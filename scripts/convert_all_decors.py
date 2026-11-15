import os
import re
import sys
import glob
import json
import time
import traceback
from PIL import Image
import openskp
import openskp.export.glb as glb_exporter
import trimesh

SOURCE_DIR = r"C:\Users\aravi\Downloads\decors-skp"
DEST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "assets", "decors"))
os.makedirs(DEST_DIR, exist_ok=True)

def sanitize_slug(name):
    # e.g. "Ashley+Padova+3+Seater+Sofa.skp" -> "ashley_padova_3_seater_sofa"
    base = os.path.splitext(name)[0]
    base = re.sub(r'[\+\s\-]+', '_', base)
    base = re.sub(r'[^\w\.]', '', base)
    base = re.sub(r'_+', '_', base).strip('_').lower()
    return base or "decor_item"

def guess_category_and_info(fname, extents):
    lower = fname.lower()
    w, h, d = extents[0], extents[1], extents[2]
    
    # Defaults
    elev = 0
    cat = "decor"
    subcat = "Decor & Styling"
    icon = "🪴"
    clean_name = os.path.splitext(fname)[0].replace("+", " ").replace("_", " ").title()
    
    if any(k in lower for k in ['bed', 'cama']):
        cat = "bed"
        subcat = "Beds & Bedroom"
        icon = "🛏️"
        elev = 0
    elif any(k in lower for k in ['sofa', 'boucle']):
        cat = "sofa"
        subcat = "Sofas & Seating"
        icon = "🛋️"
        elev = 0
    elif any(k in lower for k in ['dining', 'table']):
        cat = "dining_table"
        subcat = "Dining Tables"
        icon = "🪑"
        elev = 0
    elif any(k in lower for k in ['tv']):
        cat = "tv"
        subcat = "Electronics & TV"
        icon = "📺"
        elev = 900
    elif any(k in lower for k in ['chimney', 'pv977nss', 'hood']):
        cat = "chimney"
        subcat = "Kitchen Appliances"
        icon = "💨"
        elev = 1500
    elif any(k in lower for k in ['hob']):
        cat = "gas_hob"
        subcat = "Kitchen Appliances"
        icon = "🍳"
        elev = 850
    elif any(k in lower for k in ['dishwasher']):
        cat = "dishwasher"
        subcat = "Kitchen Appliances"
        icon = "🍽️"
        elev = 0
    elif any(k in lower for k in ['washing', 'lavar', 'sansung']):
        cat = "washing_machine"
        subcat = "Appliances"
        icon = "🧺"
        elev = 0
    elif any(k in lower for k in ['fridge', 'refrigerator', 'r7250']):
        cat = "fridge"
        subcat = "Kitchen Appliances"
        icon = "❄️"
        elev = 0
    elif any(k in lower for k in ['partition', 'jaali']):
        cat = "partition"
        subcat = "Partitions & Walls"
        icon = "🧱"
        elev = 0
    elif any(k in lower for k in ['flower', 'pot', 'succulent', 'plant']):
        cat = "plant"
        subcat = "Plants & Pots"
        icon = "🪴"
        elev = 0 if h > 600 else 850
    elif any(k in lower for k in ['lamp', 'light']):
        cat = "floor_lamp"
        subcat = "Lighting"
        icon = "💡"
        elev = 0
    elif any(k in lower for k in ['teapot', 'cutlery', 'dishrack', 'vegetables', 'jar', 'kitchen']):
        cat = "kitchen_decor"
        subcat = "Kitchen Styling"
        icon = "🫖" if 'teapot' in lower else "🥗" if 'vegetables' in lower else "🍴"
        elev = 850  # countertop height
    else:
        cat = "decor"
        subcat = "Accents & Styling"
        icon = "✨"
        elev = 850 if h < 600 else 0

    return {
        "clean_name": clean_name,
        "cat": cat,
        "subcat": subcat,
        "icon": icon,
        "default_elevation": elev
    }

