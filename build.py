#!/usr/bin/env python3
"""Build the single-file version of the site (for Claude Artifacts or
any host that wants one file). Usage: python3 build.py [out.html]"""
import sys, os, base64, re

here = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(here, 'index.html'), encoding='utf-8').read()
frag = src.split('<!-- ARTIFACT-START -->')[1].split('<!-- ARTIFACT-END -->')[0]
css = open(os.path.join(here, 'style.css'), encoding='utf-8').read()
orbix_icons_path = os.path.join(here, 'orbix-unit-icons.js')
orbix_unit_icons = open(orbix_icons_path, encoding='utf-8').read() if os.path.exists(orbix_icons_path) else ''
orbix_projects = open(os.path.join(here, 'orbix-projects.js'), encoding='utf-8').read()
orbix_core = open(os.path.join(here, 'orbix-core.js'), encoding='utf-8').read()
orbix_plan = open(os.path.join(here, 'orbix-plan.js'), encoding='utf-8').read()
orbix_3d = open(os.path.join(here, 'orbix-3d.js'), encoding='utf-8').read()
orbix_ui = open(os.path.join(here, 'orbix-ui.js'), encoding='utf-8').read()
js = open(os.path.join(here, 'app.js'), encoding='utf-8').read()
pwa_js = open(os.path.join(here, 'pwa.js'), encoding='utf-8').read()

logo_path = os.path.join(here, 'logo.jpeg')
if os.path.exists(logo_path):
    b64_logo = 'data:image/jpeg;base64,' + base64.b64encode(open(logo_path, 'rb').read()).decode('utf-8')
    frag = frag.replace('src="logo.jpeg"', 'src="' + b64_logo + '"')

furn_icon_path = os.path.join(here, 'icon-furniture.png')
if os.path.exists(furn_icon_path):
    b64_furn = 'data:image/png;base64,' + base64.b64encode(open(furn_icon_path, 'rb').read()).decode('utf-8')
    frag = frag.replace('src="icon-furniture.png"', 'src="' + b64_furn + '"')

cook_icon_path = os.path.join(here, 'icon-cookscape-unit.png')
if os.path.exists(cook_icon_path):
    b64_cook = 'data:image/png;base64,' + base64.b64encode(open(cook_icon_path, 'rb').read()).decode('utf-8')
    frag = frag.replace('src="icon-cookscape-unit.png"', 'src="' + b64_cook + '"')

frag = re.sub(r'<link rel="stylesheet" href="style\.css[^"]*">', '<style>\n' + css + '\n</style>', frag)
all_js = '<script>\n' + orbix_unit_icons + '\n' + orbix_projects + '\n' + orbix_core + '\n' + orbix_plan + '\n' + orbix_3d + '\n' + orbix_ui + '\n' + js + '\n' + pwa_js + '\n</script>'
pattern = r'(?:<script src="orbix-unit-icons\.js[^"]*"></script>\s*)?<script src="orbix-projects\.js[^"]*"></script>\s*<script src="orbix-core\.js[^"]*"></script>\s*<script src="orbix-plan\.js[^"]*"></script>\s*<script src="orbix-3d\.js[^"]*"></script>\s*<script src="orbix-ui\.js[^"]*"></script>\s*<script src="app\.js[^"]*"></script>\s*<script src="pwa\.js[^"]*"></script>'
frag = re.sub(pattern, lambda m: all_js, frag, flags=re.DOTALL)
out = frag.strip() + '\n'
dest = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, 'dist-single.html')
open(dest, 'w', encoding='utf-8').write(out)
print(dest, len(out), 'bytes')
