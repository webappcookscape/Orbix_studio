#!/usr/bin/env python3
"""
Strict Master-Template.pptx Exporter (100% Python Standard Library — ZERO Pillow/PIL dependency):
- Preserves Slide 1 Cover (with quotegenerator's exact alignments & token replacements),
  Slides 2-6 Intro, Slides 34-40 Process/Terms/FAQs, and Slide 41 Closing untouched.
- Supports all 9 Master-Template.pptx variants (Slides 7-33) in exact template order:
  ZAPPO EL PEARL, POT & CAFE, HOME SPACE, CAFÉ HUNT, LL ELITE,
  CAPRICOAST MATTE, CAPRICOST GLOSSY, ELEGANT SURABHI, 4X TUFF GLOSS.
- Keeps ONLY selected variants; inserts native PowerPoint Unit Snips slides (with embedded
  unit icon PNG thumbnails) right before each selected variant's native Quotation Summary table.
"""

import base64
import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PPTX_PATH = os.path.join(ROOT_DIR, 'Master-Template.pptx')
TEMPLATE_DATA_PATH = os.path.join(ROOT_DIR, 'server', 'quote-assets', 'template-data.json')
ADDONS_BRANDS_PATH = os.path.join(ROOT_DIR, 'server', 'quote-assets', 'addons-brands.json')
_ADDONS_BRANDS_CACHE = None


def load_addons_brands():
    global _ADDONS_BRANDS_CACHE
    if _ADDONS_BRANDS_CACHE is not None:
        return _ADDONS_BRANDS_CACHE
    try:
        with open(ADDONS_BRANDS_PATH, 'r', encoding='utf-8') as f:
            _ADDONS_BRANDS_CACHE = json.load(f)
    except Exception:
        _ADDONS_BRANDS_CACHE = {'byId': {}, 'byName': {}}
    return _ADDONS_BRANDS_CACHE


def load_template_variants_by_key():
    try:
        with open(TEMPLATE_DATA_PATH, 'r', encoding='utf-8') as f:
            tpl = json.load(f)
        return {v['key']: v for v in (tpl.get('variants') or []) if v.get('key')}
    except Exception:
        return {}


def resolve_variant_unit_finish(tpl_v, item):
    if item and str(item.get('refCode') or '').upper() == 'CIV':
        return str(item.get('finish') or 'Included Civil Scope')
    tables = (tpl_v or {}).get('specTables') or []
    if not tables:
        return str((item or {}).get('finish') or '-')
    ctx = f"{(item or {}).get('room') or ''} {(item or {}).get('name') or ''}".lower()
    is_kitchen = bool(re.search(r'(kitchen|utility|pantry|crockery|hob|sink|tall\s*unit|base\s*unit|wall\s*unit|loft\s*kitchen)', ctx))

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

    joined = re.sub(r'\s+', ' ', ' | '.join(parts)).strip()
    return joined or str((item or {}).get('finish') or '-')

VARIANT_SLIDE_GROUPS = {
    'zappo - el pearl': {'title': 'ZAPPO EL PEARL', 'slides': [7, 8, 9], 'quote_slide': 9},
    'pot&cafe': {'title': 'POT & CAFE', 'slides': [10, 11, 12], 'quote_slide': 12},
    'homespace': {'title': 'HOME SPACE', 'slides': [13, 14, 15], 'quote_slide': 15},
    'cafehunt': {'title': 'CAFÉ HUNT', 'slides': [16, 17, 18], 'quote_slide': 18},
    'LL elite': {'title': 'LL ELITE', 'slides': [19, 20, 21], 'quote_slide': 21},
    'CC MATTE': {'title': 'CAPRICOAST MATTE', 'slides': [22, 23, 24], 'quote_slide': 24},
    'CC GLOSSY': {'title': 'CAPRICOST GLOSSY', 'slides': [25, 26, 27], 'quote_slide': 27},
    'SURABHI': {'title': 'ELEGANT SURABHI', 'slides': [28, 29, 30], 'quote_slide': 30},
    'MR+': {'title': '4X TUFF GLOSS', 'slides': [31, 32, 33], 'quote_slide': 33},
}

BASE_UNIT_TEMPLATE_SLIDE = 21  # Clean single-header Quotation slide (LL ELITE)


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


def get_room_summary_rank(name):
    s = str(name or '').lower().strip()
    if not s:
        return 99.0
    if re.search(r'\bcommon\b', s) and re.search(r'(vanity|wash|bath|toilet|basin)', s):
        return 8.0
    if re.search(r'\bpowder\b|hand\s*wash|wash\s*basin', s):
        return 8.0
    if re.search(r'(bathroom|bath\s*vanity|washroom|toilet|restroom|vanity|ensuite|\bbath\b)', s):
        return 9.0
    if re.search(r'\bkitchen\b|modular\s*kitchen|wet\s*kitchen|dry\s*kitchen|pantry', s):
        return 1.0
    if re.search(r'\btv\b|tv\s*unit|media\s*wall|entertainment|\bliving\b|\bhall\b|drawing\s*room', s):
        return 2.0
    if re.search(r'pooja|puja|prayer|mandir', s):
        return 3.0
    if re.search(r'crockery|dining|\bbar\b', s):
        return 4.0
    if re.search(r'\bmaster\b|\bmbr\b|primary\s*bed', s):
        return 5.0
    if re.search(r'\bkids?\b|child|children', s):
        return 6.0
    if re.search(r'\bguest\b|parents?\s*bed', s):
        return 7.0
    if re.search(r'bed\s*room|bedroom', s):
        return 7.5
    if re.search(r'shoe\s*rack|\bshoe\b|foyer|entrance|entry|mudroom', s):
        return 10.0
    return 99.0


def normalize_rooms_summary(rooms):
    filtered = [
        (idx, rm) for idx, rm in enumerate(rooms or [])
        if isinstance(rm, dict) and int(rm.get('itemCount') or 0) > 0
    ]
    filtered.sort(key=lambda pair: (get_room_summary_rank(pair[1].get('name')), pair[0]))
    return [rm for _, rm in filtered]


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


def xml_escape(text):
    return (
        str(text or '')
        .replace('&', '&amp;')
        .replace('<', '&lt;')
        .replace('>', '&gt;')
        .replace('"', '&quot;')
        .replace("'", '&apos;')
    )


def decode_unit_icons_bytes(icons_map):
    """Return {iconKey: (ext, raw_bytes)} without requiring PIL."""
    out = {}
    if not isinstance(icons_map, dict):
        return out
    for k, raw in icons_map.items():
        if not isinstance(raw, str):
            continue
        clean_key = re.sub(r'[^a-zA-Z0-9_-]', '', str(k or ''))[:36]
        if not clean_key:
            continue
        m = re.match(r'^data:image/(png|jpeg|jpg|webp);base64,(.+)$', raw, flags=re.DOTALL)
        if not m:
            continue
        ext = 'jpg' if m.group(1) in ('jpeg', 'jpg') else m.group(1)
        try:
            b = base64.b64decode(m.group(2))
            if b:
                out[clean_key] = (ext, b)
        except Exception:
            pass
    return out


