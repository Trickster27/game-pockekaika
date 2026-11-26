"""Генератор «живых» героев: каждая часть — отдельный слой со своей точкой вращения.

Выход:
  units/<key>.svg          — собранный герой с SMIL-анимацией (для карточек и плиток интерфейса);
  rig/<key>/<part>.svg     — слои для боя (Pixi анимирует их сам по тем же параметрам);
  rigs.json                — описание слоёв: точка вращения и движение.
Кадр общий для всех: viewBox -60 -130 120 135, ноги в (0, 0).
"""
import json, math, os, sys

OUT = sys.argv[1]  # src/assets/art
VB = '-60 -130 120 135'
OUTLINE = '#0d0912'


def wrap(inner, defs=''):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VB}" width="240" height="270">'
            f'{"<defs>" + defs + "</defs>" if defs else ""}'
            f'<g stroke="{OUTLINE}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">{inner}</g></svg>\n')


# Движения (те же формулы в Pixi):
#   sway  — поворот: amp (градусы) * sin(2π t / period + phase)
#   breathe — растяжение по вертикали: 1 + amp * sin(...)
#   bob   — сдвиг по вертикали: amp * sin(...)
#   pulse — прозрачность: 1 - amp * (0.5 + 0.5 sin(...))
#   blink — закрытые глаза видны ~0.13 с раз в period секунд
#   swing — следует за замахом в бою (в карточках — как sway)
def smil(m, px, py):
    kind, amp, per, ph = m['kind'], m.get('amp', 0), m.get('period', 2), m.get('phase', 0)
    begin = f'{-ph / (2 * math.pi) * per:.2f}s'
    n = 12
    sines = [math.sin(2 * math.pi * i / n) for i in range(n + 1)]
    if kind in ('sway', 'swing'):
        vals = ';'.join(f'{amp * s:.2f} {px} {py}' for s in sines)
        return f'<animateTransform attributeName="transform" type="rotate" values="{vals}" dur="{per}s" begin="{begin}" repeatCount="indefinite"/>'
    if kind == 'breathe':
        vals = ';'.join(f'1 {1 + amp * s:.4f}' for s in sines)
        return f'<animateTransform attributeName="transform" type="scale" values="{vals}" dur="{per}s" begin="{begin}" repeatCount="indefinite"/>'
    if kind == 'bob':
        vals = ';'.join(f'0 {amp * s:.2f}' for s in sines)
        return f'<animateTransform attributeName="transform" type="translate" values="{vals}" dur="{per}s" begin="{begin}" repeatCount="indefinite"/>'
    if kind == 'pulse':
        vals = ';'.join(f'{1 - amp * (0.5 + 0.5 * s):.3f}' for s in sines)
        return f'<animate attributeName="opacity" values="{vals}" dur="{per}s" begin="{begin}" repeatCount="indefinite"/>'
    if kind == 'blink':
        return (f'<animate attributeName="opacity" values="0;0;1;0" keyTimes="0;0.955;0.97;1" calcMode="discrete" '
                f'dur="{per}s" begin="{begin}" repeatCount="indefinite"/>')
    return ''


def build(key, parts):
    """parts: [{id, pivot:(x,y), motion:{...}|None, follow:'torso'|None, svg, defs}] в порядке отрисовки."""
    rdir = os.path.join(OUT, 'rig', key)
    os.makedirs(rdir, exist_ok=True)
    comp, defs_all, meta = [], [], []
    torso = next((p for p in parts if p.get('breath')), None)
    for p in parts:
        px, py = p['pivot']
        defs_all.append(p.get('defs', ''))
        open(os.path.join(rdir, p['id'] + '.svg'), 'w').write(wrap(p['svg'], p.get('defs', '')))
        inner = p['svg']
        m = p.get('motion')
        if m and m['kind'] in ('breathe',):
            inner = f'<g transform="translate({px} {py})"><g>{smil(m, px, py)}<g transform="translate({-px} {-py})">{inner}</g></g></g>'
        elif m and m['kind'] in ('pulse', 'blink'):
            inner = f'<g>{smil(m, px, py)}{inner}</g>'
        elif m:
            inner = f'<g>{smil(m, px, py)}{inner}</g>'
        # Части, что «едут» вместе с дыханием торса (голова, руки, волосы).
        if p.get('follow') and torso:
            tm = torso['motion']
            tpy = torso['pivot'][1]
            lift = round(tm['amp'] * (tpy - py), 2)  # верх торса поднимается на amp * высоту
            inner = f'<g>{smil({"kind": "bob", "amp": -lift, "period": tm["period"], "phase": tm.get("phase", 0)}, 0, 0)}{inner}</g>'
        comp.append(inner)
        meta.append({'id': p['id'], 'pivot': [px, py], **({'motion': m} if m else {}),
                     **({'follow': True} if p.get('follow') else {})})
    open(os.path.join(OUT, 'units', key + '.svg'), 'w').write(wrap(''.join(comp), ''.join(defs_all)))
    return {'parts': meta}


