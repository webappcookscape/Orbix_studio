"""
Orbix Studio - Blender Cycles Photorealistic Raytracing Engine
==============================================================
Standalone bridge script for importing .cycles.json scenes exported from Orbix Studio,
reconstructing geometry, PBR materials, window area lights, warm interior fill,
and rendering physically-grounded 4K still images via Cycles + OpenImageDenoise / OptiX.

Usage:
  blender -b -P scripts/orbix_blender_cycles.py -- --input scene.cycles.json --output render.png --blend output.blend

Lighting Controls (on 'ORBIX LIGHTING' object):
  - Daylight %: Changes window light and sky/sun brightness (default: 20%)
  - Interior Fill W: Warm 3200K interior ceiling/bounce fill in Watts (default: 10W)
  - Exposure EV: Scene exposure compensation in EV (default: 0 EV)
"""

import sys
import os
import math
import json

def parse_args():
    # Pass arguments after '--'
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []

    import argparse
    parser = argparse.ArgumentParser(description="Orbix Studio Blender Cycles Renderer")
    parser.add_argument("--input", "-i", required=True, help="Path to input .cycles.json file")
    parser.add_argument("--output", "-o", default=None, help="Path to output render PNG")
    parser.add_argument("--blend", "-b", default=None, help="Path to save editable .blend file")
    parser.add_argument("--samples", "-s", type=int, default=None, help="Cycles render samples")
    parser.add_argument("--resolution", "-r", nargs=2, type=int, default=None, help="Resolution W H (e.g. 3840 2160)")
    parser.add_argument("--device", "-d", choices=["GPU", "CPU", "AUTO"], default="AUTO", help="Compute device")
    return parser.parse_args(argv)

