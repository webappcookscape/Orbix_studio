#!/usr/bin/env python3
"""
Extract Cookscape Master-Template.pptx artwork (preserving Slide 1 masks, flips & duotone fills),
Cover layout boxes, and structured specification/policy/T&C/FAQ content into server/quote-assets/.
"""

import colorsys
import io
import json
import math
import os
import re
import subprocess
import tempfile
import zipfile
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageOps

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
MASTER_BG = (244, 237, 227)  # #F4EDE3


def clean_text(s):
    if not s:
        return ''
    return ' '.join(s.replace('\xa0', ' ').split()).strip()


def load_theme_colors(z):
    colors = {
        'dk1': '000000', 'lt1': 'FFFFFF',
        'dk2': '1F497D', 'lt2': 'EEECE1',
        'accent1': '4F81BD', 'accent2': 'C0504D',
        'accent3': '9BBB59', 'accent4': '8064A2',
        'accent5': '4BACC6', 'accent6': 'F79646'
    }
    try:
        t = ET.fromstring(z.read('ppt/theme/theme1.xml'))
        scheme = t.find('.//a:clrScheme', NS)
        if scheme is not None:
            for ch in scheme:
                tag = ch.tag.split('}')[-1]
                srgb = ch.find('.//a:srgbClr', NS)
                if srgb is not None and 'val' in srgb.attrib:
                    colors[tag] = srgb.attrib['val']
    except Exception:
        pass
    return colors


def resolve_ooxml_color(clr_container, theme_colors):
    """Resolve <a:srgbClr> or <a:schemeClr> or <a:prstClr> with tint/satMod children."""
    if clr_container is None:
        return None
    base_rgb = None
    clr_el = None

    srgb = clr_container.find('a:srgbClr', NS)
    scheme = clr_container.find('a:schemeClr', NS)
    prst = clr_container.find('a:prstClr', NS)

    if srgb is not None:
        clr_el = srgb
        hx = srgb.attrib.get('val', 'FFFFFF')
        base_rgb = (int(hx[0:2], 16) / 255.0, int(hx[2:4], 16) / 255.0, int(hx[4:6], 16) / 255.0)
    elif scheme is not None:
        clr_el = scheme
        hx = theme_colors.get(scheme.attrib.get('val', 'accent1'), 'C0504D')
        base_rgb = (int(hx[0:2], 16) / 255.0, int(hx[2:4], 16) / 255.0, int(hx[4:6], 16) / 255.0)
    elif prst is not None:
        clr_el = prst
        pv = prst.attrib.get('val', 'black')
        base_rgb = (0.0, 0.0, 0.0) if pv == 'black' else (1.0, 1.0, 1.0)
    else:
        return None

    r, g, b = base_rgb
    for mod in clr_el:
        mtag = mod.tag.split('}')[-1]
        val = int(mod.attrib.get('val', 100000)) / 100000.0
        if mtag == 'tint':
            r = r * val + (1.0 - val)
            g = g * val + (1.0 - val)
            b = b * val + (1.0 - val)
        elif mtag == 'shade':
            r *= val
            g *= val
            b *= val
        elif mtag == 'satMod':
            h, l, s = colorsys.rgb_to_hls(r, g, b)
            s = min(1.0, max(0.0, s * val))
            r, g, b = colorsys.hls_to_rgb(h, l, s)

    return (
        int(round(min(1.0, max(0.0, r)) * 255)),
        int(round(min(1.0, max(0.0, g)) * 255)),
        int(round(min(1.0, max(0.0, b)) * 255))
    )


def apply_duotone_if_present(im, blip_el, theme_colors):
    duotone = blip_el.find('a:duotone', NS)
    if duotone is None:
        return im
    c1 = None
    c2 = None
    children = list(duotone)
    if len(children) >= 2:
        wrapper1 = ET.Element('w'); wrapper1.append(children[0])
        wrapper2 = ET.Element('w'); wrapper2.append(children[1])
        # Copy directly without mutating parent cleanly
        c1 = resolve_color_node(children[0], theme_colors)
        c2 = resolve_color_node(children[1], theme_colors)
    if c1 is None or c2 is None:
        return im

    rgba = im.convert('RGBA')
    gray = rgba.convert('L')
    lut_r = [int(round(c1[0] + (c2[0] - c1[0]) * (i / 255.0))) for i in range(256)]
    lut_g = [int(round(c1[1] + (c2[1] - c1[1]) * (i / 255.0))) for i in range(256)]
    lut_b = [int(round(c1[2] + (c2[2] - c1[2]) * (i / 255.0))) for i in range(256)]

    r_band = gray.point(lut_r)
    g_band = gray.point(lut_g)
    b_band = gray.point(lut_b)
    _, _, _, a_band = rgba.split()
    return Image.merge('RGBA', (r_band, g_band, b_band, a_band))