def lg(id_, c1, c2, x1=0, y1=0, x2=1, y2=1):
    return f'<linearGradient id="{id_}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}"><stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient>'


def rg(id_, c1, c2, o2=0):
    return f'<radialGradient id="{id_}"><stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}" stop-opacity="{o2}"/></radialGradient>'


RIGS = {}

# ═══════════════════════════ Ардан, Рыцарь Рассвета ═══════════════════════════
K = 'knight'
RIGS[K] = build(K, [
    {'id': 'cape', 'pivot': (0, -60), 'motion': {'kind': 'sway', 'amp': 2.2, 'period': 3.2, 'phase': 0.6},
     'defs': lg('kn-cape', '#c8343c', '#5a1220', 0, 0, 0, 1),
     'svg': '''<path d="M-20 -62 Q-34 -30 -40 2 Q-30 -4 -22 2 Q-12 -6 -2 2 Q8 -6 18 2 Q28 -4 38 0 Q30 -30 20 -62 Z" fill="url(#kn-cape)"/>
<path d="M-14 -58 Q-26 -30 -30 -2 M2 -58 Q0 -30 -2 0 M14 -58 Q24 -30 28 -2" fill="none" stroke="#3a0a14" stroke-width="1.4"/>'''},
    {'id': 'legs', 'pivot': (0, -20), 'motion': None,
     'svg': '''<path d="M-15 0 L-13 -26 L-3 -26 L-3 0 Z" fill="#8a97b2"/>
<path d="M15 0 L13 -26 L3 -26 L3 0 Z" fill="#5f6b88"/>
<path d="M-13 -20 L-3 -20 M13 -20 L3 -20" stroke="#d9a94a" stroke-width="2.4"/>
<path d="M-18 0 L-16 -8 L-2 -8 L-1 0 Z M18 0 L16 -8 L2 -8 L1 0 Z" fill="#323a52"/>
<circle cx="-8" cy="-14" r="3" fill="#cdd5e4"/><circle cx="8" cy="-14" r="3" fill="#a9b4ca"/>'''},
    {'id': 'shield', 'pivot': (-18, -58), 'motion': {'kind': 'sway', 'amp': 1.4, 'period': 3.2, 'phase': 1.2}, 'follow': True,
     'defs': lg('kn-sh', '#3e5aa8', '#1d2a5a', 0, 0, 1, 1),
     'svg': '''<path d="M-44 -66 L-16 -66 L-16 -34 Q-24 -10 -30 -4 Q-36 -10 -44 -34 Z" fill="url(#kn-sh)"/>
<path d="M-44 -66 L-30 -66 L-30 -4 Q-36 -10 -44 -34 Z" fill="#4c6cc0" opacity=".55" stroke="none"/>
<path d="M-44 -66 L-16 -66 L-16 -34 Q-24 -10 -30 -4 Q-36 -10 -44 -34 Z" fill="none" stroke="#d9a94a" stroke-width="2"/>
<circle cx="-30" cy="-44" r="7" fill="#f0c860"/>
<path d="M-30 -56 L-30 -32 M-42 -44 L-18 -44 M-38 -52 L-22 -36 M-22 -52 L-38 -36" stroke="#f0c860" stroke-width="1.6"/>
<circle cx="-30" cy="-44" r="3.4" fill="#fff4c8" stroke-width="1.2"/>'''},
    {'id': 'torso', 'pivot': (0, -26), 'motion': {'kind': 'breathe', 'amp': 0.016, 'period': 3.2}, 'breath': True,
     'defs': lg('kn-pl', '#e8eef8', '#8592ae', 0, 0, 1, 0),
     'svg': '''<path d="M-12 -30 L12 -30 L14 -6 L0 2 L-14 -6 Z" fill="#f2ead8"/>
<path d="M-12 -30 L0 -30 L0 2 L-14 -6 Z" fill="#fffaf0" stroke="none"/>
<path d="M-12 -30 L12 -30 L14 -6 L0 2 L-14 -6 Z" fill="none"/>
<path d="M-4 -28 L4 -28 L5 -4 L0 0 L-5 -4 Z" fill="#d9a94a"/>
<path d="M-21 -30 Q-24 -56 0 -62 Q24 -56 21 -30 Z" fill="url(#kn-pl)"/>
<path d="M-21 -30 Q-24 -56 0 -62 Q24 -56 21 -30 Z" fill="none"/>
<path d="M-16 -54 Q0 -60 16 -54 M-17 -44 Q0 -50 17 -44" fill="none" stroke="#6a7592" stroke-width="1.4"/>
<rect x="-21" y="-33" width="42" height="6" rx="2" fill="#5a3a22"/>
<rect x="-4" y="-34.5" width="8" height="9" rx="1.5" fill="#f0c860"/>'''},
    {'id': 'emblem', 'pivot': (0, -45), 'motion': {'kind': 'pulse', 'amp': 0.45, 'period': 2.4}, 'follow': True,
     'defs': rg('kn-gl', '#fff4c8', '#f0c860'),
     'svg': '''<circle cx="0" cy="-45" r="11" fill="url(#kn-gl)" stroke="none" opacity=".9"/>
<path d="M0 -53 L2.4 -47.4 L8 -45 L2.4 -42.6 L0 -37 L-2.4 -42.6 L-8 -45 L-2.4 -47.4 Z" fill="#fff4c8" stroke-width="1.4"/>'''},
    {'id': 'head', 'pivot': (0, -62), 'motion': {'kind': 'sway', 'amp': 1.6, 'period': 3.2, 'phase': 0.3}, 'follow': True,
     'defs': lg('kn-hm', '#f4f7fc', '#8592ae', 0, 0, 1, 0),
     'svg': '''<path d="M-13 -66 Q-15 -90 0 -94 Q15 -90 13 -66 L9 -60 L-9 -60 Z" fill="url(#kn-hm)"/>
<path d="M-11 -77 L11 -77 L10 -71 L-10 -71 Z" fill="#0d0912"/>
<rect x="-8" y="-75.6" width="5.5" height="2.2" fill="#ffe7a0" stroke="none"/>
<rect x="2.5" y="-75.6" width="5.5" height="2.2" fill="#ffe7a0" stroke="none"/>
<path d="M0 -94 L0 -60" stroke="#6a7592" stroke-width="1.4"/>
<path d="M-15 -86 L-9 -98 L-5 -90 L0 -102 L5 -90 L9 -98 L15 -86 Q0 -92 -15 -86 Z" fill="#f0c860"/>
<circle cx="0" cy="-94" r="2.4" fill="#fff4c8" stroke-width="1.2"/>'''},
    {'id': 'plume', 'pivot': (4, -98), 'motion': {'kind': 'sway', 'amp': 7, 'period': 2.1, 'phase': 1.0}, 'follow': True,
     'svg': '''<path d="M4 -98 Q14 -120 34 -114 Q42 -110 46 -100 Q36 -106 28 -102 Q36 -96 38 -88 Q26 -98 14 -92 Z" fill="#c8343c"/>
<path d="M8 -102 Q18 -114 32 -110 M14 -96 Q24 -102 34 -96" fill="none" stroke="#ff8a7a" stroke-width="1.4"/>'''},
    {'id': 'sword', 'pivot': (19, -56), 'motion': {'kind': 'swing', 'amp': 2, 'period': 3.2, 'phase': 0.9}, 'follow': True,
     'defs': lg('kn-bl', '#ffffff', '#aebbd4', 0, 0, 1, 0),
     'svg': '''<path d="M14 -62 Q28 -66 30 -50 L24 -44 Z" fill="#cdd5e4"/>
<path d="M18 -52 L28 -36 L22 -32 L14 -46 Z" fill="#a9b4ca"/>
<path d="M27 -40 L44 -112 L50 -110 L33 -38 Z" fill="url(#kn-bl)"/>
<path d="M44 -104 L32 -46" stroke="#fff6cf" stroke-width="1.4"/>
<path d="M44 -112 L47 -122 L50 -110 Z" fill="#ffffff"/>
<path d="M20 -44 L42 -36 L40 -30 L18 -38 Z" fill="#d9a94a"/>
<path d="M26 -34 L23 -22 L29 -20 L32 -32 Z" fill="#6b4a2b"/>
<circle cx="25" cy="-19" r="4" fill="#d9a94a"/>
<circle cx="31" cy="-40" r="3.2" fill="#fff4c8" stroke-width="1.2"/>'''},
    {'id': 'shard', 'pivot': (31, -40), 'motion': {'kind': 'pulse', 'amp': 0.7, 'period': 1.6}, 'follow': True,
     'defs': rg('kn-sg', '#fff4c8', '#f0c860'),
     'svg': '<circle cx="31" cy="-40" r="9" fill="url(#kn-sg)" stroke="none"/><path d="M40 -100 L36 -84" stroke="#fffbe6" stroke-width="2.4" opacity=".8"/>'},
])

