with open('app.js', 'rb') as f:
    app_content = f.read()

# 1. Update makeGrassGroundMat in app.js
i1 = app_content.find(b'function makeGrassGroundMat() {')
i2 = app_content.find(b'function makeNeutralGroundMat() {')

old_green_fn = b'''function makeGrassGroundMat() {
      if (matCache["sp|grassGround"]) return matCache["sp|grassGround"];
      var c = document.createElement("canvas"); c.width = c.height = 512;
      var g = c.getContext("2d");
      if (g) {
        // Rich natural lawn grass green base
        g.fillStyle = "#46813A";
        g.fillRect(0, 0, 512, 512);

        // Organic grass sod tone variations
        var lawnTones = ["#3D7333", "#4A883E", "#559947", "#3E7834", "#4F9042", "#5C9F4E"];
        for (var i = 0; i < 400; i++) {
          var x = Math.random() * 512, y = Math.random() * 512, rad = 8 + Math.random() * 24;
          var grad = g.createRadialGradient(x, y, 0, x, y, rad);
          var col = lawnTones[Math.floor(Math.random() * lawnTones.length)];
          grad.addColorStop(0, col);
          grad.addColorStop(1, "rgba(70, 129, 58, 0)");
          g.fillStyle = grad;
          g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
        }

        // Fine lawn grass blades
        for (var b = 0; b < 2500; b++) {
          var bx = Math.random() * 512, by = Math.random() * 512, blen = 3 + Math.random() * 7;
          var bcol = (b % 3 === 0) ? "#65AD55" : ((b % 3 === 1) ? "#3B6E32" : "#4B893F");
          g.strokeStyle = bcol; g.lineWidth = 1.0;
          g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + (Math.random() - 0.5) * 3, by - blen); g.stroke();
        }
      }

      var tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(160, 160);
      tex.encoding = THREE.sRGBEncoding;

      var m = new THREE.MeshStandardMaterial({
        map: tex,
        color: 0x4E8A42, // Rich natural lawn grass green
        roughness: 0.92,
        metalness: 0.0,
        polygonOffset: true,
        polygonOffsetFactor: 2.0,
        polygonOffsetUnits: 2.0,
        side: THREE.DoubleSide
      });
      matCache["sp|grassGround"] = m;
      return m;
    }
    '''

assert i1 != -1 and i2 != -1, "makeGrassGroundMat not found in app.js"
app_content = app_content[:i1] + old_green_fn + app_content[i2:]

# HemisphereLight ground color
app_content = app_content.replace(b'THREE.HemisphereLight(0x82C3EC, 0xE6E2D8, 0.55)', b'THREE.HemisphereLight(0x82C3EC, 0x4E8A42, 0.55)')

with open('app.js', 'wb') as f:
    f.write(app_content)
print("Updated app.js with old green grass")

# 2. Update orbix-3d.js
with open('orbix-3d.js', 'rb') as f:
    three_content = f.read()

three_content = three_content.replace(b'color: 0xE6E2D8, // Soft pastel exterior ground', b'color: 0x4E8A42, // Lush natural grass green')
with open('orbix-3d.js', 'wb') as f:
    f.write(three_content)
print("Updated orbix-3d.js with 0x4E8A42")

# 3. Update orbix-ui.js
with open('orbix-ui.js', 'rb') as f:
    ui_content = f.read()

ui_content = ui_content.replace(b'c.material.color.setHex(0xE6E2D8);', b'c.material.color.setHex(0x4E8A42);')
with open('orbix-ui.js', 'wb') as f:
    f.write(ui_content)
print("Updated orbix-ui.js with 0x4E8A42")

