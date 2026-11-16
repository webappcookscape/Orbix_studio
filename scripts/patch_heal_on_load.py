with open('orbix-ui.js', 'r', encoding='utf-8') as f:
    ui_content = f.read()

old_ui_load = """      this.project = proj;
      if (typeof Core !== 'undefined' && typeof Core.detectRooms === 'function') {
        try { Core.detectRooms(this.project); } catch (e) { console.warn('[Orbix UI] detectRooms on load:', e); }
      }"""

new_ui_load = """      this.project = proj;
      if (typeof Core !== 'undefined' && typeof Core.healCollinearWalls === 'function') {
        try { Core.healCollinearWalls(this.project); } catch (e) { }
      }
      if (typeof Core !== 'undefined' && typeof Core.detectRooms === 'function') {
        try { Core.detectRooms(this.project); } catch (e) { console.warn('[Orbix UI] detectRooms on load:', e); }
      }"""

assert old_ui_load in ui_content, "old_ui_load not found in orbix-ui.js"
ui_content = ui_content.replace(old_ui_load, new_ui_load, 1)

with open('orbix-ui.js', 'w', encoding='utf-8') as f:
    f.write(ui_content)
print("Updated orbix-ui.js successfully!")

with open('orbix-projects.js', 'r', encoding='utf-8') as f:
    proj_content = f.read()

old_proj_load = """      // Load 2D floor plan into OrbixUI
      if (window.OrbixUI && planToLoad && typeof window.OrbixUI.loadProject === 'function') {"""

new_proj_load = """      // Heal any sliced collinear walls before loading into workspace
      if (window.OrbixCore && planToLoad && typeof window.OrbixCore.healCollinearWalls === 'function') {
        try { window.OrbixCore.healCollinearWalls(planToLoad); } catch (e) { }
      }

      // Load 2D floor plan into OrbixUI
      if (window.OrbixUI && planToLoad && typeof window.OrbixUI.loadProject === 'function') {"""

assert old_proj_load in proj_content, "old_proj_load not found in orbix-projects.js"
proj_content = proj_content.replace(old_proj_load, new_proj_load, 1)

with open('orbix-projects.js', 'w', encoding='utf-8') as f:
    f.write(proj_content)
print("Updated orbix-projects.js successfully!")