COVER_SHAPE_ALIGNMENTS = [
    ('60', 1140000, 8168341, None, None),
    ('51', 1140000, 8667320, None, None),
    ('62', 1140000, 9156700, None, None),
    ('64', 1140000, 9613900, None, None),
    ('65', 2266527, 8168341, None, None),
    ('66', 2266527, 8667320, None, None),
    ('69', 2266527, 9156700, None, None),
    ('68', 2266527, 9613900, None, None),
    ('73', 2420000, 8095502, 3600000, 369332),
    ('74', 2420000, 8594481, 3600000, 369332),
    ('76', 2420000, 9083861, 3600000, 369332),
    ('77', 2420000, 9541061, 3600000, 369332),
    ('27', 4248150, 11456931, None, None),
    ('59', 4850877, 10693847, None, None),
    ('61', 4850877, 11182762, None, None),
    ('53', 4850877, 11605675, None, None),
    ('71', 6150000, 10693847, None, None),
    ('70', 6150000, 11182762, None, None),
    ('72', 6150000, 11605675, None, None),
    ('80', 6300000, 10684772, 2750000, 307777),
    ('79', 6300000, 11173687, 2750000, 307777),
    ('78', 6300000, 11596600, 2750000, 307777),
]


def apply_cover_shape_alignments(slide1_xml):
    align_map = {sid: (x, y, cx, cy) for sid, x, y, cx, cy in COVER_SHAPE_ALIGNMENTS}

    def _rw_sp(m):
        sp_xml = m.group(0)
        mid = re.search(r'<p:cNvPr\b[^>]*\bid="(\d+)"', sp_xml)
        if not mid or mid.group(1) not in align_map:
            return sp_xml
        x, y, cx, cy = align_map[mid.group(1)]

        def _rw_xf(xm):
            xf = re.sub(r'<a:off\b[^/]*/>', f'<a:off x="{x}" y="{y}"/>', xm.group(0), count=1)
            if cx is not None and cy is not None:
                xf = re.sub(r'<a:ext\b[^/]*/>', f'<a:ext cx="{cx}" cy="{cy}"/>', xf, count=1)
            return xf

        return re.sub(r'<a:xfrm\b[^>]*>.*?</a:xfrm>', _rw_xf, sp_xml, count=1, flags=re.DOTALL)

    return re.sub(r'<p:sp\b[^>]*>.*?</p:sp>', _rw_sp, slide1_xml, flags=re.DOTALL)


def replace_cover_tokens(slide1_xml, payload):
    meta = payload.get('meta') or {}
    designer = payload.get('designer') or {}
    c_name = str(payload.get('clientName') or meta.get('clientName') or '')
    c_phone = str(payload.get('clientPhone') or meta.get('phone') or '')
    c_email = str(payload.get('clientEmail') or meta.get('clientEmail') or '')
    c_loc = str(payload.get('siteAddress') or meta.get('siteAddress') or '')
    c_date = str(meta.get('dateCreated') or '')
    d_name = str(designer.get('name') or meta.get('designerName') or '')
    d_phone = str(designer.get('phone') or '')
    d_email = str(designer.get('email') or '')
    cover_replacements = [
        (r'Designer\s+Details', 'Architect Details'),
        (r'Mr\.\s*Aravindan', c_name),
        (r'7418414780', c_phone),
        (r'Webapp\.cookscape@gmail\.com', c_email),
        (r'Individual Villa Adyar', c_loc),
        (r'10\/10\/2026', c_date),
        (r'Mr\.\s*Abishek', d_name),
        (r'93611\s*84787', d_phone),
        (r'designs\.cookscape@gmail\.com', d_email),
        (r'\{\{CLIENT_NAME\}\}', c_name),
        (r'\{\{CLIENT_PHONE\}\}', c_phone),
        (r'\{\{CLIENT_EMAIL\}\}', c_email),
        (r'\{\{LOCATION\}\}', c_loc),
        (r'\{\{DATE\}\}', c_date),
        (r'\{\{ARCHITECT_NAME\}\}', d_name),
        (r'\{\{ARCHITECT_PHONE\}\}', d_phone),
        (r'\{\{ARCHITECT_EMAIL\}\}', d_email),
    ]
    for pat, val in cover_replacements:
        esc = xml_escape(val)
        slide1_xml = re.sub(pat, lambda _m, v=esc: v, slide1_xml, flags=re.IGNORECASE)
    return apply_cover_shape_alignments(slide1_xml)


def replace_footer_and_number(slide_xml, footer_text, slide_num):
    slide_xml = slide_xml.replace('Mr. Aravindan | Individual Villa Adyar | 7418414780', xml_escape(footer_text))
    slide_xml = re.sub(
        r'(<a:fld\b[^>]*type="slidenum"[^>]*>.*?<a:t>)\d+(</a:t>)',
        lambda m: f"{m.group(1)}{slide_num}{m.group(2)}",
        slide_xml,
        flags=re.DOTALL
    )
    return slide_xml


def _ooxml_cell_borders(color_hex='D2C6B6', width_emu=12700):
    ln_xml = f'<a:ln w="{width_emu}" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:srgbClr val="{color_hex}"/></a:solidFill></a:ln>'
    return (
        f'<a:lnL w="{width_emu}" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:srgbClr val="{color_hex}"/></a:solidFill></a:lnL>'
        f'<a:lnR w="{width_emu}" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:srgbClr val="{color_hex}"/></a:solidFill></a:lnR>'
        f'<a:lnT w="{width_emu}" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:srgbClr val="{color_hex}"/></a:solidFill></a:lnT>'
        f'<a:lnB w="{width_emu}" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:srgbClr val="{color_hex}"/></a:solidFill></a:lnB>'
    )


def build_ooxml_cell(lines, fill_hex='FFFFFF', text_hex='08231B', bold=False, font_sz=1000, align='l', border_hex='D2C6B6', grid_span=None, h_merge=False):
    """Build a single native PowerPoint <a:tc> cell supporting multi-line paragraphs and horizontal merge."""
    tc_attrs = ''
    if grid_span and int(grid_span) > 1:
        tc_attrs += f' gridSpan="{int(grid_span)}"'
    if h_merge:
        tc_attrs += ' hMerge="1"'
        borders = _ooxml_cell_borders(border_hex)
        return (
            f'<a:tc{tc_attrs}>'
            f'<a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-IN" sz="{font_sz}"/></a:p></a:txBody>'
            f'<a:tcPr anchor="ctr">{borders}<a:solidFill><a:srgbClr val="{fill_hex}"/></a:solidFill></a:tcPr>'
            f'</a:tc>'
        )
    if isinstance(lines, str):
        lines = [lines]
    p_parts = []
    for idx, line in enumerate(lines):
        if isinstance(line, tuple):
            txt, l_bold, l_hex, l_sz = line
        else:
            txt, l_bold, l_hex, l_sz = str(line or ''), bold, text_hex, font_sz
        b_attr = ' b="1"' if l_bold else ''
        p_parts.append(
            f'<a:p><a:pPr algn="{align}"/>'
            f'<a:r><a:rPr lang="en-IN" sz="{l_sz}"{b_attr} dirty="0">'
            f'<a:solidFill><a:srgbClr val="{l_hex}"/></a:solidFill>'
            f'<a:latin typeface="Calibri"/>'
            f'</a:rPr><a:t>{xml_escape(txt)}</a:t></a:r></a:p>'
        )
    if not p_parts:
        p_parts.append(f'<a:p><a:pPr algn="{align}"/><a:endParaRPr lang="en-IN" sz="{font_sz}"/></a:p>')
    borders = _ooxml_cell_borders(border_hex)
    return (
        f'<a:tc{tc_attrs}>'
        f'<a:txBody><a:bodyPr wrap="square" lIns="75000" tIns="45000" rIns="75000" bIns="45000" anchor="ctr"/>'
        f'<a:lstStyle/>{"".join(p_parts)}</a:txBody>'
        f'<a:tcPr anchor="ctr">{borders}<a:solidFill><a:srgbClr val="{fill_hex}"/></a:solidFill></a:tcPr>'
        f'</a:tc>'
    )