# ═══════════════════════════ Ифрита, Повелительница пламени ═══════════════════════════
K = 'ifrita'
SKIN = '#f3c9a8'
SKIN2 = '#d99c7c'
RIGS[K] = build(K, [
    {'id': 'hairBack', 'pivot': (0, -84), 'motion': {'kind': 'sway', 'amp': 4.5, 'period': 1.7, 'phase': 0.5}, 'follow': True,
     'defs': lg('if-hb', '#ffd36b', '#c8282a', 0, 0, 0, 1),
     'svg': '''<path d="M-14 -88 Q-30 -70 -26 -48 Q-34 -40 -30 -26 Q-22 -36 -20 -46 Q-16 -36 -10 -32 Q-12 -46 -6 -56 L6 -56 Q12 -46 10 -32 Q18 -38 20 -48 Q24 -36 32 -30 Q34 -44 26 -50 Q32 -72 14 -90 Z" fill="url(#if-hb)"/>
<path d="M-20 -70 Q-24 -56 -22 -44 M18 -72 Q24 -58 22 -46" fill="none" stroke="#ff9a3a" stroke-width="1.6"/>'''},
    {'id': 'legs', 'pivot': (0, -30), 'motion': None,
     'defs': lg('if-lg', '#ffd9bc', '#c98a6a', 0, 0, 1, 0),
     'svg': '''<path d="M-9 -40 Q-14 -20 -11 -6 L-6 -6 Q-4 -22 0 -40 Z" fill="url(#if-lg)"/>
<path d="M2 -40 Q10 -24 12 -6 L7 -6 Q2 -22 -2 -40 Z" fill="#e2a888"/>
<path d="M-13 -8 L-5 -8 L-4 0 L-16 0 Q-16 -4 -13 -8 Z" fill="#3a1218"/>
<path d="M5 -8 L13 -8 L16 0 L4 0 Q4 -4 5 -8 Z" fill="#2a0c12"/>
<path d="M-6 -1 L-4 4 M14 -1 L15 4" stroke="#0d0912" stroke-width="2.4"/>
<path d="M-12 -14 L-6 -14 M6 -14 L12 -14" stroke="#d9a94a" stroke-width="1.8"/>'''},
    {'id': 'armBack', 'pivot': (-12, -70), 'motion': {'kind': 'sway', 'amp': 1.2, 'period': 3, 'phase': 2}, 'follow': True,
     'svg': f'''<path d="M-12 -70 Q-22 -62 -22 -52 Q-21 -44 -14 -42 L-12 -46 Q-16 -50 -16 -54 Q-15 -62 -9 -66 Z" fill="{SKIN2}"/>
<path d="M-22 -58 L-16 -56 M-21 -54 L-15 -52" stroke="#d9a94a" stroke-width="1.8"/>'''},
    {'id': 'torso', 'pivot': (0, -44), 'motion': {'kind': 'breathe', 'amp': 0.02, 'period': 3}, 'breath': True,
     'defs': lg('if-sk', '#ff5a3a', '#7a1020', 0, 0, 0, 1) + lg('if-bd', '#a8202e', '#4a0a18', 0, 0, 1, 1) + lg('if-sn', '#ffe0c8', SKIN2, 0, 0, 1, 0),
     'svg': f'''<path d="M-9 -46 Q-20 -40 -22 -24 Q-24 -10 -22 -4 Q-14 -2 -10 -8 Q-8 -22 -2 -36 L2 -36 Q4 -24 4 -12 L22 -6 Q24 -20 18 -36 Q14 -44 9 -46 Z" fill="url(#if-sk)"/>
<path d="M-22 -4 Q-18 0 -14 -4 Q-12 0 -10 -8 M4 -12 Q8 -4 12 -8 Q16 -2 22 -6" fill="none" stroke="#ffd36b" stroke-width="1.6"/>
<path d="M-10 -74 Q-12 -66 -9 -60 Q-12 -54 -9 -46 L9 -46 Q12 -54 9 -60 Q12 -66 10 -74 Q0 -78 -10 -74 Z" fill="url(#if-sn)"/>
<path d="M-9 -64 Q-12 -58 -9 -50 L-8 -46 L8 -46 L9 -50 Q12 -58 9 -64 Q4 -60 0 -62 Q-4 -60 -9 -64 Z" fill="url(#if-bd)"/>
<path d="M-11 -66 Q-6 -71 0 -66 Q6 -71 11 -66 Q8 -60 0 -62 Q-8 -60 -11 -66 Z" fill="url(#if-bd)"/>
<path d="M-8 -66 Q-4 -69 -1 -66 M1 -66 Q4 -69 8 -66" fill="none" stroke="#ff9a7a" stroke-width="1.2"/>
<path d="M0 -62 L0 -47 M-3 -59 L3 -56 M3 -59 L-3 -56 M-3 -53 L3 -50 M3 -53 L-3 -50" stroke="#f0c860" stroke-width="1.2"/>
<path d="M-9 -47 Q0 -44 9 -47" fill="none" stroke="#f0c860" stroke-width="2"/>
<circle cx="0" cy="-70" r="2" fill="#ff7a2a" stroke-width="1"/>'''},
    {'id': 'head', 'pivot': (0, -76), 'motion': {'kind': 'sway', 'amp': 2.2, 'period': 3, 'phase': 0.4}, 'follow': True,
     'defs': lg('if-fc', '#ffe4cc', SKIN, 0, 0, 1, 1),
     'svg': '''<path d="M-3 -80 L-3 -74 L3 -74 L3 -80 Z" fill="#e8b08f"/>
<path d="M-9 -92 Q-10 -80 -4 -78 Q0 -76 4 -78 Q10 -80 9 -92 Q8 -100 0 -100 Q-8 -100 -9 -92 Z" fill="url(#if-fc)"/>
<path d="M-6.5 -89 Q-4.5 -91 -2.5 -89 M2.5 -89 Q4.5 -91 6.5 -89" fill="none" stroke-width="1.4"/>
<path d="M-6.2 -88.6 Q-4.5 -86.4 -2.8 -88.6 Z M2.8 -88.6 Q4.5 -86.4 6.2 -88.6 Z" fill="#ffb02a" stroke-width="1"/>
<path d="M-2 -82.5 Q0 -81 2 -82.5 Q0 -80.4 -2 -82.5 Z" fill="#c8243a" stroke-width="1"/>
<path d="M-8 -98 Q-14 -106 -12 -112 Q-8 -104 -5 -100 Z M8 -98 Q14 -106 12 -112 Q8 -104 5 -100 Z" fill="#2a0c12"/>'''},
    {'id': 'eyes', 'pivot': (0, -88), 'motion': {'kind': 'blink', 'period': 4.2}, 'follow': True,
     'svg': '''<path d="M-7 -88.4 Q-4.5 -86.8 -2 -88.4 M2 -88.4 Q4.5 -86.8 7 -88.4" fill="none" stroke-width="1.6"/>
<path d="M-7 -89 L-2 -89 L-2 -87.6 L-7 -87.6 Z M2 -89 L7 -89 L7 -87.6 L2 -87.6 Z" fill="#ffe4cc" stroke="none"/>
<path d="M-7 -88 Q-4.5 -86.6 -2 -88 M2 -88 Q4.5 -86.6 7 -88" fill="none" stroke-width="1.4"/>'''},
    {'id': 'hairFront', 'pivot': (0, -98), 'motion': {'kind': 'sway', 'amp': 3, 'period': 1.7, 'phase': 1.1}, 'follow': True,
     'defs': lg('if-hf', '#ffe08a', '#e0402a', 0, 0, 0, 1),
     'svg': '''<path d="M-11 -90 Q-12 -104 0 -104 Q12 -104 11 -90 Q8 -96 3 -97 Q4 -92 0 -90 Q-2 -96 -5 -96 Q-8 -94 -11 -90 Z" fill="url(#if-hf)"/>
<path d="M-11 -90 Q-16 -80 -12 -70 Q-10 -78 -9 -84 Z M11 -90 Q16 -80 13 -68 Q10 -76 9 -84 Z" fill="url(#if-hf)"/>
<path d="M0 -104 Q4 -112 0 -118 Q8 -112 6 -104 Z" fill="#ffd36b"/>'''},
    {'id': 'armFront', 'pivot': (10, -70), 'motion': {'kind': 'swing', 'amp': 2.5, 'period': 3, 'phase': 1.5}, 'follow': True,
     'svg': f'''<path d="M9 -72 Q18 -70 22 -82 Q26 -94 30 -100 L26 -102 Q20 -94 17 -86 Q14 -78 8 -76 Z" fill="{SKIN}"/>
<path d="M17 -84 L23 -82 M19 -88 L25 -86" stroke="#d9a94a" stroke-width="1.8"/>
<path d="M26 -102 Q24 -108 28 -110 Q32 -108 31 -102 Z" fill="{SKIN}"/>'''},
    {'id': 'fire', 'pivot': (29, -116), 'motion': {'kind': 'pulse', 'amp': 0.35, 'period': 0.9}, 'follow': True,
     'defs': rg('if-fb', '#fff4c8', '#ff5a1a'),
     'svg': '''<circle cx="29" cy="-116" r="15" fill="url(#if-fb)" stroke="none" opacity=".9"/>
<path d="M29 -128 Q38 -118 34 -110 Q30 -104 24 -108 Q19 -114 24 -120 Q24 -114 28 -114 Q26 -122 29 -128 Z" fill="#ffb02a"/>
<path d="M29 -120 Q33 -114 30 -110 Q26 -110 27 -114 Z" fill="#fff4c8" stroke-width="1.2"/>'''},
])

