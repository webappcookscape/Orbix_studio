with open('orbix-core.js', 'r', encoding='utf-8') as f:
    content = f.read()

func_def = """  function formatFeetInches(mm) {
    if (typeof mm !== 'number' || isNaN(mm)) return '0"';
    var totalInches = mm / 25.4;
    var feet = Math.floor(totalInches / 12);
    var remInches = Math.round(totalInches % 12);
    if (remInches === 12) { feet += 1; remInches = 0; }
    if (feet === 0) return remInches + '"';
    if (remInches === 0) return feet + '\\'';
    return feet + '\\' ' + remInches + '"';
  }

  function toValidHexColor(val, fallback) {"""

target_above = "  function toValidHexColor(val, fallback) {"
assert target_above in content, "target_above not found in orbix-core.js"
content = content.replace(target_above, func_def)

export_target = "    toValidHexColor: toValidHexColor"
export_replacement = """    formatFeetInches: formatFeetInches,
    toValidHexColor: toValidHexColor"""
assert export_target in content, "export_target not found in orbix-core.js"
content = content.replace(export_target, export_replacement)

with open('orbix-core.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Added formatFeetInches to orbix-core.js successfully!")

