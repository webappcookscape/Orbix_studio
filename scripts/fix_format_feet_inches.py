with open('orbix-plan.js', 'r', encoding='utf-8') as f:
    content = f.read()

old_code = """      var dimTxt = (this.unitSystem === 'imperial')
        ? (Core.formatFeetInches(rwMm) + ' × ' + Core.formatFeetInches(rhMm))
        : ((rwMm / 1000).toFixed(1) + 'm × ' + (rhMm / 1000).toFixed(1) + 'm  ·  ' + (r.areaSqM || 0).toFixed(1) + ' m²');"""

new_code = """      var dimTxt = (this.unitSystem === 'imperial')
        ? (this.formatDim(rwMm) + ' × ' + this.formatDim(rhMm))
        : ((rwMm / 1000).toFixed(1) + 'm × ' + (rhMm / 1000).toFixed(1) + 'm  ·  ' + (r.areaSqM || 0).toFixed(1) + ' m²');"""

assert old_code in content, "old_code not found in orbix-plan.js"
content = content.replace(old_code, new_code)

with open('orbix-plan.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated orbix-plan.js successfully!")