# ═══════════════════════════ Гром, Огр-громила ═══════════════════════════
K = 'grom'
OG = '#7f9a6a'
OG2 = '#5c7550'
RIGS[K] = build(K, [
    {'id': 'legs', 'pivot': (0, -20), 'motion': None,
     'svg': f'''<path d="M-26 0 Q-30 -14 -24 -26 L-8 -26 Q-8 -12 -10 0 Z" fill="{OG2}"/>
<path d="M26 0 Q30 -14 24 -26 L8 -26 Q8 -12 10 0 Z" fill="#4c6342"/>
<path d="M-30 0 L-28 -6 L-8 -6 L-8 0 Z M30 0 L28 -6 L8 -6 L8 0 Z" fill="#4a3220"/>
<path d="M-26 -14 L-12 -16 M26 -14 L12 -16" stroke="#3a2618" stroke-width="2"/>'''},
    {'id': 'armBack', 'pivot': (-30, -66), 'motion': {'kind': 'sway', 'amp': 2, 'period': 3.6, 'phase': 2.2}, 'follow': True,
     'svg': f'''<path d="M-30 -72 Q-48 -68 -50 -46 Q-50 -32 -46 -24 L-34 -26 Q-36 -40 -32 -52 Z" fill="{OG2}"/>
<path d="M-52 -28 Q-54 -14 -44 -12 Q-32 -12 -32 -24 Q-36 -32 -46 -30 Z" fill="{OG2}"/>
<path d="M-48 -42 L-36 -40" stroke="#4a3220" stroke-width="4"/>'''},
    {'id': 'torso', 'pivot': (0, -22), 'motion': {'kind': 'breathe', 'amp': 0.03, 'period': 3.6}, 'breath': True,
     'defs': lg('gr-sk', '#9db886', OG2, 0, 0, 1, 1),
     'svg': f'''<path d="M-30 -24 Q-40 -50 -30 -72 Q-14 -84 0 -82 Q14 -84 30 -72 Q40 -50 30 -24 Q16 -16 0 -16 Q-16 -16 -30 -24 Z" fill="url(#gr-sk)"/>
<path d="M-22 -40 Q0 -28 22 -40 Q20 -24 0 -20 Q-20 -24 -22 -40 Z" fill="#a8c290"/>
<path d="M-12 -62 Q-6 -56 0 -60 Q6 -56 12 -62" fill="none" stroke="{OG2}" stroke-width="2"/>
<path d="M-30 -70 L24 -26 M-22 -76 L30 -32" stroke="#5a3a22" stroke-width="6"/>
<path d="M-30 -70 L24 -26" stroke="#8a5a32" stroke-width="2.4"/>
<circle cx="-2" cy="-48" r="4" fill="#c9a46a"/>
<path d="M-26 -22 L26 -22 L22 -6 Q0 0 -22 -6 Z" fill="#6b4a2b"/>
<path d="M-12 -22 L-8 -4 M6 -22 L10 -4" stroke="#3a2618" stroke-width="1.6"/>
<rect x="-26" y="-26" width="52" height="6" rx="2" fill="#3a2618"/>
<rect x="-5" y="-27" width="10" height="8" rx="2" fill="#a8a8b4"/>'''},
    {'id': 'head', 'pivot': (0, -80), 'motion': {'kind': 'sway', 'amp': 2, 'period': 3.6, 'phase': 0.8}, 'follow': True,
     'svg': f'''<path d="M-15 -80 Q-18 -100 0 -104 Q18 -100 15 -80 Q8 -72 0 -72 Q-8 -72 -15 -80 Z" fill="{OG}"/>
<path d="M-12 -94 L-3 -91 M12 -94 L3 -91" stroke-width="3"/>
<circle cx="-6" cy="-88" r="2.6" fill="#ffd84a" stroke-width="1.2"/><circle cx="6" cy="-88" r="2.6" fill="#ffd84a" stroke-width="1.2"/>
<path d="M-4 -84 Q0 -82 4 -84" fill="none" stroke-width="1.6"/>
<path d="M-10 -78 Q0 -74 10 -78" fill="none" stroke-width="1.8"/>
<path d="M-8 -79 L-10 -88 L-5 -80 Z M8 -79 L10 -88 L5 -80 Z" fill="#f4ead2" stroke-width="1.4"/>
<path d="M-17 -92 Q-24 -94 -22 -86 Q-19 -88 -15 -88 Z M17 -92 Q24 -94 22 -86 Q19 -88 15 -88 Z" fill="{OG2}"/>
<circle cx="-21" cy="-86" r="1.8" fill="#d9a94a" stroke-width="1"/>'''},
    {'id': 'eyes', 'pivot': (0, -88), 'motion': {'kind': 'blink', 'period': 5.3}, 'follow': True,
     'svg': f'<path d="M-9 -89.5 L-3 -89.5 L-3 -86.5 L-9 -86.5 Z M3 -89.5 L9 -89.5 L9 -86.5 L3 -86.5 Z" fill="{OG}" stroke="none"/><path d="M-9 -87.5 L-3 -87.5 M3 -87.5 L9 -87.5" stroke-width="1.6"/>'},
    {'id': 'topknot', 'pivot': (0, -103), 'motion': {'kind': 'sway', 'amp': 9, 'period': 1.8, 'phase': 1.3}, 'follow': True,
     'svg': '''<path d="M-2 -103 Q-4 -112 2 -114 Q8 -112 4 -103 Z" fill="#3a2618"/>
<path d="M2 -113 Q10 -122 4 -128 Q14 -124 12 -114 Q10 -108 4 -108 Z" fill="#2a1a10"/>
<rect x="-3" y="-108" width="8" height="3" fill="#c9a46a"/>'''},
    {'id': 'club', 'pivot': (30, -66), 'motion': {'kind': 'swing', 'amp': 2.5, 'period': 3.6, 'phase': 0.2}, 'follow': True,
     'defs': lg('gr-cl', '#a8784a', '#5a3a22', 0, 0, 1, 0),
     'svg': f'''<path d="M26 -74 Q44 -76 48 -56 Q50 -44 44 -36 L34 -40 Q38 -48 34 -58 Z" fill="{OG}"/>
<path d="M30 -48 Q24 -100 28 -122 Q38 -128 46 -120 Q42 -96 40 -46 Z" fill="url(#gr-cl)"/>
<path d="M28 -112 L20 -114 M30 -98 L22 -98 M44 -110 L52 -112 M42 -94 L50 -94 M36 -124 L36 -132" stroke="#c8ccdc" stroke-width="3"/>
<path d="M32 -116 Q36 -110 34 -100 M38 -88 Q40 -78 38 -66" fill="none" stroke="#3a2618" stroke-width="1.4"/>
<path d="M40 -46 Q48 -40 46 -30 Q38 -24 30 -30 Q28 -40 32 -46 Z" fill="{OG}"/>
<path d="M32 -40 L44 -38 M31 -35 L44 -33" stroke="{OG2}" stroke-width="1.4"/>'''},
])