def build_ooxml_table(shape_id, name, x, y, col_widths, rows_spec):
    """Build a complete native <p:graphicFrame><a:tbl> shape."""
    total_w = sum(col_widths)
    total_h = sum(r_h for r_h, _ in rows_spec)
    grid_xml = ''.join(f'<a:gridCol w="{w}"/>' for w in col_widths)
    tr_xml = []
    for r_h, cells in rows_spec:
        tr_xml.append(f'<a:tr h="{r_h}">{"".join(cells)}</a:tr>')
    return (
        f'<p:graphicFrame xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
        f'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
        f'<p:nvGraphicFramePr>'
        f'<p:cNvPr id="{shape_id}" name="{xml_escape(name)}"/>'
        f'<p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr>'
        f'<p:nvPr/>'
        f'</p:nvGraphicFramePr>'
        f'<p:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{total_w}" cy="{total_h}"/></p:xfrm>'
        f'<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">'
        f'<a:tbl><a:tblPr firstRow="1" bandRow="1"/><a:tblGrid>{grid_xml}</a:tblGrid>{"".join(tr_xml)}</a:tbl>'
        f'</a:graphicData></a:graphic></p:graphicFrame>'
    )


def build_ooxml_textbox(shape_id, name, x, y, cx, cy, lines, fill_hex=None, border_hex=None, align='l'):
    p_parts = []
    for line in lines:
        txt, bold, hex_c, sz = line
        b_attr = ' b="1"' if bold else ''
        p_parts.append(
            f'<a:p><a:pPr algn="{align}"/>'
            f'<a:r><a:rPr lang="en-IN" sz="{sz}"{b_attr} dirty="0">'
            f'<a:solidFill><a:srgbClr val="{hex_c}"/></a:solidFill>'
            f'<a:latin typeface="Calibri"/>'
            f'</a:rPr><a:t>{xml_escape(txt)}</a:t></a:r></a:p>'
        )
    fill_xml = f'<a:solidFill><a:srgbClr val="{fill_hex}"/></a:solidFill>' if fill_hex else '<a:noFill/>'
    ln_xml = f'<a:ln w="12700"><a:solidFill><a:srgbClr val="{border_hex}"/></a:solidFill></a:ln>' if border_hex else '<a:ln><a:noFill/></a:ln>'
    return (
        f'<p:sp xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
        f'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
        f'<p:nvSpPr><p:cNvPr id="{shape_id}" name="{xml_escape(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>'
        f'<p:spPr><a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm>'
        f'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>{fill_xml}{ln_xml}</p:spPr>'
        f'<p:txBody><a:bodyPr wrap="square" lIns="110000" tIns="60000" rIns="110000" bIns="60000" anchor="ctr"/>'
        f'<a:lstStyle/>{"".join(p_parts)}</p:txBody></p:sp>'
    )


def build_ooxml_pic(shape_id, name, rid, x, y, cx, cy):
    return (
        f'<p:pic xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
        f'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
        f'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f'<p:nvPicPr><p:cNvPr id="{shape_id}" name="{xml_escape(name)}"/>'
        f'<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>'
        f'<p:blipFill><a:blip r:embed="{rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>'
        f'<p:spPr><a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm>'
        f'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>'
    )


