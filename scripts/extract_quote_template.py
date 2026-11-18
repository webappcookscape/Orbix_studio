#!/usr/bin/env python3
"""
Extract Cookscape Master-Template.pptx artwork, Cover Slide 1 artwork/textboxes,
and structured specification/policy/T&C/FAQ content into server/quote-assets/.
"""

import io
import json
import os
import zipfile
import xml.etree.ElementTree as ET
from PIL import Image, ImageOps

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PPTX_PATH = os.path.join(ROOT_DIR, 'Master-Template.pptx')
OUT_DIR = os.path.join(ROOT_DIR, 'server', 'quote-assets')

NS = {
    'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
}

CANVAS_W = 1060
CANVAS_H = 1498  # Exact Master-Template 10045700 x 14198600 EMUs (A4 portrait)
MASTER_BG = (244, 237, 227)  # #F4EDE3 from ppt/slideMasters/slideMaster1.xml


def clean_text(s):
    if not s:
        return ''
    return ' '.join(s.replace('\xa0', ' ').split()).strip()


def extract_table(tbl_el):
    rows = []
    for tr in tbl_el.findall('a:tr', NS):
        cells = []
        for tc in tr.findall('a:tc', NS):
            paras = []
            for p in tc.findall('.//a:p', NS):
                txt = ''.join(t.text or '' for t in p.findall('.//a:t', NS))
                c = clean_text(txt)
                if c:
                    paras.append(c)
            cells.append('\n'.join(paras))
        if any(cells):
            rows.append(cells)
    return rows


def extract_paragraphs(root_el):
    items = []
    sp_tree = root_el.find('.//p:spTree', NS)
    if sp_tree is None:
        return items
    for el in sp_tree:
        if el.tag.endswith('}sp'):
            nv = el.find('.//p:cNvPr', NS)
            name = nv.attrib.get('name', '') if nv is not None else ''
            if 'Slide Number Placeholder' in name or 'Footer Placeholder' in name:
                continue
            for p in el.findall('.//a:p', NS):
                txt = ''.join(t.text or '' for t in p.findall('.//a:t', NS))
                c = clean_text(txt)
                if c:
                    items.append(c)
    return items


def draw_blip_element(z, canvas, el, rel, slide_w_emu, slide_h_emu):
    blip = el.find('.//a:blip', NS)
    if blip is None:
        return
    rid = blip.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed', '')
    target = rel.get(rid, '')
    if not target:
        return
    media_path = 'ppt/' + target.replace('../', '')
    if media_path not in z.namelist():
        return

    im = Image.open(io.BytesIO(z.read(media_path)))
    if im.mode not in ('RGB', 'RGBA'):
        im = im.convert('RGBA')

    xf = el.find('.//a:xfrm', NS)
    if xf is None:
        return
    if xf.attrib.get('flipH') == '1':
        im = ImageOps.mirror(im)
    if xf.attrib.get('flipV') == '1':
        im = ImageOps.flip(im)

    sr = el.find('.//a:srcRect', NS)
    if sr is not None:
        iw, ih = im.size
        l_pct = max(0, int(sr.attrib.get('l', 0))) / 100000.0
        t_pct = max(0, int(sr.attrib.get('t', 0))) / 100000.0
        r_pct = max(0, int(sr.attrib.get('r', 0))) / 100000.0
        b_pct = max(0, int(sr.attrib.get('b', 0))) / 100000.0
        left = int(round(iw * l_pct))
        top = int(round(ih * t_pct))
        right = int(round(iw * (1.0 - r_pct)))
        bottom = int(round(ih * (1.0 - b_pct)))
        if right > left + 2 and bottom > top + 2:
            im = im.crop((left, top, right, bottom))

    off = xf.find('a:off', NS)
    ext = xf.find('a:ext', NS)
    if off is None or ext is None:
        return

    px = int(round(int(off.attrib.get('x', 0)) / slide_w_emu * CANVAS_W))
    py = int(round(int(off.attrib.get('y', 0)) / slide_h_emu * CANVAS_H))
    pw = max(1, int(round(int(ext.attrib.get('cx', 0)) / slide_w_emu * CANVAS_W)))
    ph = max(1, int(round(int(ext.attrib.get('cy', 0)) / slide_h_emu * CANVAS_H)))

    im = im.resize((pw, ph), Image.Resampling.LANCZOS)
    if im.mode == 'RGBA':
        canvas.paste(im, (px, py), im)
    else:
        canvas.paste(im, (px, py))


