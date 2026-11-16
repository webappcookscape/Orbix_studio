import os, base64

here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
g1_path = os.path.join(here, 'assets', 'textures', 'countertops', 'granite_black_galaxy.jpg')
g2_path = os.path.join(here, 'assets', 'textures', 'countertops', 'granite_kashmir_white.jpg')
g3_path = os.path.join(here, 'assets', 'textures', 'countertops', 'granite_tan_brown.jpg')

g1_b64 = 'data:image/jpeg;base64,' + base64.b64encode(open(g1_path, 'rb').read()).decode('utf-8')
g2_b64 = 'data:image/jpeg;base64,' + base64.b64encode(open(g2_path, 'rb').read()).decode('utf-8')
g3_b64 = 'data:image/jpeg;base64,' + base64.b64encode(open(g3_path, 'rb').read()).decode('utf-8')

content = f'''/* Realistic Granite Countertop Textures - Cookscape / Orbix Studio */
(function () {{
  var gBlackGalaxy = "{g1_b64}";
  var gKashmirWhite = "{g2_b64}";
  var gTanBrown = "{g3_b64}";

  var textures = {{
    granite_black_galaxy: gBlackGalaxy,
    granite_1: gBlackGalaxy,
    black_galaxy: gBlackGalaxy,
    granite_kashmir_white: gKashmirWhite,
    granite_2: gKashmirWhite,
    kashmir_white: gKashmirWhite,
    river_white: gKashmirWhite,
    granite_tan_brown: gTanBrown,
    granite_3: gTanBrown,
    tan_brown: gTanBrown
  }};

  if (typeof window !== "undefined") {{
    window.ORBIX_COUNTERTOP_TEXTURES = textures;
  }}
  if (typeof module !== "undefined" && module.exports) {{
    module.exports = textures;
  }}
}})();
'''

out_path = os.path.join(here, 'orbix-countertop-textures.js')
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'Wrote {out_path} successfully. Size: {len(content)} bytes')
