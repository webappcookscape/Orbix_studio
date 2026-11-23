#!/usr/bin/env python3
"""
Pure Python Standard-Library Master-Template PDF Exporter (ZERO PIL / ZERO ReportLab / ZERO external binaries):
- Embeds exact Master-Template JPEG slides directly via PDF /DCTDecode streams (Cover, Intro 2-6,
  all 9 Variant Dividers, Master Logo, Closing Slide 41).
- Renders crisp A4 Portrait (595.28 x 841.89 pt) vector Specification Tables, Unit-Wise Breakdown
  tables, Approved Commercial Quotation Summaries (with Head-approved Discounts/ADP), Process/Policy
  tables, Terms & Conditions, and FAQs.
"""

import json
import os
import re
import struct
import sys
import zlib

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(ROOT_DIR, 'server', 'quote-assets')
TEMPLATE_DATA_PATH = os.path.join(ASSETS_DIR, 'template-data.json')

PAGE_W = 595.28   # A4 Portrait width in pt
PAGE_H = 841.89   # A4 Portrait height in pt
CANVAS_W = 1060.0
CANVAS_H = 1498.0

# Brand Colors (0..1 RGB)
C_CREAM = (244 / 255.0, 237 / 255.0, 227 / 255.0)
C_FOREST = (8 / 255.0, 35 / 255.0, 27 / 255.0)
C_CRIMSON = (192 / 255.0, 0.0, 0.0)
C_WHITE = (1.0, 1.0, 1.0)
C_ALT = (250 / 255.0, 246 / 255.0, 240 / 255.0)
C_BORDER = (210 / 255.0, 198 / 255.0, 182 / 255.0)
C_MUTED = (71 / 255.0, 85 / 255.0, 105 / 255.0)
C_GOLD = (254 / 255.0, 243 / 255.0, 199 / 255.0)
C_DISC_BG = (255 / 255.0, 244 / 255.0, 229 / 255.0)
C_DISC_BORDER = (234 / 255.0, 88 / 255.0, 12 / 255.0)
C_DISC_TEXT = (154 / 255.0, 52 / 255.0, 18 / 255.0)
C_DISC_VAL = (194 / 255.0, 65 / 255.0, 12 / 255.0)
C_SAVE_BG = (220 / 255.0, 252 / 255.0, 231 / 255.0)
C_SAVE_BORDER = (22 / 255.0, 163 / 255.0, 74 / 255.0)
C_SAVE_TEXT = (20 / 255.0, 83 / 255.0, 45 / 255.0)
C_SAVE_VAL = (21 / 255.0, 128 / 255.0, 61 / 255.0)


def normalize_tier_key(raw):
    s = str(raw or '').strip().lower()
    if s in ('zappo - el pearl', 'zappo-el pearl', 'zappo-el-pearl', 'zappo el pearl', 'zappo', 'p1', 'price 1', 'price1'):
        return 'zappo - el pearl'
    if s in ('pot&cafe', 'pot & cafe', 'pot and cafe', 'pot cafe', 'p2', 'price 2', 'price2'):
        return 'pot&cafe'
    if s in ('homespace', 'home space', 'home-space', 'p3', 'price 3', 'price3'):
        return 'homespace'
    if s in ('cafehunt', 'cafe hunt', 'café hunt', 'cafe-hunt', 'livlame', 'p4', 'price 4', 'price4'):
        return 'cafehunt'
    if s in ('ll elite', 'llelite', 'livelane', 'live lane'):
        return 'LL elite'
    if s in ('cc matte', 'ccmatte', 'capricoast matte'):
        return 'CC MATTE'
    if s in ('cc glossy', 'ccglossy', 'capricost glossy', 'capricoast glossy', 'capricost'):
        return 'CC GLOSSY'
    if s in ('surabhi', 'elegant surabhi'):
        return 'SURABHI'
    if s in ('mr+', 'mr plus', '4x tuff gloss', '4x tg', '4xtg', 'tuff gloss'):
        return 'MR+'
    return None


def fmt_inr(val):
    n = int(round(float(val or 0)))
    neg = n < 0
    s = str(abs(n))
    if len(s) > 3:
        last3 = s[-3:]
        rest = s[:-3]
        parts = []
        while len(rest) > 2:
            parts.append(rest[-2:])
            rest = rest[:-2]
        if rest:
            parts.append(rest)
        parts.reverse()
        s = ','.join(parts) + ',' + last3
    return ('- Rs. ' if neg else 'Rs. ') + s


def pdf_safe_text(text):
    s = str(text or '')
    repls = {
        '₹': 'Rs. ', '—': '-', '–': '-', '•': '-', '’': "'", '‘': "'",
        '“': '"', '”': '"', 'é': 'e', 'É': 'E', '\xa0': ' ', '\t': ' '
    }
    for k, v in repls.items():
        s = s.replace(k, v)
    s = s.encode('latin-1', errors='ignore').decode('latin-1')
    return s.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')


