"""Враги: Мгла, утопленники, Горнило, Сумрак, Небо, рейд-босс и Страж Разлома."""
from kit import *

MIST = '#7a5ab8'
GLOW = '#c79cff'


def P2(key, out, parts, hand, top, idle=None):
    return build(out, key, parts, hand=hand, top=top, idle=idle)


def quadruped(key, out, *, c, belly, eye, horns_c=None, mane=None, crystals=None, size=1.0, tail_c=None, hand=None, top=70, extra=''):
    """Четвероногий зверь в профиль (смотрит вправо): хвост, ноги, тело, голова."""
    s = size
    by = -26 * s  # центр тела
    parts = []
    tc = tail_c or c
    parts.append(part('tail', (-24 * s, by - 4 * s), curve(f'M{-22 * s} {by - 2 * s} Q{-40 * s} {by - 6 * s} {-46 * s} {by - 22 * s} Q{-44 * s} {by - 30 * s} {-36 * s} {by - 30 * s}', 5 * s, tc)
                      + (shape(f'M{-40 * s} {by - 26 * s} L{-36 * s} {by - 36 * s} L{-32 * s} {by - 26 * s} Z', crystals, sw=1.4) if crystals else ''),
                      sway(10, 1.4, 0), follow=True))
    parts.append(part('legsBack', (0, by), line([(-16 * s, by + 4 * s), (-20 * s, -10 * s), (-16 * s, -2)], 6 * s, dark(c, 0.25))
                      + line([(14 * s, by + 4 * s), (18 * s, -12 * s), (16 * s, -2)], 6 * s, dark(c, 0.25)), None))
    body = shape(f'M{-26 * s} {by} Q{-26 * s} {by - 16 * s} {-6 * s} {by - 16 * s} Q{16 * s} {by - 20 * s} {26 * s} {by - 8 * s} Q{28 * s} {by + 8 * s} {12 * s} {by + 10 * s} '
                 f'Q{-6 * s} {by + 14 * s} {-22 * s} {by + 10 * s} Q{-28 * s} {by + 6 * s} {-26 * s} {by} Z', D.vol(c))
    body += shape(f'M{-14 * s} {by + 9 * s} Q0 {by + 14 * s} {14 * s} {by + 8 * s} Q4 {by + 4 * s} {-14 * s} {by + 9 * s} Z', belly, sw=1.4)
    if mane:
        body += shape(f'M{6 * s} {by - 17 * s} Q{20 * s} {by - 30 * s} {30 * s} {by - 14 * s} Q{22 * s} {by - 8 * s} {12 * s} {by - 6 * s} Z', D.vol(mane))
    if crystals:
        body += ''.join(rot(x * s, (by - 16 * s) + abs(x) * 0.05, a, shape(f'M-3 0 L0 {-12 * s} L3 0 Z', D.lin('#ffffff', crystals), sw=1.4)) for x, a in ((-14, -20), (-6, -5), (2, 10)))
    body += extra
    parts.append(part('body', (0, -2), body, breathe(0.03, 1.6), breath=True))
    parts.append(part('legsFront', (0, by), line([(-10 * s, by + 6 * s), (-12 * s, -10 * s), (-6 * s, -2)], 6.4 * s, c)
                      + line([(18 * s, by + 4 * s), (24 * s, -12 * s), (22 * s, -2)], 6.4 * s, c), None))
    hx, hy = 30 * s, by - 16 * s
    head = shape(f'M{hx - 10 * s} {hy + 6 * s} Q{hx - 10 * s} {hy - 10 * s} {hx + 2 * s} {hy - 10 * s} Q{hx + 10 * s} {hy - 8 * s} {hx + 20 * s} {hy + 2 * s} '
                 f'Q{hx + 20 * s} {hy + 8 * s} {hx + 12 * s} {hy + 10 * s} Q{hx} {hy + 12 * s} {hx - 10 * s} {hy + 6 * s} Z', D.vol(c))
    head += shape(f'M{hx - 4 * s} {hy - 8 * s} L{hx - 8 * s} {hy - 20 * s} L{hx + 2 * s} {hy - 9 * s} Z', D.vol(dark(c, 0.1)), sw=1.6)
    head += hl(f'M{hx + 6 * s} {hy + 8 * s} L{hx + 19 * s} {hy + 4 * s}', OUT_LINE, 1.6, 1)
    head += ''.join(shape(f'M{hx + (8 + i * 4) * s} {hy + 6 * s} L{hx + (9 + i * 4) * s} {hy + 9 * s} L{hx + (10 + i * 4) * s} {hy + 6 * s} Z', '#f4ead2', sw=0.8) for i in range(3))
    head += dot(hx + 6 * s, hy - 2 * s, 2.4 * s, eye, 1.2) + halo(hx + 6 * s, hy - 2 * s, 6 * s, eye)
    if horns_c:
        head += shape(f'M{hx - 6 * s} {hy - 6 * s} Q{hx - 14 * s} {hy - 20 * s} {hx - 22 * s} {hy - 18 * s} Q{hx - 14 * s} {hy - 14 * s} {hx - 2 * s} {hy - 4 * s} Z', D.vol(horns_c), sw=1.6)
    parts.append(part('head', (hx - 6 * s, hy + 4 * s), head, sway(4, 1.6, 0.5), follow=True, role='head'))
    return build(out, key, parts, hand=hand or (hx + 18 * s, hy + 2 * s), top=top, idle='bob')


