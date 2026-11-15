"""Reproduce the Atlas magnetic layer from the author-published degree-134 model.

Preparation only: requires numpy and pyshtools==4.13.1; not a server dependency.
The original coefficients are verified against the hash pinned by SHTOOLS.
"""
import argparse
import gzip
import hashlib
import json
import struct
import urllib.request
from pathlib import Path
import numpy as np
import pyshtools as pysh

ROOT = Path(__file__).resolve().parents[1]
URL = 'https://zenodo.org/records/3876714/files/Langlais2019.sh.gz?download=1'
SHA256 = '3cad9e268f0673be1702f1df504a4cbcb8dba4480c7b3f629921911488fe247b'
RADIUS = 3393500.0


def pole_strength(model, altitude, south=False):
    """Exact Schmidt-harmonic limit: m=0 radial and m=1 horizontal terms.

    MakeMagGridDH sets horizontal components to zero at exact poles. That is a
    coordinate singularity, not a zero physical horizontal field. Use the
    analytic total and verify it against near-pole point synthesis instead.
    """
    n = np.arange(1, 135)
    weight = (RADIUS/(RADIUS+altitude))**(n+2)
    parity = (-1.)**n if south else np.ones_like(n)
    radial = np.sum((n+1)*weight*model.coeffs[0, 1:, 0]*parity)
    tangent = np.sqrt(n*(n+1)/2)*weight*parity
    horizontal_x = np.sum(tangent*model.coeffs[0, 1:, 1])
    horizontal_y = np.sum(tangent*model.coeffs[1, 1:, 1])
    return float(np.linalg.norm([radial, horizontal_x, horizontal_y]))


def build(source):
    if not source.exists():
        source.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(URL, timeout=60) as response:
            body = response.read(1_000_000)
        if hashlib.sha256(body).hexdigest() != SHA256:
            raise ValueError('The published coefficient checksum does not match.')
        source.write_bytes(body)
    raw = source.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == SHA256
    # Same radius, header skip, units and default Schmidt normalization as the
    # official pyshtools.datasets.Mars.Langlais2019 loader.
    model = pysh.SHMagCoeffs.from_file(str(source), lmax=134, skip=4,
                                     r0=RADIUS, header=False, file_units='nT',
                                     name='Langlais2019 (Mars)', units='nT')
    assert model.normalization == 'schmidt' and model.csphase == 1
    destination = ROOT / 'public/magnetic'
    destination.mkdir(parents=True, exist_ok=True)
    manifest = {
        'schema': 'mars-crustal-magnetism/1', 'model': 'Langlais et al. (2019)',
        'quantity': 'Magnitude of the modeled internal crustal magnetic field |B|',
        'units': 'nT', 'degree': 134, 'reference_radius_m': RADIUS,
        'effective_surface_resolution_km': 160,
        'grid': {'width': 720, 'height': 361, 'step_degrees': .5,
                 'west': -180, 'north': 90, 'east_exclusive': 180, 'south': -90,
                 'longitude': 'east-positive', 'latitude': 'planetocentric',
                 'row_order': 'north-to-south', 'encoding': 'little-endian Float32'},
        'sources': {
            'dataset': 'https://doi.org/10.5281/zenodo.3876714',
            'paper': 'https://doi.org/10.1029/2018JE005854',
            'coefficients_url': URL, 'coefficients_sha256': SHA256,
            'loader': 'https://github.com/SHTOOLS/SHTOOLS/blob/v4.13.1/pyshtools/datasets/Mars/__init__.py',
            'observations': ['MGS magnetometer', 'MGS electron reflectometer', 'MAVEN magnetometer']},
        'calculation': {'library': 'pyshtools', 'version': pysh.__version__,
                        'normalization': 'Schmidt semi-normalized', 'csphase': 1,
                        'operation': 'SHMagCoeffs.expand(a=reference_radius+altitude, f=0, lmax=179, lmax_calc=134, sampling=2, extend=True)',
                        'pole_operation': 'Exact m=0 radial and m=1 horizontal Schmidt-harmonic limits, checked against point synthesis at ±89.9999°'},
        'interpretation': 'Static model of crustal magnetism; not a live total-field measurement. Altitudes are above the model reference sphere, not local terrain. Grid sampling is finer than the resolving power of the model.',
        'layers': []}
    rng = np.random.default_rng(2019)
    for altitude in [150000, 0]:
        field = model.expand(a=RADIUS + altitude, f=0, lmax=179,
                             lmax_calc=134, sampling=2, extend=True)
        assert field.total.data.shape == (361, 721)
        assert np.allclose(field.total.lats(), np.linspace(90, -90, 361))
        assert np.allclose(field.total.lons(), np.linspace(0, 360, 721))
        assert np.allclose(field.total.data[:, 0], field.total.data[:, -1])
        for pole in [0, -1]:
            assert np.ptp(field.total.data[pole]) < 1e-7
        strength = np.roll(field.total.data[:, :-1], 360, axis=1).astype('<f4')
        pole_checks = []
        for row, south in [(0, False), (-1, True)]:
            total = pole_strength(model, altitude, south)
            near = float(np.linalg.norm(model.expand(lat=-89.9999 if south else 89.9999,
                                                     lon=0.0, r=RADIUS+altitude, lmax_calc=134)))
            assert abs(total-near) < max(.5, total*.001)
            strength[row, :] = total
            pole_checks.append({'lat': -90 if south else 90, 'analytic_nT': total,
                                'near_pole_nT': near})
        assert np.isfinite(strength).all() and (strength >= 0).all()
        checks = []
        # Independent point synthesis exercises the grid orientation, reference
        # altitude and the radial/theta/phi vector-magnitude calculation.
        # The point-synthesis routine cannot differentiate Legendre functions
        # at an exact pole. Pole totals are checked for longitude invariance above.
        for row, col in [(1, 0), (359, 400), (180, 0), (180, 360), (140, 101),
                         *[(int(rng.integers(1, 360)), int(rng.integers(720))) for _ in range(20)]]:
            lat, lon = 90-row*.5, -180+col*.5
            vector = model.expand(lat=lat, lon=lon, r=RADIUS+altitude, lmax_calc=134)
            expected = float(np.linalg.norm(vector))
            actual = float(strength[row, col])
            assert abs(actual-expected) <= max(.001, expected*1e-6), (lon, lat, actual, expected)
            checks.append({'lon': lon, 'lat': lat, 'expected_nT': expected})
        packet = struct.pack('<8sIIfffI', b'MARSB001', 720, 361, RADIUS,
                             altitude, .5, 134) + strength.tobytes()
        encoded = gzip.compress(packet, mtime=0)
        name = f'crustal-field-{altitude//1000}km.f32.gz'
        (destination/name).write_bytes(encoded)
        manifest['layers'].append({'altitude_m': altitude, 'file': name,
                                   'sha256': hashlib.sha256(encoded).hexdigest(),
                                   'packet_sha256': hashlib.sha256(packet).hexdigest(),
                                   'bytes': len(encoded), 'min_nT': float(strength.min()),
                                   'max_nT': float(strength.max()), 'verification_points': checks,
                                   'pole_verification': pole_checks})
    (destination/'model.json').write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({'model': manifest['model'], 'sha256_verified': SHA256,
                      'layers': [{k:v for k,v in x.items() if k!='verification_points'} for x in manifest['layers']]}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=ROOT/'tools/data/Langlais2019.sh.gz')
    build(parser.parse_args().source)
