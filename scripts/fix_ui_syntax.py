with open('orbix-ui.js', 'rb') as f:
    content = f.read()

bad_bytes = b"          '</div>' +\r\n          '\r\n          '<div style=\"margin-top:10px;padding:8px 10px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;\">' +\r\n          '  <label style=\"font-size:11px;font-weight:700;color:#1e293b;display:block;margin-bottom:4px;\">\xf0\x9f\xa7\xb1 RCC Column Joint (Separate Wall)</label>' +\r\n          '  <div style=\"font-size:10.5px;color:#64748b;margin-bottom:6px;\">Split this straight wall into separate walls at an RCC joint:</div>' +\r\n          '  <div style=\"display:flex;gap:6px;\">' +\r\n          '    <button type=\"button\" class=\"btn small full\" id=\"inspWallSplitMid\" style=\"background:#0f172a;color:#ffffff;font-size:11px;\">\xe2\x9e\x95 RCC Joint at Midpoint (' + Math.round(lenMm / 2) + 'mm)</button>' +\r\n          '  </div>' +\r\n          '</div>' +\r\n          <button class=\"btn danger full\" id=\"inspDelWall\" style=\"margin-top:12px\">Delete Wall</button>'"

good_bytes = b"          '</div>' +\r\n          '<div style=\"margin-top:10px;padding:8px 10px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;\">' +\r\n          '  <label style=\"font-size:11px;font-weight:700;color:#1e293b;display:block;margin-bottom:4px;\">\xf0\x9f\xa7\xb1 RCC Column Joint (Separate Wall)</label>' +\r\n          '  <div style=\"font-size:10.5px;color:#64748b;margin-bottom:6px;\">Split this straight wall into separate walls at an RCC joint:</div>' +\r\n          '  <div style=\"display:flex;gap:6px;\">' +\r\n          '    <button type=\"button\" class=\"btn small full\" id=\"inspWallSplitMid\" style=\"background:#0f172a;color:#ffffff;font-size:11px;\">\xe2\x9e\x95 RCC Joint at Midpoint (' + Math.round(lenMm / 2) + 'mm)</button>' +\r\n          '  </div>' +\r\n          '</div>' +\r\n          '<button class=\"btn danger full\" id=\"inspDelWall\" style=\"margin-top:12px\">Delete Wall</button>'"

if bad_bytes in content:
    content = content.replace(bad_bytes, good_bytes)
    with open('orbix-ui.js', 'wb') as f:
        f.write(content)
    print("Fixed bad_bytes in orbix-ui.js successfully")
else:
    # Try normalizing line breaks
    import re
    # Match pattern
    pattern = re.compile(rb"'</div>' \+\s*'\s*'<div style=\"margin-top:10px.*?Delete Wall</button>';", re.DOTALL)
    m = pattern.search(content)
    if m:
        content = content[:m.start()] + good_bytes + content[m.end():]
        with open('orbix-ui.js', 'wb') as f:
            f.write(content)
        print("Regex replaced in orbix-ui.js successfully")
    else:
        print("Pattern not found!")

