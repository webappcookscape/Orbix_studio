with open('orbix-3d.js', 'r', encoding='utf-8') as f:
    content = f.read()

old_end = """    group.position.set(start.x, 0, start.y);
    group.rotation.y = -angle;
    group.userData = {
      isWall: true,
      wallId: wall.id,
      wall: wall,
      start: { x: start.x, y: start.y },
      end: { x: wall.end.x, y: wall.end.y },
      isDivider: !!wall.isDivider,
      mid: { x: (start.x + wall.end.x) / 2, y: (start.y + wall.end.y) / 2 }
    };
    return group;"""

new_end = """    group.position.set(start.x, 0, start.y);
    group.rotation.y = -angle;
    group.userData = {
      isWall: true,
      wallId: wall.id,
      wall: wall,
      start: { x: start.x, y: start.y },
      end: { x: wall.end.x, y: wall.end.y },
      isDivider: !!wall.isDivider,
      mid: { x: (start.x + wall.end.x) / 2, y: (start.y + wall.end.y) / 2 }
    };
    group.traverse(function (child) {
      if (child.isMesh) {
        child.userData = child.userData || {};
        child.userData.isWall = true;
        child.userData.wallId = wall.id;
      }
    });
    return group;"""

assert old_end in content, "old_end not found in orbix-3d.js"
content = content.replace(old_end, new_end)

with open('orbix-3d.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated orbix-3d.js successfully!")

