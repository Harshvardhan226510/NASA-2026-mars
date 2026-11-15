#!/usr/bin/env python3
"""
Generate high-fidelity, authentic binary glTF 2.0 (.glb) 3D models
for Martian surface scientific equipment:
1. solar_array.glb - Deployable UltraFlex dual-wing photovoltaic array with solar tracking gimbal
2. comms_mast.glb - High-gain parabolic dish & UHF mesh tactical relay tower
3. seis_station.glb - NASA InSight SEIS broadband seismometer with Wind & Thermal Shield (WTS)
4. weather_station.glb - REMS/MEDA micro-meteorological mast with dual orthogonal wind booms
"""

import struct
import json
from pathlib import Path
import numpy as np

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "apps/web/public/equipment/models"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

class GLBBuilder:
    def __init__(self):
        self.materials = []
        self.primitives = []
        self.bin_data = bytearray()
        self.accessors = []
        self.buffer_views = []

    def add_material(self, name, base_color, metallic=0.2, roughness=0.5, emissive=None):
        mat = {
            "name": name,
            "pbrMetallicRoughness": {
                "baseColorFactor": [float(c) for c in base_color],
                "metallicFactor": float(metallic),
                "roughnessFactor": float(roughness)
            }
        }
        if emissive:
            mat["emissiveFactor"] = [float(e) for e in emissive]
        self.materials.append(mat)
        return len(self.materials) - 1

    def add_primitive(self, positions, normals, indices, material_idx):
        if not positions or not indices:
            return

        pos_np = np.array(positions, dtype=np.float32)
        norm_np = np.array(normals, dtype=np.float32)
        idx_np = np.array(indices, dtype=np.uint16)

        # Align to 4 bytes
        def append_buffer(data_bytes, target):
            pad = (4 - (len(self.bin_data) % 4)) % 4
            if pad != 4 and pad != 0:
                self.bin_data.extend(b'\x00' * pad)
            byte_offset = len(self.bin_data)
            self.bin_data.extend(data_bytes)
            view_idx = len(self.buffer_views)
            self.buffer_views.append({
                "buffer": 0,
                "byteOffset": byte_offset,
                "byteLength": len(data_bytes),
                "target": target
            })
            return view_idx

        # 1. POSITION
        pos_view = append_buffer(pos_np.tobytes(), 34962)
        pos_acc = len(self.accessors)
        self.accessors.append({
            "bufferView": pos_view,
            "byteOffset": 0,
            "componentType": 5126,  # FLOAT
            "count": len(positions),
            "type": "VEC3",
            "min": pos_np.min(axis=0).tolist(),
            "max": pos_np.max(axis=0).tolist()
        })

        # 2. NORMAL
        norm_view = append_buffer(norm_np.tobytes(), 34962)
        norm_acc = len(self.accessors)
        self.accessors.append({
            "bufferView": norm_view,
            "byteOffset": 0,
            "componentType": 5126,  # FLOAT
            "count": len(normals),
            "type": "VEC3"
        })

        # 3. INDICES
        idx_view = append_buffer(idx_np.tobytes(), 34963)
        idx_acc = len(self.accessors)
        self.accessors.append({
            "bufferView": idx_view,
            "byteOffset": 0,
            "componentType": 5123,  # UNSIGNED_SHORT
            "count": len(indices),
            "type": "SCALAR"
        })

        self.primitives.append({
            "attributes": {
                "POSITION": pos_acc,
                "NORMAL": norm_acc
            },
            "indices": idx_acc,
            "material": material_idx
        })

    def build(self):
        # 4-byte pad final buffer
        pad = (4 - (len(self.bin_data) % 4)) % 4
        if pad != 4 and pad != 0:
            self.bin_data.extend(b'\x00' * pad)

        gltf = {
            "asset": {"version": "2.0", "generator": "MarsFieldAtlas High-Fidelity Equipment Engine"},
            "scene": 0,
            "scenes": [{"nodes": [0]}],
            "nodes": [{"mesh": 0, "name": "EquipmentRoot"}],
            "materials": self.materials,
            "meshes": [{
                "name": "EquipmentMesh",
                "primitives": self.primitives
            }],
            "buffers": [{"byteLength": len(self.bin_data)}],
            "bufferViews": self.buffer_views,
            "accessors": self.accessors
        }

        json_bytes = json.dumps(gltf, separators=(',', ':')).encode('utf-8')
        pad_json = (4 - (len(json_bytes) % 4)) % 4
        if pad_json != 4 and pad_json != 0:
            json_bytes += b' ' * pad_json

        total_length = 12 + 8 + len(json_bytes) + 8 + len(self.bin_data)

        header = struct.pack('<4sII', b'glTF', 2, total_length)
        chunk0_hdr = struct.pack('<II', len(json_bytes), 0x4E4F534A)  # 'JSON'
        chunk1_hdr = struct.pack('<II', len(self.bin_data), 0x004E4942)  # 'BIN\0'

        return header + chunk0_hdr + json_bytes + chunk1_hdr + bytes(self.bin_data)

# --- Geometry Helper Functions ---

def create_box_mesh(min_pt, max_pt):
    x0, y0, z0 = min_pt
    x1, y1, z1 = max_pt
    faces = [
        ([0, 1, 0], [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]]),  # +Y (Top)
        ([0, -1, 0], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]]), # -Y (Bottom)
        ([0, 0, 1], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]),  # +Z (Front)
        ([0, 0, -1], [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]]), # -Z (Back)
        ([1, 0, 0], [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]]),  # +X (Right)
        ([-1, 0, 0], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]]), # -X (Left)
    ]
    positions, normals, indices = [], [], []
    for norm, verts in faces:
        base = len(positions)
        for v in verts:
            positions.append(v)
            normals.append(norm)
        indices.extend([base, base + 1, base + 2, base, base + 2, base + 3])
    return positions, normals, indices

def create_cylinder_mesh(center_bottom, radius, height, segments=24):
    cx, cy, cz = center_bottom
    positions, normals, indices = [], [], []
    
    # Bottom center
    bc_idx = len(positions)
    positions.append([cx, cy, cz])
    normals.append([0, -1, 0])
    
    # Top center
    tc_idx = len(positions)
    positions.append([cx, cy + height, cz])
    normals.append([0, 1, 0])
    
    angle_step = 2 * np.pi / segments
    for i in range(segments):
        a = i * angle_step
        x = cx + radius * np.cos(a)
        z = cz + radius * np.sin(a)
        norm = [float(np.cos(a)), 0.0, float(np.sin(a))]
        positions.append([x, cy, z])
        normals.append(norm)
        positions.append([x, cy + height, z])
        normals.append(norm)
        
    ring_start = 2
    for i in range(segments):
        next_i = (i + 1) % segments
        b0 = ring_start + i * 2
        t0 = ring_start + i * 2 + 1
        b1 = ring_start + next_i * 2
        t1 = ring_start + next_i * 2 + 1
        indices.extend([b0, b1, t1, b0, t1, t0])
        indices.extend([bc_idx, b1, b0])
        indices.extend([tc_idx, t0, t1])
        
    return positions, normals, indices

