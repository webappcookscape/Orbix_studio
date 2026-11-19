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

SOURCE_DIR = r"C:\Users\aravi\Downloads\final-decors"
DEST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "assets", "decors"))
os.makedirs(DEST_DIR, exist_ok=True)

CATALOG_JS_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "orbix-decors-catalog.js"))
MANIFEST_PATH = os.path.join(DEST_DIR, "decors_manifest.json")

def sanitize_slug(name):
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
    icon = "✨"
    clean_name = os.path.splitext(fname)[0].replace("+", " ").replace("_", " ").title()
    clean_name = re.sub(r'\s*\(\d+\)\s*', ' ', clean_name).strip()
    
    if any(k in lower for k in ['cuadro', 'frame', 'picture', 'painting', 'art']):
        cat = "wall_art"
        subcat = "Wall Art & Frames"
        icon = "🖼️"
        elev = 1200
        if "Cuadros" in clean_name or "cuadro" in lower:
            clean_name = "Modern Wall Art & Canvas Set"
    elif any(k in lower for k in ['mirror', 'espejo']):
        cat = "mirror"
        subcat = "Mirrors & Vanity"
        icon = "🪞"
        elev = 1100
        clean_name = "Designer Wall Vanity Mirror"
    elif any(k in lower for k in ['kid', 'bedroom']) and 'bed' in lower:
        cat = "bed"
        subcat = "Beds & Bedroom"
        icon = "🛏️"
        elev = 0
        clean_name = "Kids Bedroom Suite & Bunk Set"
    elif any(k in lower for k in ['bed', 'cama']):
        cat = "bed"
        subcat = "Beds & Bedroom"
        icon = "🛏️"
        elev = 0
        if "Nightstand" in clean_name or "Beds" in clean_name:
            clean_name = "Luxury Bed with Matching Nightstands"
        elif "Bed 01" in clean_name:
            clean_name = "Contemporary Platform Bed 01"
    elif any(k in lower for k in ['sofa', 'couch', 'seating']):
        cat = "sofa"
        subcat = "Sofas & Seating"
        icon = "🛋️"
        elev = 0
        clean_name = "Modern Living Room Sofa Suite"
    elif any(k in lower for k in ['chuoi', 'banana', 'palm']):
        cat = "plant"
        subcat = "Plants & Pots"
        icon = "🪴"
        elev = 0
        clean_name = "Indoor Banana Palm Planter"
    elif any(k in lower for k in ['plant', 'flower', 'pot', 'succulent']):
        cat = "plant"
        subcat = "Plants & Pots"
        icon = "🪴"
        elev = 0 if h > 500 else 850
        clean_name = clean_name.replace("Plant", "Potted Greenery").strip()
    elif any(k in lower for k in ['adorno', 'rmllr']):
        cat = "decor"
        subcat = "Accents & Styling"
        icon = "🏺"
        elev = 850
        clean_name = "Ceramic Decor & Vases Arrangement"
    elif "component 9" in lower:
        cat = "decor"
        subcat = "Accents & Styling"
        icon = "✨"
        elev = 850 if h < 700 else 0
        clean_name = "Styling Accessory Set 09"
    elif "component" in lower:
        cat = "decor"
        subcat = "Accents & Styling"
        icon = "✨"
        elev = 850 if h < 700 else 0
        clean_name = "Designer Accent Collection"
    elif "decor" in lower:
        cat = "decor"
        subcat = "Accents & Styling"
        icon = "✨"
        elev = 850
        clean_name = "Curated Tabletop Styling Decor"
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
    print(f"\n[{fname}] Processing -> {slug}...")
    try:
        skp = openskp.SkpFile(skp_path)
        skp.parse()
        
        print(f"[{fname}] Exporting GLB (with textures)...")
        glb_exporter.export(skp, out_glb, coordinate_system="y-up", units="mm", textures=True)
        
        # Check thumbnail from openskp
        generated_thumb = os.path.join(DEST_DIR, f"{slug}_thumbnail.png")
        if os.path.exists(generated_thumb):
            if os.path.exists(thumb_path):
                os.remove(thumb_path)
            os.rename(generated_thumb, thumb_path)
        
        # Load mesh with trimesh to calculate real bounds
        scene = trimesh.load(out_glb)
        bounds = scene.bounds
        extents = bounds[1] - bounds[0]
        w = round(float(extents[0]), 1)
        h = round(float(extents[1]), 1)
        d = round(float(extents[2]), 1)
        
        # Guard against zero or NaN dimensions
        if w < 10: w = 300
        if h < 10: h = 300
        if d < 10: d = 300
        
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
        print(f"[{fname}] SUCCESS in {dur:.1f}s -> {slug}.glb ({res['fileSizeGlb']/1024/1024:.2f}MB, W:{w} H:{h} D:{d})")
        return res
    except Exception as e:
        print(f"[{fname}] ERROR: {e}")
        traceback.print_exc()
        return None

def main():
    skp_files = sorted(glob.glob(os.path.join(SOURCE_DIR, "*.skp")))
    print(f"Found {len(skp_files)} .skp files in {SOURCE_DIR}")
    
    # Filter duplicates by slug/size
    unique_files = []
    seen_slugs = set()
    for p in skp_files:
        fn = os.path.basename(p)
        slug = sanitize_slug(fn)
        # Skip if exact duplicate variant like "Plant (2) (1).skp" when "Plant (2).skp" exists
        if "(1)" in fn:
            alt_name = fn.replace(" (1)", "")
            alt_path = os.path.join(SOURCE_DIR, alt_name)
            if os.path.exists(alt_path):
                print(f"Skipping duplicate: {fn} (matches {alt_name})")
                continue
        if slug in seen_slugs:
            print(f"Skipping seen slug: {slug} ({fn})")
            continue
        seen_slugs.add(slug)
        unique_files.append(p)
        
    print(f"Processing {len(unique_files)} unique .skp files...")
    
    new_items = []
    for i, path in enumerate(unique_files, 1):
        print(f"\n--- ({i}/{len(unique_files)}) ---")
        item = process_file(path)
        if item:
            new_items.append(item)
            
    # Load existing manifest
    existing_items = []
    if os.path.exists(MANIFEST_PATH):
        try:
            with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
                existing_items = json.load(f)
        except Exception as e:
            print(f"Warning reading existing manifest: {e}")
            
    # Merge: update or append
    merged_map = { it["slug"]: it for it in existing_items }
    for it in new_items:
        merged_map[it["slug"]] = it
        
    merged_list = list(merged_map.values())
    
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(merged_list, f, indent=2, ensure_ascii=False)
        
    with open(CATALOG_JS_PATH, "w", encoding="utf-8") as f:
        f.write("/* Auto-generated & Curated Orbix Decors Catalog */\n")
        f.write("(function() {\n")
        f.write("  var catalog = ")
        json.dump(merged_list, f, indent=2, ensure_ascii=False)
        f.write(";\n")
        f.write("  if (typeof window !== 'undefined') { window.ORBIX_DECORS_CATALOG = catalog; }\n")
        f.write("  if (typeof module !== 'undefined' && module.exports) { module.exports = catalog; }\n")
        f.write("})();\n")
        
    print(f"\n==========================================")
    print(f"FINISHED! Imported {len(new_items)} new models. Total catalog items: {len(merged_list)}")
    print(f"Saved to {MANIFEST_PATH} and {CATALOG_JS_PATH}")
    print(f"==========================================")

if __name__ == "__main__":
    main()
