import base64

p1 = 'textures/dado-rhombus-sage.jpg'
p2 = 'textures/dado-chevron-mono.jpg'

b1 = base64.b64encode(open(p1, 'rb').read()).decode('ascii')
b2 = base64.b64encode(open(p2, 'rb').read()).decode('ascii')

content = f'''/* Dado Tile Backsplash Textures */
window.ORBIX_DADO_TEXTURES = {{
  rhombus_sage: "data:image/jpeg;base64,{b1}",
  chevron_mono: "data:image/jpeg;base64,{b2}"
}};
'''

with open('orbix-dado-textures.js', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Generated orbix-dado-textures.js ({len(content)} bytes)")

