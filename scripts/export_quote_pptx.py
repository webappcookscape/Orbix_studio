#!/usr/bin/env python3
"""
Generate a customized Cookscape quotation PPTX directly from Master-Template.pptx
preserving exact Master Template flow:
Slide 1 Cover -> Intro (2-6) -> Per Selected Variant: [Divider, Specs, Unit Snips, Quotation] -> Process/Terms/FAQs (22-28) -> Closing (29).
"""

import base64
import io
import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageFont

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PPTX_PATH = os.path.join(ROOT_DIR, 'Master-Template.pptx')

VARIANT_SLIDE_GROUPS = {
    'LL elite': {'slides': [7, 8, 9], 'quote_slide': 9, 'title': 'LL ELITE'},
    'CC MATTE': {'slides': [10, 11, 12], 'quote_slide': 12, 'title': 'CAPRICOAST MATTE'},
    'CC GLOSSY': {'slides': [13, 14, 15], 'quote_slide': 15, 'title': 'CAPRICOST GLOSSY'},
    'SURABHI': {'slides': [16, 17, 18], 'quote_slide': 18, 'title': 'ELEGANT SURABHI'},
    'MR+': {'slides': [19, 20, 21], 'quote_slide': 21, 'title': '4X TUFF GLOSS'}
}

CRIMSON = (192, 0, 0)
FOREST = (8, 35, 27)
BORDER = (210, 198, 182)
CREAM_BG = (244, 237, 227)
CARD_BG = (255, 253, 249)
ALT_ROW = (250, 246, 240)
GOLD_BG = (254, 249, 195)
MUTED = (90, 96, 94)


def load_font(size, bold=False):
    candidates = (
        ['C:/Windows/Fonts/segoeuib.ttf', 'C:/Windows/Fonts/arialbd.ttf']
        if bold else
        ['C:/Windows/Fonts/segoeui.ttf', 'C:/Windows/Fonts/arial.ttf']
    )
    for fp in candidates:
        if os.path.exists(fp):
            try:
                return ImageFont.truetype(fp, size)
            except Exception:
                pass
    return ImageFont.load_default()


def fmt_inr(val):
    try:
        n = round(float(val or 0))
    except Exception:
        n = 0
    s = str(abs(n))
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        formatted = ','.join(parts) + ',' + tail
    else:
        formatted = s
    return ('-' if n < 0 else '') + 'Rs. ' + formatted


def decode_unit_icons(unit_icons_map):
    decoded = {}
    if not isinstance(unit_icons_map, dict):
        return decoded
    for key, data_url in unit_icons_map.items():
        if not isinstance(data_url, str) or ';base64,' not in data_url:
            continue
        try:
            raw = base64.b64decode(data_url.split(';base64,', 1)[1])
            decoded[key] = Image.open(io.BytesIO(raw)).convert('RGBA')
        except Exception:
            pass
    return decoded