def create_oriented_cylinder(p0, p1, radius, segments=16):
    """Creates a cylinder between arbitrary 3D endpoints p0 and p1."""
    p0 = np.array(p0, dtype=float)
    p1 = np.array(p1, dtype=float)
    v = p1 - p0
    length = np.linalg.norm(v)
    if length < 1e-6:
        return [], [], []
    u = v / length
    
    if abs(u[1]) < 0.9:
        ref = np.array([0.0, 1.0, 0.0])
    else:
        ref = np.array([1.0, 0.0, 0.0])
    r = np.cross(u, ref)
    r = r / np.linalg.norm(r)
    w = np.cross(u, r)
    
    positions, normals, indices = [], [], []
    
    bc_idx = 0
    positions.append(p0.tolist())
    normals.append((-u).tolist())
    
    tc_idx = 1
    positions.append(p1.tolist())
    normals.append(u.tolist())
    
    angle_step = 2 * np.pi / segments
    for i in range(segments):
        a = i * angle_step
        radial = float(np.cos(a)) * r + float(np.sin(a)) * w
        pos_b = p0 + radius * radial
        pos_t = p1 + radius * radial
        norm = radial.tolist()
        positions.append(pos_b.tolist())
        normals.append(norm)
        positions.append(pos_t.tolist())
        normals.append(norm)
        
    ring_start = 2
    for i in range(segments):
        next_i = (i + 1) % segments
        b0 = ring_start + i * 2
        t0 = ring_start + i * 2 + 1
        b1 = ring_start + next_i * 2
        t1 = ring_start + next_i * 2 + 1
        indices.extend([b0, b1, t1, b0, t1, t0])
        indices.extend([bc_idx, b1, b0])
        indices.extend([tc_idx, t0, t1])
        
    return positions, normals, indices

def create_truncated_cone(center_bottom, r_bottom, r_top, height, segments=24):
    cx, cy, cz = center_bottom
    positions, normals, indices = [], [], []
    
    bc_idx = len(positions)
    positions.append([cx, cy, cz])
    normals.append([0, -1, 0])
    
    tc_idx = len(positions)
    positions.append([cx, cy + height, cz])
    normals.append([0, 1, 0])
    
    angle_step = 2 * np.pi / segments
    slant = np.arctan2(r_bottom - r_top, height)
    cos_s = np.cos(slant)
    sin_s = np.sin(slant)
    
    for i in range(segments):
        a = i * angle_step
        norm = [float(np.cos(a) * cos_s), float(sin_s), float(np.sin(a) * cos_s)]
        positions.append([cx + r_bottom * np.cos(a), cy, cz + r_bottom * np.sin(a)])
        normals.append(norm)
        positions.append([cx + r_top * np.cos(a), cy + height, cz + r_top * np.sin(a)])
        normals.append(norm)
        
    ring_start = 2
    for i in range(segments):
        next_i = (i + 1) % segments
        b0 = ring_start + i * 2
        t0 = ring_start + i * 2 + 1
        b1 = ring_start + next_i * 2
        t1 = ring_start + next_i * 2 + 1
        indices.extend([b0, b1, t1, b0, t1, t0])
        indices.extend([bc_idx, b1, b0])
        indices.extend([tc_idx, t0, t1])
        
    return positions, normals, indices

def create_parabolic_dish(center, radius, depth, segments=32, rings=8):
    cx, cy, cz = center
    positions, normals, indices = [], [], []
    
    grid = []
    for r_idx in range(rings + 1):
        r_frac = r_idx / rings
        cur_r = radius * r_frac
        cur_y = cy + depth * (r_frac ** 2)
        ring_verts = []
        for s_idx in range(segments):
            a = s_idx * 2 * np.pi / segments
            x = cx + cur_r * np.cos(a)
            z = cz + cur_r * np.sin(a)
            # Normal calculation for paraboloid y = k * r^2
            slope = 2 * depth * r_frac / max(1e-4, radius)
            norm_r = -np.sin(np.arctan(slope))
            norm_y = np.cos(np.arctan(slope))
            norm = [float(norm_r * np.cos(a)), float(norm_y), float(norm_r * np.sin(a))]
            v_idx = len(positions)
            positions.append([x, cur_y, z])
            normals.append(norm)
            ring_verts.append(v_idx)
        grid.append(ring_verts)
        
    for r_idx in range(rings):
        for s_idx in range(segments):
            next_s = (s_idx + 1) % segments
            v00 = grid[r_idx][s_idx]
            v01 = grid[r_idx][next_s]
            v10 = grid[r_idx + 1][s_idx]
            v11 = grid[r_idx + 1][next_s]
            # Front face (convex dish interior)
            indices.extend([v00, v10, v11, v00, v11, v01])
            # Back face (concave dish exterior)
            indices.extend([v00, v11, v10, v00, v01, v11])
            
    return positions, normals, indices

def merge_mesh_parts(parts):
    all_p, all_n, all_i = [], [], []
    for p, n, idxs in parts:
        base = len(all_p)
        all_p.extend(p)
        all_n.extend(n)
        all_i.extend([i + base for i in idxs])
    return all_p, all_n, all_i

# --- Specific Equipment Model Generators ---

