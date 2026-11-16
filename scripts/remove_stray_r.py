with open('orbix-3d.js', 'rb') as f:
    content = f.read()

bad_str = b'    var group = new THREE.Group();\r\n    \\r\r\n    var wallMat = this.createWallFinishMaterial ? this.createWallFinishMaterial(wall) : this.materials.wall;'
if bad_str not in content:
    # Try with \n only
    bad_str = b'    var group = new THREE.Group();\n    \\r\n    var wallMat = this.createWallFinishMaterial ? this.createWallFinishMaterial(wall) : this.materials.wall;'

good_str = b'    var group = new THREE.Group();\r\n    group.name = \'Wall_\' + wall.id;\r\n    var wallMat = this.createWallFinishMaterial ? this.createWallFinishMaterial(wall) : this.materials.wall;'

assert bad_str in content, "bad_str not found in orbix-3d.js"

content = content.replace(bad_str, good_str, 1)

with open('orbix-3d.js', 'wb') as f:
    f.write(content)

print("Successfully removed stray \\r and restored group.name in orbix-3d.js")