# ═══════════════════════════ Нокта, Вдова Сумрака ═══════════════════════════
K = 'nocta'
NS = '#e9cfe0'
RIGS[K] = build(K, [
    {'id': 'sash', 'pivot': (-6, -48), 'motion': {'kind': 'sway', 'amp': 6, 'period': 2.2, 'phase': 0.4}, 'follow': True,
     'defs': lg('nc-sa', '#4fd6e0', '#2a1648', 0, 0, 1, 1),
     'svg': '''<path d="M-6 -48 Q-28 -46 -44 -30 Q-52 -22 -56 -10 Q-46 -20 -38 -22 Q-46 -12 -48 0 Q-36 -16 -24 -26 Q-14 -34 -2 -42 Z" fill="url(#nc-sa)"/>
<path d="M-12 -44 Q-30 -36 -42 -20" fill="none" stroke="#bff7ff" stroke-width="1.2"/>'''},
    {'id': 'ponytail', 'pivot': (-4, -96), 'motion': {'kind': 'sway', 'amp': 7, 'period': 1.9, 'phase': 1.0}, 'follow': True,
     'defs': lg('nc-hr', '#9a7ae0', '#3a2668', 0, 0, 1, 1),
     'svg': '''<path d="M-4 -98 Q-24 -100 -32 -84 Q-38 -70 -34 -54 Q-30 -62 -28 -70 Q-26 -60 -22 -54 Q-22 -70 -16 -82 Q-12 -90 -2 -92 Z" fill="url(#nc-hr)"/>
<path d="M-8 -98 L-2 -102 L0 -96 Z" fill="#4fd6e0"/>'''},
    {'id': 'legs', 'pivot': (0, -40), 'motion': None,
     'defs': lg('nc-lg', '#5a40a0', '#2a1a50', 0, 0, 1, 0),
     'svg': '''<path d="M-6 -44 Q-16 -30 -18 -16 Q-20 -8 -16 0 L-10 0 Q-12 -10 -8 -20 Q-2 -32 2 -44 Z" fill="url(#nc-lg)"/>
<path d="M2 -44 Q12 -36 18 -26 Q22 -16 24 -2 L18 0 Q16 -14 10 -22 Q4 -30 -2 -40 Z" fill="#3a2868"/>
<path d="M-18 -18 Q-14 -24 -8 -22 M12 -24 Q18 -28 20 -22" fill="none" stroke="#4fd6e0" stroke-width="1.8"/>
<path d="M-17 -4 L-9 -4 L-8 0 L-19 0 Z M17 -4 L25 -4 L28 0 L16 0 Z" fill="#0d0912"/>
<path d="M-16 -16 L-17 -6 M19 -22 L22 -6" stroke="#5a3a90" stroke-width="1.4"/>'''},
    {'id': 'armBack', 'pivot': (-9, -72), 'motion': {'kind': 'sway', 'amp': 3, 'period': 2.6, 'phase': 2.1}, 'follow': True,
     'defs': lg('nc-db', '#ffffff', '#7fb8ff', 0, 0, 1, 1),
     'svg': f'''<path d="M-9 -72 Q-18 -76 -24 -86 Q-28 -92 -30 -96 L-26 -98 Q-22 -92 -18 -86 Q-14 -80 -7 -78 Z" fill="#4a3488"/>
<path d="M-30 -96 Q-32 -102 -28 -103 Q-24 -102 -25 -97 Z" fill="{NS}"/>
<path d="M-28 -100 Q-46 -106 -50 -88 Q-44 -98 -30 -96 Z" fill="url(#nc-db)"/>
<path d="M-27 -97 L-24 -92" stroke-width="3"/>'''},
    {'id': 'torso', 'pivot': (0, -46), 'motion': {'kind': 'breathe', 'amp': 0.018, 'period': 2.6}, 'breath': True,
     'defs': lg('nc-bd', '#7a5ad0', '#33205e', 0, 0, 1, 1),
     'svg': f'''<path d="M-8 -48 Q-16 -44 -18 -34 Q-20 -26 -16 -22 L0 -30 L16 -22 Q20 -28 16 -38 Q14 -46 8 -48 Z" fill="#4a3488"/>
<path d="M-16 -22 L-10 -14 L-6 -26 L0 -30 Z M16 -22 L12 -12 L6 -26 L0 -30 Z" fill="#33205e"/>
<path d="M-9 -76 Q-12 -66 -8 -58 Q-11 -52 -8 -46 L8 -46 Q11 -52 8 -58 Q12 -66 9 -76 Q0 -80 -9 -76 Z" fill="url(#nc-bd)"/>
<path d="M-10 -68 Q-5 -73 0 -68 Q5 -73 10 -68 Q7 -62 0 -64 Q-7 -62 -10 -68 Z" fill="#5a40a0"/>
<path d="M-8 -68 Q-4 -71 -1 -68 M1 -68 Q4 -71 8 -68" fill="none" stroke="#8a6ad0" stroke-width="1.2"/>
<path d="M-8 -50 Q0 -46 8 -50" fill="none" stroke="#4fd6e0" stroke-width="2"/>
<path d="M-3 -58 Q0 -64 3 -58 Q0 -60 -3 -58 Z" fill="#bff7ff" stroke-width="1.2"/>
<path d="M-6 -76 Q0 -72 6 -76 L5 -80 L-5 -80 Z" fill="{NS}"/>'''},
    {'id': 'head', 'pivot': (0, -80), 'motion': {'kind': 'sway', 'amp': 2, 'period': 2.6, 'phase': 0.6}, 'follow': True,
     'svg': f'''<path d="M-8 -92 Q-9 -82 -4 -80 Q0 -78 4 -80 Q9 -82 8 -92 Q7 -101 0 -101 Q-7 -101 -8 -92 Z" fill="{NS}"/>
<path d="M-8 -88 Q0 -84 8 -88 L7 -82 Q0 -77 -7 -82 Z" fill="#241640"/>
<path d="M-6 -86 Q0 -83 6 -86" fill="none" stroke="#4fd6e0" stroke-width="1"/>
<path d="M-6 -92 L-2.5 -91 L-6 -90 Z M6 -92 L2.5 -91 L6 -90 Z" fill="#4fd6e0" stroke-width="1"/>
<path d="M-9 -92 Q-10 -104 0 -104 Q10 -104 9 -92 Q4 -98 -2 -96 Q-6 -95 -9 -92 Z" fill="url(#nc-hr)"/>
<path d="M-9 -94 Q-12 -86 -10 -80 Q-8 -86 -7 -90 Z" fill="#2a1648"/>
<path d="M3 -103 Q8 -110 4 -114 Q2 -108 -2 -104 Z" fill="#c8ccdc"/>'''},
    {'id': 'eyes', 'pivot': (0, -91), 'motion': {'kind': 'blink', 'period': 3.7}, 'follow': True,
     'svg': f'<path d="M-6.5 -92.6 L-2 -92.6 L-2 -89.4 L-6.5 -89.4 Z M2 -92.6 L6.5 -92.6 L6.5 -89.4 L2 -89.4 Z" fill="{NS}" stroke="none"/><path d="M-6.5 -91 L-2.5 -90.6 M2.5 -90.6 L6.5 -91" stroke-width="1.4"/>'},
    {'id': 'armFront', 'pivot': (9, -72), 'motion': {'kind': 'swing', 'amp': 2.5, 'period': 2.6, 'phase': 1.3}, 'follow': True,
     'defs': lg('nc-df', '#ffffff', '#8a6ad0', 0, 0, 1, 1),
     'svg': f'''<path d="M8 -74 Q18 -70 22 -60 Q26 -52 30 -48 L27 -45 Q22 -50 18 -56 Q12 -64 6 -68 Z" fill="#5a40a0"/>
<path d="M27 -45 Q28 -40 32 -41 Q35 -44 31 -48 Z" fill="{NS}"/>
<path d="M30 -44 Q50 -40 54 -60 Q46 -46 32 -48 Z" fill="url(#nc-df)"/>
<path d="M29 -46 L34 -40" stroke-width="3"/>
<path d="M18 -62 L24 -58" stroke="#4fd6e0" stroke-width="1.8"/>'''},
    {'id': 'glow', 'pivot': (40, -48), 'motion': {'kind': 'pulse', 'amp': 0.75, 'period': 1.3}, 'follow': True,
     'svg': '<path d="M33 -47 Q48 -44 52 -58" fill="none" stroke="#bff7ff" stroke-width="2.4" opacity=".9"/><path d="M-30 -97 Q-44 -101 -48 -90" fill="none" stroke="#bff7ff" stroke-width="2.4" opacity=".9"/>'},
])

json.dump(RIGS, open(os.path.join(OUT, 'rigs.json'), 'w'), indent=1)
print('ok', {k: len(v['parts']) for k, v in RIGS.items()})