def render_slide1_cover_bg(z, slide_w_emu, slide_h_emu):
    """Composite exact Slide 1 cover visual layers + extract Cover textbox geometry."""
    canvas = Image.new('RGB', (CANVAS_W, CANVAS_H), MASTER_BG)
    r = ET.fromstring(z.read('ppt/slides/slide1.xml'))
    rel = {
        e.attrib['Id']: e.attrib['Target']
        for e in ET.fromstring(z.read('ppt/slides/_rels/slide1.xml.rels'))
    }
    sp_tree = r.find('.//p:spTree', NS)

    dynamic_samples = {
        'Mr. Aravindan': 'patron_name',
        '7418414780': 'patron_phone',
        'Individual Villa Adyar': 'patron_location',
        '10/10/2026': 'patron_date',
        'Mr. Abishek': 'designer_name',
        '93611 84787': 'designer_phone',
        'designs.cookscape@gmail.com': 'designer_email'
    }

    static_labels = []
    dynamic_slots = {}

    for el in sp_tree:
        if el.tag.endswith('}pic'):
            draw_blip_element(z, canvas, el, rel, slide_w_emu, slide_h_emu)
        elif el.tag.endswith('}sp'):
            nv = el.find('.//p:cNvPr', NS)
            name = nv.attrib.get('name', '') if nv is not None else ''
            if 'Slide Number Placeholder' in name or 'Footer Placeholder' in name:
                continue
            blip = el.find('.//a:blip', NS)
            if blip is not None:
                draw_blip_element(z, canvas, el, rel, slide_w_emu, slide_h_emu)
                continue

            txt = clean_text(''.join(t.text or '' for t in el.iter() if t.tag.endswith('}t')))
            if not txt:
                continue
            xf = el.find('.//a:xfrm', NS)
            if xf is None or xf.find('a:off', NS) is None or xf.find('a:ext', NS) is None:
                continue
            off = xf.find('a:off', NS).attrib
            ext = xf.find('a:ext', NS).attrib
            box = {
                'x': round(int(off['x']) / slide_w_emu * CANVAS_W, 1),
                'y': round(int(off['y']) / slide_h_emu * CANVAS_H, 1),
                'w': round(int(ext['cx']) / slide_w_emu * CANVAS_W, 1),
                'h': round(int(ext['cy']) / slide_h_emu * CANVAS_H, 1)
            }
            if txt in dynamic_samples:
                dynamic_slots[dynamic_samples[txt]] = box
            else:
                rpr = el.find('.//a:rPr', NS)
                if rpr is None:
                    rpr = el.find('.//a:defRPr', NS)
                sz_pt = int(rpr.attrib['sz']) / 100.0 if (rpr is not None and 'sz' in rpr.attrib) else 12.0
                clr_el = rpr.find('.//a:srgbClr', NS) if rpr is not None else None
                color = ('#' + clr_el.attrib['val']) if clr_el is not None else '#08231B'
                lat_el = rpr.find('a:latin', NS) if rpr is not None else None
                font = lat_el.attrib.get('typeface', 'Inter') if lat_el is not None else 'Inter'
                # Extract explicit line breaks inside shape paragraphs
                lines = []
                for p in el.findall('.//a:p', NS):
                    lt = clean_text(''.join(t.text or '' for t in p.findall('.//a:t', NS)))
                    if lt:
                        lines.append(lt)
                static_labels.append({
                    'text': '\n'.join(lines) if lines else txt,
                    'font': font,
                    'szPt': sz_pt,
                    'color': color,
                    **box
                })

    return canvas, {'staticLabels': static_labels, 'dynamicSlots': dynamic_slots}