def generate_ultraflex_solar_array():
    """Deployable UltraFlex Dual-Wing Circular Solar Array"""
    builder = GLBBuilder()
    
    # Materials
    m_chassis = builder.add_material("TitaniumChassis", [0.22, 0.24, 0.27, 1.0], metallic=0.7, roughness=0.3)
    m_gold_foil = builder.add_material("GoldThermalFoil", [0.95, 0.78, 0.22, 1.0], metallic=0.85, roughness=0.25)
    m_solar_cells = builder.add_material("TripleJunctionPV", [0.06, 0.14, 0.38, 1.0], metallic=0.4, roughness=0.15)
    m_mast_strut = builder.add_material("CarbonComposite", [0.35, 0.38, 0.42, 1.0], metallic=0.5, roughness=0.4)
    m_status_led = builder.add_material("PowerGreenLED", [0.1, 1.0, 0.4, 1.0], metallic=0.1, roughness=0.2, emissive=[0.1, 1.0, 0.4])
    
    # 1. Base lander platform & 3 stabilizing outriggers (Chassis)
    chassis_parts = []
    chassis_parts.append(create_cylinder_mesh([0, 0.0, 0], 0.75, 0.2, segments=8))
    # 3 tripod landing legs
    for angle in [0, 2 * np.pi / 3, 4 * np.pi / 3]:
        lx = 1.1 * np.cos(angle)
        lz = 1.1 * np.sin(angle)
        chassis_parts.append(create_box_mesh([lx - 0.15, 0.0, lz - 0.15], [lx + 0.15, 0.08, lz + 0.15]))
        # Strut to center
        chassis_parts.append(create_cylinder_mesh([0.4 * np.cos(angle), 0.1, 0.4 * np.sin(angle)], 0.04, 0.3, segments=8))
    p, n, i = merge_mesh_parts(chassis_parts)
    builder.add_primitive(p, n, i, m_chassis)
    
    # 2. Central Avionics Box wrapped in Gold Thermal Foil
    gold_parts = []
    gold_parts.append(create_box_mesh([-0.35, 0.2, -0.35], [0.35, 0.65, 0.35]))
    p, n, i = merge_mesh_parts(gold_parts)
    builder.add_primitive(p, n, i, m_gold_foil)
    
    # 3. Mast, Gimbal Pivot & Crossbeam
    mast_parts = []
    mast_parts.append(create_cylinder_mesh([0, 0.65, 0], 0.08, 0.85, segments=16)) # Central mast
    mast_parts.append(create_box_mesh([-0.18, 1.45, -0.15], [0.18, 1.62, 0.15])) # Gimbal head
    mast_parts.append(create_oriented_cylinder([-1.8, 1.52, 0.0], [1.8, 1.52, 0.0], 0.045, segments=12)) # Left-right boom
    p, n, i = merge_mesh_parts(mast_parts)
    builder.add_primitive(p, n, i, m_mast_strut)
    
    # 4. UltraFlex Circular Fan Wings (Left & Right)
    solar_parts = []
    # Left Wing: Circle of radius 1.35m at x = -1.8, y = 1.52, facing south-up (+Y/+Z tilted 30 deg)
    def create_ultraflex_disc(center_x, center_y, center_z, radius, tilt_deg=25, segments=24):
        p_disc, n_disc, i_disc = [], [], []
        c_idx = 0
        p_disc.append([center_x, center_y, center_z])
        tilt_rad = np.radians(tilt_deg)
        norm = [0.0, float(np.cos(tilt_rad)), float(np.sin(tilt_rad))]
        n_disc.append(norm)
        
        for s in range(segments):
            a = s * 2 * np.pi / segments
            rx = radius * np.cos(a)
            rz = radius * np.sin(a)
            # Tilt around X axis
            y_off = -rz * np.sin(tilt_rad)
            z_off = rz * np.cos(tilt_rad)
            p_disc.append([center_x + rx, center_y + y_off, center_z + z_off])
            n_disc.append(norm)
            
        for s in range(segments):
            s_next = (s + 1) % segments
            # Two-sided rendering
            i_disc.extend([c_idx, s + 1, s_next + 1])
            i_disc.extend([c_idx, s_next + 1, s + 1])
            
        return p_disc, n_disc, i_disc

    solar_parts.append(create_ultraflex_disc(-1.75, 1.55, 0.0, 1.35, tilt_deg=28, segments=28))
    solar_parts.append(create_ultraflex_disc(1.75, 1.55, 0.0, 1.35, tilt_deg=28, segments=28))
    p, n, i = merge_mesh_parts(solar_parts)
    builder.add_primitive(p, n, i, m_solar_cells)
    
    # 5. Status Power LED Beacon
    led_parts = []
    led_parts.append(create_cylinder_mesh([0, 1.62, 0], 0.05, 0.1, segments=12))
    p, n, i = merge_mesh_parts(led_parts)
    builder.add_primitive(p, n, i, m_status_led)
    
    return builder.build()

def generate_comms_relay():
    """High-Gain Parabolic Dish & UHF Tactical Relay Mast"""
    builder = GLBBuilder()
    
    # Materials
    m_tower_steel = builder.add_material("SteelTruss", [0.72, 0.75, 0.78, 1.0], metallic=0.8, roughness=0.3)
    m_dish_reflector = builder.add_material("ThermalWhiteDish", [0.94, 0.95, 0.96, 1.0], metallic=0.2, roughness=0.2)
    m_gold_feed = builder.add_material("GoldFeedHorn", [0.95, 0.78, 0.22, 1.0], metallic=0.9, roughness=0.2)
    m_avionics = builder.add_material("TacticalBaseBox", [0.18, 0.20, 0.24, 1.0], metallic=0.5, roughness=0.5)
    m_beacon_cyan = builder.add_material("CommsBeaconCyan", [0.0, 0.85, 1.0, 1.0], metallic=0.1, roughness=0.2, emissive=[0.0, 0.85, 1.0])
    
    # 1. Base avionics shelter & ground plate
    base_parts = []
    base_parts.append(create_cylinder_mesh([0, 0.0, 0], 1.1, 0.15, segments=12)) # Base ring
    base_parts.append(create_box_mesh([-0.45, 0.15, -0.45], [0.45, 0.85, 0.45])) # Transceiver shelter
    # Cooling heat-sink fins
    for z in [-0.35, -0.15, 0.05, 0.25]:
        base_parts.append(create_box_mesh([0.45, 0.25, z], [0.55, 0.75, z + 0.06]))
    p, n, i = merge_mesh_parts(base_parts)
    builder.add_primitive(p, n, i, m_avionics)
    
    # 2. Triangular Lattice Tower (3 legs + crossbraces rising to 3.8m)
    tower_parts = []
    h_tower = 3.6
    for angle in [0, 2 * np.pi / 3, 4 * np.pi / 3]:
        x = 0.35 * np.cos(angle)
        z = 0.35 * np.sin(angle)
        tower_parts.append(create_cylinder_mesh([x, 0.85, z], 0.04, h_tower - 0.85, segments=8))
    # Bracing rings
    for y_ring in [1.3, 1.9, 2.5, 3.1]:
        tower_parts.append(create_cylinder_mesh([0, y_ring, 0], 0.38, 0.04, segments=12))
    p, n, i = merge_mesh_parts(tower_parts)
    builder.add_primitive(p, n, i, m_tower_steel)
    
    # 3. High-Gain Parabolic Dish (Diameter 1.8m, depth 0.28m, angled up at 40 deg)
    dish_parts = []
    dish_parts.append(create_parabolic_dish([0, 3.2, 0.35], radius=0.95, depth=0.25, segments=32, rings=8))
    # Outer dish rim flange
    dish_parts.append(create_cylinder_mesh([0, 3.42, 0.35], 0.96, 0.04, segments=32))
    p, n, i = merge_mesh_parts(dish_parts)
    builder.add_primitive(p, n, i, m_dish_reflector)
    
    # 4. Gold Sub-Reflector Feed Horn
    feed_parts = []
    feed_parts.append(create_cylinder_mesh([0, 3.32, 0.72], 0.12, 0.18, segments=16)) # Horn
    # 3 tripod struts supporting horn
    for a in [np.pi / 2, 7 * np.pi / 6, 11 * np.pi / 6]:
        feed_parts.append(create_oriented_cylinder([0.45 * np.cos(a), 3.25, 0.35 + 0.45 * np.sin(a)], [0, 3.32, 0.72], 0.015, segments=8))
    p, n, i = merge_mesh_parts(feed_parts)
    builder.add_primitive(p, n, i, m_gold_feed)
    
    # 5. Top UHF Whip Antenna & Cyan Telemetry Beacon
    beacon_parts = []
    beacon_parts.append(create_cylinder_mesh([0, 3.6, 0], 0.02, 0.7, segments=8)) # Whip mast
    beacon_parts.append(create_cylinder_mesh([0, 4.3, 0], 0.06, 0.12, segments=12)) # Blinking beacon
    p, n, i = merge_mesh_parts(beacon_parts)
    builder.add_primitive(p, n, i, m_beacon_cyan)
    
    return builder.build()

