#!/usr/bin/env python3
"""Build the single-file version of the site (for Claude Artifacts or
any host that wants one file). Usage: python3 build.py [out.html]"""
import sys, os, base64

here = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(here, 'index.html'), encoding='utf-8').read()
frag = src.split('<!-- ARTIFACT-START -->')[1].split('<!-- ARTIFACT-END -->')[0]
css = open(os.path.join(here, 'style.css'), encoding='utf-8').read()
orbix_core = open(os.path.join(here, 'orbix-core.js'), encoding='utf-8').read()
orbix_plan = open(os.path.join(here, 'orbix-plan.js'), encoding='utf-8').read()
orbix_3d = open(os.path.join(here, 'orbix-3d.js'), encoding='utf-8').read()
orbix_ui = open(os.path.join(here, 'orbix-ui.js'), encoding='utf-8').read()
js = open(os.path.join(here, 'app.js'), encoding='utf-8').read()

logo_path = os.path.join(here, 'logo.jpeg')
if os.path.exists(logo_path):
    b64_logo = 'data:image/jpeg;base64,' + base64.b64encode(open(logo_path, 'rb').read()).decode('utf-8')
    frag = frag.replace('src="logo.jpeg"', 'src="' + b64_logo + '"')

frag = frag.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + css + '\n</style>')
all_js = '<script>\n' + orbix_core + '\n' + orbix_plan + '\n' + orbix_3d + '\n' + orbix_ui + '\n' + js + '\n</script>'
frag = frag.replace('<script src="orbix-core.js"></script>\n<script src="orbix-plan.js"></script>\n<script src="orbix-3d.js"></script>\n<script src="orbix-ui.js"></script>\n<script src="app.js"></script>', all_js)
out = frag.strip() + '\n'
dest = sys.argv[1] if len(sys.argv) > 1 else os.path.join(here, 'dist-single.html')
open(dest, 'w', encoding='utf-8').write(out)
print(dest, len(out), 'bytes')
