import re

with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Pattern for modalAIDecor block
pattern = re.compile(r'\s*<!-- ══════ MODAL: SMART AI DECOR STYLER ══════ -->.*?</div>\s*</div>\s*</div>\s*</div>', re.DOTALL)

matches = list(pattern.finditer(text))
print(f"Found {len(matches)} occurrences of modalAIDecor")

if len(matches) > 1:
    # Keep only the first one, remove the rest
    first = matches[0]
    out = text[:first.end()]
    last_end = first.end()
    for m in matches[1:]:
        out += text[last_end:m.start()]
        last_end = m.end()
    out += text[last_end:]
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(out)
    print("Cleaned up duplicates! Kept only 1 instance.")
else:
    print("Nothing to clean.")