def generate_seis_station():
    """NASA InSight SEIS Seismometer with Wind & Thermal Shield (WTS) Dome"""
    builder = GLBBuilder()
    
    # Materials
    m_gold_wts = builder.add_material("GoldThermalShield", [0.92, 0.72, 0.20, 1.0], metallic=0.9, roughness=0.22)
    m_copper_skirt = builder.add_material("CopperSkirt", [0.85, 0.48, 0.25, 1.0], metallic=0.75, roughness=0.35)
    m_cradle_metal = builder.add_material("LevelingCradleTitanium", [0.35, 0.38, 0.42, 1.0], metallic=0.7, roughness=0.4)
    m_ebox = builder.add_material("AcquisitionEBox", [0.20, 0.22, 0.25, 1.0], metallic=0.4, roughness=0.6)
    m_amber_indicator = builder.add_material("SeismicActiveAmber", [1.0, 0.75, 0.1, 1.0], metallic=0.1, roughness=0.2, emissive=[1.0, 0.75, 0.1])
    
    # 1. Lower Aerodynamic WTS Cone & Upper Dome (Gold MLI Thermal Shield)
    dome_parts = []
    # Tier 1: Truncated conical base (r_bottom = 0.9m, r_top = 0.75m, height = 0.28m)
    dome_parts.append(create_truncated_cone([0, 0.12, 0], 0.95, 0.78, 0.28, segments=32))
    # Tier 2: Upper smooth dome (r_bottom = 0.78m, r_top = 0.45m, height = 0.25m)
    dome_parts.append(create_truncated_cone([0, 0.40, 0], 0.78, 0.45, 0.25, segments=32))
    # Tier 3: Top cap (r = 0.45m, height = 0.12m)
    dome_parts.append(create_truncated_cone([0, 0.65, 0], 0.45, 0.15, 0.12, segments=24))
    # Top Grapple Handle Fixture (Sphere + stem used by InSight IDA robotic arm)
    dome_parts.append(create_cylinder_mesh([0, 0.77, 0], 0.035, 0.18, segments=12))
    dome_parts.append(create_cylinder_mesh([0, 0.92, 0], 0.09, 0.08, segments=16)) # Grapple ball
    p, n, i = merge_mesh_parts(dome_parts)
    builder.add_primitive(p, n, i, m_gold_wts)
    
    # 2. Copper Ground-Hugging Thermal Skirt (rests on regolith)
    skirt_parts = []
    skirt_parts.append(create_truncated_cone([0, 0.0, 0], 1.15, 0.95, 0.12, segments=32))
    p, n, i = merge_mesh_parts(skirt_parts)
    builder.add_primitive(p, n, i, m_copper_skirt)
    
    # 3. Motorized Leveling Cradle (3 feet extending past skirt)
    cradle_parts = []
    for angle in [0, 2 * np.pi / 3, 4 * np.pi / 3]:
        fx = 1.08 * np.cos(angle)
        fz = 1.08 * np.sin(angle)
        cradle_parts.append(create_cylinder_mesh([fx, 0.0, fz], 0.07, 0.22, segments=12)) # Foot jack
        cradle_parts.append(create_cylinder_mesh([fx, 0.0, fz], 0.12, 0.03, segments=12)) # Conical pad
    p, n, i = merge_mesh_parts(cradle_parts)
    builder.add_primitive(p, n, i, m_cradle_metal)
    
    # 4. Umbilical Ribbon Cable & Sensor E-Box
    ebox_parts = []
    # E-Box situated 1.2m away
    ebox_parts.append(create_box_mesh([1.05, 0.0, -0.3], [1.65, 0.32, 0.3]))
    # Umbilical cable bridge
    ebox_parts.append(create_box_mesh([0.7, 0.06, -0.05], [1.05, 0.12, 0.05]))
    p, n, i = merge_mesh_parts(ebox_parts)
    builder.add_primitive(p, n, i, m_ebox)
    
    # 5. Seismic Trigger Active Indicator LED
    led_parts = []
    led_parts.append(create_cylinder_mesh([1.35, 0.32, 0], 0.04, 0.06, segments=12))
    p, n, i = merge_mesh_parts(led_parts)
    builder.add_primitive(p, n, i, m_amber_indicator)
    
    return builder.build()