def inject_quotation_tables_into_slide(slide_xml, variant_quote, payload, slide_id_seed):
    """Inject native PowerPoint Room Breakdown + Commercial Summary tables onto a Quotation slide."""
    meta = payload.get('meta') or {}
    quote_code = payload.get('quoteCode') or meta.get('quoteId') or ''
    scope = variant_quote.get('roomScopeLabel') or 'All Rooms'
    client_name = payload.get('clientName') or meta.get('clientName') or ''
    tier_title = variant_quote.get('tierTitle') or variant_quote.get('tierKey') or 'QUOTATION SUMMARY'

    x0 = 460000
    w_total = 9125700
    y = 2520000
    shapes = []

    shapes.append(build_ooxml_textbox(
        8100 + slide_id_seed * 20, f'OrbixQuoteHdr_{slide_id_seed}',
        x0, y, w_total, 700000,
        [
            (f'{tier_title}  —  COMMERCIAL ESTIMATE', True, '08231B', 1400),
            (f'Patron: {client_name}   |   Scope: {scope}   |   Ref: {quote_code}', False, '475569', 1000)
        ],
        fill_hex='FFFFFF', border_hex='D2C6B6'
    ))
    y += 840000

    rooms = normalize_rooms_summary(variant_quote.get('roomsSummary') or [])[:12]
    comm = variant_quote.get('commercial') or {}

    if rooms:
        row_h = 330000 if len(rooms) <= 6 else 285000
        room_rows = [
            (360000, [
                build_ooxml_cell('ROOM-WISE BREAKDOWN', fill_hex='08231B', text_hex='FFFFFF', bold=True, font_sz=1050, align='l', border_hex='08231B'),
                build_ooxml_cell('AMOUNT', fill_hex='08231B', text_hex='FFFFFF', bold=True, font_sz=1050, align='r', border_hex='08231B'),
            ])
        ]
        for idx, rm in enumerate(rooms):
            bg = 'FFFFFF' if idx % 2 == 0 else 'FAF6F0'
            cnt = int(rm.get('itemCount') or 0)
            u_lbl = 'unit' if cnt == 1 else 'units'
            rname = f"{rm.get('name', 'Room')} ({cnt} {u_lbl})"
            room_rows.append((row_h, [
                build_ooxml_cell(rname, fill_hex=bg, text_hex='08231B', bold=True, font_sz=1000, align='l'),
                build_ooxml_cell(fmt_inr(rm.get('roomSubtotal', 0)), fill_hex=bg, text_hex='08231B', bold=True, font_sz=1000, align='r'),
            ]))
        shapes.append(build_ooxml_table(
            8101 + slide_id_seed * 20, f'OrbixRoomsTbl_{slide_id_seed}',
            x0, y, [6325700, 2800000], room_rows
        ))
        y += sum(rh for rh, _ in room_rows) + 240000

    acc_enabled = comm.get('accessoriesEnabled', True) is not False
    app_enabled = comm.get('appliancesEnabled', True) is not False
    frt_enabled = comm.get('freightEnabled', True) is not False
    gst_enabled = comm.get('gstEnabled', True) is not False

    comm_items = [
        ('Modular Woodwork Subtotal', fmt_inr(comm.get('woodworkSubtotal', 0)), True, 'normal'),
    ]
    comm_items.append(('Design Charges', fmt_inr(comm.get('designAmount', 0)), False, 'normal'))
    if frt_enabled:
        comm_items.append(('Freight Charges', fmt_inr(comm.get('freightAmount', 0)), False, 'normal'))
    orig_billable = comm.get('originalBillableValue')
    if orig_billable is None:
        orig_billable = round(float(comm.get('woodworkSubtotal') or 0) + float(comm.get('designAmount') or 0) + (float(comm.get('freightAmount') or 0) if frt_enabled else 0))
    comm_items.append(('Original Billable Value', fmt_inr(orig_billable), False, 'orig'))
    if float(comm.get('discountAmount') or 0) > 0:
        ww_after = comm.get('woodworkAfterDiscount')
        if ww_after is None:
            ww_after = max(0, round(float(comm.get('woodworkSubtotal') or 0) - float(comm.get('discountAmount') or 0)))
        comm_items.append(('Discount on Wood Work', fmt_inr(ww_after), False, 'discount'))
    if float(comm.get('adpAmount') or 0) > 0:
        dc_after = comm.get('designAfterDiscount')
        if dc_after is None:
            dc_after = max(0, round(float(comm.get('designAmount') or 0) - float(comm.get('adpAmount') or 0)))
        comm_items.append(('Discount on Design Charge', fmt_inr(dc_after), False, 'discount'))
    comm_items.append(('Grand Total (Without GST)', fmt_inr(comm.get('netBeforeTax', 0)), False, 'normal'))
    if gst_enabled:
        comm_items.append(('GST', fmt_inr(comm.get('gstAmount', 0)), False, 'normal'))

    c_row_h = 330000 if len(comm_items) <= 8 else 285000
    comm_rows = [
        (360000, [
            build_ooxml_cell('COST ESTIMATION SUMMARY', fill_hex='C00000', text_hex='FFFFFF', bold=True, font_sz=1050, align='l', border_hex='C00000'),
            build_ooxml_cell('AMOUNT', fill_hex='C00000', text_hex='FFFFFF', bold=True, font_sz=1050, align='r', border_hex='C00000'),
        ])
    ]
    for idx, (lbl, val, is_b, style_kind) in enumerate(comm_items):
        if style_kind == 'orig':
            comm_rows.append((c_row_h, [
                build_ooxml_cell(lbl, fill_hex='EFF6FF', text_hex='1E3A8A', bold=False, font_sz=1000, align='l', border_hex='2563EB'),
                build_ooxml_cell(val, fill_hex='EFF6FF', text_hex='1D4ED8', bold=False, font_sz=1000, align='r', border_hex='2563EB'),
            ]))
        elif style_kind == 'discount':
            comm_rows.append((c_row_h, [
                build_ooxml_cell(lbl, fill_hex='FFF4E5', text_hex='9A3412', bold=False, font_sz=1000, align='l', border_hex='EA580C'),
                build_ooxml_cell(val, fill_hex='FFF4E5', text_hex='C2410C', bold=False, font_sz=1000, align='r', border_hex='EA580C'),
            ]))
        else:
            bg = 'FFFFFF' if idx % 2 == 0 else 'FAF6F0'
            comm_rows.append((c_row_h, [
                build_ooxml_cell(lbl, fill_hex=bg, text_hex='08231B', bold=False, font_sz=1000, align='l'),
                build_ooxml_cell(val, fill_hex=bg, text_hex='08231B', bold=False, font_sz=1000, align='r'),
            ]))

    grand_total = fmt_inr(comm.get('grandTotal', variant_quote.get('grandTotal', 0)))
    has_discount = (float(comm.get('discountAmount') or 0) > 0) or (float(comm.get('adpAmount') or 0) > 0) or (float(comm.get('totalSavings') or 0) > 0)
    final_lbl = ('FINAL DISCOUNTED VALUE (WITH GST)' if gst_enabled else 'FINAL DISCOUNTED VALUE') if has_discount else ('FINAL TOTAL (WITH GST)' if gst_enabled else 'FINAL TOTAL')
    comm_rows.append((c_row_h, [
        build_ooxml_cell(final_lbl, fill_hex='FEF3C7', text_hex='08231B', bold=False, font_sz=1000, align='l', border_hex='C00000'),
        build_ooxml_cell(grand_total, fill_hex='FEF3C7', text_hex='C00000', bold=False, font_sz=1000, align='r', border_hex='C00000'),
    ]))
    total_savings = comm.get('totalSavings')
    if total_savings is None:
        total_savings = float(comm.get('discountAmount') or 0) + float(comm.get('adpAmount') or 0)
    comm_rows.append((c_row_h, [
        build_ooxml_cell('YOUR SAVINGS', fill_hex='DCFCE7', text_hex='14532D', bold=False, font_sz=1000, align='l', border_hex='16A34A'),
        build_ooxml_cell(fmt_inr(total_savings), fill_hex='DCFCE7', text_hex='15803D', bold=False, font_sz=1000, align='r', border_hex='16A34A'),
    ]))

    shapes.append(build_ooxml_table(
        8102 + slide_id_seed * 20, f'OrbixCommTbl_{slide_id_seed}',
        x0, y, [6325700, 2800000], comm_rows
    ))
    y += sum(rh for rh, _ in comm_rows) + 160000

    # ── ADD-ONS, ACCESSORIES & APPLIANCES (4 COLUMNS: ACCESSORIES NAME, QUANTITY, BRAND, AMOUNT) ──
    selected_addons = comm.get('selectedAddons') or []
    selected_addons_set2 = comm.get('selectedAddonsSet2') or []
    selected_custom_addons = comm.get('selectedCustomAddons') or []
    appliances_list = comm.get('appliancesList') or []
    acc_set2_enabled = comm.get('accessoriesSet2Enabled') is not False and bool(comm.get('additionalAccessoriesSet2') or selected_addons_set2)
    add_acc_amt = float(comm.get('additionalAccessories') or 0) if acc_enabled else 0
    add_acc2_amt = float(comm.get('additionalAccessoriesSet2') or 0) if acc_set2_enabled else 0
    app_amt = float(comm.get('appliances') or 0) if app_enabled else 0
    addons_total = comm.get('addonsTotal')
    if addons_total is None:
        addons_total = add_acc_amt + add_acc2_amt + app_amt
    else:
        addons_total = float(addons_total)
    total_investment = comm.get('totalInvestmentWithAddons')
    if total_investment is None:
        total_investment = float(comm.get('grandTotal') or 0) + addons_total
    else:
        total_investment = float(total_investment)

    addons_brands_db = load_addons_brands()

    def _resolve_brand(item):
        if isinstance(item, dict) and str(item.get('brand') or '').strip():
            return str(item.get('brand')).strip()
        if not isinstance(item, dict):
            return '-'
        id_k = str(item.get('id') or '').strip().lower()
        nm_k = str(item.get('name') or '').strip().lower()
        rec = (addons_brands_db.get('byId') or {}).get(id_k) or (addons_brands_db.get('byName') or {}).get(nm_k)
        if not rec:
            return '-'
        raw_r = item.get('customRate') if item.get('customRate') not in (None, '') else item.get('rate', 0)
        try:
            rv = float(raw_r or 0)
        except Exception:
            rv = 0.0
        if rec.get('brand') and rec.get('rate') and abs(rv - float(rec['rate'])) < 0.05:
            return str(rec['brand'])
        if rec.get('hettichRate') and abs(rv - float(rec['hettichRate'])) < 0.05:
            return 'HETTICH'
        if rec.get('ebcoRate') and abs(rv - float(rec['ebcoRate'])) < 0.05:
            return 'EBCO'
        if rec.get('grassRate') and abs(rv - float(rec['grassRate'])) < 0.05:
            return 'GRASS'
        return str(rec.get('brand') or '-')

    has_addons = bool(selected_addons or selected_addons_set2 or selected_custom_addons or appliances_list or (addons_total > 0))
    if y < 12100000:
        addon_col_ws = [4200000, 1280000, 1640000, 2005700]
        addon_rows = [
            (310000, [
                build_ooxml_cell('ACCESSORIES NAME', fill_hex='08231B', text_hex='FFFFFF', bold=True, font_sz=950, align='l', border_hex='08231B'),
                build_ooxml_cell('QUANTITY', fill_hex='08231B', text_hex='FFFFFF', bold=True, font_sz=950, align='ctr', border_hex='08231B'),
                build_ooxml_cell('BRAND', fill_hex='08231B', text_hex='FFFFFF', bold=True, font_sz=950, align='ctr', border_hex='08231B'),
                build_ooxml_cell('AMOUNT', fill_hex='08231B', text_hex='FFFFFF', bold=True, font_sz=950, align='r', border_hex='08231B'),
            ])
        ]
        row_idx_a = 0
        prefix1 = "[Set 1] " if (selected_addons_set2 or add_acc2_amt > 0) else ""
        if selected_addons:
            for it in selected_addons:
                bg_a = 'FFFFFF' if row_idx_a % 2 == 0 else 'FAF6F0'
                row_idx_a += 1
                q_raw = it.get('qty', 1)
                q_num = float(q_raw if q_raw not in (None, '') else 1)
                q_clean = int(q_num) if q_num == int(q_num) else q_num
                unit = str(it.get('unit') or '').lower()
                qty_disp = f"{q_clean} m" if unit == 'meter' else (f"{q_clean} sq.ft" if unit == 'sqft' else str(q_clean))
                r = float(it.get('customRate') if it.get('customRate') not in (None, '') else (it.get('rate') or 0))
                amt = float(it.get('amount') if it.get('amount') is not None else round(q_num * r))
                brand_disp = _resolve_brand(it)
                addon_rows.append((265000, [
                    build_ooxml_cell(prefix1 + str(it.get('name') or 'Accessory Item'), fill_hex=bg_a, text_hex='08231B', bold=False, font_sz=920, align='l'),
                    build_ooxml_cell(qty_disp, fill_hex=bg_a, text_hex='08231B', bold=False, font_sz=920, align='ctr'),
                    build_ooxml_cell(brand_disp, fill_hex=bg_a, text_hex='08231B', bold=False, font_sz=920, align='ctr'),
                    build_ooxml_cell(fmt_inr(amt), fill_hex=bg_a, text_hex='08231B', bold=False, font_sz=920, align='r'),
                ]))
        elif add_acc_amt > 0:
            row_idx_a += 1
            addon_rows.append((265000, [
                build_ooxml_cell(prefix1 + 'Selected Hardware Accessories Package', fill_hex='FFFFFF', text_hex='08231B', bold=False, font_sz=920, align='l'),
                build_ooxml_cell('1', fill_hex='FFFFFF', text_hex='08231B', bold=False, font_sz=920, align='ctr'),
                build_ooxml_cell('-', fill_hex='FFFFFF', text_hex='08231B', bold=False, font_sz=920, align='ctr'),
                build_ooxml_cell(fmt_inr(add_acc_amt), fill_hex='FFFFFF', text_hex='08231B', bold=False, font_sz=920, align='r'),
            ]))

        if selected_addons_set2:
            for it in selected_addons_set2:
                bg_a = 'FFFFFF' if row_idx_a % 2 == 0 else 'FAF6F0'
                row_idx_a += 1
                q_raw = it.get('qty', 1)
                q_num = float(q_raw if q_raw not in (None, '') else 1)
                q_clean = int(q_num) if q_num == int(q_num) else q_num
                unit = str(it.get('unit') or '').lower()
                qty_disp = f"{q_clean} m" if unit == 'meter' else (f"{q_clean} sq.ft" if unit == 'sqft' else str(q_clean))
                r = float(it.get('customRate') if it.get('customRate') not in (None, '') else (it.get('rate') or 0))
                amt = float(it.get('amount') if it.get('amount') is not None else round(q_num * r))
                brand_disp = _resolve_brand(it)
                addon_rows.append((265000, [
                    build_ooxml_cell('[Set 2] ' + str(it.get('name') or 'Accessory Item'), fill_hex=bg_a, text_hex='08231B', bold=False, font_sz=920, align='l'),
                    build_ooxml_cell(qty_disp, fill_hex=bg_a, text_hex='08231B', bold=False, font_sz=920, align='ctr'),
                    build_ooxml_cell(brand_disp, fill_hex=bg_a, text_hex='08231B', bold=False, font_sz=920, align='ctr'),
                    build_ooxml_cell(fmt_inr(amt), fill_hex=bg_a, text_hex='08231B', bold=False, font_sz=920, align='r'),
                ]))
        elif add_acc2_amt > 0:
            row_idx_a += 1
            addon_rows.append((265000, [
                build_ooxml_cell('[Set 2] Selected Hardware Accessories Package', fill_hex='FFFFFF', text_hex='08231B', bold=False, font_sz=920, align='l'),
                build_ooxml_cell('1', fill_hex='FFFFFF', text_hex='08231B', bold=False, font_sz=920, align='ctr'),
                build_ooxml_cell('-', fill_hex='FFFFFF', text_hex='08231B', bold=False, font_sz=920, align='ctr'),
                build_ooxml_cell(fmt_inr(add_acc2_amt), fill_hex='FFFFFF', text_hex='08231B', bold=False, font_sz=920, align='r'),
            ]))

        if selected_custom_addons:
            for ap in selected_custom_addons:
                bg_a = 'FFFFFF' if row_idx_a % 2 == 0 else 'FAF6F0'
                row_idx_a += 1
                q_num = float(ap.get('qty') or 1)
                q_clean = int(q_num) if q_num == int(q_num) else q_num
                qty_disp = f"{q_clean} sq.ft" if (float(ap.get('length') or 0) > 0 and float(ap.get('width') or 0) > 0) else str(q_clean)
                r = float(ap.get('rate') or 0)
                amt = float(ap.get('amount') if ap.get('amount') is not None else round(q_num * r))
                brand_disp = str(ap.get('brand') or ap.get('gradeName') or ('Premium' if ap.get('grade') == 'premium' else 'Regular'))
                addon_rows.append((265000, [
                    build_ooxml_cell(str(ap.get('name') or 'Add-on'), fill_hex=bg_a, text_hex='08231B', bold=False, font_sz=920, align='l'),
                    build_ooxml_cell(qty_disp, fill_hex=bg_a, text_hex='08231B', bold=False, font_sz=920, align='ctr'),
                    build_ooxml_cell(brand_disp, fill_hex=bg_a, text_hex='08231B', bold=False, font_sz=920, align='ctr'),
                    build_ooxml_cell(fmt_inr(amt), fill_hex=bg_a, text_hex='08231B', bold=False, font_sz=920, align='r'),
                ]))
        elif appliances_list:
            for ap in appliances_list:
                bg_a = 'FFFFFF' if row_idx_a % 2 == 0 else 'FAF6F0'
                row_idx_a += 1
                q = max(1, int(ap.get('qty', 1)))
                amt = float(ap.get('amount') if ap.get('amount') is not None else (float(ap.get('rate', 0)) * q))
                brand_disp = str(ap.get('brand') or '-')
                addon_rows.append((265000, [
                    build_ooxml_cell(str(ap.get('name') or 'Kitchen Appliance'), fill_hex=bg_a, text_hex='08231B', bold=False, font_sz=920, align='l'),
                    build_ooxml_cell(str(q), fill_hex=bg_a, text_hex='08231B', bold=False, font_sz=920, align='ctr'),
                    build_ooxml_cell(brand_disp, fill_hex=bg_a, text_hex='08231B', bold=False, font_sz=920, align='ctr'),
                    build_ooxml_cell(fmt_inr(amt), fill_hex=bg_a, text_hex='08231B', bold=False, font_sz=920, align='r'),
                ]))
        elif app_amt > 0:
            row_idx_a += 1
            addon_rows.append((265000, [
                build_ooxml_cell('Selected Kitchen & Home Appliances Package', fill_hex='FAF6F0', text_hex='08231B', bold=False, font_sz=920, align='l'),
                build_ooxml_cell('1', fill_hex='FAF6F0', text_hex='08231B', bold=False, font_sz=920, align='ctr'),
                build_ooxml_cell('-', fill_hex='FAF6F0', text_hex='08231B', bold=False, font_sz=920, align='ctr'),
                build_ooxml_cell(fmt_inr(app_amt), fill_hex='FAF6F0', text_hex='08231B', bold=False, font_sz=920, align='r'),
            ]))

        if has_addons:
            addon_rows.append((295000, [
                build_ooxml_cell('Add-ons & Accessories Subtotal', fill_hex='FEF9C3', text_hex='08231B', bold=True, font_sz=950, align='l', grid_span=3),
                build_ooxml_cell('', fill_hex='FEF9C3', h_merge=True),
                build_ooxml_cell('', fill_hex='FEF9C3', h_merge=True),
                build_ooxml_cell(fmt_inr(addons_total), fill_hex='FEF9C3', text_hex='08231B', bold=True, font_sz=950, align='r'),
            ]))
        else:
            addon_rows.append((265000, [
                build_ooxml_cell('None Selected (Optional Cookscape Master Add-ons available upon request)', fill_hex='FFFFFF', text_hex='64748B', bold=False, font_sz=900, align='l', grid_span=3),
                build_ooxml_cell('', fill_hex='FFFFFF', h_merge=True),
                build_ooxml_cell('', fill_hex='FFFFFF', h_merge=True),
                build_ooxml_cell('Rs. 0', fill_hex='FFFFFF', text_hex='64748B', bold=False, font_sz=900, align='r'),
            ]))

        shapes.append(build_ooxml_table(
            8104 + slide_id_seed * 20, f'OrbixAddonsTbl_{slide_id_seed}',
            x0, y, addon_col_ws, addon_rows
        ))
        y += sum(rh for rh, _ in addon_rows) + 140000

    if y < 12650000:
        scope_notes = (
            f"Loading/Unloading: {comm.get('loadingUnloadingStatus', 'Additional')}  |  "
            f"Floor Mat: {comm.get('floorMatStatus', 'Not Included')}  |  "
            f"Civil: {comm.get('civilWorksStatus', 'As per actuals')}  |  "
            f"Elec/Plumb: {comm.get('electricalPlumbingStatus', 'Additional')}  |  "
            f"False Ceiling: {comm.get('falseCeilingStatus', 'Not Included')}"
        )
        shapes.append(build_ooxml_textbox(
            8103 + slide_id_seed * 20, f'OrbixScopeNote_{slide_id_seed}',
            x0, y, w_total, 420000,
            [(scope_notes, False, '475569', 850)]
        ))

    return slide_xml.replace('</p:spTree>', ''.join(shapes) + '</p:spTree>')