def resolve_color_node(clr_el, theme_colors):
    tag = clr_el.tag.split('}')[-1]
    if tag == 'srgbClr':
        hx = clr_el.attrib.get('val', 'FFFFFF')
        r, g, b = int(hx[0:2], 16) / 255.0, int(hx[2:4], 16) / 255.0, int(hx[4:6], 16) / 255.0
    elif tag == 'schemeClr':
        hx = theme_colors.get(clr_el.attrib.get('val', 'accent1'), 'C0504D')
        r, g, b = int(hx[0:2], 16) / 255.0, int(hx[2:4], 16) / 255.0, int(hx[4:6], 16) / 255.0
    elif tag == 'prstClr':
        pv = clr_el.attrib.get('val', 'black')
        r, g, b = (0.0, 0.0, 0.0) if pv == 'black' else (1.0, 1.0, 1.0)
    else:
        return None

    for mod in clr_el:
        mtag = mod.tag.split('}')[-1]
        val = int(mod.attrib.get('val', 100000)) / 100000.0
        if mtag == 'tint':
            r = r * val + (1.0 - val)
            g = g * val + (1.0 - val)
            b = b * val + (1.0 - val)
        elif mtag == 'shade':
            r *= val
            g *= val
            b *= val
        elif mtag == 'satMod':
            h, l, s = colorsys.rgb_to_hls(r, g, b)
            s = min(1.0, max(0.0, s * val))
            r, g, b = colorsys.hls_to_rgb(h, l, s)

    return (
        int(round(min(1.0, max(0.0, r)) * 255)),
        int(round(min(1.0, max(0.0, g)) * 255)),
        int(round(min(1.0, max(0.0, b)) * 255))
    )