def generate_weather_station():
    """REMS/MEDA Micro-Meteorological Surface Station"""
    builder = GLBBuilder()
    
    # Materials
    m_mast_titanium = builder.add_material("MastTitanium", [0.82, 0.84, 0.86, 1.0], metallic=0.8, roughness=0.25)
    m_sensor_blue = builder.add_material("AnodizedCobaltBlue", [0.12, 0.45, 0.85, 1.0], metallic=0.6, roughness=0.35)
    m_gold_sensor = builder.add_material("UVSensorGold", [0.95, 0.78, 0.22, 1.0], metallic=0.9, roughness=0.2)
    m_base_housing = builder.add_material("AvionicsHousing", [0.22, 0.24, 0.28, 1.0], metallic=0.5, roughness=0.45)
    m_indicator_green = builder.add_material("WeatherOnlineGreen", [0.15, 0.95, 0.45, 1.0], metallic=0.1, roughness=0.2, emissive=[0.15, 0.95, 0.45])
    
    # 1. Ground tripod pedestal & barometric pressure avionics box
    base_parts = []
    base_parts.append(create_cylinder_mesh([0, 0.04, 0], 0.32, 0.28, segments=16)) # Central base hub
    base_parts.append(create_box_mesh([-0.25, 0.08, -0.25], [0.25, 0.52, 0.25])) # Avionics enclosure
    # 3 Sturdy Tripod Legs spreading out from hub to ground
    tripod_radius = 0.85
    for a in [0, 2 * np.pi / 3, 4 * np.pi / 3]:
        foot_x = tripod_radius * np.cos(a)
        foot_z = tripod_radius * np.sin(a)
        # Leg tube extending from [0, 0.32, 0] down to [foot_x, 0.03, foot_z]
        base_parts.append(create_oriented_cylinder([0, 0.32, 0], [foot_x, 0.03, foot_z], 0.035, segments=12))
        # Ground footpad plate
        base_parts.append(create_cylinder_mesh([foot_x, 0.0, foot_z], 0.12, 0.03, segments=12))
        # Stabilizer strut from mid-leg to mast collar
        base_parts.append(create_oriented_cylinder([foot_x * 0.65, 0.10, foot_z * 0.65], [0, 0.75, 0], 0.018, segments=8))
        
    p, n, i = merge_mesh_parts(base_parts)
    builder.add_primitive(p, n, i, m_base_housing)
    
    # 2. Main Vertical Meteorological Mast (Titanium alloy tube, h = 2.6m)
    mast_parts = []
    mast_parts.append(create_cylinder_mesh([0, 0.32, 0], 0.055, 2.38, segments=16)) # Central mast
    # Mounting collars at boom junctions
    mast_parts.append(create_cylinder_mesh([0, 1.65, 0], 0.085, 0.08, segments=16))
    mast_parts.append(create_cylinder_mesh([0, 2.15, 0], 0.085, 0.08, segments=16))
    p, n, i = merge_mesh_parts(mast_parts)
    builder.add_primitive(p, n, i, m_mast_titanium)
    
    # 3. Dual Orthogonal Wind & Temperature Sensor Booms (NASA REMS / MEDA style)
    boom_parts = []
    # Boom 1 (Lower boom: height 1.70m, length 0.65m pointing East +X)
    boom_parts.append(create_oriented_cylinder([0.05, 1.70, 0.0], [0.70, 1.70, 0.0], 0.022, segments=12))
    # Sensor head at tip of Boom 1 (vertical cylinder transducer)
    boom_parts.append(create_cylinder_mesh([0.70, 1.62, 0.0], 0.045, 0.16, segments=16))
    for pin_a in [0, np.pi/2, np.pi, 3*np.pi/2]:
        px = 0.70 + 0.038 * np.cos(pin_a)
        pz = 0.038 * np.sin(pin_a)
        boom_parts.append(create_cylinder_mesh([px, 1.72, pz], 0.008, 0.06, segments=6))
        
    # Boom 2 (Upper boom: height 2.20m, length 0.65m pointing North-West, 120 degrees offset)
    a2 = 2 * np.pi / 3
    bx = 0.70 * np.cos(a2)
    bz = 0.70 * np.sin(a2)
    boom_parts.append(create_oriented_cylinder([0.05 * np.cos(a2), 2.20, 0.05 * np.sin(a2)], [bx, 2.20, bz], 0.022, segments=12))
    # Sensor head at tip of Boom 2
    boom_parts.append(create_cylinder_mesh([bx, 2.12, bz], 0.045, 0.16, segments=16))
    for pin_a in [0, np.pi/2, np.pi, 3*np.pi/2]:
        px = bx + 0.038 * np.cos(pin_a)
        pz = bz + 0.038 * np.sin(pin_a)
        boom_parts.append(create_cylinder_mesh([px, 2.22, pz], 0.008, 0.06, segments=6))
        
    p, n, i = merge_mesh_parts(boom_parts)
    builder.add_primitive(p, n, i, m_sensor_blue)
    
    # 4. Top Solar UV Radiation Sensor Ring (Photodiode carousel at mast peak)
    uv_parts = []
    uv_parts.append(create_cylinder_mesh([0, 2.70, 0], 0.20, 0.06, segments=24))
    for s in range(6):
        a_uv = s * 2 * np.pi / 6
        uv_parts.append(create_cylinder_mesh([0.13 * np.cos(a_uv), 2.76, 0.13 * np.sin(a_uv)], 0.025, 0.03, segments=8))
    p, n, i = merge_mesh_parts(uv_parts)
    builder.add_primitive(p, n, i, m_gold_sensor)
    
    # 5. Top Telemetry Whip & Green Status LED
    led_parts = []
    led_parts.append(create_cylinder_mesh([0, 2.76, 0], 0.012, 0.35, segments=8))
    led_parts.append(create_cylinder_mesh([0, 3.11, 0], 0.035, 0.06, segments=12))
    p, n, i = merge_mesh_parts(led_parts)
    builder.add_primitive(p, n, i, m_indicator_green)
    
    return builder.build()