def inject_unit_snips_into_slide(slide_xml, rels_xml, items, start_no, page_idx, total_pages, variant_title, unit_icons_bytes, notes, unit_slide_uid):
    """Build native PowerPoint Unit Breakdown table + embedded native <p:pic> unit thumbnails."""
    x0 = 460000
    y = 2520000
    col_widths = [560000, 960000, 3550000, 1850000, 950000, 1255700]
    w_total = sum(col_widths)
    shapes = []

    hdr_text = f"{variant_title} — UNIT-WISE BREAKDOWN (PAGE {page_idx} OF {total_pages})"
    shapes.append(build_ooxml_textbox(
        9100 + unit_slide_uid * 40, f'OrbixUnitHdr_{unit_slide_uid}',
        x0, y, w_total, 420000,
        [(hdr_text, True, 'FFFFFF', 1100)],
        fill_hex='08231B'
    ))
    y += 460000

    hdr_h = 370000
    row_h = 920000
    tbl_rows = [
        (hdr_h, [
            build_ooxml_cell('No.', fill_hex='C00000', text_hex='FFFFFF', bold=True, font_sz=950, align='ctr', border_hex='C00000'),
            build_ooxml_cell('Unit', fill_hex='C00000', text_hex='FFFFFF', bold=True, font_sz=950, align='ctr', border_hex='C00000'),
            build_ooxml_cell('Unit Details & Dimensions', fill_hex='C00000', text_hex='FFFFFF', bold=True, font_sz=950, align='l', border_hex='C00000'),
            build_ooxml_cell('Material / Finish', fill_hex='C00000', text_hex='FFFFFF', bold=True, font_sz=950, align='l', border_hex='C00000'),
            build_ooxml_cell('Qty', fill_hex='C00000', text_hex='FFFFFF', bold=True, font_sz=950, align='ctr', border_hex='C00000'),
            build_ooxml_cell('Amount', fill_hex='C00000', text_hex='FFFFFF', bold=True, font_sz=950, align='r', border_hex='C00000'),
        ])
    ]

    existing_rids = [int(m) for m in re.findall(r'Id="rId(\d+)"', rels_xml)]
    next_rid_num = (max(existing_rids) + 1) if existing_rids else 10
    embedded_media = {}  # media_filename -> raw_bytes
    icon_rid_cache = {}
    pic_shapes = []

    for idx, it in enumerate(items):
        bg = 'FFFFFF' if idx % 2 == 0 else 'FAF6F0'
        row_y = y + hdr_h + idx * row_h
        ref = str(it.get('refCode') or f'{start_no + idx:02d}')
        room_name = str(it.get('room') or 'Interior')
        unit_name = str(it.get('name') or 'Modular Unit')
        dims = str(it.get('dimensions') or '')
        finish = str(it.get('finish') or '-')
        qty_txt = str(it.get('qtyText') or '1')
        amt_txt = fmt_inr(it.get('amount') or 0)

        detail_lines = [
            (f'{room_name} • {unit_name}', True, '08231B', 950),
        ]
        if dims:
            detail_lines.append((dims, False, '475569', 850))

        icon_key = re.sub(r'[^a-zA-Z0-9_-]', '', str(it.get('iconKey') or ''))
        has_icon = icon_key in unit_icons_bytes
        if has_icon:
            ext, raw_bytes = unit_icons_bytes[icon_key]
            media_fn = f'orbix_uicon_{icon_key}.{ext}'
            embedded_media[media_fn] = raw_bytes
            if media_fn not in icon_rid_cache:
                rid = f'rId{next_rid_num}'
                next_rid_num += 1
                icon_rid_cache[media_fn] = rid
                rel_tag = (
                    f'<Relationship Id="{rid}" '
                    f'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" '
                    f'Target="../media/{media_fn}"/>'
                )
                rels_xml = rels_xml.replace('</Relationships>', f'{rel_tag}</Relationships>')
            icon_sz = 680000
            pic_x = x0 + col_widths[0] + (col_widths[1] - icon_sz) // 2
            pic_y = row_y + (row_h - icon_sz) // 2
            pic_shapes.append(build_ooxml_pic(
                9120 + unit_slide_uid * 40 + idx,
                f'OrbixUnitIcon_{unit_slide_uid}_{idx}',
                icon_rid_cache[media_fn],
                pic_x, pic_y, icon_sz, icon_sz
            ))

        tbl_rows.append((row_h, [
            build_ooxml_cell(ref, fill_hex=bg, text_hex='08231B', bold=True, font_sz=900, align='ctr'),
            build_ooxml_cell('' if has_icon else 'UNIT', fill_hex=bg, text_hex='94A3B8', bold=False, font_sz=750, align='ctr'),
            build_ooxml_cell(detail_lines, fill_hex=bg, text_hex='08231B', bold=False, font_sz=900, align='l'),
            build_ooxml_cell(finish, fill_hex=bg, text_hex='334155', bold=False, font_sz=850, align='l'),
            build_ooxml_cell(qty_txt, fill_hex=bg, text_hex='08231B', bold=False, font_sz=850, align='ctr'),
            build_ooxml_cell(amt_txt, fill_hex=bg, text_hex='08231B', bold=True, font_sz=950, align='r'),
        ]))

    if not items:
        tbl_rows.append((600000, [
            build_ooxml_cell('-', fill_hex='FFFFFF', text_hex='475569', align='ctr'),
            build_ooxml_cell('-', fill_hex='FFFFFF', text_hex='475569', align='ctr'),
            build_ooxml_cell('No modular units listed.', fill_hex='FFFFFF', text_hex='475569', align='l'),
            build_ooxml_cell('-', fill_hex='FFFFFF', text_hex='475569', align='l'),
            build_ooxml_cell('-', fill_hex='FFFFFF', text_hex='475569', align='ctr'),
            build_ooxml_cell('Rs. 0', fill_hex='FFFFFF', text_hex='08231B', bold=True, align='r'),
        ]))

    shapes.append(build_ooxml_table(
        9101 + unit_slide_uid * 40, f'OrbixUnitsTbl_{unit_slide_uid}',
        x0, y, col_widths, tbl_rows
    ))
    shapes.extend(pic_shapes)
    y += sum(rh for rh, _ in tbl_rows) + 180000

    if notes and y < 12650000:
        shapes.append(build_ooxml_textbox(
            9105 + unit_slide_uid * 40, f'OrbixUnitsNotes_{unit_slide_uid}',
            x0, y, w_total, 500000,
            [(f'Remarks: {notes}', False, '08231B', 900)],
            fill_hex='FAF6F0', border_hex='D2C6B6'
        ))

    slide_xml = slide_xml.replace('</p:spTree>', ''.join(shapes) + '</p:spTree>')
    return slide_xml, rels_xml, embedded_media