def make(out):
    R = {}

    # ═════════ Глава 1: Мгла ═════════
    # Призрак Мглы — парящий саван с когтями
    start('wraith')
    parts = [
        part('tail', (0, -30), shape('M-16 -60 Q-26 -30 -22 -6 Q-16 -14 -12 -4 Q-6 -12 0 -2 Q6 -12 12 -4 Q16 -14 22 -6 Q26 -30 16 -60 Z', D.lin('#5a4a8a', '#1a1030')) , sway(3, 2, 0)),
        part('body', (0, -40), shape('M-18 -56 Q-20 -86 0 -96 Q20 -86 18 -56 Q10 -48 0 -50 Q-10 -48 -18 -56 Z', D.vol('#4a3a7a'))
             + shape('M-10 -78 Q0 -90 10 -78 Q8 -64 0 -62 Q-8 -64 -10 -78 Z', '#0d0912', sw=1.6)
             + dot(-4.5, -76, 2.2, GLOW, 0) + dot(4.5, -76, 2.2, GLOW, 0) + gem(0, -58, 3, GLOW), breathe(0.03, 2), breath=True),
        part('armBack', (-16, -66), line([(-16, -66), (-30, -56), (-34, -42)], 4, '#4a3a7a') + ''.join(line([(-34 + i * 2.5, -42), (-38 + i * 3, -34)], 1.4, '#c8ccdc') for i in range(3)), sway(6, 2, 1), follow=True),
        part('armFront', (16, -66), line([(16, -66), (30, -58), (36, -46)], 4, '#4a3a7a') + ''.join(line([(34 + i * 2.5, -46), (36 + i * 3, -38)], 1.4, '#c8ccdc') for i in range(3)), swing(6, 2, 0), follow=True, role='weapon'),
        part('glow', (0, -76), halo(0, -76, 16, GLOW), pulse(0.5, 1.6), follow=True, role='fx'),
    ]
    R['wraith'] = build(out, 'wraith', parts, hand=(36, -42), top=100, idle='float')

    R['hound'] = quadruped('hound', out, c='#4a3a6a', belly='#6a5a8a', eye=GLOW, crystals='#a37cff', size=1.0, top=64)
    R['eclipse_wolf'] = quadruped('eclipse_wolf', out, c='#2a2448', belly='#4a3a6a', eye='#ffd36b', mane='#1a1430', size=1.1, top=72,
                                  extra=halo(0, -60, 16, '#ffd36b') + f'<circle cx="0" cy="-60" r="7" fill="#1a1430" stroke="#ffd36b" stroke-width="2"/>')

    # Колосс Мглы — громада из камня и тумана с кристаллом в груди
    b = Body(118, 1.8)
    start('mglaboss')
    rock = '#5a4a7a'
    parts = [
        part('mist', (0, -20), ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#a37cff" opacity=".22" stroke="none"/>' for x, y, r in ((-40, -10, 16), (40, -14, 14), (0, -4, 20))), pulse(0.5, 2.4)),
        part('legs', (0, b.hip), legs(b, rock, '#3a2a5a', stance=1.8)),
        part('armBack', (-30, b.sh + 4), line([(-30, b.sh + 4), (-46, b.chest + 14), (-44, b.waist + 18)], 13, dark(rock, 0.2)) + dot(-44, b.waist + 22, 9, D.vol(rock), SW), sway(2, 3.6, 2), follow=True),
        part('torso', (0, b.hip), shape(f'M-34 {b.sh + 6} Q-46 {b.waist} -24 {b.hip + 4} L24 {b.hip + 4} Q46 {b.waist} 34 {b.sh + 6} Q0 {b.sh - 12} -34 {b.sh + 6} Z', D.vol(rock))
             + hl(f'M-20 {b.sh + 10} L-10 {b.chest} L-20 {b.waist} M18 {b.sh + 8} L8 {b.chest + 4} L20 {b.hip}', '#3a2a5a', 2.4, 1)
             + halo(0, b.chest, 18, GLOW) + gem(0, b.chest, 8, '#d8c0ff'), breathe(0.02, 3.6), breath=True),
        part('head', (0, b.neck), shape(f'M-16 {b.hy + 8} Q-20 {b.hy - 16} 0 {b.hy - 18} Q20 {b.hy - 16} 16 {b.hy + 8} Q0 {b.hy + 14} -16 {b.hy + 8} Z', D.vol(rock))
             + shape(f'M-10 {b.hy - 2} L-3 {b.hy} L-10 {b.hy + 2} Z M10 {b.hy - 2} L3 {b.hy} L10 {b.hy + 2} Z', GLOW, sw=1)
             + ''.join(rot(x, b.hy - 14, a, shape('M-3 0 L0 -12 L3 0 Z', D.lin('#ffffff', '#a37cff'), sw=1.4)) for x, a in ((-10, -20), (0, 0), (10, 20))), sway(1.6, 3.6, 0.4), follow=True, role='head'),
        part('armFront', (30, b.sh + 4), line([(30, b.sh + 4), (48, b.chest + 10), (46, b.waist + 16)], 13, rock) + dot(46, b.waist + 20, 10, D.vol(rock), SW), swing(2.4, 3.6, 0.6), follow=True, role='weapon'),
    ]
    R['mglaboss'] = build(out, 'mglaboss', parts, hand=(46, b.waist + 20), top=130, idle='heavy')

    # Мглистый лучник и Рыцарь Мглы — люди, поглощённые туманом
    b = Body(98)
    sh_f, sh_b = (14, b.sh + 3), (-14, b.sh + 3)
    R['shade_archer'] = humanoid('shade_archer', out, h=98, skin='#8a80a8', kind='beast',
                                 legs_kw=dict(pants='#2a2448', boots='#1a1430', stance=1.4),
                                 body=lambda b: torso_m(b, '#3a3060', belt='#1a1430', buckle=GLOW),
                                 head_kw=dict(eye=GLOW, glow_eyes=GLOW), headgear=lambda b: helm(b, '#2a2448', 'hood'),
                                 back=[('cape', (0, b.sh), cape(b, '#2a2448', 0.8, 0.8, tattered=True), sway(3, 2.4, 0))],
                                 back_arm=(arm(sh_b, (-4, b.chest + 2), (4, b.chest - 4), 4.6, '#3a3060', '#8a80a8'), sh_b),
                                 front_arm=(arm(sh_f, (18, b.chest - 2), (22, b.chest - 4), 4.6, '#3a3060', '#8a80a8') + rot(22, b.chest - 4, 0, W_bow(50, '#3a2a4a', '#c79cff', True, GLOW)), sh_f),
                                 hand=(52, b.chest - 4), period=2.6, blink_p=0)
    b = Body(104, 1.25)
    sh_f, sh_b = (19, b.sh + 4), (-19, b.sh + 4)
    R['gloom_knight'] = humanoid('gloom_knight', out, h=104, build_=1.25, skin='#6a6088', kind='beast',
                                 legs_kw=dict(pants='#3a3458', boots='#1a1430', stance=1.5, armor=True, trim=GLOW),
                                 body=lambda b: torso_m(b, '#4a4470', belt='#1a1430', buckle=GLOW, deco=gem(0, b.chest, 3.6, GLOW)),
                                 head_kw=dict(eye=GLOW, glow_eyes=GLOW), headgear=lambda b: helm(b, '#3a3458', 'horned', GLOW, GLOW),
                                 back=[('cape', (0, b.sh), cape(b, '#1f1a34', 0.95, 1.1, tattered=True, inner=GLOW), sway(2.4, 3, 0.5))],
                                 back_arm=(pauldron(-19, b.sh + 4, 9, '#4a4470', 2, -1) + arm(sh_b, (-26, b.chest + 6), (-20, b.waist), 6, '#4a4470', '#6a6088') + rot(-22, b.waist - 2, 0, W_shield_kite(14, 36, '#2a2448', GLOW, GLOW)), sh_b),
                                 front_arm=(pauldron(19, b.sh + 4, 9, '#4a4470', 2, 1) + arm(sh_f, (26, b.chest + 6), (24, b.waist - 4), 6, '#4a4470', '#6a6088') + rot(24, b.waist - 4, 20, W_sword(48, '#8a80a8', '#3a3458', '#1a1430', GLOW, 1.3)), sh_f),
                                 hand=(42, b.waist - 50), period=3.2, blink_p=0, idle='heavy')

    # ═════════ Глава 2: Затонувший собор ═════════
    b = Body(96)
    sh_f, sh_b = (14, b.sh + 3), (-14, b.sh + 3)
    weed = ''.join(curve(f'M{x} {y} Q{x + 3} {y + 6} {x - 1} {y + 12}', 1.6, '#3f8a46') for x, y in ((-10, -64), (6, -58), (-2, -46)))
    R['drowned'] = humanoid('drowned', out, h=96, skin='#8ab8a8', kind='beast',
                            legs_kw=dict(pants='#3a5a6a', boots='#2a3a4a', stance=1.3),
                            body=lambda b: torso_m(b, '#4a6a7a', belt='#2a3a3a', buckle='#c9a46a', deco=weed),
                            head_kw=dict(eye='#bff7ff', glow_eyes='#bff7ff'), hair_style='long', hair_c='#2f4a4a',
                            back_arm=(arm(sh_b, (-22, b.chest + 8), (-24, b.waist + 4), 5, '#4a6a7a', '#8ab8a8'), sh_b),
                            front_arm=(arm(sh_f, (22, b.chest + 6), (22, b.waist - 4), 5, '#4a6a7a', '#8ab8a8') + rot(22, b.waist - 4, 20, W_spear(64, '#5a4a3a', '#8a7a5a', 14)), sh_f),
                            hand=(44, b.waist - 60), period=3.4, blink_p=0)

    start('eel')
    seg = 'M-36 -8 Q-24 -30 -6 -16 Q10 -2 22 -24 Q32 -42 20 -60'
    parts = [
        part('body', (0, -20), curve(seg, 15, '#2f6f8a') + curve(seg, 6, '#4fd6e0').replace('stroke-width="10.8"', 'stroke-width="0"')
             + hl('M-34 -10 Q-24 -26 -8 -14 Q8 -2 20 -22', '#bff7ff', 2, 0.6)
             + ''.join(shape(f'M{x} {y} L{x - 3} {y - 8} L{x + 3} {y - 2} Z', '#4fd6e0', sw=1.2) for x, y in ((-24, -24), (-4, -20), (16, -30))), breathe(0.04, 1.4), breath=True),
        part('head', (20, -60), shape('M10 -58 Q12 -74 26 -76 Q38 -72 40 -62 Q36 -54 26 -54 Q16 -52 10 -58 Z', D.vol('#2f6f8a'))
             + dot(28, -66, 2.4, '#ffd36b', 1) + halo(28, -66, 7, '#ffd36b')
             + shape('M30 -56 L40 -58 L36 -54 Z M24 -55 L28 -50 L32 -55 Z', '#f4ead2', sw=0.9)
             + curve('M34 -76 Q42 -92 50 -90', 1.4, '#bff7ff') + dot(50, -90, 2.6, '#fff4c8', 1), sway(5, 1.4, 0.6), follow=True, role='head'),
    ]
    R['eel'] = build(out, 'eel', parts, hand=(40, -62), top=96, idle='sway')

    b = Body(110, 1.05, True)
    sh_f, sh_b = (12, b.sh + 3), (-12, b.sh + 3)
    R['abbess'] = humanoid('abbess', out, h=110, build_=1.05, female=True, skin='#a8d0d8', kind='beast',
                           legs_kw=dict(pants=None, boots='#2f4a5a', skin='#a8d0d8'),
                           body=lambda b: robe(b, '#2f4a6a', trim='#d9a94a', open_front='#1f3a4a') + torso_f(b, '#3a5a7a', trim='#d9a94a', bust=0.8),
                           head_kw=dict(eye='#bff7ff', glow_eyes='#bff7ff'),
                           headgear=lambda b: shape(f'M{-b.hr * 1.3} {b.hy + b.hr * 2} Q{-b.hr * 1.5} {b.hy - b.hr * 1.6} 0 {b.hy - b.hr * 1.7} Q{b.hr * 1.5} {b.hy - b.hr * 1.6} {b.hr * 1.3} {b.hy + b.hr * 2} '
                                                    f'Q{b.hr * 0.9} {b.hy - b.hr * 0.3} 0 {b.hy - b.hr * 0.9} Q{-b.hr * 0.9} {b.hy - b.hr * 0.3} {-b.hr * 1.3} {b.hy + b.hr * 2} Z', D.vol('#e8ecf4'))
                           + helm(b, '#d9a94a', 'circlet', '#d9a94a', '#4fd6e0'),
                           back=[('halo', (0, b.hy), f'<circle cx="0" cy="{b.hy - 4}" r="20" fill="none" stroke="#4fd6e0" stroke-width="2" opacity=".7"/>' + halo(0, b.hy - 4, 24, '#4fd6e0'), pulse(0.4, 2.4))],
                           back_arm=(arm(sh_b, (-20, b.chest + 6), (-16, b.waist), 4.8, '#3a5a7a', '#a8d0d8'), sh_b),
                           front_arm=(arm(sh_f, (22, b.chest + 2), (28, b.chest - 8), 4.8, '#3a5a7a', '#a8d0d8') + rot(28, b.chest - 8, 0, W_lantern('#d9a94a', '#9ff0ff')), sh_f),
                           fx=[('lamp', (28, b.chest + 6), halo(28, b.chest + 6, 16, '#4fd6e0'), pulse(0.5, 1.6))],
                           hand=(28, b.chest + 6), period=3.6, idle='float', blink_p=0, top=124)

    b = Body(100, 1.0, True)
    sh_f, sh_b = (11, b.sh + 3), (-11, b.sh + 3)
    R['siren'] = humanoid('siren', out, female=True, skin='#bfe8e0', hair_style='long', hair_c='#4fd6e0',
                          legs_kw=dict(pants='#2f8a96', boots='#2f8a96', stance=0.6),
                          body=lambda b: shape(f'M-14 {b.hip} Q-18 -16 -6 -4 L6 -4 Q18 -16 14 {b.hip} Z', D.vol('#2f8a96'))
                          + shape('M-6 -6 Q-20 -2 -24 6 Q-12 2 0 -2 Q12 2 24 6 Q20 -2 6 -6 Z', D.vol('#4fd6e0'))
                          + ''.join(hl(f'M{-10 + i * 5} {b.hip + 6 + (i % 2) * 6} Q{-8 + i * 5} {b.hip + 10 + (i % 2) * 6} {-6 + i * 5} {b.hip + 6 + (i % 2) * 6}', '#7fe7ff', 1.2, 0.9) for i in range(5))
                          + torso_f(b, '#3fa0b8', trim='#bff7ff', skin='#bfe8e0'),
                          head_kw=dict(eye='#2f8a96', ears=True, lips='#2f8a96'),
                          headgear=lambda b: helm(b, '#ff7a8a', 'circlet', '#ff7a8a', '#bff7ff'),
                          back_arm=(arm(sh_b, (-20, b.chest + 4), (-26, b.chest - 8), 4.4, None, '#bfe8e0'), sh_b),
                          front_arm=(arm(sh_f, (20, b.chest), (24, b.sh - 6), 4.4, None, '#bfe8e0'), sh_f),
                          fx=[('song', (0, b.hy), ''.join(f'<text x="{x}" y="{y}" font-size="10" fill="#bff7ff" stroke="none">♪</text>' for x, y in ((-34, b.hy), (28, b.hy - 10), (-24, b.sh - 14))), sway(8, 2, 0))],
                          hand=(24, b.sh - 8), period=2.8, idle='sway', hair_sway=6)

    start('crab')
    sh = '#c8482a'
    parts = [
        part('legs', (0, -14), ''.join(line([(s * 10, -16), (s * (26 + i * 4), -18 + i * 2), (s * (32 + i * 4), -2)], 3.6, dark(sh, 0.25)) for s in (-1, 1) for i in range(3)), None),
        part('body', (0, -18), shape('M-28 -18 Q-30 -44 0 -46 Q30 -44 28 -18 Q14 -8 0 -8 Q-14 -8 -28 -18 Z', D.vol(sh))
             + hl('M-18 -38 Q0 -44 18 -38 M-22 -28 Q0 -34 22 -28', light(sh, 0.4), 1.6, 0.7)
             + ''.join(shape(f'M{x} -44 L{x + 2} -52 L{x + 4} -44 Z', '#f4ead2', sw=1.2) for x in (-16, -4, 8)), breathe(0.03, 2.4), breath=True),
        part('head', (0, -44), line([(-6, -44), (-8, -54)], 2, sh) + line([(6, -44), (8, -54)], 2, sh) + dot(-8, -56, 3, '#1a1420', 1.4) + dot(8, -56, 3, '#1a1420', 1.4)
             + dot(-8.6, -56.8, 1, '#ffffff', 0) + dot(7.4, -56.8, 1, '#ffffff', 0), sway(5, 1.8, 0), follow=True, role='head'),
        part('clawBack', (-26, -30), line([(-26, -30), (-38, -40)], 5, sh) + shape('M-38 -40 Q-52 -48 -50 -62 Q-44 -56 -40 -56 Q-46 -48 -36 -46 Z', D.vol(sh)), sway(4, 2.4, 1), follow=True),
        part('clawFront', (26, -30), line([(26, -30), (38, -40)], 5, sh) + shape('M38 -40 Q52 -48 50 -62 Q44 -56 40 -56 Q46 -48 36 -46 Z', D.vol(sh)), swing(4, 2.4, 0), follow=True, role='weapon'),
    ]
    R['crab'] = build(out, 'crab', parts, hand=(50, -60), top=64, idle='heavy')

    # ═════════ Глава 3: Горнило ═════════
    b = Body(64, 1.0)
    sh_f, sh_b = (9, b.sh + 2), (-9, b.sh + 2)
    R['imp'] = humanoid('imp', out, h=64, kind='beast', skin='#c8402a',
                        legs_kw=dict(pants='#c8402a', boots='#2a0c0c', stance=1.7),
                        body=lambda b: torso_m(b, '#c8402a', belt='#3a1a10', buckle='#ffb02a'),
                        back=[('wings', (0, b.sh), wings('bat', '#5a1a1a', 0.45, b.sh + 2), sway(14, 0.5, 0)),
                              ('tail', (-3, b.hip), tail('devil', '#c8402a', -3, b.hip, -1, '#2a0c0c'), sway(12, 1.2, 0))],
                        head_kw=dict(eye='#ffd36b', glow_eyes='#ffd36b', ears=True), headgear=lambda b: horns(b, '#2a0c0c', 'curl', 0.8),
                        back_arm=(arm(sh_b, (-14, b.chest + 4), (-16, b.waist + 2), 3.4, None, '#c8402a'), sh_b),
                        front_arm=(arm(sh_f, (15, b.chest + 2), (16, b.waist - 2), 3.4, None, '#c8402a') + rot(16, b.waist - 2, 24, line([(0, 8), (0, -34)], 2.2, '#3a1a10') + curve('M-4 -30 L-4 -40 M0 -32 L0 -44 M4 -30 L4 -40 M-4 -32 L4 -32', 1.6, '#a9b4ca')), sh_f),
                        fx=[('spark', (30, b.waist - 40), halo(32, b.waist - 40, 9, '#ff7a2a'), pulse(0.7, 0.7))],
                        hand=(32, b.waist - 40), period=1.6, idle='bob', top=72, blink_p=0)

    start('golem')
    mag = '#4a3a34'
    parts = [
        part('legs', (0, -24), line([(-12, -26), (-14, -4)], 12, dark(mag, 0.2)) + line([(12, -26), (14, -4)], 12, dark(mag, 0.2)), None),
        part('armBack', (-26, -56), line([(-26, -56), (-36, -36), (-34, -18)], 11, dark(mag, 0.15)) + dot(-34, -14, 8, D.vol(mag), SW), sway(2, 3, 2), follow=True),
        part('torso', (0, -24), shape('M-28 -62 Q-34 -40 -20 -22 L20 -22 Q34 -40 28 -62 Q0 -74 -28 -62 Z', D.vol(mag))
             + hl('M-16 -58 L-8 -46 L-16 -34 L-6 -26 M14 -60 L6 -48 L16 -38', '#ff9a3a', 2.4, 1)
             + halo(0, -46, 12, '#ff7a2a') + dot(0, -46, 4, '#ffd36b', 1.4), breathe(0.025, 3), breath=True),
        part('head', (0, -66), shape('M-12 -64 Q-14 -82 0 -84 Q14 -82 12 -64 Z', D.vol(mag)) + shape('M-8 -74 L-2 -72 L-8 -70 Z M8 -74 L2 -72 L8 -70 Z', '#ffd36b', sw=1)
             + hl('M-6 -82 L-2 -76', '#ff9a3a', 1.8, 1), sway(1.6, 3, 0.4), follow=True, role='head'),
        part('armFront', (26, -56), line([(26, -56), (38, -38), (36, -20)], 11, mag) + dot(36, -16, 8.4, D.vol(mag), SW) + hl('M32 -42 L38 -34', '#ff9a3a', 1.8, 1), swing(2.4, 3, 0.4), follow=True, role='weapon'),
    ]
    R['golem'] = build(out, 'golem', parts, hand=(36, -16), top=84, idle='heavy')

    b = Body(116, 1.5)
    sh_f, sh_b = (22, b.sh + 4), (-22, b.sh + 4)

    def flame_crown(b):
        o = ''
        for i, x in enumerate((-16, -8, 0, 8, 16)):
            h = 22 if i == 2 else 14 if i % 2 else 18
            o += shape(f'M{x - 5} {b.hy - b.hr * 0.6} Q{x - 5} {b.hy - b.hr - h * 0.6} {x} {b.hy - b.hr - h} Q{x + 5} {b.hy - b.hr - h * 0.6} {x + 5} {b.hy - b.hr * 0.6} Z', D.lin('#ffe08a', '#ff5a1a'), sw=1.4)
        return o
    R['emberlord'] = humanoid('emberlord', out, h=116, build_=1.5, skin='#3a2420', kind='m',
                              legs_kw=dict(pants='#2a1818', boots='#120808', stance=1.7, armor=True, trim='#ff7a2a'),
                              body=lambda b: torso_m(b, '#3a2420', belt='#120808', buckle='#ff7a2a', bulk=1.15,
                                                     deco=hl(f'M-14 {b.sh + 10} L-6 {b.chest} L-14 {b.waist} M12 {b.sh + 8} L4 {b.chest + 4} L14 {b.hip}', '#ff9a3a', 2.4, 1) + halo(0, b.chest, 14, '#ff7a2a') + gem(0, b.chest, 5, '#ffd36b')),
                              head_kw=dict(eye='#ffd36b', glow_eyes='#ffd36b', beard='#ff7a2a'), headgear=flame_crown,
                              back=[('chains', (0, b.sh), curve(f'M-30 {b.sh + 6} Q-44 {b.waist} -36 {b.hip + 10}', 2, '#8a8a9a'), sway(4, 2.6, 0))],
                              back_arm=(pauldron(-22, b.sh + 4, 10, '#2a1818', 3, -1) + arm(sh_b, (-32, b.chest + 8), (-30, b.waist + 6), 8, '#3a2420', '#3a2420'), sh_b),
                              front_arm=(pauldron(22, b.sh + 4, 10, '#2a1818', 3, 1) + arm(sh_f, (34, b.chest + 4), (36, b.chest - 10), 8, '#3a2420', '#3a2420')
                                         + rot(36, b.chest - 10, 30, W_whip('#ff5a1a', '#ffd36b')), sh_f),
                              fx=[('heat', (0, b.chest), halo(0, b.waist, 40, '#ff7a2a'), pulse(0.5, 1.4))],
                              hand=(36, b.chest - 30), period=3.4, idle='heavy', top=128, blink_p=0)

    start('firedrake')
    dr = '#e0602a'
    parts = [
        part('wings', (0, -46), wings('bat', '#a8302a', 0.55, -46, membrane='#ff9a3a'), sway(12, 0.7, 0), follow=True),
        part('tail', (-12, -26), curve('M-12 -24 Q-30 -20 -38 -34 Q-42 -44 -34 -48', 6, dr) + shape('M-34 -48 L-40 -56 L-28 -50 Z', '#ffd36b', sw=1.4), sway(10, 1.2, 0.5), follow=True),
        part('body', (0, -10), line([(-8, -22), (-10, -4)], 6, dark(dr, 0.2)) + line([(8, -22), (10, -4)], 6, dark(dr, 0.2))
             + shape('M-16 -30 Q-16 -50 0 -50 Q16 -48 16 -28 Q10 -16 0 -16 Q-12 -16 -16 -30 Z', D.vol(dr)) + shape('M-8 -26 Q0 -20 8 -26 Q6 -40 0 -42 Q-6 -40 -8 -26 Z', '#ffd36b', sw=1.4), breathe(0.04, 1.2), breath=True),
        part('head', (6, -50), shape('M0 -52 Q0 -68 14 -68 Q28 -64 30 -56 Q24 -48 12 -48 Q2 -46 0 -52 Z', D.vol(dr)) + dot(14, -60, 2.4, '#ffd36b', 1)
             + shape('M6 -66 L2 -76 L10 -68 Z M14 -68 L14 -78 L19 -67 Z', '#5a1a1a', sw=1.2) + hl('M20 -52 L29 -55', OUT_LINE, 1.4, 1), sway(6, 1.4, 0.4), follow=True, role='head'),
        part('flame', (32, -56), halo(34, -56, 10, '#ff7a2a') + shape('M30 -56 Q38 -62 44 -56 Q38 -52 30 -56 Z', '#ffd36b', sw=1), pulse(0.7, 0.6), follow=True, role='fx'),
    ]
    R['firedrake'] = build(out, 'firedrake', parts, hand=(38, -56), top=80, idle='float')

    b = Body(100)
    sh_f, sh_b = (14, b.sh + 3), (-14, b.sh + 3)
    R['cultist'] = humanoid('cultist', out, skin='#c8a8a0', kind='beast',
                            legs_kw=dict(pants='#3a1a2a', boots='#1a0c14'),
                            body=lambda b: robe(b, '#5a1a2a', trim='#ffb02a', open_front='#2a0c14') + torso_m(b, '#5a1a2a', belt='#2a0c14', buckle='#ff7a2a', deco=gem(0, b.chest, 3, '#ff7a2a')),
                            head_kw=dict(eye='#ff7a2a', glow_eyes='#ffb02a'), headgear=lambda b: helm(b, '#3a0c1a', 'hood') + horns(b, '#1a0c14', 'straight', 0.6),
                            back_arm=(arm(sh_b, (-22, b.chest + 2), (-26, b.chest - 8), 5, '#5a1a2a', '#c8a8a0'), sh_b),
                            front_arm=(arm(sh_f, (22, b.chest + 6), (22, b.waist - 6), 5, '#5a1a2a', '#c8a8a0') + rot(22, b.waist - 6, 6, W_staff(62, '#2a0c14', '#ff7a2a', 'claw')), sh_f),
                            fx=[('orb', (29, b.waist - 68), halo(29, b.waist - 68, 12, '#ff7a2a'), pulse(0.6, 1.2)), ('rite', (-26, b.chest - 10), halo(-26, b.chest - 10, 10, '#ff7a2a'), pulse(0.6, 1.5))],
                            hand=(29, b.waist - 68), period=3.2, blink_p=0)

    # ═════════ Глава 4: Сумрачный предел ═════════
    start('dusk_wisp')
    parts = [
        part('trail', (0, -40), shape('M-8 -40 Q-16 -20 -6 -6 Q-4 -18 0 -22 Q4 -14 8 -6 Q14 -24 8 -40 Z', D.lin('#a37cff', '#2a1648')), sway(8, 1.2, 0)),
        part('body', (0, -50), halo(0, -54, 26, '#a37cff') + dot(0, -54, 12, D.glow('#c79cff', '#ffffff'), 2) + dot(-4, -56, 2.4, '#1a1030', 0) + dot(4, -56, 2.4, '#1a1030', 0)
             + hl('M-4 -48 Q0 -46 4 -48', '#1a1030', 1.2, 1), breathe(0.06, 1.4), breath=True),
        part('motes', (0, -54), ''.join(dot(math.cos(a) * 22, -54 + math.sin(a) * 18, 2, '#fff4c8', 0.8) for a in (0.4, 2.0, 3.6, 5.0)), sway(30, 3, 0), follow=True, role='fx'),
    ]
    R['dusk_wisp'] = build(out, 'dusk_wisp', parts, hand=(0, -54), top=82, idle='float')

    start('shard_golem')
    cr = '#e8e0ff'
    parts = [
        part('legs', (0, -24), line([(-12, -26), (-14, -4)], 11, '#8a80b0') + line([(12, -26), (14, -4)], 11, '#8a80b0'), None),
        part('armBack', (-24, -58), line([(-24, -58), (-34, -38), (-32, -20)], 10, '#9a90c0') + rot(-32, -18, 180, shape('M-5 0 L0 -14 L5 0 Z', D.lin('#ffffff', '#bfb0ff'), sw=1.6)), sway(2, 3.2, 2), follow=True),
        part('torso', (0, -24), shape('M-26 -62 L-30 -40 L-18 -22 L18 -22 L30 -40 L26 -62 L0 -72 Z', D.vol('#aaa0d0'))
             + hl('M-26 -62 L0 -50 L26 -62 M0 -50 L0 -22 M-30 -40 L0 -50 L30 -40', '#6a60a0', 1.6, 1)
             + halo(0, -46, 12, '#fff0b8') + gem(0, -46, 5, '#fff4c8'), breathe(0.02, 3.2), breath=True),
        part('head', (0, -68), shape('M-10 -66 L-12 -80 L0 -88 L12 -80 L10 -66 Z', D.vol(cr)) + shape('M-7 -76 L-2 -74 L-7 -72 Z M7 -76 L2 -74 L7 -72 Z', '#fff0b8', sw=1)
             + ''.join(rot(x, -86, a, shape('M-3 0 L0 -12 L3 0 Z', D.lin('#ffffff', '#bfb0ff'), sw=1.4)) for x, a in ((-8, -25), (0, 0), (8, 25))), sway(1.6, 3.2, 0.4), follow=True, role='head'),
        part('armFront', (24, -58), line([(24, -58), (36, -40), (34, -22)], 10, '#aaa0d0') + rot(34, -20, 180, shape('M-5 0 L0 -16 L5 0 Z', D.lin('#ffffff', '#bfb0ff'), sw=1.6)), swing(2.4, 3.2, 0.4), follow=True, role='weapon'),
    ]
    R['shard_golem'] = build(out, 'shard_golem', parts, hand=(34, -6), top=96, idle='heavy')

    b = Body(100)
    sh_f, sh_b = (14, b.sh + 3), (-14, b.sh + 3)
    R['dusk_priest'] = humanoid('dusk_priest', out, skin='#b8a8c8', kind='beast',
                                legs_kw=dict(pants='#2a1648', boots='#1a1030'),
                                body=lambda b: robe(b, '#3a2468', trim='#ffd36b', open_front='#1a1030') + torso_m(b, '#3a2468', belt='#1a1030', buckle='#ffd36b'),
                                head_kw=dict(eye='#ffd36b', glow_eyes='#ffd36b'),
                                headgear=lambda b: helm(b, '#2a1648', 'hood') + f'<circle cx="0" cy="{b.hy - b.hr * 1.6}" r="6" fill="#1a1030" stroke="#ffd36b" stroke-width="2"/>',
                                back_arm=(arm(sh_b, (-22, b.chest + 2), (-26, b.chest - 8), 5, '#3a2468', '#b8a8c8'), sh_b),
                                front_arm=(arm(sh_f, (22, b.chest + 6), (22, b.waist - 6), 5, '#3a2468', '#b8a8c8') + rot(22, b.waist - 6, 4, W_staff(64, '#1a1030', '#ffd36b', 'crescent')), sh_f),
                                fx=[('orb', (26, b.waist - 70), halo(26, b.waist - 70, 12, '#ffd36b'), pulse(0.6, 1.4))],
                                hand=(26, b.waist - 70), period=3.2, blink_p=0)

    b = Body(104, 1.1)
    sh_f, sh_b = (16, b.sh + 3), (-16, b.sh + 3)
    R['star_lancer'] = humanoid('star_lancer', out, h=104, build_=1.1, skin='#c8d0e8', kind='beast',
                                legs_kw=dict(pants='#2a3a6a', boots='#c8ccdc', stance=1.6, knee=1, armor=True, trim='#fff4c8'),
                                body=lambda b: torso_m(b, '#3a4a8a', belt='#c8ccdc', buckle='#fff4c8', deco=gem(0, b.chest, 3.6, '#fff4c8')),
                                head_kw=dict(eye='#fff4c8', glow_eyes='#fff4c8'), headgear=lambda b: helm(b, '#c8ccdc', 'knight', '#fff4c8', '#fff4c8') + shape(f'M-2 {b.hy - b.hr * 1.45} L0 {b.hy - b.hr * 2.4} L2 {b.hy - b.hr * 1.45} Z', '#fff4c8', sw=1.4),
                                back=[('cape', (0, b.sh), cape(b, '#1f2a5a', 0.8, 0.9, inner='#fff4c8') + ''.join(gem(x, y, 1.6, '#fff4c8') for x, y in ((-16, -40), (12, -30), (-6, -20))), sway(2.6, 2.8, 0.5))],
                                back_arm=(pauldron(-16, b.sh + 3, 8, '#c8ccdc', 0, -1) + arm(sh_b, (-24, b.chest + 6), (-22, b.waist), 5.4, '#3a4a8a', '#c8d0e8'), sh_b),
                                front_arm=(pauldron(16, b.sh + 3, 8, '#c8ccdc', 0, 1) + arm(sh_f, (24, b.chest + 6), (20, b.waist - 2), 5.4, '#3a4a8a', '#c8d0e8') + rot(20, b.waist - 2, 30, W_spear(80, '#c8ccdc', '#fff4c8', 24)), sh_f),
                                fx=[('tip', (60, b.waist - 68), halo(60, b.waist - 68, 10, '#fff4c8'), pulse(0.6, 1.3))],
                                hand=(58, b.waist - 66), period=2.8, blink_p=0)

    b = Body(116, 1.05, True)
    sh_f, sh_b = (12, b.sh + 3), (-12, b.sh + 3)
    R['eclipse_queen'] = humanoid('eclipse_queen', out, h=116, build_=1.05, female=True, skin='#d8c8e8', hair_style='long', hair_c='#1a1030',
                                  legs_kw=dict(pants=None, boots='#1a1030', skin='#d8c8e8', heels=True),
                                  body=lambda b: skirt(b, '#1f1438', 1.0, 1.8, slit=True, trim='#ffd36b') + torso_f(b, '#2a1a4a', trim='#ffd36b', skin='#d8c8e8', belt='#ffd36b',
                                                                                                                  deco=gem(0, b.chest + 10, 3, '#ffd36b')),
                                  back=[('sun', (0, b.hy), f'<circle cx="0" cy="{b.hy - 6}" r="30" fill="#0d0912" stroke="#ffd36b" stroke-width="3"/>' + halo(0, b.hy - 6, 40, '#ffd36b'), pulse(0.3, 3)),
                                        ('wings', (0, b.sh), wings('bat', '#1a1030', 0.9, b.sh + 4, membrane='#3a2468'), sway(3, 2.6, 0))],
                                  head_kw=dict(eye='#ffd36b', lips='#5a1a4a'), headgear=lambda b: helm(b, '#ffd36b', 'crown', '#ffd36b', '#a37cff'),
                                  back_arm=(arm(sh_b, (-20, b.chest + 2), (-26, b.chest - 10), 4.6, None, '#d8c8e8', cuff='#ffd36b'), sh_b),
                                  front_arm=(arm(sh_f, (22, b.chest + 6), (22, b.waist - 6), 4.6, None, '#d8c8e8', cuff='#ffd36b') + rot(22, b.waist - 6, 6, W_staff(72, '#1a1030', '#a37cff', 'crescent')), sh_f),
                                  fx=[('orb', (29, b.waist - 78), halo(29, b.waist - 78, 14, '#a37cff'), pulse(0.6, 1.6))],
                                  hand=(29, b.waist - 78), period=3.4, idle='float', top=130)

    # ═════════ Глава 5: Небесная цитадель ═════════
    b = Body(106, 1.25)
    sh_f, sh_b = (19, b.sh + 4), (-19, b.sh + 4)
    R['sky_sentinel'] = humanoid('sky_sentinel', out, h=106, build_=1.25, skin='#a8b8c8', kind='beast',
                                 legs_kw=dict(pants='#5a6a7a', boots='#3a4a5a', stance=1.6, armor=True, trim='#c9a46a'),
                                 body=lambda b: torso_m(b, '#8a9aaa', belt='#c9a46a', buckle='#fff4c8', deco=gem(0, b.chest, 4, '#7fb8ff')),
                                 head_kw=dict(eye='#fff4c8', glow_eyes='#fff4c8'), headgear=lambda b: helm(b, '#8a9aaa', 'knight', '#c9a46a', '#fff4c8') + shape(f'M-2 {b.hy - b.hr * 1.45} L0 {b.hy - b.hr * 2.2} L2 {b.hy - b.hr * 1.45} Z', '#c9a46a', sw=1.4),
                                 back_arm=(pauldron(-19, b.sh + 4, 9, '#a8b8c8', 0, -1) + arm(sh_b, (-26, b.chest + 6), (-22, b.waist + 2), 6, '#8a9aaa', '#a8b8c8')
                                           + rot(-24, b.waist - 2, 0, shape('M-14 -24 L14 -24 L14 14 Q0 26 -14 14 Z', D.lin('#ffffff', '#c8d8f0')) + hl('M-10 -10 Q0 -18 10 -10 M-12 0 Q0 -8 12 0', '#7fb8ff', 1.8, 1)), sh_b),
                                 front_arm=(pauldron(19, b.sh + 4, 9, '#a8b8c8', 0, 1) + arm(sh_f, (26, b.chest + 6), (24, b.waist - 4), 6, '#8a9aaa', '#a8b8c8') + rot(24, b.waist - 4, 16, W_spear(70, '#c9a46a', '#fff4c8', 20)), sh_f),
                                 hand=(42, b.waist - 60), period=3.4, idle='heavy', blink_p=0)

    b = Body(96, 1.0, True)
    sh_f, sh_b = (11, b.sh + 3), (-11, b.sh + 3)
    R['storm_harpy'] = humanoid('storm_harpy', out, h=96, female=True, skin='#d8eef0', hair_style='wild', hair_c='#1f4a6a', kind='f',
                                legs_kw=dict(pants='#2f6f8a', boots='#e0c27a', stance=1.2),
                                body=lambda b: torso_f(b, '#2f6f8a', trim='#4fd6e0', bust=0.85),
                                back=[('wings', (0, b.sh), wings('feather', '#4fd6e0', 0.95, b.sh + 2, top='#bff7ff'), sway(8, 0.9, 0))],
                                head_kw=dict(eye='#ffd9a0', lips='#2f6f8a'),
                                back_arm=(arm(sh_b, (-18, b.chest + 2), (-22, b.chest - 8), 4, '#2f6f8a', '#d8eef0', glove='#e0c27a'), sh_b),
                                front_arm=(arm(sh_f, (20, b.chest), (26, b.sh - 4), 4, '#2f6f8a', '#d8eef0', glove='#e0c27a')
                                           + ''.join(line([(26 + i * 2, b.sh - 8), (30 + i * 3, b.sh - 14)], 1.4, '#f4ead2') for i in range(3)), sh_f),
                                fx=[('spark', (30, b.sh - 14), halo(30, b.sh - 14, 10, '#bff7ff'), pulse(0.7, 0.8))],
                                hand=(30, b.sh - 14), period=1.4, idle='float', hair_sway=6)

    b = Body(90)
    sh_f, sh_b = (13, b.sh + 3), (-13, b.sh + 3)
    R['sun_acolyte'] = humanoid('sun_acolyte', out, h=90, kind='y', skin='#f2dcc0',
                                legs_kw=dict(pants='#f2ead8', boots='#d9a94a'),
                                body=lambda b: robe(b, '#fff8ea', trim='#f0c860', open_front='#f0c860') + torso_m(b, '#fff8ea', belt='#f0c860', buckle='#fff4c8'),
                                head_kw=dict(eye='#d9a94a'), headgear=lambda b: helm(b, '#f6efe0', 'hood'),
                                back_arm=(arm(sh_b, (-20, b.chest + 6), (-14, b.waist), 4.6, '#fff8ea', '#f2dcc0'), sh_b),
                                front_arm=(arm(sh_f, (20, b.chest + 4), (22, b.waist - 4), 4.6, '#fff8ea', '#f2dcc0') + rot(22, b.waist - 4, 4, W_staff(56, '#d9a94a', '#ffe08a', 'sun')), sh_f),
                                fx=[('sun', (26, b.waist - 60), halo(26, b.waist - 60, 12, '#ffe08a'), pulse(0.6, 1.6))],
                                hand=(26, b.waist - 60), period=3.0)

    start('cloud_serpent')
    seg = 'M-40 -6 Q-28 -28 -8 -12 Q10 4 24 -18 Q34 -38 22 -58'
    parts = [
        part('body', (0, -20), curve(seg, 16, '#9ab8e0') + hl('M-38 -10 Q-28 -24 -10 -14 Q8 -2 22 -20', '#ffffff', 2.4, 0.7)
             + ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#ffffff" opacity=".7" stroke-width="1.6"/>' for x, y, r in ((-30, -30, 7), (-2, -26, 6), (20, -40, 5))), breathe(0.04, 2.2), breath=True),
        part('head', (22, -58), shape('M12 -60 Q14 -78 30 -80 Q44 -74 46 -62 Q40 -54 28 -54 Q16 -52 12 -60 Z', D.vol('#9ab8e0')) + dot(30, -68, 2.4, '#ffd9a0', 1)
             + curve('M44 -64 Q54 -60 58 -66 M42 -58 Q50 -52 56 -54', 1.4, '#e8f2ff') + shape('M22 -78 L18 -90 L28 -80 Z', '#e8f2ff', sw=1.4), sway(5, 2.2, 0.6), follow=True, role='head'),
    ]
    R['cloud_serpent'] = build(out, 'cloud_serpent', parts, hand=(46, -62), top=96, idle='float')

    b = Body(104, 1.15)
    sh_f, sh_b = (17, b.sh + 3), (-17, b.sh + 3)
    R['gilded_knight'] = humanoid('gilded_knight', out, h=104, build_=1.15, skin='#e0c08a', kind='beast',
                                  legs_kw=dict(pants='#c8983a', boots='#8a6a2a', stance=1.6, armor=True, trim='#fff4c8'),
                                  body=lambda b: torso_m(b, '#f0c860', belt='#8a6a2a', buckle='#fff4c8', deco=shape(f'M-8 {b.sh + 4} L0 {b.chest + 8} L8 {b.sh + 4} Z', '#fff4c8', sw=1.6)),
                                  head_kw=dict(eye='#fff4c8', glow_eyes='#fff4c8'),
                                  headgear=lambda b: helm(b, '#e0b050', 'knight', '#fff4c8', '#fff4c8') + shape(f'M0 {b.hy - b.hr * 1.4} Q-10 {b.hy - b.hr * 2.6} -2 {b.hy - b.hr * 3.2} Q4 {b.hy - b.hr * 2.4} 6 {b.hy - b.hr * 1.6} Z', '#e0503a'),
                                  back_arm=(pauldron(-17, b.sh + 3, 8, '#f0c860', 0, -1) + arm(sh_b, (-24, b.chest + 6), (-20, b.waist), 5.6, '#c8983a', '#e0c08a'), sh_b),
                                  front_arm=(pauldron(17, b.sh + 3, 8, '#f0c860', 0, 1) + arm(sh_f, (24, b.chest + 6), (20, b.waist - 2), 5.6, '#c8983a', '#e0c08a') + rot(20, b.waist - 2, 32, W_spear(84, '#f0c860', '#fff4c8', 26)), sh_f),
                                  fx=[('tip', (62, b.waist - 70), halo(62, b.waist - 70, 10, '#fff4c8'), pulse(0.6, 1.2))],
                                  hand=(60, b.waist - 68), period=2.8, blink_p=0)

    b = Body(114, 1.3)
    sh_f, sh_b = (20, b.sh + 4), (-20, b.sh + 4)
    bolt = lambda x, y: shape(f'M{x} {y} L{x - 4} {y + 10} L{x + 1} {y + 10} L{x - 3} {y + 22} L{x + 6} {y + 6} L{x + 1} {y + 6} L{x + 5} {y} Z', '#fff4c8', sw=1.2)
    R['storm_king'] = humanoid('storm_king', out, h=114, build_=1.3, skin='#d8e4f0', kind='m',
                               legs_kw=dict(pants='#1f4a7a', boots='#c8ccdc', stance=1.6, armor=True, trim='#4fd6e0'),
                               body=lambda b: robe(b, '#1f4a7a', trim='#4fd6e0', open_front='#2a5e94') + torso_m(b, '#2a5e94', belt='#c8ccdc', buckle='#4fd6e0', deco=bolt(0, b.sh + 6)),
                               back=[('cape', (0, b.sh), cape(b, '#123056', 1.0, 1.3, inner='#4fd6e0'), sway(3, 2.4, 0.6)),
                                     ('storm', (0, b.hy), bolt(-44, b.hy - 18) + bolt(40, b.hy - 10) + halo(0, b.hy, 46, '#4fd6e0'), pulse(0.6, 0.9))],
                               head_kw=dict(eye='#4fd6e0', glow_eyes='#bff7ff', beard='#e8f2ff', age=1),
                               headgear=lambda b: helm(b, '#c8ccdc', 'crown', '#c8ccdc', '#4fd6e0'),
                               back_arm=(pauldron(-20, b.sh + 4, 10, '#c8ccdc', 3, -1) + arm(sh_b, (-28, b.chest + 4), (-32, b.chest - 8), 6.4, '#2a5e94', '#d8e4f0'), sh_b),
                               front_arm=(pauldron(20, b.sh + 4, 10, '#c8ccdc', 3, 1) + arm(sh_f, (30, b.chest + 6), (28, b.waist - 4), 6.4, '#2a5e94', '#d8e4f0') + rot(28, b.waist - 4, 6, W_trident(84, '#fff4c8', '#c8ccdc')), sh_f),
                               fx=[('palm', (-32, b.chest - 10), halo(-32, b.chest - 12, 12, '#bff7ff') + bolt(-34, b.chest - 30), pulse(0.6, 0.8))],
                               hand=(-32, b.chest - 12), period=3.2, idle='heavy', top=130, blink_p=0)

    # ═════════ Пожиратель звёзд (рейд) ═════════
    start('star_devourer')
    dv = '#2a1f48'
    stars = ''.join(dot(x, y, r, '#fff4c8', 0) for x, y, r in ((-46, -108, 1.6), (44, -112, 2), (50, -40, 1.4), (-52, -50, 1.4), (30, -124, 1.2)))
    parts = [
        part('cosmos', (0, -60), halo(0, -60, 60, '#a37cff') + stars, pulse(0.4, 3)),
        part('tendrils', (0, -10), ''.join(curve(f'M{x} -8 Q{x + d} 4 {x + d * 2} -4', 5, '#3a2856') for x, d in ((-30, -8), (-12, -6), (12, 6), (30, 8))), sway(4, 1.8, 0)),
        part('body', (0, -8), shape('M-44 -4 Q-56 -56 -24 -86 Q0 -104 24 -86 Q56 -56 44 -4 Q22 -12 0 -4 Q-22 -12 -44 -4 Z', D.vol(dv))
             + ''.join(dot(x, y, 1.2, '#c79cff', 0) for x, y in ((-30, -40), (-20, -70), (24, -60), (32, -30), (10, -84))), breathe(0.025, 2.8), breath=True),
        part('maw', (0, -50), shape('M-28 -54 Q0 -24 28 -54 Q22 -30 0 -22 Q-22 -30 -28 -54 Z', '#0c0718')
             + ''.join(shape(f'M{x} -50 L{x + 3} -40 L{x + 6} -50 Z', '#efe6cf', sw=1) for x in range(-24, 22, 6))
             + halo(0, -38, 10, '#ffd9a0') + dot(0, -38, 4, '#ffd9a0', 1.2), breathe(0.08, 2.8, 0.5), follow=True),
        part('eyes', (0, -68), shape('M-22 -72 L-10 -66 L-22 -62 Z M22 -72 L10 -66 L22 -62 Z', '#c79cff', sw=1.2) + halo(-16, -67, 8, '#c79cff') + halo(16, -67, 8, '#c79cff'), pulse(0.4, 1.4), follow=True, role='head'),
        part('horns', (0, -86), shape('M-30 -80 L-50 -110 L-22 -88 Z M30 -80 L50 -110 L22 -88 Z', D.vol('#3a2856')), sway(1.5, 2.8, 0), follow=True, role='head'),
    ]
    R['star_devourer'] = build(out, 'star_devourer', parts, hand=(0, -38), top=118, idle='heavy')

    # ═════════ Страж Разлома: шесть стихий ═════════
    RIFT = {'fire': ('#c8402a', '#ffb02a'), 'thorn': ('#3f6a3a', '#9be07a'), 'stone': ('#7a6a5a', '#e0c08a'),
            'tide': ('#1f5a7a', '#4fd6e0'), 'light': ('#c8b880', '#fff4c8'), 'dark': ('#2a1f48', '#a37cff')}
    for el, (c, g) in RIFT.items():
        key = f'rift_{el}'
        start(key)
        parts = [
            part('ring', (0, -70), f'<circle cx="0" cy="-70" r="52" fill="none" stroke="{g}" stroke-width="3" stroke-dasharray="10 6" opacity=".8"/>' + halo(0, -70, 58, g), sway(8, 6, 0)),
            part('legs', (0, -30), line([(-16, -32), (-22, -4)], 12, dark(c, 0.3)) + line([(16, -32), (22, -4)], 12, dark(c, 0.3))),
            part('armBack', (-34, -86), line([(-34, -86), (-50, -62), (-48, -38)], 12, dark(c, 0.15)) + shape('M-56 -38 L-40 -38 L-44 -22 L-52 -22 Z', D.vol(c)), sway(2.4, 3.4, 2), follow=True),
            part('torso', (0, -30), shape('M-38 -92 Q-48 -60 -26 -30 L26 -30 Q48 -60 38 -92 Q0 -108 -38 -92 Z', D.vol(c))
                 + hl('M-24 -86 L-12 -70 L-24 -54 M22 -88 L10 -72 L22 -52', g, 2.4, 0.9)
                 + halo(0, -66, 18, g) + f'<path d="M0 -80 Q12 -66 0 -52 Q-12 -66 0 -80 Z" fill="{g}" stroke-width="2"/>' + dot(0, -66, 4, '#ffffff', 1.4), breathe(0.02, 3.4), breath=True),
            part('head', (0, -100), shape('M-16 -98 Q-18 -120 0 -124 Q18 -120 16 -98 Q0 -92 -16 -98 Z', D.vol(dark(c, 0.1)))
                 + shape('M-10 -110 L-2 -108 L-10 -105 Z M10 -110 L2 -108 L10 -105 Z', g, sw=1)
                 + shape('M-14 -116 L-26 -128 L-10 -120 Z M14 -116 L26 -128 L10 -120 Z', D.vol(c), sw=1.6), sway(1.6, 3.4, 0.4), follow=True, role='head'),
            part('armFront', (34, -86), line([(34, -86), (52, -62), (50, -40)], 12, c) + shape('M42 -40 L58 -40 L54 -22 L46 -22 Z', D.vol(c)) + halo(50, -30, 10, g), swing(2.4, 3.4, 0.4), follow=True, role='weapon'),
        ]
        R[key] = build(out, key, parts, hand=(50, -30), top=130, idle='heavy')
    return R