def generate_crew_hab():
    """NASA DRA 5.0 Two-Deck Pressurized Crew Habitat Core (Mars Hab)"""
    builder = GLBBuilder()
    
    m_hab_shell = builder.add_material("MicrometeoroidShellWhite", [0.92, 0.93, 0.95, 1.0], metallic=0.15, roughness=0.3)
    m_airlock_titanium = builder.add_material("AirlockVestibuleNavy", [0.15, 0.22, 0.32, 1.0], metallic=0.75, roughness=0.35)
    m_gold_foil = builder.add_material("ECLSSGoldFoil", [0.95, 0.78, 0.22, 1.0], metallic=0.85, roughness=0.25)
    m_trim_yellow = builder.add_material("TacticalAirlockTrim", [0.85, 0.65, 0.15, 1.0], metallic=0.4, roughness=0.4)
    m_cyan_light = builder.add_material("HabAirlockStatusCyan", [0.2, 0.85, 1.0, 1.0], metallic=0.1, roughness=0.2, emissive=[0.2, 0.85, 1.0])
    
    # 1. Main Habitation Cylinder (Diameter 7.6m, Height 5.2m)
    hab_parts = []
    hab_parts.append(create_cylinder_mesh([0, 0.35, 0], 3.8, 4.6, segments=36))
    # Upper deck dome transition
    hab_parts.append(create_truncated_cone([0, 4.95, 0], 3.8, 2.0, 1.1, segments=32))
    # Top docking collar / cupola
    hab_parts.append(create_cylinder_mesh([0, 6.05, 0], 1.6, 0.45, segments=24))
    # 4 Heavy landing outriggers with footpads
    for angle in [np.pi/4, 3*np.pi/4, 5*np.pi/4, 7*np.pi/4]:
        px = 4.3 * np.cos(angle)
        pz = 4.3 * np.sin(angle)
        hab_parts.append(create_cylinder_mesh([px, 0.0, pz], 0.35, 0.12, segments=12)) # Footpad
        hab_parts.append(create_cylinder_mesh([3.2 * np.cos(angle), 0.1, 3.2 * np.sin(angle)], 0.12, 1.2, segments=8)) # Strut
    p, n, i = merge_mesh_parts(hab_parts)
    builder.add_primitive(p, n, i, m_hab_shell)
    
    # 2. Forward Airlock Vestibule & EVA Porch (Facing +Z)
    airlock_parts = []
    # Vestibule box protruding from hull
    airlock_parts.append(create_box_mesh([-1.2, 0.35, 3.2], [1.2, 2.7, 4.8]))
    # EVA Staging Porch & stairs down to regolith
    airlock_parts.append(create_box_mesh([-1.6, 0.0, 4.8], [1.6, 0.35, 6.2]))
    # Handrails
    airlock_parts.append(create_box_mesh([-1.55, 0.35, 4.8], [-1.45, 1.35, 6.15]))
    airlock_parts.append(create_box_mesh([1.45, 0.35, 4.8], [1.55, 1.35, 6.15]))
    p, n, i = merge_mesh_parts(airlock_parts)
    builder.add_primitive(p, n, i, m_airlock_titanium)
    
    # 3. Gold Thermal Insulation Panels (ECLSS Life-Support radiators on rear -Z)
    foil_parts = []
    foil_parts.append(create_box_mesh([-2.2, 1.2, -4.05], [2.2, 4.5, -3.85]))
    p, n, i = merge_mesh_parts(foil_parts)
    builder.add_primitive(p, n, i, m_gold_foil)
    
    # 4. Airlock Door Hatch Frame (Tactical Yellow)
    trim_parts = []
    trim_parts.append(create_box_mesh([-0.75, 0.5, 4.81], [0.75, 2.3, 4.88]))
    p, n, i = merge_mesh_parts(trim_parts)
    builder.add_primitive(p, n, i, m_trim_yellow)
    
    # 5. Pressurization Status Beacon (Cyan LED above airlock)
    led_parts = []
    led_parts.append(create_cylinder_mesh([0, 2.5, 4.9], 0.08, 0.12, segments=12))
    p, n, i = merge_mesh_parts(led_parts)
    builder.add_primitive(p, n, i, m_cyan_light)
    
    return builder.build()

def generate_greenhouse_dome():
    """Hydroponic Agricultural Greenhouse Biodome"""
    builder = GLBBuilder()
    
    m_dome_frame = builder.add_material("TitaniumRibsFrame", [0.72, 0.76, 0.80, 1.0], metallic=0.75, roughness=0.3)
    m_polycarb = builder.add_material("GreenhouseGlassBotanical", [0.22, 0.65, 0.42, 0.85], metallic=0.1, roughness=0.15, emissive=[0.12, 0.42, 0.22])
    m_foundation = builder.add_material("FoundationBerm", [0.22, 0.24, 0.26, 1.0], metallic=0.4, roughness=0.6)
    m_crops = builder.add_material("AeroponicCropsFoliage", [0.18, 0.75, 0.22, 1.0], metallic=0.1, roughness=0.7)
    
    # 1. Reinforced foundation berm
    berm_parts = []
    berm_parts.append(create_cylinder_mesh([0, 0.0, 0], 4.4, 0.55, segments=32))
    # Connector airlock tunnel to main hub (-X)
    berm_parts.append(create_box_mesh([-5.2, 0.0, -0.9], [-4.0, 2.1, 0.9]))
    p, n, i = merge_mesh_parts(berm_parts)
    builder.add_primitive(p, n, i, m_foundation)
    
    # 2. Translucent Polycarbonate Geodesic Dome (Multi-tiered greenhouse dome)
    glass_parts = []
    glass_parts.append(create_truncated_cone([0, 0.55, 0], 4.3, 3.8, 1.4, segments=32))
    glass_parts.append(create_truncated_cone([0, 1.95, 0], 3.8, 2.8, 1.3, segments=32))
    glass_parts.append(create_truncated_cone([0, 3.25, 0], 2.8, 1.2, 1.0, segments=24))
    glass_parts.append(create_cylinder_mesh([0, 4.25, 0], 1.2, 0.15, segments=24))
    p, n, i = merge_mesh_parts(glass_parts)
    builder.add_primitive(p, n, i, m_polycarb)
    
    # 3. Geodesic Structural Arch Ribs
    rib_parts = []
    for s in range(8):
        angle = s * np.pi / 4
        rx = 4.35 * np.cos(angle)
        rz = 4.35 * np.sin(angle)
        rib_parts.append(create_cylinder_mesh([rx, 0.55, rz], 0.06, 3.6, segments=8))
    # Horizontal rib belts
    rib_parts.append(create_cylinder_mesh([0, 1.95, 0], 3.84, 0.06, segments=32))
    rib_parts.append(create_cylinder_mesh([0, 3.25, 0], 2.84, 0.06, segments=24))
    p, n, i = merge_mesh_parts(rib_parts)
    builder.add_primitive(p, n, i, m_dome_frame)
    
    # 4. Interior Aeroponic Crop Columns
    crop_parts = []
    for angle in [0, np.pi/3, 2*np.pi/3, np.pi, 4*np.pi/3, 5*np.pi/3]:
        cx = 2.2 * np.cos(angle)
        cz = 2.2 * np.sin(angle)
        crop_parts.append(create_cylinder_mesh([cx, 0.55, cz], 0.35, 2.4, segments=12))
    p, n, i = merge_mesh_parts(crop_parts)
    builder.add_primitive(p, n, i, m_crops)
    
    return builder.build()