def read_jpeg_size(data):
    """Parse JPEG width & height from SOF markers in pure Python."""
    if not data or len(data) < 4 or data[0:2] != b'\xff\xd8':
        return (1060, 1498)
    i = 2
    n = len(data)
    while i + 9 < n:
        if data[i] != 0xFF:
            i += 1
            continue
        while i < n and data[i] == 0xFF:
            i += 1
        if i >= n:
            break
        marker = data[i]
        i += 1
        if marker in (0xD8, 0xD9, 0x01) or (0xD0 <= marker <= 0xD7):
            continue
        if i + 2 > n:
            break
        seg_len = struct.unpack('>H', data[i:i + 2])[0]
        if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
            if i + 7 <= n:
                h, w = struct.unpack('>HH', data[i + 3:i + 7])
                return (w, h)
        i += max(2, seg_len)
    return (1060, 1498)


def wrap_text(text, max_width_pt, font_size, bold=False):
    avg_char_w = font_size * (0.55 if bold else 0.51)
    max_chars = max(8, int(max_width_pt / max(1.0, avg_char_w)))
    out = []
    for para in str(text or '').split('\n'):
        words = para.strip().split()
        if not words:
            continue
        line = ''
        for w in words:
            test = (line + ' ' + w) if line else w
            if len(test) > max_chars and line:
                out.append(line)
                line = w
            else:
                line = test
        if line:
            out.append(line)
    return out or ['']


