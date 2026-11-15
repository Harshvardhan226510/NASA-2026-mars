"""Generate browser-ready display textures from committed Pyxis tile packets."""
import gzip
import hashlib
import io
import json
import struct
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1] / 'public' / 'prepared'


def save(pixels):
    image = Image.frombytes('LA', (512, 512), pixels).convert('RGBA')
    encoded = io.BytesIO()
    image.save(encoded, format='WEBP', quality=86, method=5, alpha_quality=100)
    payload = encoded.getvalue()
    name = f'{hashlib.sha256(payload).hexdigest()}.webp'
    (ROOT / 'tiles' / name).write_bytes(payload)
    return f'/prepared/tiles/{name}'


def main():
    index = ROOT / 'index.json'
    manifest = json.loads(index.read_text(encoding='utf-8'))
    provenance = json.loads((ROOT.parents[1] / 'src' / 'ortho-mask-provenance.json').read_text(encoding='utf-8'))
    candidates = {item['dataset_id'] for item in provenance['labels']}
    for key, entry in manifest['tiles'].items():
        packet = (ROOT / 'tiles' / Path(entry['path']).name).read_bytes()
        if packet.startswith(b'\x1f\x8b'):
            packet = gzip.decompress(packet)
        if len(packet) != 590884 or struct.unpack_from('<II', packet) != (0x4D415253, 1):
            raise ValueError(f'Invalid source packet: {key}')
        pixels = packet[32 + 129 * 129 * 4:]
        entry['webp'] = save(pixels)
        if key.split(':', 1)[0] in candidates:
            # The client chooses this variant only after checking the product's stretch and label.
            masked = bytearray(pixels)
            for i in range(0, len(masked), 2):
                if masked[i] == 0:
                    masked[i + 1] = 0
            entry['masked_webp'] = save(bytes(masked))
    index.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