def generate_nuclear_reactor():
    """NASA Kilopower 40 kWe Stirling Surface Fission Plant"""
    builder = GLBBuilder()
    
    m_reactor_core = builder.add_material("BerylliumFissionCore", [0.35, 0.38, 0.42, 1.0], metallic=0.85, roughness=0.25)
    m_stirling = builder.add_material("StirlingConvertersCopper", [0.72, 0.45, 0.22, 1.0], metallic=0.9, roughness=0.2)
    m_radiator_fins = builder.add_material("TitaniumPotassiumRadiator", [0.88, 0.90, 0.92, 1.0], metallic=0.7, roughness=0.3)
    m_radiation_shield = builder.add_material("TungstenShadowShield", [0.18, 0.20, 0.22, 1.0], metallic=0.6, roughness=0.5)
    m_amber_beacon = builder.add_material("NuclearOperationalAmber", [1.0, 0.65, 0.05, 1.0], metallic=0.1, roughness=0.2, emissive=[1.0, 0.65, 0.05])
    
    # 1. Base Emplacement & Heavy Radiation Shadow Shield (protects surface base from direct gamma/neutrons)
    shield_parts = []
    shield_parts.append(create_truncated_cone([0, 0.0, 0], 1.8, 1.4, 0.75, segments=24))
    # 3 Ground stabilizers
    for a in [0, 2*np.pi/3, 4*np.pi/3]:
        shield_parts.append(create_cylinder_mesh([1.6 * np.cos(a), 0.0, 1.6 * np.sin(a)], 0.15, 0.3, segments=8))
    p, n, i = merge_mesh_parts(shield_parts)
    builder.add_primitive(p, n, i, m_radiation_shield)
    
    # 2. Enriched U-235 Reactor Core & Beryllium Reflector Drum
    core_parts = []
    core_parts.append(create_cylinder_mesh([0, 0.75, 0], 0.75, 1.2, segments=20))
    p, n, i = merge_mesh_parts(core_parts)
    builder.add_primitive(p, n, i, m_reactor_core)
    
    # 3. Ring of 8 Stirling Power Engines (Heat-pipe to electrical power converters)
    stirling_parts = []
    for s in range(8):
        angle = s * 2 * np.pi / 8
        sx = 0.85 * np.cos(angle)
        sz = 0.85 * np.sin(angle)
        stirling_parts.append(create_cylinder_mesh([sx, 1.95, sz], 0.14, 0.65, segments=12))
    p, n, i = merge_mesh_parts(stirling_parts)
    builder.add_primitive(p, n, i, m_stirling)
    
    # 4. Giant Deployable Umbrella Heat-Pipe Radiators (Expands upward to reject waste heat)
    rad_parts = []
    rad_parts.append(create_truncated_cone([0, 2.6, 0], 0.85, 3.6, 2.6, segments=32))
    # Central radiator support column
    rad_parts.append(create_cylinder_mesh([0, 2.6, 0], 0.18, 3.1, segments=16))
    p, n, i = merge_mesh_parts(rad_parts)
    builder.add_primitive(p, n, i, m_radiator_fins)
    
    # 5. Top Crane Grapple Point & Amber Nuclear Hazard Beacon
    beacon_parts = []
    beacon_parts.append(create_cylinder_mesh([0, 5.7, 0], 0.08, 0.22, segments=12))
    p, n, i = merge_mesh_parts(beacon_parts)
    builder.add_primitive(p, n, i, m_amber_beacon)
    
    return builder.build()

def generate_isru_plant():
    """ISRU Subsurface Ice Extractor & Sabatier Fuel Synthesis Refinery"""
    builder = GLBBuilder()
    
    m_steel_skid = builder.add_material("IndustrialSkidYellow", [0.82, 0.68, 0.18, 1.0], metallic=0.6, roughness=0.4)
    m_cryo_tanks = builder.add_material("CryogenicTanksLOX_CH4", [0.92, 0.94, 0.96, 1.0], metallic=0.25, roughness=0.2)
    m_drill_derrick = builder.add_material("DrillDerrickDarkSteel", [0.25, 0.28, 0.32, 1.0], metallic=0.8, roughness=0.3)
    m_sabatier_col = builder.add_material("SabatierReactorColumn", [0.55, 0.60, 0.65, 1.0], metallic=0.85, roughness=0.25)
    m_cyan_cryo_led = builder.add_material("CryoCondenserActiveCyan", [0.0, 0.9, 0.95, 1.0], metallic=0.1, roughness=0.2, emissive=[0.0, 0.9, 0.95])
    
    # 1. Heavy Industrial Skid Platform (6.6m x 4.2m)
    skid_parts = []
    skid_parts.append(create_box_mesh([-3.3, 0.0, -2.1], [3.3, 0.45, 2.1]))
    # Anchor footpads
    for cx in [-3.1, 3.1]:
        for cz in [-1.9, 1.9]:
            skid_parts.append(create_cylinder_mesh([cx, 0.0, cz], 0.35, 0.12, segments=12))
    p, n, i = merge_mesh_parts(skid_parts)
    builder.add_primitive(p, n, i, m_steel_skid)
    
    # 2. Subsurface Rotary Drill Rig Derrick Tower (-X side, height 6.2m)
    derrick_parts = []
    # 4 Corner lattice posts
    for dx in [-2.6, -1.2]:
        for dz in [-1.4, 0.0]:
            derrick_parts.append(create_cylinder_mesh([dx, 0.45, dz], 0.07, 5.8, segments=8))
    # Drill rotary drive head
    derrick_parts.append(create_box_mesh([-2.4, 3.2, -1.2], [-1.4, 4.4, -0.2]))
    # Rotary drill stem entering ground
    derrick_parts.append(create_cylinder_mesh([-1.9, 0.0, -0.7], 0.12, 3.2, segments=12))
    p, n, i = merge_mesh_parts(derrick_parts)
    builder.add_primitive(p, n, i, m_drill_derrick)
    
    # 3. Dual Spherical Cryogenic Propellant Tanks (+X side: LOX & Liquid CH4)
    cryo_parts = []
    # Tank 1: LOX (Radius 1.35m)
    cryo_parts.append(create_cylinder_mesh([1.6, 0.45, -0.75], 1.25, 1.8, segments=24))
    cryo_parts.append(create_truncated_cone([1.6, 2.25, -0.75], 1.25, 0.3, 0.6, segments=20))
    # Tank 2: Liquid Methane CH4 (Radius 1.35m)
    cryo_parts.append(create_cylinder_mesh([1.6, 0.45, 0.85], 1.25, 1.8, segments=24))
    cryo_parts.append(create_truncated_cone([1.6, 2.25, 0.85], 1.25, 0.3, 0.6, segments=20))
    p, n, i = merge_mesh_parts(cryo_parts)
    builder.add_primitive(p, n, i, m_cryo_tanks)
    
    # 4. Central Sabatier Chemical Reactor & Methanation Column
    sabatier_parts = []
    sabatier_parts.append(create_cylinder_mesh([-0.15, 0.45, -0.75], 0.55, 3.6, segments=16)) # CO2 capture column
    sabatier_parts.append(create_cylinder_mesh([-0.15, 0.45, 0.65], 0.45, 3.2, segments=16)) # Methanation column
    # Connecting pipeline
    sabatier_parts.append(create_box_mesh([-0.25, 2.8, -0.75], [-0.05, 3.0, 0.65]))
    p, n, i = merge_mesh_parts(sabatier_parts)
    builder.add_primitive(p, n, i, m_sabatier_col)
    
    # 5. Cryogenic Liquefaction Indicator LED
    led_parts = []
    led_parts.append(create_cylinder_mesh([1.6, 2.9, 0], 0.08, 0.15, segments=12))
    p, n, i = merge_mesh_parts(led_parts)
    builder.add_primitive(p, n, i, m_cyan_cryo_led)
    
    return builder.build()