def render_visual_slide(z, slide_idx, slide_w_emu, slide_h_emu):
    canvas = Image.new('RGB', (CANVAS_W, CANVAS_H), MASTER_BG)
    r = ET.fromstring(z.read(f'ppt/slides/slide{slide_idx}.xml'))
    rel = {
        e.attrib['Id']: e.attrib['Target']
        for e in ET.fromstring(z.read(f'ppt/slides/_rels/slide{slide_idx}.xml.rels'))
    }
    sp_tree = r.find('.//p:spTree', NS)
    if sp_tree is None:
        return canvas
    for el in sp_tree:
        if el.tag.endswith('}pic'):
            draw_blip_element(z, canvas, el, rel, slide_w_emu, slide_h_emu)
    return canvas


def main():
    if not os.path.exists(PPTX_PATH):
        raise FileNotFoundError(f'Missing template: {PPTX_PATH}')
    os.makedirs(OUT_DIR, exist_ok=True)
    # Remove stale hero if leftover
    old_hero = os.path.join(OUT_DIR, 'cover_hero.jpg')
    if os.path.exists(old_hero):
        os.remove(old_hero)

    with zipfile.ZipFile(PPTX_PATH) as z:
        pres = ET.fromstring(z.read('ppt/presentation.xml'))
        sz = pres.find('.//p:sldSz', NS)
        slide_w_emu = int(sz.attrib['cx'])
        slide_h_emu = int(sz.attrib['cy'])

        # 1. Master logo (slideMaster1 -> image1.jpeg top-right banner)
        master_logo_im = Image.open(io.BytesIO(z.read('ppt/media/image1.jpeg'))).convert('RGB')
        master_logo_im.save(os.path.join(OUT_DIR, 'master_logo.jpg'), 'JPEG', quality=92, optimize=True)

        # 2. Slide 1 Cover background artwork + exact textbox layout
        cover_bg_im, cover_layout = render_slide1_cover_bg(z, slide_w_emu, slide_h_emu)
        cover_bg_im.save(os.path.join(OUT_DIR, 'slide_01_bg.jpg'), 'JPEG', quality=88, optimize=True)

        # 3. Full-page visual slides (Intro 2-6, Divider 7/10/13/16/19, Closing 29)
        visual_slides = [2, 3, 4, 5, 6, 7, 10, 13, 16, 19, 29]
        for idx in visual_slides:
            fname = f'slide_{idx:02d}.jpg'
            img = render_visual_slide(z, idx, slide_w_emu, slide_h_emu)
            img.save(os.path.join(OUT_DIR, fname), 'JPEG', quality=88, optimize=True)

        def read_slide_tables(idx):
            r = ET.fromstring(z.read(f'ppt/slides/slide{idx}.xml'))
            return [extract_table(t) for t in r.findall('.//a:tbl', NS)]

        def read_slide_paras(idx):
            r = ET.fromstring(z.read(f'ppt/slides/slide{idx}.xml'))
            return extract_paragraphs(r)

        variants = [
            {
                'key': 'LL elite',
                'title': 'LL ELITE',
                'subtitle': 'Smart Essential Modular Range',
                'dividerSlide': 7,
                'dividerAsset': 'slide_07.jpg',
                'specTables': read_slide_tables(8)
            },
            {
                'key': 'CC MATTE',
                'title': 'CAPRICOAST MATTE',
                'subtitle': 'Refined Matte Laminate Finish',
                'dividerSlide': 10,
                'dividerAsset': 'slide_10.jpg',
                'specTables': read_slide_tables(11)
            },
            {
                'key': 'CC GLOSSY',
                'title': 'CAPRICOST GLOSSY',
                'subtitle': 'High-Gloss Mirror Finish',
                'dividerSlide': 13,
                'dividerAsset': 'slide_13.jpg',
                'specTables': read_slide_tables(14)
            },
            {
                'key': 'SURABHI',
                'title': 'ELEGANT SURABHI',
                'subtitle': 'Super Matte 1mm Branded Laminate',
                'dividerSlide': 16,
                'dividerAsset': 'slide_16.jpg',
                'specTables': read_slide_tables(17)
            },
            {
                'key': 'MR+',
                'title': '4X TUFF GLOSS',
                'subtitle': 'Scratch & Stain Proof Gloss',
                'dividerSlide': 19,
                'dividerAsset': 'slide_19.jpg',
                'specTables': read_slide_tables(20)
            }
        ]

        s22_paras = read_slide_paras(22)
        s22_tables = read_slide_tables(22)
        s23_paras = read_slide_paras(23)
        s23_tables = read_slide_tables(23)
        s24_tables = read_slide_tables(24)
        s25_tables = read_slide_tables(25)
        s26_paras = read_slide_paras(26)
        s27_paras = read_slide_paras(27)
        s28_paras = read_slide_paras(28)

        faq_idx = next((i for i, p in enumerate(s27_paras) if 'FREQUENTLY ASKED QUESTIONS' in p.upper()), len(s27_paras))
        terms_paras = [p for p in (s26_paras + s27_paras[:faq_idx]) if p.upper() != 'TERMS & CONDITIONS']
        faq_paras = [p for p in (s27_paras[faq_idx + 1:] + s28_paras) if 'FREQUENTLY ASKED QUESTIONS' not in p.upper()]

        data = {
            'canvas': {'width': CANVAS_W, 'height': CANVAS_H, 'bgColor': '#F4EDE3'},
            'assets': {
                'masterLogo': 'master_logo.jpg',
                'masterLogoRect': {
                    'x': round(6242050 / slide_w_emu * CANVAS_W, 1),
                    'y': round(274638 / slide_h_emu * CANVAS_H, 1),
                    'w': round(3493554 / slide_w_emu * CANVAS_W, 1),
                    'h': round(655042 / slide_h_emu * CANVAS_H, 1)
                },
                'coverBg': 'slide_01_bg.jpg',
                'coverLayout': cover_layout,
                'introSlides': [
                    {'id': 'intro_2', 'title': 'Introduction — Page 2', 'asset': 'slide_02.jpg'},
                    {'id': 'intro_3', 'title': 'Introduction — Page 3', 'asset': 'slide_03.jpg'},
                    {'id': 'intro_4', 'title': 'The Scape Flow', 'asset': 'slide_04.jpg'},
                    {'id': 'intro_5', 'title': 'Introduction — Page 5', 'asset': 'slide_05.jpg'},
                    {'id': 'intro_6', 'title': 'Introduction — Page 6', 'asset': 'slide_06.jpg'}
                ],
                'closingAsset': 'slide_29.jpg'
            },
            'variants': variants,
            'processSlides': {
                'designProcess': {
                    'title': 'DESIGN PROCESS AND TIMELINES',
                    'paragraphs': [p for p in s22_paras if p.upper() != 'DESIGN PROCESS AND TIMELINES'],
                    'table': s22_tables[0] if s22_tables else []
                },
                'executionProcess': {
                    'title': 'EXECUTION PROCESS AND TIMELINES',
                    'paragraphs': [p for p in s23_paras if p.upper() != 'EXECUTION PROCESS AND TIMELINES'],
                    'table': s23_tables[0] if s23_tables else []
                },
                'inclusionsExclusions': {
                    'title': 'INCLUSION & EXCLUSION POLICY',
                    'table': s24_tables[0] if s24_tables else []
                },
                'paymentTerms': {
                    'title': 'PAYMENT TERMS AND WORK STAGE',
                    'table': s25_tables[0] if s25_tables else []
                },
                'termsConditions': {
                    'title': 'TERMS & CONDITIONS',
                    'paragraphs': terms_paras
                },
                'faqs': {
                    'title': 'FREQUENTLY ASKED QUESTIONS (FAQS)',
                    'paragraphs': faq_paras
                }
            }
        }

        with open(os.path.join(OUT_DIR, 'template-data.json'), 'w', encoding='utf-8', newline='\r\n') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    files = sorted(os.listdir(OUT_DIR))
    total_kb = sum(os.path.getsize(os.path.join(OUT_DIR, fn)) for fn in files) / 1024.0
    print(f'Extracted {len(files)} template assets ({total_kb:.1f} KB total) cleanly!')


if __name__ == '__main__':
    main()
