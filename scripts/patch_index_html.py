import re
import os

html_path = os.path.join(os.path.dirname(__file__), "..", "index.html")
content = open(html_path, "r", encoding="utf-8").read()

new_tab_presets = """      <!-- Tab 1: Built-in Catalog -->
      <div id="decorTabPresets">
        <div style="display:flex;gap:10px;margin-bottom:12px;align-items:center;">
          <input type="text" id="decorSearchInput" class="form-input" placeholder="🔍 Search 46 3D models (beds, sofas, tables, appliances, plants...)" style="width:100%;padding:8px 14px;border:1px solid #cbd5e1;border-radius:6px;font-size:12.5px;box-sizing:border-box;">
        </div>
        <div id="decorCategoryFilter" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;">
          <button type="button" class="btn decor-cat-pill is-active" data-cat="all" style="font-size:11px;padding:4px 10px;border-radius:14px;background:#15803d;color:#ffffff;border:none;cursor:pointer;">All (46)</button>
          <button type="button" class="btn decor-cat-pill" data-cat="Beds & Bedroom" style="font-size:11px;padding:4px 10px;border-radius:14px;background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;cursor:pointer;">🛏️ Beds</button>
          <button type="button" class="btn decor-cat-pill" data-cat="Sofas & Seating" style="font-size:11px;padding:4px 10px;border-radius:14px;background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;cursor:pointer;">🛋️ Sofas</button>
          <button type="button" class="btn decor-cat-pill" data-cat="Dining Tables" style="font-size:11px;padding:4px 10px;border-radius:14px;background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;cursor:pointer;">🪑 Dining</button>
          <button type="button" class="btn decor-cat-pill" data-cat="Kitchen Appliances" style="font-size:11px;padding:4px 10px;border-radius:14px;background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;cursor:pointer;">🍳 Appliances</button>
          <button type="button" class="btn decor-cat-pill" data-cat="Kitchen Styling" style="font-size:11px;padding:4px 10px;border-radius:14px;background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;cursor:pointer;">🥗 Kitchen Styling</button>
          <button type="button" class="btn decor-cat-pill" data-cat="Plants & Pots" style="font-size:11px;padding:4px 10px;border-radius:14px;background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;cursor:pointer;">🪴 Plants</button>
          <button type="button" class="btn decor-cat-pill" data-cat="Partitions & Walls" style="font-size:11px;padding:4px 10px;border-radius:14px;background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;cursor:pointer;">🧱 Partitions</button>
          <button type="button" class="btn decor-cat-pill" data-cat="Lighting" style="font-size:11px;padding:4px 10px;border-radius:14px;background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;cursor:pointer;">💡 Lighting</button>
          <button type="button" class="btn decor-cat-pill" data-cat="Electronics & TV" style="font-size:11px;padding:4px 10px;border-radius:14px;background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;cursor:pointer;">📺 Electronics</button>
          <button type="button" class="btn decor-cat-pill" data-cat="Accents & Styling" style="font-size:11px;padding:4px 10px;border-radius:14px;background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;cursor:pointer;">✨ Accents</button>
        </div>
        <div id="decorPresetGrid" class="decor-preset-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(215px, 1fr));gap:12px;"></div>
      </div>"""

# Replace between <!-- Tab 1: Built-in Catalog --> and <!-- Tab 2: Custom 3D Model Upload -->
pattern = r'<!-- Tab 1: Built-in Catalog -->.*?<!-- Tab 2: Custom 3D Model Upload -->'
replacement = new_tab_presets + "\n\n      <!-- Tab 2: Custom 3D Model Upload -->"

assert re.search(pattern, content, flags=re.DOTALL) is not None, "Pattern not found in index.html"
content = re.sub(pattern, replacement, content, flags=re.DOTALL)

# Add script tag for orbix-decors-catalog.js if not present
if "orbix-decors-catalog.js" not in content:
    content = content.replace(
        '<script src="orbix-projects.js?v=14"></script>',
        '<script src="orbix-projects.js?v=14"></script>\n<script src="orbix-decors-catalog.js?v=14"></script>'
    )

open(html_path, "w", encoding="utf-8").write(content)
print("Successfully patched index.html with dynamic decor grid & orbix-decors-catalog.js script tag!")