def render_unit_snips_image(items_chunk, start_no, page_idx, total_pages, variant_title, unit_icons, notes=''):
    """Render auto-generated Unit Breakdown / Unit Snips PNG placed before Quotation slide."""
    W, H = 1360, 1480
    img = Image.new('RGB', (W, H), CREAM_BG)
    draw = ImageDraw.Draw(img)

    f_sec = load_font(22, bold=True)
    f_th = load_font(17, bold=True)
    f_td = load_font(16, bold=False)
    f_td_b = load_font(16, bold=True)
    f_sm = load_font(14, bold=False)

    y = 14
    sub_lbl = f"{variant_title} — UNIT BREAKDOWN (PAGE {page_idx}/{total_pages})" if total_pages > 1 else f"{variant_title} — MODULAR UNIT BREAKDOWN"
    draw.rectangle([16, y, W - 16, y + 44], fill=FOREST)
    draw.text((32, y + 10), sub_lbl, fill=(255, 255, 255), font=f_sec)
    y += 50

    cols = [
        (16, 64, '#'),
        (64, 160, 'Preview'),
        (160, 330, 'Room'),
        (330, 620, 'Unit & Finish'),
        (620, 815, 'Size (mm)'),
        (815, 945, 'Qty'),
        (945, 1135, 'Rate'),
        (1135, W - 16, 'Amount')
    ]
    draw.rectangle([16, y, W - 16, y + 40], fill=CRIMSON)
    for x0, x1, title in cols:
        draw.text((x0 + 8, y + 10), title, fill=(255, 255, 255), font=f_th)
    y += 42

    row_h = 112
    for idx, it in enumerate(items_chunk):
        bg = CARD_BG if idx % 2 == 0 else ALT_ROW
        draw.rectangle([16, y, W - 16, y + row_h], fill=bg, outline=BORDER, width=1)
        draw.text((28, y + 42), str(start_no + idx), fill=FOREST, font=f_td_b)

        icon_key = it.get('iconKey')
        icon_im = unit_icons.get(icon_key) if icon_key else None
        if icon_im is not None:
            thumb = icon_im.copy()
            thumb.thumbnail((78, 88), Image.Resampling.LANCZOS)
            ix = 64 + (96 - thumb.width) // 2
            iy = y + (row_h - thumb.height) // 2
            img.paste(thumb, (ix, iy), thumb)
        else:
            draw.rectangle([82, y + 20, 142, y + 92], fill=(232, 245, 243), outline=(94, 186, 170), width=2)

        draw.text((170, y + 42), str(it.get('room', 'General'))[:16], fill=FOREST, font=f_td_b)
        draw.text((340, y + 22), str(it.get('name', 'Unit'))[:26], fill=FOREST, font=f_td_b)
        draw.text((340, y + 50), str(it.get('refCode', ''))[:16], fill=CRIMSON, font=f_sm)
        draw.text((340, y + 74), str(it.get('finish', ''))[:32], fill=MUTED, font=f_sm)

        draw.text((628, y + 42), str(it.get('dimensions', '-'))[:20], fill=FOREST, font=f_td)
        draw.text((824, y + 42), str(it.get('qtyText', '-'))[:11], fill=FOREST, font=f_td)
        draw.text((1125, y + 42), fmt_inr(it.get('rate', 0)), fill=FOREST, font=f_td, anchor='ra')
        draw.text((W - 26, y + 42), fmt_inr(it.get('amount', 0)), fill=CRIMSON, font=f_td_b, anchor='ra')
        y += row_h

    if notes and notes.strip():
        ny = min(y + 18, H - 150)
        draw.rectangle([16, ny, W - 16, min(ny + 124, H - 18)], fill=GOLD_BG, outline=(252, 211, 77), width=2)
        draw.text((30, ny + 12), 'SPECIFICATION REMARKS:', fill=(146, 64, 14), font=f_td_b)
        draw.text((30, ny + 44), notes.strip()[:140], fill=FOREST, font=f_td)

    buf = io.BytesIO()
    img.save(buf, format='PNG', optimize=True)
    return buf.getvalue()