def generate_crew_rover():
    """Pressurized Multi-Sol Exploration Rover (6-Wheeled Rocker-Bogie)"""
    builder = GLBBuilder()
    
    m_rover_hull = builder.add_material("PressurizedRoverHullWhite", [0.92, 0.93, 0.95, 1.0], metallic=0.25, roughness=0.3)
    m_gold_cockpit = builder.add_material("GoldCockpitCanopy", [0.85, 0.65, 0.15, 1.0], metallic=0.95, roughness=0.1)
    m_suspension = builder.add_material("TitaniumRockerBogie", [0.20, 0.22, 0.25, 1.0], metallic=0.8, roughness=0.35)
    m_mesh_wheels = builder.add_material("HighTractionMeshWheels", [0.45, 0.48, 0.52, 1.0], metallic=0.9, roughness=0.45)
    m_headlights = builder.add_material("HighBeamLEDHeadlights", [1.0, 1.0, 1.0, 1.0], metallic=0.1, roughness=0.2, emissive=[1.0, 1.0, 1.0])
    
    # 1. Main Pressurized Cabin Hull (Length 5.2m, Width 2.8m, Height 2.2m, elevated 1.0m above ground)
    hull_parts = []
    hull_parts.append(create_box_mesh([-1.4, 0.9, -2.6], [1.4, 2.7, 1.8]))
    # Slanted nose front (+Z)
    hull_parts.append(create_truncated_cone([0, 1.4, 1.8], 1.4, 1.1, 0.9, segments=16))
    # Roof equipment rack & auxiliary solar panel
    hull_parts.append(create_box_mesh([-1.2, 2.72, -1.8], [1.2, 2.82, 1.2]))
    # Rear suitports (2 astronaut entry ports on -Z)
    hull_parts.append(create_box_mesh([-0.9, 1.2, -2.75], [-0.15, 2.2, -2.6]))
    hull_parts.append(create_box_mesh([0.15, 1.2, -2.75], [0.9, 2.2, -2.6]))
    p, n, i = merge_mesh_parts(hull_parts)
    builder.add_primitive(p, n, i, m_rover_hull)
    
    # 2. Forward Panoramic Gold Cockpit Canopy
    canopy_parts = []
    canopy_parts.append(create_box_mesh([-1.1, 1.6, 1.9], [1.1, 2.5, 2.65]))
    p, n, i = merge_mesh_parts(canopy_parts)
    builder.add_primitive(p, n, i, m_gold_cockpit)
    
    # 3. 6-Wheeled Rocker-Bogie Suspension Arms
    susp_parts = []
    for side in [-1.55, 1.55]:
        # Main longitudinal rocker beam
        susp_parts.append(create_box_mesh([side - 0.08, 0.9, -1.8], [side + 0.08, 1.05, 1.4]))
        # Drop pivots to wheel axles
        for z in [-1.8, 0.0, 1.4]:
            susp_parts.append(create_cylinder_mesh([side, 0.45, z], 0.06, 0.5, segments=8))
    p, n, i = merge_mesh_parts(susp_parts)
    builder.add_primitive(p, n, i, m_suspension)
    
    # 4. 6 High-Traction Metallic Mesh Wheels (Diameter 1.1m, Width 0.44m, along X axis)
    wheel_parts = []
    for side in [-1.65, 1.65]:
        for z in [-1.8, 0.0, 1.4]:
            x0 = side - 0.22
            x1 = side + 0.22
            wheel_parts.append(create_oriented_cylinder([x0, 0.55, z], [x1, 0.55, z], radius=0.55, segments=24))
            # Wheel hub cap
            cap_x = side - 0.23 if side < 0 else side + 0.23
            cap_x1 = side - 0.25 if side < 0 else side + 0.25
            wheel_parts.append(create_oriented_cylinder([cap_x, 0.55, z], [cap_x1, 0.55, z], radius=0.20, segments=16))
    p, n, i = merge_mesh_parts(wheel_parts)
    builder.add_primitive(p, n, i, m_mesh_wheels)
    
    # 5. High-Intensity LED Headlights
    headlight_parts = []
    headlight_parts.append(create_cylinder_mesh([-0.9, 1.35, 2.65], 0.09, 0.06, segments=12))
    headlight_parts.append(create_cylinder_mesh([0.9, 1.35, 2.65], 0.09, 0.06, segments=12))
    p, n, i = merge_mesh_parts(headlight_parts)
    builder.add_primitive(p, n, i, m_headlights)
    
    return builder.build()

if __name__ == '__main__':
    models = {
        "solar_array.glb": generate_ultraflex_solar_array(),
        "comms_mast.glb": generate_comms_relay(),
        "seis_station.glb": generate_seis_station(),
        "weather_station.glb": generate_weather_station(),
        "crew_hab.glb": generate_crew_hab(),
        "greenhouse_dome.glb": generate_greenhouse_dome(),
        "nuclear_reactor.glb": generate_nuclear_reactor(),
        "isru_plant.glb": generate_isru_plant(),
        "crew_rover.glb": generate_crew_rover(),
    }
    for name, data in models.items():
        out_path = OUTPUT_DIR / name
        out_path.write_bytes(data)
        print(f"Generated {out_path} ({len(data)} bytes, authentic high-poly PBR GLB)")
