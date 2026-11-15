import os
import shutil

here = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
targets = [
    os.path.join(here, "dist-desktop", "OrbixStudio-win32-x64", "resources", "app"),
    os.path.join(here, "dist-desktop", "OrbixStudio-v2-win32-x64", "resources", "app")
]

files_to_copy = [
    "index.html",
    "cupboard-cad.html",
    "dist-single.html",
    "app.js",
    "orbix-3d.js",
    "orbix-core.js",
    "orbix-plan.js",
    "orbix-ui.js",
    "orbix-decors-catalog.js",
    "orbix-unit-icons.js",
    "orbix-projects.js",
    "style.css"
]

for target in targets:
    if not os.path.exists(target):
        print(f"Skipping non-existent target: {target}")
        continue
    print(f"\nSyncing to {target}...")
    for f in files_to_copy:
        src = os.path.join(here, f)
        if os.path.exists(src):
            dst = os.path.join(target, f)
            shutil.copy2(src, dst)
            print(f"  Copied {f}")
            
    # Copy assets/three.min.js and assets/GLTFLoader.js
    target_assets = os.path.join(target, "assets")
    os.makedirs(target_assets, exist_ok=True)
    
    src_three = os.path.join(here, "assets", "three.min.js")
    if os.path.exists(src_three):
        shutil.copy2(src_three, os.path.join(target_assets, "three.min.js"))
        print("  Copied assets/three.min.js")

    src_gltf = os.path.join(here, "assets", "GLTFLoader.js")
    if os.path.exists(src_gltf):
        shutil.copy2(src_gltf, os.path.join(target_assets, "GLTFLoader.js"))
        print("  Copied assets/GLTFLoader.js")
        
    src_decors = os.path.join(here, "assets", "decors")
    dst_assets_decors = os.path.join(target_assets, "decors")
    os.makedirs(dst_assets_decors, exist_ok=True)
    
    dst_root_decors = os.path.join(target, "decors")
    os.makedirs(dst_root_decors, exist_ok=True)
    
    count = 0
    for it in os.listdir(src_decors):
        if it.endswith(".glb") or it.endswith(".png") or it.endswith(".json"):
            s_file = os.path.join(src_decors, it)
            shutil.copy2(s_file, os.path.join(dst_assets_decors, it))
            shutil.copy2(s_file, os.path.join(dst_root_decors, it))
            count += 1
    print(f"  Synced {count} decor assets (.glb, .png, .json) to target assets/decors and decors/")

print("\nDesktop sync complete!")