def render_quote_summary_image(variant_quote, payload):
    """Render crisp Quotation Commercial Summary PNG for Quotation Slides (9/12/15/18/21)."""
    W, H = 1360, 1420
    img = Image.new('RGB', (W, H), CREAM_BG)
    draw = ImageDraw.Draw(img)

    f_title = load_font(28, bold=True)
    f_sub = load_font(19, bold=False)
    f_sec = load_font(21, bold=True)
    f_td = load_font(18, bold=False)
    f_td_b = load_font(18, bold=True)

    y = 18
    meta = payload.get('meta') or {}
    quote_code = payload.get('quoteCode') or meta.get('quoteId') or ''
    scope = variant_quote.get('roomScopeLabel') or 'All Rooms'
    draw.rectangle([20, y, W - 20, y + 92], fill=CARD_BG, outline=BORDER, width=2)
    draw.text((40, y + 14), f"{variant_quote.get('tierTitle', 'QUOTATION SUMMARY')}  —  COMMERCIAL ESTIMATE", fill=FOREST, font=f_title)
    draw.text((40, y + 54), f"Patron: {payload.get('clientName', '')}   |   Scope: {scope}   |   Ref: {quote_code}", fill=MUTED, font=f_sub)
    y += 116

    rooms = variant_quote.get('roomsSummary') or []
    comm = variant_quote.get('commercial') or {}

    if rooms:
        draw.rectangle([20, y, W - 20, y + 42], fill=FOREST)
        draw.text((36, y + 9), 'ROOM-WISE BREAKDOWN', fill=(255, 255, 255), font=f_sec)
        y += 42
        for i, rm in enumerate(rooms[:10]):
            bg = CARD_BG if i % 2 == 0 else ALT_ROW
            draw.rectangle([20, y, W - 20, y + 42], fill=bg, outline=BORDER, width=1)
            rname = f"{rm.get('name', 'Room')} ({rm.get('itemCount', 0)} units)"
            draw.text((36, y + 10), rname, fill=FOREST, font=f_td_b)
            draw.text((W - 40, y + 10), fmt_inr(rm.get('roomSubtotal', 0)), fill=FOREST, font=f_td_b, anchor='ra')
            y += 42
        y += 28

    draw.rectangle([20, y, W - 20, y + 42], fill=CRIMSON)
    draw.text((36, y + 9), 'COMMERCIAL SUMMARY & CHARGES', fill=(255, 255, 255), font=f_sec)
    y += 42

    comm_rows = [
        ('Modular Woodwork Subtotal', fmt_inr(comm.get('woodworkSubtotal', 0)), True),
        ('Additional Accessories', fmt_inr(comm.get('additionalAccessories', 0)), False),
        ('Appliances', fmt_inr(comm.get('appliances', 0)), False),
        (f"Design & Handling Fee ({comm.get('designPercent', 9)}%)", fmt_inr(comm.get('designAmount', 0)), False),
        (f"Freight Charges ({comm.get('freightPercent', 2.5)}%)", fmt_inr(comm.get('freightAmount', 0)), False),
    ]
    if float(comm.get('discountAmount') or 0) > 0:
        comm_rows.append((f"Promotional Discount ({comm.get('discountPercent', 0)}%)", '- ' + fmt_inr(comm.get('discountAmount', 0)), False))
    if float(comm.get('adpAmount') or 0) > 0:
        comm_rows.append((f"Additional Discount ADP ({comm.get('adpPercent', 0)}%)", '- ' + fmt_inr(comm.get('adpAmount', 0)), False))
    comm_rows.append(('Net Estimate (Excl. GST)', fmt_inr(comm.get('netBeforeTax', 0)), True))
    comm_rows.append((f"GST Applicable ({comm.get('gstPercent', 18)}%)", fmt_inr(comm.get('gstAmount', 0)), False))

    for i, (label, val, is_bold) in enumerate(comm_rows):
        bg = CARD_BG if i % 2 == 0 else ALT_ROW
        draw.rectangle([20, y, W - 20, y + 44], fill=bg, outline=BORDER, width=1)
        draw.text((36, y + 11), label, fill=FOREST, font=f_td_b if is_bold else f_td)
        draw.text((W - 40, y + 11), val, fill=FOREST, font=f_td_b, anchor='ra')
        y += 44

    draw.rectangle([20, y, W - 20, y + 60], fill=GOLD_BG, outline=CRIMSON, width=3)
    draw.text((36, y + 16), 'FINAL QUOTED VALUE (INCLUSIVE OF GST)', fill=FOREST, font=f_sec)
    draw.text((W - 40, y + 14), fmt_inr(comm.get('grandTotal', variant_quote.get('grandTotal', 0))), fill=CRIMSON, font=f_title, anchor='ra')
    y += 78

    if y < H - 80:
        scope_notes = (
            f"Loading/Unloading: {comm.get('loadingUnloadingStatus', 'Additional')}  •  "
            f"Floor Mat: {comm.get('floorMatStatus', 'Not Included')}  •  "
            f"Civil: {comm.get('civilWorksStatus', 'As per actuals')}  •  "
            f"Elec/Plumb: {comm.get('electricalPlumbingStatus', 'Additional')}  •  "
            f"False Ceiling: {comm.get('falseCeilingStatus', 'Not Included')}"
        )
        draw.text((28, y), scope_notes, fill=MUTED, font=load_font(15))

    buf = io.BytesIO()
    img.save(buf, format='PNG', optimize=True)
    return buf.getvalue()


def xml_escape(text):
    return (
        str(text or '')
        .replace('&', '&amp;')
        .replace('<', '&lt;')
        .replace('>', '&gt;')
        .replace('"', '&quot;')
        .replace("'", '&apos;')
    )


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


def inject_png_into_slide(slide_xml, rels_xml, media_filename, img_id_num):
    existing_rids = [int(m) for m in re.findall(r'Id="rId(\d+)"', rels_xml)]
    next_rid = f"rId{(max(existing_rids) + 1) if existing_rids else 10}"
    new_rel = (
        f'<Relationship Id="{next_rid}" '
        f'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" '
        f'Target="../media/{media_filename}"/>'
    )
    rels_xml = rels_xml.replace('</Relationships>', f'{new_rel}</Relationships>')

    pic_xml = f'''
      <p:pic xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <p:nvPicPr>
          <p:cNvPr id="{9000 + img_id_num}" name="OrbixQuotePic{img_id_num}"/>
          <p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>
          <p:nvPr/>
        </p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="{next_rid}"/>
          <a:stretch><a:fillRect/></a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm><a:off x="480000" y="2550000"/><a:ext cx="9085700" cy="10500000"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
      </p:pic>'''
    slide_xml = slide_xml.replace('</p:spTree>', f'{pic_xml}</p:spTree>')
    return slide_xml, rels_xml