def ensure_content_types(ct_xml, media_files):
    needed = set()
    for fn in media_files:
        ext = os.path.splitext(fn)[1].lstrip('.').lower()
        if ext:
            needed.add(ext)
    mime_map = {'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'webp': 'image/webp'}
    for ext in needed:
        if ext in mime_map and not re.search(rf'Extension="{re.escape(ext)}"', ct_xml, flags=re.IGNORECASE):
            ct_xml = ct_xml.replace(
                '</Types>',
                f'<Default Extension="{ext}" ContentType="{mime_map[ext]}"/></Types>'
            )
    return ct_xml


def build_pptx(payload, out_path):
    if not os.path.exists(PPTX_PATH):
        raise FileNotFoundError(f'Missing {PPTX_PATH}')

    variant_quotes = payload.get('variantQuotes') or []
    unit_icons_bytes = decode_unit_icons_bytes(payload.get('unitIcons') or {})

    # Map normalized variant keys from payload
    payload_by_key = {}
    for vq in variant_quotes:
        nk = normalize_tier_key(vq.get('tierKey') or vq.get('tierName') or vq.get('tierTitle'))
        if nk and nk not in payload_by_key:
            payload_by_key[nk] = vq

    kept_variant_map = {}
    slides_to_remove = set()
    for key, cfg in VARIANT_SLIDE_GROUPS.items():
        matched = payload_by_key.get(key)
        if matched:
            kept_variant_map[cfg['quote_slide']] = (cfg, matched)
        else:
            for s in cfg['slides']:
                slides_to_remove.add(s)

    footer_parts = [payload.get('clientName') or '', payload.get('siteAddress') or '', payload.get('clientPhone') or '']
    footer_text = ' | '.join([p for p in footer_parts if p]) or 'Cookscape Interiors'

    tpl_variants_by_key = load_template_variants_by_key()
    unit_slides_by_quote_slide = {}
    unit_counter = 0
    for q_slide, (cfg, vq) in kept_variant_map.items():
        tk_norm = normalize_tier_key(vq.get('tierKey') or vq.get('tierName') or vq.get('tierTitle') or cfg.get('title'))
        tpl_v = tpl_variants_by_key.get(tk_norm)
        raw_items = vq.get('items') or []
        items = [dict(it, finish=resolve_variant_unit_finish(tpl_v, it)) for it in raw_items]
        chunks = [items[i:i + 9] for i in range(0, len(items), 9)] or [[]]
        unit_slides_by_quote_slide[q_slide] = []
        for p_idx, ch in enumerate(chunks):
            unit_counter += 1
            unit_slides_by_quote_slide[q_slide].append((
                unit_counter,
                cfg['title'],
                ch,
                p_idx * 9 + 1,
                p_idx + 1,
                len(chunks),
                vq.get('notes', '') if p_idx == len(chunks) - 1 else ''
            ))

    with zipfile.ZipFile(PPTX_PATH, 'r') as zin:
        pres_xml = zin.read('ppt/presentation.xml').decode('utf-8')
        pres_rels_xml = zin.read('ppt/_rels/presentation.xml.rels').decode('utf-8')
        ct_xml = zin.read('[Content_Types].xml').decode('utf-8')

        base_quote_xml = zin.read(f'ppt/slides/slide{BASE_UNIT_TEMPLATE_SLIDE}.xml').decode('utf-8')
        base_quote_rels = zin.read(f'ppt/slides/_rels/slide{BASE_UNIT_TEMPLATE_SLIDE}.xml.rels').decode('utf-8')

        rel_root = ET.fromstring(pres_rels_xml)
        rid_to_slide = {}
        for rel in rel_root:
            m = re.match(r'^slides/slide(\d+)\.xml$', rel.attrib.get('Target', ''))
            if m:
                rid_to_slide[rel.attrib['Id']] = int(m.group(1))

        # Assemble final slide order, inserting Unit Snips right before each variant's Quotation slide
        final_entries = []
        for m in re.finditer(r'<p:sldId\b[^>]*r:id="([^"]+)"[^>]*/?>', pres_xml):
            rid = m.group(1)
            s_num = rid_to_slide.get(rid)
            if s_num and s_num in slides_to_remove:
                continue
            if s_num in unit_slides_by_quote_slide:
                for u_info in unit_slides_by_quote_slide[s_num]:
                    u_id = u_info[0]
                    u_rid = f"rIdOrbixUnit{u_id}"
                    u_target = f"slides/slide_unit_{u_id}.xml"
                    u_sld_tag = f'<p:sldId id="{32000 + u_id}" r:id="{u_rid}"/>'
                    final_entries.append(('unit', u_sld_tag, u_info, u_rid, u_target))
            final_entries.append(('orig', m.group(0), s_num))

        new_sld_lst = '<p:sldIdLst>' + ''.join(e[1] for e in final_entries) + '</p:sldIdLst>'
        pres_xml = re.sub(r'<p:sldIdLst>.*?</p:sldIdLst>', new_sld_lst, pres_xml, flags=re.DOTALL)

        for s_num in slides_to_remove:
            pres_rels_xml = re.sub(rf'<Relationship\b[^>]*Target="slides/slide{s_num}\.xml"[^>]*/?>', '', pres_rels_xml)
            ct_xml = re.sub(rf'<Override\b[^>]*PartName="/ppt/slides/slide{s_num}\.xml"[^>]*/?>', '', ct_xml)

        orig_seq_map = {}
        unit_seq_map = {}
        for seq_idx, e in enumerate(final_entries, start=1):
            if e[0] == 'orig':
                orig_seq_map[e[2]] = seq_idx
            else:
                u_info, u_rid, u_target = e[2], e[3], e[4]
                unit_seq_map[u_info[0]] = seq_idx
                pres_rels_xml = pres_rels_xml.replace(
                    '</Relationships>',
                    f'<Relationship Id="{u_rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="{u_target}"/></Relationships>'
                )
                ct_xml = ct_xml.replace(
                    '</Types>',
                    f'<Override PartName="/ppt/{u_target}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>'
                )

        # Pre-generate synthesized Unit Snips slides so we know all embedded media extensions before writing Content_Types
        built_unit_slides = []
        all_embedded_media = {}
        for e in final_entries:
            if e[0] != 'unit':
                continue
            u_info, _, u_target = e[2], e[3], e[4]
            u_id, v_title, ch, start_no, p_idx, total_p, notes = u_info
            u_xml = (
                base_quote_xml
                .replace(' LL ELITE', f' {xml_escape(v_title)}')
                .replace('LL ELITE', xml_escape(v_title))
                .replace('Quotation', 'Unit Breakdown')
            )
            u_xml = replace_footer_and_number(u_xml, footer_text, unit_seq_map[u_id])
            u_xml, u_rels, media_dict = inject_unit_snips_into_slide(
                u_xml, base_quote_rels, ch, start_no, p_idx, total_p, v_title, unit_icons_bytes, notes, u_id
            )
            all_embedded_media.update(media_dict)
            built_unit_slides.append((u_target, u_xml, u_rels))

        ct_xml = ensure_content_types(ct_xml, all_embedded_media.keys())

        with zipfile.ZipFile(out_path, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                fn = item.filename
                m_slide = re.match(r'^ppt/slides/(?:_rels/)?slide(\d+)\.xml(?:\.rels)?$', fn)
                if m_slide and int(m_slide.group(1)) in slides_to_remove:
                    continue

                if fn == 'ppt/presentation.xml':
                    zout.writestr(fn, pres_xml.encode('utf-8'))
                elif fn == 'ppt/_rels/presentation.xml.rels':
                    zout.writestr(fn, pres_rels_xml.encode('utf-8'))
                elif fn == '[Content_Types].xml':
                    zout.writestr(fn, ct_xml.encode('utf-8'))
                elif m_slide and not fn.endswith('.rels'):
                    s_num = int(m_slide.group(1))
                    s_xml = zin.read(fn).decode('utf-8')
                    if s_num == 1:
                        s_xml = replace_cover_tokens(s_xml, payload)
                    s_xml = replace_footer_and_number(s_xml, footer_text, orig_seq_map.get(s_num, s_num))
                    if s_num in kept_variant_map:
                        _, vq = kept_variant_map[s_num]
                        s_xml = inject_quotation_tables_into_slide(s_xml, vq, payload, s_num)
                    zout.writestr(fn, s_xml.encode('utf-8'))
                else:
                    zout.writestr(fn, zin.read(fn))

            for media_fn, raw_bytes in all_embedded_media.items():
                zout.writestr(f'ppt/media/{media_fn}', raw_bytes)

            for u_target, u_xml, u_rels in built_unit_slides:
                zout.writestr(f'ppt/{u_target}', u_xml.encode('utf-8'))
                zout.writestr(f'ppt/slides/_rels/{os.path.basename(u_target)}.rels', u_rels.encode('utf-8'))


if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit(2)
    payload_path = sys.argv[1]
    out_pptx = sys.argv[2]
    with open(payload_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    build_pptx(data, out_pptx)
    print(out_pptx)
