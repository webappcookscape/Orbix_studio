import os, base64

dado_files = sorted(os.listdir('assets/textures/dado'))
dado_b64 = []
for f in dado_files:
    p = os.path.join('assets/textures/dado', f)
    with open(p, 'rb') as fp:
        dado_b64.append('data:image/jpeg;base64,' + base64.b64encode(fp.read()).decode('ascii'))

floor_files = sorted(os.listdir('assets/textures/floor'))
floor_b64 = []
for f in floor_files:
    p = os.path.join('assets/textures/floor', f)
    with open(p, 'rb') as fp:
        floor_b64.append('data:image/jpeg;base64,' + base64.b64encode(fp.read()).decode('ascii'))

print(f'Encoded {len(dado_b64)} dado tiles and {len(floor_b64)} floor tiles.')

# Write orbix-dado-textures.js
with open('orbix-dado-textures.js', 'w', encoding='utf-8') as f:
    f.write('/* Dado Tile Backsplash Textures - Cookscape / Orbix Studio */\n')
    f.write('(function () {\n')
    for i, b in enumerate(dado_b64):
        f.write(f'  var d{i+1} = "{b}";\n')
    f.write('  var textures = {\n')
    for i in range(len(dado_b64)):
        f.write(f'    dado_{i+1}: d{i+1},\n')
        f.write(f'    dado_tile_{i+1}: d{i+1},\n')
    f.write('    rhombus_sage: d1,\n')
    f.write('    chevron_mono: d2,\n')
    f.write('    subway_white: d4\n')
    f.write('  };\n')
    f.write('  if (typeof window !== "undefined") {\n')
    f.write('    window.ORBIX_DADO_TEXTURES = textures;\n')
    f.write('  }\n')
    f.write('  if (typeof module !== "undefined" && module.exports) {\n')
    f.write('    module.exports = textures;\n')
    f.write('  }\n')
    f.write('})();\n')

# Write orbix-floor-textures.js
with open('orbix-floor-textures.js', 'w', encoding='utf-8') as f:
    f.write('/* Orbix Studio Floor Tile Textures - Cookscape / Orbix Studio */\n')
    f.write('(function () {\n')
    for i, b in enumerate(floor_b64):
        f.write(f'  var t{i+1} = "{b}";\n')
    f.write('  var textures = {\n')
    for i in range(len(floor_b64)):
        f.write(f'    tile_{i+1}: t{i+1},\n')
        f.write(f'    floor_tile_{i+1}: t{i+1},\n')
        f.write(f'    designer_tile_{i+1}: t{i+1},\n')
        f.write(f'    custom_tile_{i+1}: t{i+1},\n')
    f.write('  };\n')
    f.write('  if (typeof window !== "undefined") {\n')
    f.write('    window.ORBIX_FLOOR_TEXTURES = textures;\n')
    f.write('  }\n')
    f.write('  if (typeof module !== "undefined" && module.exports) {\n')
    f.write('    module.exports = textures;\n')
    f.write('  }\n')
    f.write('})();\n')

print('Generated orbix-dado-textures.js and orbix-floor-textures.js successfully!')
