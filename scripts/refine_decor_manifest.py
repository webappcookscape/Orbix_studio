import json
import os

CURATED_DATA = {
    "023": {
        "name": "Master Suite Bed & Nightstands 023",
        "category": "bed",
        "subCategory": "Beds & Bedroom",
        "icon": "🛏️",
        "dimensions": {"W": 2400, "H": 1050, "D": 2150},
        "elevation": 0
    },
    "7_mi_tv": {
        "name": "Xiaomi Mi 65\" Smart 4K TV",
        "category": "tv",
        "subCategory": "Electronics & TV",
        "icon": "📺",
        "dimensions": {"W": 1450, "H": 860, "D": 65},
        "elevation": 950
    },
    "ai_2049_100r1": {
        "name": "Modern Contemporary Armchair",
        "category": "chair",
        "subCategory": "Sofas & Seating",
        "icon": "🛋️",
        "dimensions": {"W": 1050, "H": 880, "D": 1000},
        "elevation": 0
    },
    "ashley_padova_3_seater_sofa": {
        "name": "Ashley Padova 3-Seater Sofa",
        "category": "sofa",
        "subCategory": "Sofas & Seating",
        "icon": "🛋️",
        "dimensions": {"W": 2400, "H": 980, "D": 1020},
        "elevation": 0
    },
    "bed_windsor_1": {
        "name": "Windsor King Bed Set",
        "category": "bed",
        "subCategory": "Beds & Bedroom",
        "icon": "🛏️",
        "dimensions": {"W": 2050, "H": 1150, "D": 2150},
        "elevation": 0
    },
    "cama_3": {
        "name": "Cama Modern Upholstered Bed",
        "category": "bed",
        "subCategory": "Beds & Bedroom",
        "icon": "🛏️",
        "dimensions": {"W": 1800, "H": 970, "D": 2100},
        "elevation": 0
    },
    "chimney": {
        "name": "Stainless Steel Slim Chimney",
        "category": "chimney",
        "subCategory": "Kitchen Appliances",
        "icon": "💨",
        "dimensions": {"W": 880, "H": 750, "D": 480},
        "elevation": 1500
    },
    "component": {
        "name": "Architectural Display Column",
        "category": "decor",
        "subCategory": "Accents & Styling",
        "icon": "🏛️",
        "dimensions": {"W": 640, "H": 1800, "D": 680},
        "elevation": 0
    },
    "component_12": {
        "name": "Vanity Dressing Stool",
        "category": "stool",
        "subCategory": "Accents & Styling",
        "icon": "🪑",
        "dimensions": {"W": 450, "H": 520, "D": 450},
        "elevation": 0
    },
    "component_3": {
        "name": "Decorative Ceramic Table Planter",
        "category": "plant",
        "subCategory": "Plants & Pots",
        "icon": "🪴",
        "dimensions": {"W": 480, "H": 430, "D": 480},
        "elevation": 850
    },
    "conc_flower_pot": {
        "name": "Concrete Architectural Planter",
        "category": "plant",
        "subCategory": "Plants & Pots",
        "icon": "🪴",
        "dimensions": {"W": 590, "H": 780, "D": 610},
        "elevation": 0
    },
    "cutlery": {
        "name": "Countertop Cutlery Organizer",
        "category": "kitchen_decor",
        "subCategory": "Kitchen Styling",
        "icon": "🍴",
        "dimensions": {"W": 170, "H": 290, "D": 160},
        "elevation": 850
    },
    "cutlery_1": {
        "name": "Formal Dining Cutlery Set",
        "category": "kitchen_decor",
        "subCategory": "Kitchen Styling",
        "icon": "🍴",
        "dimensions": {"W": 630, "H": 80, "D": 390},
        "elevation": 850
    },
    "cuttlery_dishrack": {
        "name": "Cutlery & Dish Drying Rack",
        "category": "kitchen_decor",
        "subCategory": "Kitchen Styling",
        "icon": "🍽️",
        "dimensions": {"W": 310, "H": 280, "D": 400},
        "elevation": 850
    },
    "dining_table2": {
        "name": "Luxury 6-Seater Dining Table Set",
        "category": "dining_table",
        "subCategory": "Dining Tables",
        "icon": "🪑",
        "dimensions": {"W": 1500, "H": 760, "D": 1000},
        "elevation": 0
    },
    "dining_table_4": {
        "name": "Modern 4-Seater Dining Set",
        "category": "dining_table",
        "subCategory": "Dining Tables",
        "icon": "🪑",
        "dimensions": {"W": 1350, "H": 760, "D": 1200},
        "elevation": 0
    },
    "drfxnj": {
        "name": "Sculptural Accent Centerpiece",
        "category": "decor",
        "subCategory": "Accents & Styling",
        "icon": "✨",
        "dimensions": {"W": 600, "H": 500, "D": 450},
        "elevation": 850
    },
    "floor_lamp": {
        "name": "Nordic Curved Arc Floor Lamp",
        "category": "floor_lamp",
        "subCategory": "Lighting",
        "icon": "💡",
        "dimensions": {"W": 500, "H": 2100, "D": 1400},
        "elevation": 0
    },
    "flower_pot_12": {
        "name": "Tall Indoor Fiddle Fig Tree",
        "category": "plant",
        "subCategory": "Plants & Pots",
        "icon": "🌿",
        "dimensions": {"W": 800, "H": 1850, "D": 800},
        "elevation": 0
    },
    "girls_bed": {
        "name": "Youth / Girl Single Bed",
        "category": "bed",
        "subCategory": "Beds & Bedroom",
        "icon": "🛏️",
        "dimensions": {"W": 1200, "H": 1150, "D": 2000},
        "elevation": 0
    },
    "glass_apothecary_jar": {
        "name": "Glass Apothecary Canisters",
        "category": "kitchen_decor",
        "subCategory": "Kitchen Styling",
        "icon": "🫙",
        "dimensions": {"W": 450, "H": 210, "D": 190},
        "elevation": 850
    },
    "group_338": {
        "name": "Styling Decor Vignette 338",
        "category": "decor",
        "subCategory": "Accents & Styling",
        "icon": "✨",
        "dimensions": {"W": 420, "H": 650, "D": 500},
        "elevation": 850
    },
    "hob": {
        "name": "Built-in 4-Burner Glass Cooktop",
        "category": "gas_hob",
        "subCategory": "Kitchen Appliances",
        "icon": "🍳",
        "dimensions": {"W": 865, "H": 60, "D": 510},
        "elevation": 850
    },
    "hob_1": {
        "name": "Built-in 3-Burner Gas Hob",
        "category": "gas_hob",
        "subCategory": "Kitchen Appliances",
        "icon": "🍳",
        "dimensions": {"W": 750, "H": 80, "D": 500},
        "elevation": 850
    },
    "jaali_partition": {
        "name": "Decorative Geometric Jaali Screen",
        "category": "partition",
        "subCategory": "Partitions & Walls",
        "icon": "🧱",
        "dimensions": {"W": 1200, "H": 2300, "D": 120},
        "elevation": 0
    },
    "kitchen_composition_decor_2": {
        "name": "Kitchen Counter Decor Composition",
        "category": "kitchen_decor",
        "subCategory": "Kitchen Styling",
        "icon": "🍶",
        "dimensions": {"W": 480, "H": 380, "D": 200},
        "elevation": 850
    },
    "kitchenaid_dishwasher": {
        "name": "KitchenAid Built-in Dishwasher",
        "category": "dishwasher",
        "subCategory": "Kitchen Appliances",
        "icon": "🍽️",
        "dimensions": {"W": 600, "H": 850, "D": 640},
        "elevation": 0
    },
    "maquina_de_lavar_roupas_sansung": {
        "name": "Samsung EcoBubble Front Load Washer",
        "category": "washing_machine",
        "subCategory": "Appliances",
        "icon": "🧺",
        "dimensions": {"W": 600, "H": 850, "D": 630},
        "elevation": 0
    },
    "partition": {
        "name": "Architectural Vertical Wood Slats",
        "category": "partition",
        "subCategory": "Partitions & Walls",
        "icon": "🧱",
        "dimensions": {"W": 1450, "H": 2400, "D": 200},
        "elevation": 0
    },
    "partition_wall": {
        "name": "Modern Fluted Divider Wall",
        "category": "partition",
        "subCategory": "Partitions & Walls",
        "icon": "🧱",
        "dimensions": {"W": 2000, "H": 2400, "D": 250},
        "elevation": 0
    },
    "pv977nss_geprofile": {
        "name": "GE Profile Glass Canopy Chimney",
        "category": "chimney",
        "subCategory": "Kitchen Appliances",
        "icon": "💨",
        "dimensions": {"W": 900, "H": 810, "D": 550},
        "elevation": 1500
    },
    "r7250_refrigerator_freezer_20_cubic_feet": {
        "name": "Double Door Refrigerator-Freezer (20 Cu Ft)",
        "category": "fridge",
        "subCategory": "Kitchen Appliances",
        "icon": "❄️",
        "dimensions": {"W": 760, "H": 1730, "D": 620},
        "elevation": 0
    },
    "rth": {
        "name": "Artisan Ceramic Table Vase",
        "category": "decor",
        "subCategory": "Accents & Styling",
        "icon": "🏺",
        "dimensions": {"W": 350, "H": 500, "D": 350},
        "elevation": 850
    },
    "sofa": {
        "name": "Contemporary Deep Lounge Sofa",
        "category": "sofa",
        "subCategory": "Sofas & Seating",
        "icon": "🛋️",
        "dimensions": {"W": 2400, "H": 860, "D": 1000},
        "elevation": 0
    },
    "sofa_ovo_z_pojemnikiem_beżowa_boucle": {
        "name": "Ovo Beige Bouclé Storage Sofa",
        "category": "sofa",
        "subCategory": "Sofas & Seating",
        "icon": "🛋️",
        "dimensions": {"W": 2200, "H": 850, "D": 950},
        "elevation": 0
    },
    "succulent_decoration": {
        "name": "Succulent Botanical Dish Arrangement",
        "category": "plant",
        "subCategory": "Plants & Pots",
        "icon": "🪴",
        "dimensions": {"W": 350, "H": 250, "D": 350},
        "elevation": 850
    },
    "teapot": {
        "name": "Classic Porcelain Teapot",
        "category": "kitchen_decor",
        "subCategory": "Kitchen Styling",
        "icon": "🫖",
        "dimensions": {"W": 240, "H": 160, "D": 170},
        "elevation": 850
    },
    "teapot_1": {
        "name": "Nordic Matte Ceramic Teapot",
        "category": "kitchen_decor",
        "subCategory": "Kitchen Styling",
        "icon": "🫖",
        "dimensions": {"W": 210, "H": 170, "D": 180},
        "elevation": 850
    },
    "teapot_2": {
        "name": "Artisan Tea Server Set with Cups",
        "category": "kitchen_decor",
        "subCategory": "Kitchen Styling",
        "icon": "🫖",
        "dimensions": {"W": 350, "H": 220, "D": 250},
        "elevation": 850
    },
    "untitled": {
        "name": "Sculptural Ficus Botanical Display",
        "category": "plant",
        "subCategory": "Plants & Pots",
        "icon": "🌿",
        "dimensions": {"W": 800, "H": 1850, "D": 800},
        "elevation": 0
    },
    "vegetables": {
        "name": "Fresh Harvest Kitchen Vegetable Bowl",
        "category": "kitchen_decor",
        "subCategory": "Kitchen Styling",
        "icon": "🥗",
        "dimensions": {"W": 300, "H": 150, "D": 300},
        "elevation": 850
    },
    "washing_machine": {
        "name": "Modern Front Load Washing Machine",
        "category": "washing_machine",
        "subCategory": "Appliances",
        "icon": "🧺",
        "dimensions": {"W": 600, "H": 850, "D": 600},
        "elevation": 0
    },
    "x1": {
        "name": "Architectural Accent Decor X1",
        "category": "decor",
        "subCategory": "Accents & Styling",
        "icon": "✨",
        "dimensions": {"W": 800, "H": 750, "D": 350},
        "elevation": 850
    },
    "x1_1": {
        "name": "Architectural Accent Decor X2",
        "category": "decor",
        "subCategory": "Accents & Styling",
        "icon": "✨",
        "dimensions": {"W": 900, "H": 800, "D": 400},
        "elevation": 850
    },
    "y1": {
        "name": "Architectural Wall Relief Panel Y1",
        "category": "decor",
        "subCategory": "Accents & Styling",
        "icon": "🖼️",
        "dimensions": {"W": 1200, "H": 600, "D": 50},
        "elevation": 1200
    },
    "z1": {
        "name": "Architectural Graphic Wall Feature Z1",
        "category": "decor",
        "subCategory": "Accents & Styling",
        "icon": "🖼️",
        "dimensions": {"W": 1200, "H": 800, "D": 60},
        "elevation": 900
    }
}