def apply_preset_geometry_mask(im, el, flip_h):
    """Apply PowerPoint preset shape clipping (such as flowChartDelay curved arch mask)."""
    prst = el.find('.//a:prstGeom', NS)
    if prst is None:
        return im
    shape_type = prst.attrib.get('prst', '')
    if shape_type != 'flowChartDelay':
        return im

    pw, ph = im.size
    # Render anti-aliased mask at 2x resolution then downsample
    sw, sh = pw * 2, ph * 2
    mask = Image.new('L', (sw, sh), 0)
    md = ImageDraw.Draw(mask)
    if flip_h:
        # Right half solid rectangle, left half curved D-arch
        md.rectangle([sw // 2, 0, sw, sh], fill=255)
        md.ellipse([0, 0, sw, sh], fill=255)
    else:
        md.rectangle([0, 0, sw // 2, sh], fill=255)
        md.ellipse([0, 0, sw, sh], fill=255)
    mask = mask.resize((pw, ph), Image.Resampling.LANCZOS)

    rgba = im.convert('RGBA')
    _, _, _, existing_a = rgba.split()
    if im.mode == 'RGBA':
        from PIL import ImageChops
        mask = ImageChops.darker(mask, existing_a)
    rgba.putalpha(mask)
    return rgba


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


def draw_blip_element(z, canvas, el, rel, slide_w_emu, slide_h_emu, theme_colors):
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
    flip_h = xf.attrib.get('flipH') == '1'
    if flip_h:
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

    im = apply_duotone_if_present(im, blip, theme_colors)

    off = xf.find('a:off', NS)
    ext = xf.find('a:ext', NS)
    if off is None or ext is None:
        return

    px = int(round(int(off.attrib.get('x', 0)) / slide_w_emu * CANVAS_W))
    py = int(round(int(off.attrib.get('y', 0)) / slide_h_emu * CANVAS_H))
    pw = max(1, int(round(int(ext.attrib.get('cx', 0)) / slide_w_emu * CANVAS_W)))
    ph = max(1, int(round(int(ext.attrib.get('cy', 0)) / slide_h_emu * CANVAS_H)))

    im = im.resize((pw, ph), Image.Resampling.LANCZOS)
    im = apply_preset_geometry_mask(im, el, flip_h)

    if im.mode == 'RGBA':
        canvas.paste(im, (px, py), im)
    else:
        canvas.paste(im, (px, py))


def render_slide1_cover_bg(z, slide_w_emu, slide_h_emu, theme_colors):
    """Composite exact Slide 1 artwork layers + extract exact Cover textbox geometry."""
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
            draw_blip_element(z, canvas, el, rel, slide_w_emu, slide_h_emu, theme_colors)
        elif el.tag.endswith('}sp'):
            nv = el.find('.//p:cNvPr', NS)
            name = nv.attrib.get('name', '') if nv is not None else ''
            if 'Slide Number Placeholder' in name or 'Footer Placeholder' in name:
                continue
            blip = el.find('.//a:blip', NS)
            if blip is not None:
                draw_blip_element(z, canvas, el, rel, slide_w_emu, slide_h_emu, theme_colors)
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
                ppr = el.find('.//a:pPr', NS)
                sz_pt = int(rpr.attrib['sz']) / 100.0 if (rpr is not None and 'sz' in rpr.attrib) else 12.0
                bold = (rpr.attrib.get('b') == '1') if rpr is not None else False
                algn = ppr.attrib.get('algn', 'l') if ppr is not None else 'l'
                clr_el = rpr.find('.//a:srgbClr', NS) if rpr is not None else None
                color = ('#' + clr_el.attrib['val']) if clr_el is not None else '#08231B'
                lat_el = rpr.find('a:latin', NS) if rpr is not None else None
                font = lat_el.attrib.get('typeface', 'Inter') if lat_el is not None else 'Inter'
                lines = []
                for p in el.findall('.//a:p', NS):
                    lt = clean_text(''.join(t.text or '' for t in p.findall('.//a:t', NS)))
                    if lt:
                        lines.append(lt)
                static_labels.append({
                    'text': '\n'.join(lines) if lines else txt,
                    'font': font,
                    'szPt': sz_pt,
                    'bold': bold,
                    'algn': algn,
                    'color': color,
                    **box
                })

    return canvas, {'coverBakedStatics': False, 'staticLabels': static_labels, 'dynamicSlots': dynamic_slots}


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


def render_slide1_via_powerpoint_com(pptx_path, slide_w_emu, slide_h_emu):
    if os.name != 'nt':
        return None
    try:
        import fitz
    except Exception:
        return None

    tmp_dir = tempfile.mkdtemp(prefix='orbix_s1_')
    tmp_pptx = os.path.join(tmp_dir, 'cover_blank.pptx')
    tmp_pdf = os.path.join(tmp_dir, 'cover_blank.pdf')
    tmp_ps1 = os.path.join(tmp_dir, 'export_pdf.ps1')
    try:
        blank_patterns = [
            r'Mr\.\s*Aravindan', r'7418414780', r'Webapp\.cookscape@gmail\.com',
            r'Individual Villa Adyar', r'10\/10\/2026', r'Mr\.\s*Abishek',
            r'93611\s*84787', r'designs\.cookscape@gmail\.com'
        ]
        with zipfile.ZipFile(pptx_path, 'r') as zin, zipfile.ZipFile(tmp_pptx, 'w', zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                raw = zin.read(item.filename)
                if item.filename == 'ppt/slides/slide1.xml':
                    s1 = raw.decode('utf-8')
                    for pat in blank_patterns:
                        s1 = re.sub(pat, '', s1, flags=re.IGNORECASE)
                    s1 = apply_cover_shape_alignments(s1)
                    raw = s1.encode('utf-8')
                zout.writestr(item, raw)

        ps_code = (
            "param([string]$Src, [string]$Dst)\r\n"
            "$ppt = $null; $pres = $null\r\n"
            "try {\r\n"
            "  $ppt = New-Object -ComObject PowerPoint.Application\r\n"
            "  $pres = $ppt.Presentations.Open($Src, -1, 0, 0)\r\n"
            "  $pres.SaveAs($Dst, 32)\r\n"
            "} finally {\r\n"
            "  if ($pres -ne $null) { try { $pres.Close() } catch {} ; [System.Runtime.Interopservices.Marshal]::ReleaseComObject($pres) | Out-Null }\r\n"
            "  if ($ppt -ne $null) { try { $ppt.Quit() } catch {} ; [System.Runtime.Interopservices.Marshal]::ReleaseComObject($ppt) | Out-Null }\r\n"
            "}\r\n"
        )
        with open(tmp_ps1, 'w', encoding='utf-8') as f:
            f.write(ps_code)

        res = subprocess.run(
            ['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tmp_ps1, tmp_pptx, tmp_pdf],
            capture_output=True, text=True, timeout=90
        )
        if res.returncode != 0 or not os.path.exists(tmp_pdf):
            print(f'[extract] PowerPoint COM render unavailable (code={res.returncode}): {res.stderr.strip()[:200]}')
            return None

        doc = fitz.open(tmp_pdf)
        page = doc[0]
        pix = page.get_pixmap(matrix=fitz.Matrix(2.5, 2.5), alpha=False)
        img = Image.frombytes('RGB', [pix.width, pix.height], pix.samples)
        doc.close()
        img = img.resize((CANVAS_W, CANVAS_H), Image.Resampling.LANCZOS)

        slot_ids = {
            '73': 'patron_name', '74': 'patron_phone', '76': 'patron_location', '77': 'patron_date',
            '80': 'designer_name', '79': 'designer_phone', '78': 'designer_email'
        }
        dynamic_slots = {}
        for sid, x, y, cx, cy in COVER_SHAPE_ALIGNMENTS:
            if sid in slot_ids:
                dynamic_slots[slot_ids[sid]] = {
                    'x': round(x / slide_w_emu * CANVAS_W, 1),
                    'y': round(y / slide_h_emu * CANVAS_H, 1),
                    'w': round(cx / slide_w_emu * CANVAS_W, 1),
                    'h': round(cy / slide_h_emu * CANVAS_H, 1)
                }
        return img, {'coverBakedStatics': True, 'staticLabels': [], 'dynamicSlots': dynamic_slots}
    except Exception as ex:
        print(f'[extract] PowerPoint COM render fallback: {ex}')
        return None
    finally:
        for fp in (tmp_pptx, tmp_pdf, tmp_ps1):
            try:
                if os.path.exists(fp):
                    os.remove(fp)
            except Exception:
                pass
        try:
            os.rmdir(tmp_dir)
        except Exception:
            pass


def render_visual_slide(z, slide_idx, slide_w_emu, slide_h_emu, theme_colors):
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
            draw_blip_element(z, canvas, el, rel, slide_w_emu, slide_h_emu, theme_colors)
    return canvas


def main():
    if not os.path.exists(PPTX_PATH):
        raise FileNotFoundError(f'Missing template: {PPTX_PATH}')
    os.makedirs(OUT_DIR, exist_ok=True)
    old_hero = os.path.join(OUT_DIR, 'cover_hero.jpg')
    if os.path.exists(old_hero):
        os.remove(old_hero)

    with zipfile.ZipFile(PPTX_PATH) as z:
        theme_colors = load_theme_colors(z)
        pres = ET.fromstring(z.read('ppt/presentation.xml'))
        sz = pres.find('.//p:sldSz', NS)
        slide_w_emu = int(sz.attrib['cx'])
        slide_h_emu = int(sz.attrib['cy'])

        master_logo_im = Image.open(io.BytesIO(z.read('ppt/media/image1.jpeg'))).convert('RGB')
        master_logo_im.save(os.path.join(OUT_DIR, 'master_logo.jpg'), 'JPEG', quality=92, optimize=True)

        com_res = render_slide1_via_powerpoint_com(PPTX_PATH, slide_w_emu, slide_h_emu)
        if com_res is not None:
            cover_bg_im, cover_layout = com_res
            print('Rendered Slide 1 cover natively via Microsoft PowerPoint COM -> PDF -> PyMuPDF.')
            cover_bg_im.save(os.path.join(OUT_DIR, 'slide_01_bg.jpg'), 'JPEG', quality=92, optimize=True)
        else:
            cover_bg_im, cover_layout = render_slide1_cover_bg(z, slide_w_emu, slide_h_emu, theme_colors)
            cover_bg_im.save(os.path.join(OUT_DIR, 'slide_01_bg.jpg'), 'JPEG', quality=88, optimize=True)

        visual_slides = [2, 3, 4, 5, 6, 7, 10, 13, 16, 19, 29]
        for idx in visual_slides:
            fname = f'slide_{idx:02d}.jpg'
            img = render_visual_slide(z, idx, slide_w_emu, slide_h_emu, theme_colors)
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