class SimplePdfBuilder:
    def __init__(self):
        self.images = {}       # asset_name -> {'name': 'Im1', 'data': bytes, 'w': int, 'h': int, 'obj_id': None}
        self.pages = []        # list of {'stream': str, 'im_keys': set}

    def register_jpeg(self, asset_filename):
        if asset_filename in self.images:
            return self.images[asset_filename]['name']
        full_path = os.path.join(ASSETS_DIR, os.path.basename(asset_filename))
        if not os.path.exists(full_path):
            return None
        with open(full_path, 'rb') as f:
            raw = f.read()
        w, h = read_jpeg_size(raw)
        im_name = f'Im{len(self.images) + 1}'
        self.images[asset_filename] = {'name': im_name, 'data': raw, 'w': w, 'h': h, 'obj_id': None}
        return im_name

    def add_page(self, stream_ops, used_assets):
        self.pages.append({'stream': '\n'.join(stream_ops), 'assets': list(used_assets)})

    def write(self, out_path):
        objects = []  # 1-indexed list of bytes

        def add_obj(body_bytes):
            objects.append(body_bytes)
            return len(objects)

        # Reserve 1: Catalog, 2: Pages, 3: Helvetica, 4: Helvetica-Bold, 5: Times-Roman
        catalog_id = add_obj(b'')
        pages_id = add_obj(b'')
        f_reg_id = add_obj(b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
        f_bld_id = add_obj(b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
        f_ser_id = add_obj(b'<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman /Encoding /WinAnsiEncoding >>')

        # Image XObjects
        for _, im in self.images.items():
            hdr = (
                f"<< /Type /XObject /Subtype /Image /Width {im['w']} /Height {im['h']} "
                f"/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length {len(im['data'])} >>\nstream\n"
            ).encode('ascii')
            im['obj_id'] = add_obj(hdr + im['data'] + b'\nendstream')

        page_ids = []
        for pg in self.pages:
            raw_stream = pg['stream'].encode('latin-1', errors='ignore')
            compressed = zlib.compress(raw_stream, 6)
            content_id = add_obj(
                f'<< /Length {len(compressed)} /Filter /FlateDecode >>\nstream\n'.encode('ascii')
                + compressed + b'\nendstream'
            )
            xobj_entries = []
            seen_im = set()
            for a_fn in pg['assets']:
                im = self.images.get(a_fn)
                if im and im['name'] not in seen_im:
                    seen_im.add(im['name'])
                    xobj_entries.append(f"/{im['name']} {im['obj_id']} 0 R")
            xobj_dict = f'/XObject << {" ".join(xobj_entries)} >>' if xobj_entries else ''
            page_dict = (
                f'<< /Type /Page /Parent {pages_id} 0 R '
                f'/MediaBox [0 0 {PAGE_W:.2f} {PAGE_H:.2f}] '
                f'/Resources << /Font << /F1 {f_reg_id} 0 R /F2 {f_bld_id} 0 R /F3 {f_ser_id} 0 R >> {xobj_dict} >> '
                f'/Contents {content_id} 0 R >>'
            ).encode('ascii')
            page_ids.append(add_obj(page_dict))

        kids_str = ' '.join(f'{pid} 0 R' for pid in page_ids)
        objects[pages_id - 1] = f'<< /Type /Pages /Kids [{kids_str}] /Count {len(page_ids)} >>'.encode('ascii')
        objects[catalog_id - 1] = f'<< /Type /Catalog /Pages {pages_id} 0 R >>'.encode('ascii')

        buf = bytearray(b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')
        offsets = [0]
        for idx, body in enumerate(objects, start=1):
            offsets.append(len(buf))
            buf.extend(f'{idx} 0 obj\n'.encode('ascii'))
            buf.extend(body)
            buf.extend(b'\nendobj\n')

        xref_pos = len(buf)
        buf.extend(f'xref\n0 {len(objects) + 1}\n0000000000 65535 f \n'.encode('ascii'))
        for off in offsets[1:]:
            buf.extend(f'{off:010d} 00000 n \n'.encode('ascii'))
        buf.extend(
            f'trailer\n<< /Size {len(objects) + 1} /Root {catalog_id} 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n'.encode('ascii')
        )
        with open(out_path, 'wb') as f:
            f.write(buf)


def y_top_to_pdf(y_top, h=0.0):
    return PAGE_H - y_top - h


def op_rect(x, y_top, w, h, fill=None, stroke=None, lw=0.6):
    y_b = y_top_to_pdf(y_top, h)
    parts = ['q']
    if fill:
        parts.append(f'{fill[0]:.3f} {fill[1]:.3f} {fill[2]:.3f} rg')
    if stroke:
        parts.append(f'{lw:.2f} w {stroke[0]:.3f} {stroke[1]:.3f} {stroke[2]:.3f} RG')
    parts.append(f'{x:.2f} {y_b:.2f} {w:.2f} {h:.2f} re')
    if fill and stroke:
        parts.append('B')
    elif fill:
        parts.append('f')
    elif stroke:
        parts.append('S')
    parts.append('Q')
    return ' '.join(parts)


def op_text(text, x, y_top, size=10.0, color=C_FOREST, font='F1', align='l', box_w=0.0):
    safe = pdf_safe_text(text)
    if not safe:
        return ''
    est_w = len(safe) * size * (0.53 if font == 'F2' else 0.49)
    draw_x = x
    if align == 'r' and box_w > 0:
        draw_x = max(x, x + box_w - est_w)
    elif align == 'c' and box_w > 0:
        draw_x = x + max(0.0, (box_w - est_w) / 2.0)
    y_base = PAGE_H - y_top - size * 0.82
    return f'BT /{font} {size:.1f} Tf {color[0]:.3f} {color[1]:.3f} {color[2]:.3f} rg 1 0 0 1 {draw_x:.2f} {y_base:.2f} Tm ({safe}) Tj ET'


def op_image(im_name, x, y_top, w, h):
    y_b = y_top_to_pdf(y_top, h)
    return f'q {w:.2f} 0 0 {h:.2f} {x:.2f} {y_b:.2f} cm /{im_name} Do Q'


def add_footer(ops, footer_text, page_num, show_footer=True):
    if show_footer and footer_text:
        ops.append(op_text(footer_text, 26, PAGE_H - 22, size=8.0, color=C_MUTED, font='F1'))
    ops.append(op_text(str(page_num), PAGE_W - 60, PAGE_H - 22, size=8.5, color=C_MUTED, font='F2', align='r', box_w=34))


def draw_frame_header(pdf, ops, used_assets, logo_asset, logo_rect, title, subtitle=''):
    ops.append(op_rect(0, 0, PAGE_W, PAGE_H, fill=C_CREAM))
    if logo_asset:
        im_name = pdf.register_jpeg(logo_asset)
        if im_name:
            used_assets.add(logo_asset)
            sx = PAGE_W / CANVAS_W
            sy = PAGE_H / CANVAS_H
            ops.append(op_image(
                im_name,
                logo_rect['x'] * sx, logo_rect['y'] * sy,
                logo_rect['w'] * sx, logo_rect['h'] * sy
            ))
    ops.append(op_text(title, 30, 74, size=17.0, color=C_FOREST, font='F2'))
    if subtitle:
        ops.append(op_text(subtitle, 30, 96, size=9.5, color=C_MUTED, font='F1'))
    ops.append(op_rect(30, 112, PAGE_W - 60, 1.5, fill=C_CRIMSON))


def draw_table_ops(ops, rows, x, y, total_w, col_ratios, font_size=8.2, header_fill=C_CRIMSON, right_cols=None, bold_first=False, pad_y=4.5):
    right_cols = set(right_cols or [])
    col_ws = [total_w * r for r in col_ratios]

    for r_idx, row in enumerate(rows):
        is_hdr = (r_idx == 0)
        is_hl = False
        is_accent = False
        is_bold_row = False
        custom_bg = None
        custom_border = None
        custom_lw = None
        custom_text_color = None
        custom_val_color = None
        r_font = font_size
        r_val_font = font_size
        r_pad_y = pad_y
        cells = row
        if isinstance(row, dict):
            cells = row.get('cells', [])
            is_hl = bool(row.get('highlight'))
            is_accent = bool(row.get('accent'))
            is_bold_row = bool(row.get('bold')) or is_hl
            custom_bg = row.get('bg')
            custom_border = row.get('border')
            custom_lw = row.get('lw')
            custom_text_color = row.get('text_color')
            custom_val_color = row.get('val_color')
            if row.get('font_size'):
                r_font = float(row['font_size'])
            r_val_font = float(row.get('val_font_size') or r_font)
            if row.get('pad_y'):
                r_pad_y = float(row['pad_y'])

        line_h = max(r_font, r_val_font) * 1.28

        wrapped = []
        max_lines = 1
        for c_idx in range(len(col_ws)):
            raw_val = cells[c_idx] if c_idx < len(cells) else ''
            c_fs = r_val_font if (c_idx == len(col_ws) - 1 and not is_hdr) else r_font
            ls = wrap_text(raw_val, col_ws[c_idx] - 10, c_fs, bold=(is_hdr or is_bold_row or (c_idx == 0 and bold_first)))
            wrapped.append(ls)
            max_lines = max(max_lines, len(ls))

        row_h = max(18.0, max_lines * line_h + r_pad_y * 2)
        if y + row_h > PAGE_H - 36:
            break

        if is_hdr:
            bg = header_fill
        elif custom_bg is not None:
            bg = custom_bg
        elif is_hl:
            bg = C_GOLD
        else:
            bg = C_WHITE if r_idx % 2 == 1 else C_ALT

        stroke_c = custom_border if custom_border is not None else (C_CRIMSON if is_hl else C_BORDER)
        stroke_lw = custom_lw if custom_lw is not None else (1.3 if is_hl else 0.5)
        ops.append(op_rect(x, y, total_w, row_h, fill=bg, stroke=stroke_c, lw=stroke_lw))

        cx = x
        for c_idx, cw in enumerate(col_ws):
            if c_idx > 0:
                ops.append(op_rect(cx, y, 0.5, row_h, fill=(custom_border or C_BORDER)))
            is_last_col = (c_idx == len(col_ws) - 1)
            c_fs = r_val_font if (is_last_col and not is_hdr) else r_font
            fnt = 'F2' if (is_hdr or is_bold_row or (c_idx == 0 and bold_first)) else 'F1'
            if is_hdr:
                clr = C_WHITE
            elif is_last_col and custom_val_color is not None:
                clr = custom_val_color
            elif is_last_col and is_accent:
                clr = C_CRIMSON
            elif custom_text_color is not None:
                clr = custom_text_color
            else:
                clr = C_FOREST
            algn = 'r' if (c_idx in right_cols and not is_hdr) else 'l'
            text_y_start = y + (row_h - len(wrapped[c_idx]) * line_h) / 2.0 + (line_h - c_fs) * 0.35
            for li, line in enumerate(wrapped[c_idx]):
                ops.append(op_text(line, cx + 5, text_y_start + li * line_h, size=c_fs, color=clr, font=fnt, align=algn, box_w=cw - 10))
            cx += cw

        y += row_h
    return y


def resolve_variant_unit_finish(tpl_v, item):
    import re as _re
    if item and str(item.get('refCode') or '').upper() == 'CIV':
        return str(item.get('finish') or 'Included Civil Scope')
    tables = (tpl_v or {}).get('specTables') or []
    if not tables:
        return str((item or {}).get('finish') or '-')
    ctx = f"{(item or {}).get('room') or ''} {(item or {}).get('name') or ''}".lower()
    is_kitchen = bool(_re.search(r'(kitchen|utility|pantry|crockery|hob|sink|tall\s*unit|base\s*unit|wall\s*unit|loft\s*kitchen)', ctx))

    chosen = tables[0]
    if len(tables) > 1:
        k_tbl = next((t for t in tables if t and t[0] and 'kitchen' in str(t[0][0]).lower()), None)
        w_tbl = next((t for t in tables if t and t[0] and 'wardrobe' in str(t[0][0]).lower()), None)
        chosen = (k_tbl or tables[0]) if is_kitchen else (w_tbl or tables[1] or tables[0])

    carcass = ''
    k_carcass = ''
    w_carcass = ''
    shutter_mat = ''
    shutter_finishes = []
    laminate_brand = ''

    for row in chosen[1:]:
        if not isinstance(row, list) or len(row) < 2:
            continue
        k = str(row[0] or '').strip().lower()
        v = str(row[1] or '').strip()
        if not v or v == '-':
            continue
        if 'kitchen' in k and 'carcass' in k:
            k_carcass = k_carcass or v
        elif 'wardrobe' in k and 'carcass' in k:
            w_carcass = w_carcass or v
        elif k == 'carcass material' or 'carcass' in k:
            carcass = carcass or v
        elif k == 'shutter material':
            shutter_mat = shutter_mat or v
        elif k == 'shutter finish':
            shutter_finishes.append(v)
        elif 'laminate' in k and 'brand' in k:
            laminate_brand = laminate_brand or v

    resolved_carcass = (k_carcass or carcass or w_carcass) if is_kitchen else (w_carcass or carcass or k_carcass)
    resolved_finish = (shutter_finishes[0] if is_kitchen else shutter_finishes[1]) if len(shutter_finishes) > 1 else (shutter_finishes[0] if shutter_finishes else '')

    parts = []
    if resolved_carcass:
        parts.append('Carcass: ' + resolved_carcass)
    s_bits = []
    if shutter_mat:
        s_bits.append(shutter_mat)
    if resolved_finish and resolved_finish.lower() != shutter_mat.lower():
        s_bits.append(resolved_finish)
    if not s_bits and laminate_brand:
        s_bits.append(laminate_brand)
    if s_bits:
        parts.append('Shutter: ' + ' / '.join(s_bits))

    joined = _re.sub(r'\s+', ' ', ' | '.join(parts)).strip()
    return joined or str((item or {}).get('finish') or '-')


def build_pdf(payload, out_path):
    if not os.path.exists(TEMPLATE_DATA_PATH):
        raise FileNotFoundError(f'Missing {TEMPLATE_DATA_PATH}')
    with open(TEMPLATE_DATA_PATH, 'r', encoding='utf-8') as f:
        tpl = json.load(f)

    pdf = SimplePdfBuilder()
    meta = payload.get('meta') or {}
    designer = payload.get('designer') or {}
    client_name = str(payload.get('clientName') or meta.get('clientName') or 'Valued Client')
    client_phone = str(payload.get('clientPhone') or meta.get('phone') or '-')
    site_addr = str(payload.get('siteAddress') or meta.get('siteAddress') or '-')
    quote_code = str(payload.get('quoteCode') or meta.get('quoteId') or '')
    issue_date = str(meta.get('dateCreated') or '')
    footer_text = ' | '.join([p for p in [client_name, site_addr, client_phone] if p and p != '-']) or 'Cookscape Interiors'

    assets = tpl.get('assets') or {}
    logo_asset = assets.get('masterLogo') or 'master_logo.jpg'
    logo_rect = assets.get('masterLogoRect') or {'x': 658.6, 'y': 29.0, 'w': 368.6, 'h': 69.1}

    page_counter = 0

    # 1. Cover Page (Slide 1)
    page_counter += 1
    cover_asset = assets.get('coverBg') or 'slide_01_bg.jpg'
    c_ops = []
    c_used = set()
    im_cov = pdf.register_jpeg(cover_asset)
    if im_cov:
        c_used.add(cover_asset)
        c_ops.append(op_image(im_cov, 0, 0, PAGE_W, PAGE_H))
    slots = ((assets.get('coverLayout') or {}).get('dynamicSlots')) or {}
    sx = PAGE_W / CANVAS_W
    sy = PAGE_H / CANVAS_H
    slot_vals = [
        ('patron_name', client_name, (255.4, 854.1, 379.9), 12.0, 'F3', 4.5),
        ('patron_phone', client_phone, (255.4, 906.7, 379.9), 12.0, 'F3', 4.5),
        ('patron_location', site_addr, (255.4, 958.4, 379.9), 11.5, 'F3', 4.5),
        ('patron_date', issue_date, (255.4, 1006.6, 379.9), 12.0, 'F3', 4.5),
        ('designer_name', designer.get('name') or meta.get('designerName') or 'Cookscape Team', (664.8, 1127.3, 290.2), 10.0, 'F3', 3.0),
        ('designer_phone', designer.get('phone') or meta.get('designerPhone') or '-', (664.8, 1178.9, 290.2), 10.0, 'F3', 3.0),
        ('designer_email', designer.get('email') or 'designs.cookscape@gmail.com', (664.8, 1223.5, 290.2), 9.0, 'F1', 3.5),
    ]
    for key, val, fb, sz, fnt, dy in slot_vals:
        txt = str(val or '').strip()
        if not txt:
            continue
        box = slots.get(key) or {'x': fb[0], 'y': fb[1], 'w': fb[2]}
        c_ops.append(op_text(txt, (box['x'] + 6) * sx, box['y'] * sy + dy, size=sz, color=C_FOREST, font=fnt))
    pdf.add_page(c_ops, c_used)

    # 2. Intro Slides (Slides 2 - 6)
    for intro in (assets.get('introSlides') or []):
        page_counter += 1
        ops = []
        used = set()
        im_n = pdf.register_jpeg(intro['asset'])
        if im_n:
            used.add(intro['asset'])
            ops.append(op_image(im_n, 0, 0, PAGE_W, PAGE_H))
        add_footer(ops, footer_text, page_counter, show_footer=(intro.get('id') == 'intro_2'))
        pdf.add_page(ops, used)

    # 3. Selected Variants in Master-Template Order
    variant_by_key = {v['key']: v for v in (tpl.get('variants') or [])}
    selected_map = {}
    for vq in (payload.get('variantQuotes') or []):
        nk = normalize_tier_key(vq.get('tierKey') or vq.get('tierName') or vq.get('tierTitle'))
        if nk and nk not in selected_map:
            selected_map[nk] = vq

    for tpl_v in (tpl.get('variants') or []):
        vq = selected_map.get(tpl_v['key'])
        if not vq:
            continue
        v_title = tpl_v['title']

        # 3a. Divider Slide
        page_counter += 1
        ops = []
        used = set()
        im_div = pdf.register_jpeg(tpl_v['dividerAsset'])
        if im_div:
            used.add(tpl_v['dividerAsset'])
            ops.append(op_image(im_div, 0, 0, PAGE_W, PAGE_H))
        add_footer(ops, footer_text, page_counter, True)
        pdf.add_page(ops, used)

        # 3b. Specification Slide
        page_counter += 1
        ops = []
        used = set()
        draw_frame_header(pdf, ops, used, logo_asset, logo_rect, v_title, 'Material & Hardware Specifications')
        y = 128.0
        for tbl in (tpl_v.get('specTables') or []):
            if not tbl:
                continue
            ratios = [0.34, 0.66] if len(tbl[0]) == 2 else [0.5, 0.5]
            y = draw_table_ops(ops, tbl, 30, y, PAGE_W - 60, ratios, font_size=8.0, header_fill=C_CRIMSON, bold_first=True, pad_y=4.0) + 14.0
        add_footer(ops, footer_text, page_counter, True)
        pdf.add_page(ops, used)

        # 3c. Unit Breakdown Slide(s)
        items = vq.get('items') or []
        chunks = [items[i:i + 14] for i in range(0, len(items), 14)] or [[]]
        for p_idx, ch in enumerate(chunks):
            page_counter += 1
            ops = []
            used = set()
            sub = f'Unit-Wise Breakdown (Page {p_idx + 1} of {len(chunks)})'
            draw_frame_header(pdf, ops, used, logo_asset, logo_rect, v_title, sub)
            rows = [['No.', 'Room & Unit Details', 'Dimensions', 'Material / Finish', 'Qty', 'Amount']]
            for idx, it in enumerate(ch):
                ref = str(it.get('refCode') or f'{p_idx * 14 + idx + 1:02d}')
                r_u = f"{it.get('room', 'Interior')} - {it.get('name', 'Modular Unit')}"
                dyn_finish = resolve_variant_unit_finish(tpl_v, it)
                rows.append([
                    ref, r_u, str(it.get('dimensions') or '-'),
                    dyn_finish, str(it.get('qtyText') or '1'),
                    fmt_inr(it.get('amount') or 0)
                ])
            if not ch:
                rows.append(['-', 'No modular units listed.', '-', '-', '-', 'Rs. 0'])
            y = draw_table_ops(
                ops, rows, 30, 128.0, PAGE_W - 60,
                [0.07, 0.29, 0.16, 0.24, 0.09, 0.15],
                font_size=7.6, header_fill=C_FOREST, right_cols={5}, bold_first=True, pad_y=4.2
            )
            notes = vq.get('notes', '') if p_idx == len(chunks) - 1 else ''
            if notes and y < PAGE_H - 65:
                ops.append(op_rect(30, y + 10, PAGE_W - 60, 26, fill=C_ALT, stroke=C_BORDER))
                ops.append(op_text(f'Remarks: {notes}', 38, y + 18, size=8.0, color=C_FOREST, font='F1'))
            add_footer(ops, footer_text, page_counter, True)
            pdf.add_page(ops, used)

        # 3d. Quotation Summary Slide
        page_counter += 1
        ops = []
        used = set()
        draw_frame_header(pdf, ops, used, logo_asset, logo_rect, f'{v_title} - QUOTATION', f'Patron: {client_name}  |  Scope: {vq.get("roomScopeLabel", "All Rooms")}  |  Ref: {quote_code}')
        y = 128.0
        rooms = (vq.get('roomsSummary') or [])[:12]
        comm = vq.get('commercial') or {}
        if rooms:
            r_rows = [['ROOM-WISE BREAKDOWN', 'AMOUNT']]
            for rm in rooms:
                r_rows.append([f"{rm.get('name', 'Room')} ({rm.get('itemCount', 0)} units)", fmt_inr(rm.get('roomSubtotal', 0))])
            y = draw_table_ops(ops, r_rows, 30, y, PAGE_W - 60, [0.70, 0.30], font_size=8.6, header_fill=C_FOREST, right_cols={1}, bold_first=True, pad_y=5.0) + 14.0

        acc_enabled = comm.get('accessoriesEnabled', True) is not False
        app_enabled = comm.get('appliancesEnabled', True) is not False
        frt_enabled = comm.get('freightEnabled', True) is not False
        gst_enabled = comm.get('gstEnabled', True) is not False

        c_rows = [
            ['COST ESTIMATION SUMMARY', 'AMOUNT'],
            ['Modular Woodwork Subtotal', fmt_inr(comm.get('woodworkSubtotal', 0))],
        ]
        if acc_enabled:
            c_rows.append(['Additional Accessories', fmt_inr(comm.get('additionalAccessories', 0))])
        if app_enabled:
            c_rows.append(['Appliances', fmt_inr(comm.get('appliances', 0))])
        c_rows.append(['Design Charges', fmt_inr(comm.get('designAmount', 0))])
        if frt_enabled:
            c_rows.append(['Freight Charges', fmt_inr(comm.get('freightAmount', 0))])
        orig_billable = comm.get('originalBillableValue')
        if orig_billable is None:
            orig_billable = round(float(comm.get('woodworkSubtotal') or 0) + float(comm.get('designAmount') or 0) + (float(comm.get('freightAmount') or 0) if frt_enabled else 0))
        c_rows.append(['Original Billable Value', fmt_inr(orig_billable)])
        if float(comm.get('discountAmount') or 0) > 0:
            ww_after = comm.get('woodworkAfterDiscount')
            if ww_after is None:
                ww_after = max(0, round(float(comm.get('woodworkSubtotal') or 0) - float(comm.get('discountAmount') or 0)))
            c_rows.append({
                'cells': ['Discount on Wood Work', fmt_inr(ww_after)],
                'bg': C_DISC_BG,
                'border': C_DISC_BORDER,
                'lw': 0.9,
                'text_color': C_DISC_TEXT,
                'val_color': C_DISC_VAL,
                'bold': True,
                'font_size': 9.8,
                'val_font_size': 10.4,
                'pad_y': 6.2
            })
        if float(comm.get('adpAmount') or 0) > 0:
            dc_after = comm.get('designAfterDiscount')
            if dc_after is None:
                dc_after = max(0, round(float(comm.get('designAmount') or 0) - float(comm.get('adpAmount') or 0)))
            c_rows.append({
                'cells': ['Discount on Design Charge', fmt_inr(dc_after)],
                'bg': C_DISC_BG,
                'border': C_DISC_BORDER,
                'lw': 0.9,
                'text_color': C_DISC_TEXT,
                'val_color': C_DISC_VAL,
                'bold': True,
                'font_size': 9.8,
                'val_font_size': 10.4,
                'pad_y': 6.2
            })
        c_rows.append(['Grand Total (Without GST)', fmt_inr(comm.get('netBeforeTax', 0))])
        if gst_enabled:
            c_rows.append(['GST', fmt_inr(comm.get('gstAmount', 0))])
        has_discount = (float(comm.get('discountAmount') or 0) > 0) or (float(comm.get('adpAmount') or 0) > 0) or (float(comm.get('totalSavings') or 0) > 0)
        final_lbl = ('FINAL DISCOUNTED VALUE (WITH GST)' if gst_enabled else 'FINAL DISCOUNTED VALUE') if has_discount else ('FINAL TOTAL (WITH GST)' if gst_enabled else 'FINAL TOTAL')
        c_rows.append({
            'cells': [final_lbl, fmt_inr(comm.get('grandTotal', vq.get('grandTotal', 0)))],
            'highlight': True,
            'accent': True,
            'bg': C_GOLD,
            'border': C_CRIMSON,
            'lw': 1.5,
            'text_color': C_FOREST,
            'val_color': C_CRIMSON,
            'font_size': 11.2,
            'val_font_size': 13.2,
            'pad_y': 8.0
        })
        total_savings = comm.get('totalSavings')
        if total_savings is None:
            total_savings = float(comm.get('discountAmount') or 0) + float(comm.get('adpAmount') or 0)
        c_rows.append({
            'cells': ['YOUR SAVINGS', fmt_inr(total_savings)],
            'bg': C_SAVE_BG,
            'border': C_SAVE_BORDER,
            'lw': 1.3,
            'text_color': C_SAVE_TEXT,
            'val_color': C_SAVE_VAL,
            'bold': True,
            'font_size': 10.6,
            'val_font_size': 12.4,
            'pad_y': 7.5
        })

        y = draw_table_ops(ops, c_rows, 30, y, PAGE_W - 60, [0.70, 0.30], font_size=8.8, header_fill=C_CRIMSON, right_cols={1}, bold_first=False, pad_y=5.5) + 14.0
        if y < PAGE_H - 55:
            scope_notes = (
                f"Loading/Unloading: {comm.get('loadingUnloadingStatus', 'Additional')} | "
                f"Floor Mat: {comm.get('floorMatStatus', 'Not Included')} | "
                f"Civil: {comm.get('civilWorksStatus', 'As per actuals')} | "
                f"Elec/Plumb: {comm.get('electricalPlumbingStatus', 'Additional')} | "
                f"False Ceiling: {comm.get('falseCeilingStatus', 'Not Included')}"
            )
            for li, ln in enumerate(wrap_text(scope_notes, PAGE_W - 64, 7.6)):
                ops.append(op_text(ln, 32, y + li * 10.5, size=7.6, color=C_MUTED, font='F1'))
        add_footer(ops, footer_text, page_counter, True)
        pdf.add_page(ops, used)

    # 4. Process / Policies / Payment / Terms / FAQs (Slides 34-40)
    ps = tpl.get('processSlides') or {}
    for sec_key in ('designProcess', 'executionProcess', 'inclusionsExclusions', 'paymentTerms'):
        sec = ps.get(sec_key)
        if not sec:
            continue
        page_counter += 1
        ops = []
        used = set()
        draw_frame_header(pdf, ops, used, logo_asset, logo_rect, sec.get('title', 'PROCESS & POLICIES'))
        y = 128.0
        for p in (sec.get('paragraphs') or []):
            for ln in wrap_text(p, PAGE_W - 60, 8.5):
                if y > PAGE_H - 45:
                    break
                ops.append(op_text(ln, 30, y, size=8.5, color=C_FOREST, font='F1'))
                y += 11.5
            y += 4.0
        tbl = sec.get('table') or []
        if tbl:
            ncols = len(tbl[0])
            ratios = [0.28, 0.12, 0.60] if ncols == 3 else ([0.5, 0.5] if ncols == 2 else [1.0 / ncols] * ncols)
            draw_table_ops(ops, tbl, 30, y + 4, PAGE_W - 60, ratios, font_size=8.0, header_fill=C_FOREST, bold_first=True, pad_y=4.5)
        add_footer(ops, footer_text, page_counter, True)
        pdf.add_page(ops, used)

    for prose_key in ('termsConditions', 'faqs'):
        sec = ps.get(prose_key)
        if not sec or not sec.get('paragraphs'):
            continue
        paras = sec['paragraphs']
        chunks = [paras[i:i + 18] for i in range(0, len(paras), 18)]
        for c_idx, ch in enumerate(chunks):
            page_counter += 1
            ops = []
            used = set()
            t_lbl = sec.get('title', '') + (f' (Part {c_idx + 1})' if len(chunks) > 1 else '')
            draw_frame_header(pdf, ops, used, logo_asset, logo_rect, t_lbl)
            y = 128.0
            for p in ch:
                is_q = bool(re.match(r'^\d+\.', p.strip()))
                fnt = 'F2' if is_q else 'F1'
                sz = 8.4 if is_q else 8.0
                for ln in wrap_text(p, PAGE_W - 60, sz, bold=is_q):
                    if y > PAGE_H - 40:
                        break
                    ops.append(op_text(ln, 30, y, size=sz, color=C_FOREST, font=fnt))
                    y += 11.0
                y += 4.5
            add_footer(ops, footer_text, page_counter, True)
            pdf.add_page(ops, used)

    # 5. Closing Slide (Slide 41)
    page_counter += 1
    closing_asset = assets.get('closingAsset') or 'slide_41.jpg'
    cl_ops = []
    cl_used = set()
    im_cl = pdf.register_jpeg(closing_asset)
    if im_cl:
        cl_used.add(closing_asset)
        cl_ops.append(op_image(im_cl, 0, 0, PAGE_W, PAGE_H))
    add_footer(cl_ops, footer_text, page_counter, True)
    pdf.add_page(cl_ops, cl_used)

    pdf.write(out_path)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit(2)
    payload_path = sys.argv[1]
    out_pdf = sys.argv[2]
    with open(payload_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    build_pdf(data, out_pdf)
    print(out_pdf)