def build_pptx(payload, out_path):
    if not os.path.exists(PPTX_PATH):
        raise FileNotFoundError(f'Missing {PPTX_PATH}')

    variant_quotes = payload.get('variantQuotes') or []
    unit_icons = decode_unit_icons(payload.get('unitIcons') or {})

    kept_variant_map = {}
    slides_to_remove = set()
    for key, cfg in VARIANT_SLIDE_GROUPS.items():
        matched = next((vq for vq in variant_quotes if vq.get('tierKey') == key), None)
        if matched:
            kept_variant_map[cfg['quote_slide']] = (cfg, matched)
        else:
            for s in cfg['slides']:
                slides_to_remove.add(s)

    footer_parts = [payload.get('clientName') or '', payload.get('siteAddress') or '', payload.get('clientPhone') or '']
    footer_text = ' | '.join([p for p in footer_parts if p]) or 'Cookscape Interiors'

    injected_quote_media = {}
    unit_slides_by_quote_slide = {}
    unit_counter = 0

    for q_slide, (cfg, vq) in kept_variant_map.items():
        injected_quote_media[q_slide] = (
            f"orbix_quote_slide_{q_slide}.png",
            render_quote_summary_image(vq, payload)
        )
        items = vq.get('items') or []
        chunks = [items[i:i + 9] for i in range(0, len(items), 9)] or [[]]
        unit_slides_by_quote_slide[q_slide] = []
        for p_idx, ch in enumerate(chunks):
            unit_counter += 1
            media_name = f"orbix_unit_snip_{q_slide}_{p_idx + 1}.png"
            png_bytes = render_unit_snips_image(
                ch, p_idx * 9 + 1, p_idx + 1, len(chunks), cfg['title'], unit_icons,
                notes=(vq.get('notes', '') if p_idx == len(chunks) - 1 else '')
            )
            unit_slides_by_quote_slide[q_slide].append((unit_counter, cfg['title'], media_name, png_bytes))

    with zipfile.ZipFile(PPTX_PATH, 'r') as zin:
        pres_xml = zin.read('ppt/presentation.xml').decode('utf-8')
        pres_rels_xml = zin.read('ppt/_rels/presentation.xml.rels').decode('utf-8')
        ct_xml = zin.read('[Content_Types].xml').decode('utf-8')

        base_quote_xml = zin.read('ppt/slides/slide9.xml').decode('utf-8')
        base_quote_rels = zin.read('ppt/slides/_rels/slide9.xml.rels').decode('utf-8')

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
                for u_id, v_title, u_media_name, u_png in unit_slides_by_quote_slide[s_num]:
                    u_rid = f"rIdOrbixUnit{u_id}"
                    u_target = f"slides/slide_unit_{u_id}.xml"
                    u_sld_tag = f'<p:sldId id="{32000 + u_id}" r:id="{u_rid}"/>'
                    final_entries.append(('unit', u_sld_tag, u_id, v_title, u_media_name, u_png, u_rid, u_target))
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
                unit_seq_map[e[2]] = seq_idx
                u_rid, u_target = e[6], e[7]
                pres_rels_xml = pres_rels_xml.replace(
                    '</Relationships>',
                    f'<Relationship Id="{u_rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="{u_target}"/></Relationships>'
                )
                ct_xml = ct_xml.replace(
                    '</Types>',
                    f'<Override PartName="/ppt/{u_target}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>'
                )

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
                    if s_num in injected_quote_media:
                        rels_fn = f'ppt/slides/_rels/slide{s_num}.xml.rels'
                        rels_xml = zin.read(rels_fn).decode('utf-8')
                        s_xml, rels_xml = inject_png_into_slide(s_xml, rels_xml, injected_quote_media[s_num][0], s_num)
                        zout.writestr(fn, s_xml.encode('utf-8'))
                        zout.writestr(rels_fn, rels_xml.encode('utf-8'))
                        continue
                    zout.writestr(fn, s_xml.encode('utf-8'))
                elif m_slide and fn.endswith('.rels') and int(m_slide.group(1)) in injected_quote_media:
                    continue
                else:
                    zout.writestr(fn, zin.read(fn))

            # Write quotation slide PNGs
            for _, (media_name, png_bytes) in injected_quote_media.items():
                zout.writestr(f'ppt/media/{media_name}', png_bytes)

            # Write synthesized Unit Snips slides (exact clone of Slide 9 frame with Unit Breakdown title & PNG)
            for e in final_entries:
                if e[0] != 'unit':
                    continue
                _, _, u_id, v_title, u_media_name, u_png, _, u_target = e
                u_xml = base_quote_xml.replace(' LL ELITE', f' {xml_escape(v_title)}').replace('LL ELITE', xml_escape(v_title)).replace('Quotation', 'Unit Breakdown')
                u_xml = replace_footer_and_number(u_xml, footer_text, unit_seq_map[u_id])
                u_xml, u_rels = inject_png_into_slide(u_xml, base_quote_rels, u_media_name, 500 + u_id)
                zout.writestr(f'ppt/{u_target}', u_xml.encode('utf-8'))
                zout.writestr(f'ppt/slides/_rels/{os.path.basename(u_target)}.rels', u_rels.encode('utf-8'))
                zout.writestr(f'ppt/media/{u_media_name}', u_png)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit(2)
    payload_path = sys.argv[1]
    out_pptx = sys.argv[2]
    with open(payload_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    build_pptx(data, out_pptx)
    print(out_pptx)