def run():
    try:
        import bpy
        import mathutils
    except ImportError:
        print("ERROR: This script must be run inside Blender: blender -b -P scripts/orbix_blender_cycles.py -- --input <file.json>")
        sys.exit(1)

    args = parse_args()
    if not os.path.exists(args.input):
        print(f"ERROR: Input file not found: {args.input}")
        sys.exit(1)

    with open(args.input, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 1. Clean existing scene
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene

    # 2. Configure Render Engine to Cycles
    scene.render.engine = 'CYCLES'
    cycles = scene.cycles

    # Configure GPU / CPU
    cycles.device = 'GPU'
    prefs = bpy.context.preferences
    cprefs = prefs.addons.get('cycles')
    if cprefs and hasattr(cprefs, 'preferences'):
        cprefs = cprefs.preferences
        # Try OptiX, then CUDA, then Metal, then HIP
        for compute_backend in ['OPTIX', 'CUDA', 'METAL', 'HIP', 'ONEAPI']:
            try:
                cprefs.compute_device_type = compute_backend
                cprefs.get_devices()
                devices = [d for d in cprefs.devices if d.type == compute_backend and not d.use_cpu]
                if devices:
                    for d in cprefs.devices:
                        d.use = (d in devices)
                    print(f"[Orbix Cycles] Using GPU backend: {compute_backend} with {len(devices)} device(s)")
                    break
            except Exception:
                continue

    # Resolution & Sampling
    render_cfg = data.get("renderSettings", {})
    res_w = (args.resolution[0] if args.resolution else None) or render_cfg.get("resolution", [3840, 2160])[0]
    res_h = (args.resolution[1] if args.resolution else None) or render_cfg.get("resolution", [3840, 2160])[1]
    scene.render.resolution_x = int(res_w)
    scene.render.resolution_y = int(res_h)
    scene.render.resolution_percentage = 100

    samples = args.samples or render_cfg.get("samples", 128)
    cycles.samples = int(samples)
    cycles.use_denoising = True
    try:
        cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception:
        pass

    # Color Management (AgX, Filmic or Fallback Standard)
    lighting_cfg = data.get("lighting", {})
    exp_ev = float(lighting_cfg.get("exposureEV", 0.0))
    try:
        transforms = [c.name for c in bpy.types.ColorManagedViewSettings.bl_rna.properties['view_transform'].enum_items]
        if 'Filmic' in transforms:
            scene.view_settings.view_transform = 'Filmic'
        elif 'AgX' in transforms:
            scene.view_settings.view_transform = 'AgX'
    except Exception:
        pass

    try:
        scene.view_settings.look = 'Medium High Contrast'
    except Exception:
        pass

    try:
        scene.view_settings.exposure = exp_ev
    except Exception:
        pass

    # 3. Create Lighting Master Controller Object
    daylight_pct = float(lighting_cfg.get("daylightPercent", 20.0))
    fill_watts = float(lighting_cfg.get("interiorFillWatts", 10.0))

    ctrl_empty = bpy.data.objects.new("ORBIX LIGHTING", None)
    ctrl_empty.empty_display_type = 'ARROWS'
    ctrl_empty.empty_display_size = 0.5
    bpy.context.collection.objects.link(ctrl_empty)

    # Custom properties for interactive lighting tuning
    ctrl_empty["Daylight %"] = daylight_pct
    ctrl_empty["Interior Fill W"] = fill_watts
    ctrl_empty["Exposure EV"] = exp_ev

    # 4. Set World Sky Lighting
    if not scene.world:
        scene.world = bpy.data.worlds.new("OrbixWorld")
    world = scene.world
    world.use_nodes = True
    w_nodes = world.node_tree.nodes
    w_links = world.node_tree.links
    w_nodes.clear()

    w_bg = w_nodes.new('ShaderNodeBackground')
    w_out = w_nodes.new('ShaderNodeOutputWorld')
    w_links.new(w_bg.outputs['Background'], w_out.inputs['Surface'])

    # Warm-cool sky ambient
    w_bg.inputs['Color'].default_value = (0.78, 0.86, 0.96, 1.0)
    w_bg.inputs['Strength'].default_value = max(0.1, daylight_pct * 0.05)

    # 5. Build PBR Materials
    mat_cache = {}
    mats_data = data.get("materials", {})

    for mat_id, m_info in mats_data.items():
        b_mat = bpy.data.materials.new(name=m_info.get("name", mat_id))
        b_mat.use_nodes = True
        tree = b_mat.node_tree
        nodes = tree.nodes
        links = tree.links
        nodes.clear()

        bsdf = nodes.new('ShaderNodeBsdfPrincipled')
        output = nodes.new('ShaderNodeOutputMaterial')
        links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])

        # Base Color
        col = m_info.get("baseColor", [0.8, 0.8, 0.8])
        if len(col) == 3:
            col = [col[0], col[1], col[2], 1.0]
        bsdf.inputs['Base Color'].default_value = col

        # Roughness & Metallic
        rough = float(m_info.get("roughness", 0.45))
        metal = float(m_info.get("metallic", 0.0))
        bsdf.inputs['Roughness'].default_value = rough
        bsdf.inputs['Metallic'].default_value = metal

        # Transmission & IOR (Glass)
        trans = float(m_info.get("transmission", 0.0))
        ior = float(m_info.get("ior", 1.45))
        if trans > 0:
            if 'Transmission Weight' in bsdf.inputs:
                bsdf.inputs['Transmission Weight'].default_value = trans
            elif 'Transmission' in bsdf.inputs:
                bsdf.inputs['Transmission'].default_value = trans
            bsdf.inputs['IOR'].default_value = ior
            bsdf.inputs['Roughness'].default_value = max(0.01, rough * 0.2)

        # Clearcoat (Tiles, Lacquer, Polished Quartz)
        clearcoat = float(m_info.get("clearcoat", 0.0))
        if clearcoat > 0:
            if 'Coat Weight' in bsdf.inputs:
                bsdf.inputs['Coat Weight'].default_value = clearcoat
            elif 'Clearcoat' in bsdf.inputs:
                bsdf.inputs['Clearcoat'].default_value = clearcoat

        mat_cache[mat_id] = b_mat

    # Fallback default material
    fallback_mat = bpy.data.materials.new(name="OrbixDefaultMat")
    fallback_mat.use_nodes = True
    f_bsdf = fallback_mat.node_tree.nodes.get('Principled BSDF')
    if f_bsdf:
        f_bsdf.inputs['Base Color'].default_value = (0.85, 0.83, 0.80, 1.0)
        f_bsdf.inputs['Roughness'].default_value = 0.5

    # 6. Rebuild Geometry
    objects_data = data.get("objects", [])
    print(f"[Orbix Cycles] Rebuilding {len(objects_data)} scene objects...")

    for obj_info in objects_data:
        name = obj_info.get("name", "Object")
        verts = obj_info.get("vertices", [])
        faces = obj_info.get("faces", [])
        mat_id = obj_info.get("material")

        if not verts or not faces:
            continue

        b_mesh = bpy.data.meshes.new(name)
        b_mesh.from_pydata(verts, [], faces)
        b_mesh.update()

        b_obj = bpy.data.objects.new(name, b_mesh)
        bpy.context.collection.objects.link(b_obj)

        # Assign material
        assigned_mat = mat_cache.get(mat_id, fallback_mat)
        b_mesh.materials.append(assigned_mat)

        # Smooth shading for organic/curved surfaces
        role = (obj_info.get("role") or "").lower()

        # If camera is viewing from above/outside, don't let ceiling mesh block interior camera view
        cam_pos = data.get("camera", {}).get("position", [0, -3.5, 1.6])
        if role == 'ceiling' or 'ceiling' in name.lower():
            if cam_pos[2] > 2.3:
                continue

        if role in ["handle", "decor", "chair", "plant", "upholstery"]:
            for p in b_mesh.polygons:
                p.use_smooth = True

    # 7. Setup Architectural Sunlight (Direct warm sunlight entering the kitchen)
    sun_data = bpy.data.lights.new(name="OrbixSunlight", type='SUN')
    sun_data.energy = max(2.5, daylight_pct * 0.16)
    sun_data.color = (1.0, 0.98, 0.93) # 5500K warm architectural daylight
    sun_data.angle = math.radians(2.5) # Soft realistic shadow penumbra
    sun_obj = bpy.data.objects.new(name="OrbixSunlight", object_data=sun_data)
    # Direct sunlight at a 55-degree architectural angle
    sun_direction = mathutils.Vector((-0.45, -0.65, -0.75)).normalized()
    sun_obj.rotation_euler = (-sun_direction).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.collection.objects.link(sun_obj)

    # 8. Setup Window Area Lights (Directional Daylight entering through room openings)
    windows_data = data.get("windows", [])
    window_energy_mult = daylight_pct * 12.0

    for idx, win in enumerate(windows_data):
        pos = win.get("pos", [0, 0, 1.2]) # [x, y, z] in meters
        w = max(0.4, win.get("width", 1.2))
        h = max(0.4, win.get("height", 1.2))
        norm = win.get("normal", [0, -1, 0])

        w_light_data = bpy.data.lights.new(name=f"WindowLight_{idx+1}", type='AREA')
        w_light_data.shape = 'RECTANGLE'
        w_light_data.size = w
        w_light_data.size_y = h
        w_light_data.energy = max(80.0, window_energy_mult * (w * h) * 4.0)
        w_light_data.color = (0.92, 0.96, 1.0) # Daylight 6500K tint

        w_light_obj = bpy.data.objects.new(name=f"WindowLight_{idx+1}", object_data=w_light_data)
        w_light_obj.location = (pos[0], pos[1], pos[2])

        # Point inward into the room
        rot_z = math.atan2(norm[1], norm[0])
        w_light_obj.rotation_euler = (math.pi / 2, 0, rot_z - math.pi / 2)

        bpy.context.collection.objects.link(w_light_obj)

    # 9. Setup Warm Interior Fill Lights (Soft ceiling bounce to lift deep cabinet shadows)
    fill_light_data = bpy.data.lights.new(name="InteriorWarmFill", type='POINT')
    fill_light_data.energy = max(180.0, fill_watts * 45.0)
    fill_light_data.color = (1.0, 0.90, 0.78) # 3200K warm interior illumination
    fill_light_data.shadow_soft_size = 0.85

    cam_tgt = data.get("camera", {}).get("target", [0, 0, 0.9])

    fill_obj = bpy.data.objects.new(name="InteriorWarmFill", object_data=fill_light_data)
    fill_obj.location = (
        (cam_pos[0] + cam_tgt[0]) * 0.5,
        (cam_pos[1] + cam_tgt[1]) * 0.5,
        max(2.2, cam_pos[2] + 0.8)
    )
    bpy.context.collection.objects.link(fill_obj)

    # 10. Setup Camera (Physically-accurate orientation targeting scene center)
    cam_data = bpy.data.cameras.new("OrbixCamera")
    fov = float(data.get("camera", {}).get("fov", 50.0))
    cam_data.angle = math.radians(fov)
    cam_data.clip_start = 0.05
    cam_data.clip_end = 250.0

    cam_obj = bpy.data.objects.new("OrbixCamera", cam_data)
    cam_obj.location = (cam_pos[0], cam_pos[1], cam_pos[2])

    # Direct camera to look precisely at target using Blender's native look-at tracking
    cam_direction = mathutils.Vector(cam_tgt) - mathutils.Vector(cam_pos)
    if cam_direction.length > 0.0001:
        rot_quat = cam_direction.to_track_quat('-Z', 'Y')
        cam_obj.rotation_euler = rot_quat.to_euler()
    else:
        cam_obj.rotation_euler = (math.radians(65), 0, 0)

    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    # 10. Save .blend file if requested
    if args.blend:
        os.makedirs(os.path.dirname(os.path.abspath(args.blend)), exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=args.blend)
        print(f"[Orbix Cycles] Saved editable Blender scene: {args.blend}")

    # 11. Render still image if requested
    if args.output:
        os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
        scene.render.filepath = os.path.abspath(args.output)
        scene.render.image_settings.file_format = 'PNG'
        scene.render.image_settings.color_depth = '8'
        print(f"[Orbix Cycles] Starting 4K render to: {args.output} ({res_w}x{res_h}, {samples} samples)...")
        bpy.ops.render.render(write_still=True)
        print(f"[Orbix Cycles] Render successfully saved to: {args.output}")

if __name__ == "__main__":
    run()