def process_file(skp_path):
    fname = os.path.basename(skp_path)
    slug = sanitize_slug(fname)
    out_glb = os.path.join(DEST_DIR, f"{slug}.glb")
    thumb_path = os.path.join(DEST_DIR, f"{slug}_thumb.png")
    
    t0 = time.time()
    print(f"[{fname}] Parsing...")
    try:
        skp = openskp.SkpFile(skp_path)
        skp.parse()
        
        print(f"[{fname}] Exporting GLB (with textures)...")
        glb_exporter.export(skp, out_glb, coordinate_system="y-up", units="mm", textures=True)
        
        # Check generated thumbnail from openskp
        generated_thumb = os.path.join(DEST_DIR, f"{slug}_thumbnail.png")
        if os.path.exists(generated_thumb):
            if os.path.exists(thumb_path):
                os.remove(thumb_path)
            os.rename(generated_thumb, thumb_path)
        
        # Load mesh with trimesh to get real bounds
        scene = trimesh.load(out_glb)
        bounds = scene.bounds
        extents = bounds[1] - bounds[0]
        w = round(float(extents[0]), 1)
        h = round(float(extents[1]), 1)
        d = round(float(extents[2]), 1)
        
        info = guess_category_and_info(fname, (w, h, d))
        
        rel_glb = f"assets/decors/{slug}.glb"
        rel_thumb = f"assets/decors/{slug}_thumb.png" if os.path.exists(thumb_path) else None
        
        res = {
            "id": f"decor_{slug}",
            "slug": slug,
            "original_filename": fname,
            "name": info["clean_name"],
            "category": "decor",
            "decorType": info["cat"],
            "subCategory": info["subcat"],
            "icon": info["icon"],
            "modelUrl": rel_glb,
            "thumbnailUrl": rel_thumb,
            "dimensions": { "W": w, "H": h, "D": d },
            "elevation": info["default_elevation"],
            "bounds": {
                "min": [round(float(x), 1) for x in bounds[0]],
                "max": [round(float(x), 1) for x in bounds[1]]
            },
            "fileSizeGlb": os.path.getsize(out_glb),
            "excludeFromPricing": True,
            "isDecor": True
        }
        
        dur = time.time() - t0
        print(f"[{fname}] Done in {dur:.1f}s -> {slug}.glb ({res['fileSizeGlb']/1024/1024:.2f}MB, W:{w} H:{h} D:{d})")
        return res
    except Exception as e:
        print(f"[{fname}] ERROR: {e}")
        traceback.print_exc()
        return None

def main():
    skp_files = sorted(glob.glob(os.path.join(SOURCE_DIR, "*.skp")))
    print(f"Found {len(skp_files)} .skp files in {SOURCE_DIR}")
    
    manifest = []
    success = 0
    fail = 0
    
    for i, path in enumerate(skp_files, 1):
        print(f"\n--- ({i}/{len(skp_files)}) ---")
        item = process_file(path)
        if item:
            manifest.append(item)
            success += 1
        else:
            fail += 1
            
    manifest_path = os.path.join(DEST_DIR, "decors_manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        
    js_manifest_path = os.path.join(os.path.dirname(__file__), "..", "orbix-decors-catalog.js")
    with open(js_manifest_path, "w", encoding="utf-8") as f:
        f.write("/* Auto-generated Orbix Decors Catalog from 46 SketchUp Models */\n")
        f.write("window.ORBIX_DECORS_CATALOG = ")
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        f.write(";\n")
        f.write("if (typeof module !== 'undefined' && module.exports) { module.exports = window.ORBIX_DECORS_CATALOG; }\n")
        
    print(f"\n==========================================")
    print(f"FINISHED! Success: {success}, Failed: {fail}")
    print(f"Manifest written to: {manifest_path}")
    print(f"JS Catalog written to: {js_manifest_path}")
    print(f"==========================================")

if __name__ == "__main__":
    main()