manifest_file = os.path.join(os.path.dirname(__file__), "..", "assets", "decors", "decors_manifest.json")
with open(manifest_file, "r", encoding="utf-8") as f:
    items = json.load(f)

for it in items:
    slug = it.get("slug")
    if slug in CURATED_DATA:
        cur = CURATED_DATA[slug]
        it["name"] = cur["name"]
        it["decorType"] = cur["category"]
        it["subCategory"] = cur["subCategory"]
        it["icon"] = cur["icon"]
        it["dimensions"] = cur["dimensions"]
        it["elevation"] = cur["elevation"]

with open(manifest_file, "w", encoding="utf-8") as f:
    json.dump(items, f, indent=2, ensure_ascii=False)

js_manifest_path = os.path.join(os.path.dirname(__file__), "..", "orbix-decors-catalog.js")
with open(js_manifest_path, "w", encoding="utf-8") as f:
    f.write("/* Auto-generated & Curated Orbix Decors Catalog from 46 SketchUp Models */\n")
    f.write("(function() {\n")
    f.write("  var catalog = ")
    json.dump(items, f, indent=2, ensure_ascii=False)
    f.write(";\n")
    f.write("  if (typeof window !== 'undefined') { window.ORBIX_DECORS_CATALOG = catalog; }\n")
    f.write("  if (typeof module !== 'undefined' && module.exports) { module.exports = catalog; }\n")
    f.write("})();\n")

print(f"Refined {len(items)} items in manifest and generated {js_manifest_path}")

