"""Пепельная Тризна: пепел, кости, тьма, утопленники и сумерки."""
from kit import *

PALE = '#d8dde6'
TEAL = '#5fe0cf'


def skull(cx, cy, r, c='#efe6cf', eye='#5fe0cf'):
    out = shape(f'M{cx - r} {cy} Q{cx - r * 1.05} {cy - r * 1.15} {cx} {cy - r * 1.15} Q{cx + r * 1.05} {cy - r * 1.15} {cx + r} {cy} '
                f'Q{cx + r * 0.9} {cy + r * 0.55} {cx + r * 0.55} {cy + r * 0.6} L{cx + r * 0.5} {cy + r * 1.0} L{cx - r * 0.5} {cy + r * 1.0} '
                f'L{cx - r * 0.55} {cy + r * 0.6} Q{cx - r * 0.9} {cy + r * 0.55} {cx - r} {cy} Z', D.vol(c))
    for s in (-1, 1):
        out += shape(f'M{cx + s * r * 0.15} {cy - r * 0.05} Q{cx + s * r * 0.75} {cy - r * 0.5} {cx + s * r * 0.75} {cy} Q{cx + s * r * 0.5} {cy + r * 0.3} {cx + s * r * 0.15} {cy - r * 0.05} Z', '#1a1220', sw=1.4)
        out += dot(cx + s * r * 0.47, cy - r * 0.08, r * 0.14, eye, 0)
    out += shape(f'M{cx} {cy + r * 0.15} L{cx + r * 0.12} {cy + r * 0.38} L{cx - r * 0.12} {cy + r * 0.38} Z', '#1a1220', sw=1)
    out += hl(f'M{cx - r * 0.35} {cy + r * 0.62} L{cx - r * 0.35} {cy + r * 0.95} M{cx} {cy + r * 0.62} L{cx} {cy + r * 0.95} M{cx + r * 0.35} {cy + r * 0.62} L{cx + r * 0.35} {cy + r * 0.95}', '#1a1220', 1.2, 1)
    return out


def ribs(b, c='#efe6cf'):
    out = line([(0, b.sh + 2), (0, b.hip)], 3, c)
    for i in range(4):
        y = b.sh + 6 + i * 6
        w = 13 - i * 1.6
        out += curve(f'M0 {y} Q{-w} {y - 1} {-w} {y + 5} M0 {y} Q{w} {y - 1} {w} {y + 5}', 2.2, c)
    out += shape(f'M-12 {b.hip - 2} Q0 {b.hip - 8} 12 {b.hip - 2} L9 {b.hip + 4} L-9 {b.hip + 4} Z', D.vol(c), sw=1.8)
    return out


def make(out):
    R = {}

    # ——— Вейла, Плакальщица глубин: парящая утопленница, мокрые волосы, цепи ———
    b = Body(104, 1.0, True)
    sh_f, sh_b = (11, b.sh + 3), (-11, b.sh + 3)
    chain = ''.join(f'<ellipse cx="{24 + i * 4}" cy="{b.waist + 6 + i * 5}" rx="2.6" ry="1.6" fill="none" stroke="#8a97b2" stroke-width="1.4"/>' for i in range(6))
    R['veila'] = humanoid(
        'veila', out, h=104, female=True, skin='#b8e0e6', hair_style='long', hair_c='#2f5a6a',
        legs_kw=dict(pants=None, boots='#b8e0e6', skin='#b8e0e6'),
        body=lambda b: skirt(b, '#2f6f8a', 1.0, 1.4, tattered=True, trim=TEAL) + torso_f(b, '#3f8aa6', trim=TEAL, skin='#b8e0e6',
                                                                                         deco=hl(f'M-8 {b.chest + 8} Q0 {b.waist} 8 {b.chest + 8}', '#1f4a5a', 1.4, 1)),
        back=[('veil', (0, b.hy), shape(f'M-12 {b.hy - 10} Q-30 {b.hy + 20} -26 {b.waist} L-14 {b.waist - 4} Q-16 {b.hy + 10} -6 {b.hy - 6} Z', '#bff7ff', sw=1.6).replace('/>', ' fill-opacity=".45"/>'), sway(5, 2.4, 0.3))],
        head_kw=dict(eye=TEAL, glow_eyes=TEAL, lips='#5a8a9a'),
        headgear=lambda b: helm(b, '#c8ccdc', 'circlet', '#8a97b2', TEAL),
        back_arm=(arm(sh_b, (-20, b.chest + 2), (-28, b.chest - 8), 4.4, None, '#b8e0e6'), sh_b),
        front_arm=(arm(sh_f, (20, b.chest + 6), (22, b.waist + 2), 4.4, None, '#b8e0e6') + chain, sh_f),
        fx=[('tears', (0, b.hy), halo(-28, b.chest - 8, 10, TEAL) + ''.join(dot(-28 + i * 3, b.chest - 2 + i * 7, 1.4, '#bff7ff', 0.8) for i in range(3)), pulse(0.6, 1.6))],
        hand=(-28, b.chest - 8), period=3.2, idle='float', hair_sway=5)

    # ——— Мортис, пепельный жрец: капюшон, коса, души-огоньки ———
    b = Body(102, 1.0)
    sh_f, sh_b = (14, b.sh + 3), (-14, b.sh + 3)
    R['necro'] = humanoid(
        'necro', out, h=102, skin='#c8c0b8', hair_style=None,
        legs_kw=dict(pants='#3a3440', boots='#2a2430'),
        body=lambda b: robe(b, '#4a4452', trim='#8a8094', open_front='#2a2430', hem_y=-2)
        + torso_m(b, '#5a5462', belt='#2a2430', buckle=TEAL, deco=skull(0, b.chest - 2, 4, '#efe6cf', TEAL)),
        head_kw=dict(eye=TEAL, glow_eyes=TEAL, age=1),
        headgear=lambda b: helm(b, '#3a3440', 'hood'),
        back=[('souls', (0, b.chest), ''.join(halo(x, y, 6, TEAL) + dot(x, y, 2, '#d8fff8', 0) for x, y in ((-30, b.sh), (-36, b.waist), (-26, b.hip + 10))), sway(10, 4, 0))],
        back_arm=(arm(sh_b, (-22, b.chest + 6), (-24, b.waist), 5, '#4a4452', '#c8c0b8'), sh_b),
        front_arm=(arm(sh_f, (22, b.chest + 4), (22, b.waist - 6), 5, '#4a4452', '#c8c0b8') + rot(22, b.waist - 6, 6, W_scythe(70, '#bff7ff', '#2a2430')), sh_f),
        fx=[('blade', (4, b.waist - 74), halo(4, b.waist - 72, 12, TEAL), pulse(0.6, 1.7))],
        hand=(-6, b.waist - 74), period=3.4)

    # ——— Карр, чумной ворон: клюв-маска, перьевой плащ, рой мошкары ———
    b = Body(96, 1.0)
    sh_f, sh_b = (14, b.sh + 3), (-14, b.sh + 3)

    def beak(b):
        cy, r = b.hy, b.hr * 1.15
        o = shape(f'M{-r} {cy + 2} Q{-r * 1.1} {cy - r * 1.2} 0 {cy - r * 1.2} Q{r * 1.1} {cy - r * 1.2} {r} {cy + 2} Q0 {cy + r * 0.9} {-r} {cy + 2} Z', D.vol('#2a2430'))
        o += shape(f'M{r * 0.2} {cy - r * 0.1} Q{r * 2.6} {cy + r * 0.2} {r * 2.4} {cy + r * 1.4} Q{r * 1.4} {cy + r * 0.8} {r * 0.2} {cy + r * 0.6} Z', D.vol('#3a3440'))
        o += dot(-r * 0.3, cy - r * 0.2, r * 0.28, '#c8343c', 1.4) + dot(r * 0.35, cy - r * 0.2, r * 0.28, '#c8343c', 1.4)
        o += dot(-r * 0.3, cy - r * 0.2, r * 0.12, '#ffd36b', 0) + dot(r * 0.35, cy - r * 0.2, r * 0.12, '#ffd36b', 0)
        o += shape(f'M{-r * 1.05} {cy - r * 0.6} L{-r * 0.6} {cy - r * 1.7} L{-r * 0.2} {cy - r * 1.1} L{r * 0.2} {cy - r * 1.8} L{r * 0.5} {cy - r * 1.1} L{r * 1.0} {cy - r * 1.5} L{r * 1.05} {cy - r * 0.6} Z', '#1a1420')
        return o
    swarm = ''.join(dot(math.cos(i * 1.7) * (30 + i % 3 * 6), b.chest + math.sin(i * 2.3) * 26, 1.2, '#9be07a', 0.6) for i in range(16))
    R['karr'] = humanoid(
        'karr', out, h=96, kind='beast', skin='#3a3440',
        legs_kw=dict(pants='#2a2430', boots='#1a1420', stance=1.4),
        body=lambda b: torso_m(b, '#2a2430', belt='#5a3a22', buckle='#9be07a',
                               deco=''.join(rot(-10 + i * 5, b.sh + 8 + (i % 2) * 6, 0, shape('M0 0 Q-3 6 0 12 Q3 6 0 0 Z', '#1a1420', sw=1)) for i in range(5))),
        back=[('wings', (0, b.sh), wings('feather', '#2a2430', 0.75, b.sh + 4, top='#5a5468'), sway(4, 2.2, 0))],
        head_kw=None, blink_p=0, headgear=beak,
        back_arm=(arm(sh_b, (-22, b.chest + 6), (-26, b.waist - 4), 5, '#2a2430', '#3a3440', glove='#1a1420'), sh_b),
        front_arm=(arm(sh_f, (24, b.chest), (30, b.chest - 10), 5, '#2a2430', '#3a3440', glove='#1a1420')
                   + rot(30, b.chest - 10, 30, W_dagger(16, '#9be07a', True, '#c9f0a0')), sh_f),
        fx=[('swarm', (0, b.chest), swarm, sway(14, 1.4, 0))],
        hand=(40, b.chest - 24), period=2.4)

    # ——— Грав, костяной страж: скелет в шлеме с огромным щитом ———
    b = Body(98, 1.05)
    bone = '#efe6cf'
    sh_f, sh_b = (15, b.sh + 3), (-15, b.sh + 3)
    R['grav'] = humanoid(
        'grav', out, h=98, build_=1.05, kind='beast', skin=bone,
        legs_kw=dict(pants=bone, boots='#4a5470', stance=1.5),
        body=lambda b: ribs(b, bone) + shape(f'M-12 {b.hip} L12 {b.hip} L14 {b.hip + 16} L-14 {b.hip + 16} Z', '#3a3440', sw=1.8).replace(f'{b.hip + 16}', f'{b.hip + 16}'),
        head_kw=None, blink_p=0,
        headgear=lambda b: skull(0, b.hy, b.hr, bone, TEAL) + shape(f'M{-b.hr * 1.15} {b.hy - b.hr * 0.3} Q{-b.hr * 1.2} {b.hy - b.hr * 1.4} 0 {b.hy - b.hr * 1.45} Q{b.hr * 1.2} {b.hy - b.hr * 1.4} {b.hr * 1.15} {b.hy - b.hr * 0.3} Z', D.vol('#6a7592'))
        + shape(f'M-2 {b.hy - b.hr * 1.45} L0 {b.hy - b.hr * 2.3} L2 {b.hy - b.hr * 1.45} Z', '#a9b4ca', sw=1.6),
        back_arm=(arm(sh_b, (-20, b.chest + 6), (-18, b.waist + 4), 3.2, bone, bone) + rot(-18, b.waist + 4, -6, W_sword(30, '#a9b4ca', '#6a7592', '#3a2a2a')), sh_b),
        front_arm=(pauldron(16, b.sh + 2, 7, '#6a7592', 3, 1) + arm(sh_f, (22, b.chest + 8), (16, b.waist), 3.2, bone, bone)
                   + rot(18, b.waist - 4, 0, W_shield_kite(15, 40, '#4a5470', '#a9b4ca', TEAL)), sh_f),
        fx=[('eyes', (0, -86), halo(0, -86, 10, TEAL), pulse(0.6, 2))],
        hand=(18, b.waist - 4), period=3.2, idle='heavy')

    # ——— Рагна, рыцарь смерти: тёмные латы, двуручный меч, рваный плащ, белые волосы ———
    b = Body(104, 1.08, True)
    sh_f, sh_b = (12, b.sh + 3), (-12, b.sh + 3)
    R['ragna'] = humanoid(
        'ragna', out, h=104, build_=1.08, female=True, skin='#c8ccd8', hair_style='long', hair_c='#e8ecf4',
        legs_kw=dict(pants='#3a3448', boots='#1a1420', stance=1.5, armor=True, trim=TEAL),
        body=lambda b: skirt(b, '#2a2438', 0.45, 0.8, tattered=True, trim=TEAL) + torso_f(b, '#4a4460', trim=TEAL, belt='#1a1420', bust=0.95,
                                                                                         deco=skull(0, b.chest + 10, 3.4, '#c8ccdc', TEAL)),
        back=[('cape', (0, b.sh), cape(b, '#1f1a2a', 0.98, 1.1, inner=TEAL, tattered=True), sway(2.6, 3.2, 0.6))],
        head_kw=dict(eye=TEAL, glow_eyes=TEAL, lips='#6a6a8a'),
        headgear=lambda b: horns(b, '#3a3448', 'straight', 0.9),
        back_arm=(pauldron(-14, b.sh + 3, 8, '#4a4460', 2, -1) + arm(sh_b, (-18, b.chest + 6), (4, b.waist - 6), 5.4, '#4a4460', '#c8ccd8', glove='#1a1420'), sh_b),
        front_arm=(pauldron(14, b.sh + 3, 8, '#4a4460', 2, 1) + arm(sh_f, (20, b.chest + 6), (8, b.waist - 8), 5.4, '#4a4460', '#c8ccd8', glove='#1a1420')
                   + rot(8, b.waist - 8, 22, W_sword(62, '#8a97b2', '#3a3448', '#1a1420', TEAL, 1.5)), sh_f),
        fx=[('rune', (31, b.waist - 60), halo(31, b.waist - 60, 12, TEAL), pulse(0.6, 1.8))],
        hand=(31, b.waist - 60), period=3.4)

    # ——— Шёпот, тень: капюшон, маска, два кинжала, дымка ———
    b = Body(98, 0.95)
    sh_f, sh_b = (13, b.sh + 3), (-13, b.sh + 3)
    smoke = ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#2a2438" opacity=".5" stroke="none"/>' for x, y, r in ((-20, -6, 10), (16, -4, 9), (-4, -2, 12), (26, -12, 6), (-30, -14, 6)))
    R['whisper'] = humanoid(
        'whisper', out, h=98, build_=0.95, skin='#bfb6c8', hair_style=None,
        legs_kw=dict(pants='#2a2438', boots='#1a1420', stance=1.8, knee=2),
        body=lambda b: torso_m(b, '#3a3448', belt='#1a1420', buckle='#a37cff',
                               deco=line([(-12, b.sh + 4), (12, b.hip - 2)], 2.4, '#5a4a6a') + shape(f'M-11 {b.hip} L11 {b.hip} L14 {b.hip + 14} L0 {b.hip + 8} L-14 {b.hip + 14} Z', '#2a2438', sw=1.8)),
        head_kw=dict(eye='#a37cff', glow_eyes='#c79cff'),
        headgear=lambda b: helm(b, '#2a2438', 'hood') + shape(f'M{-b.hr * 0.95} {b.hy + 2} L{b.hr * 0.95} {b.hy + 2} L{b.hr * 0.8} {b.hy + b.hr * 1.05} L{-b.hr * 0.8} {b.hy + b.hr * 1.05} Z', '#1a1420', sw=1.6),
        back=[('smoke', (0, 0), smoke, pulse(0.5, 2.4))],
        back_arm=(arm(sh_b, (-24, b.chest), (-32, b.chest - 10), 4.6, '#3a3448', '#bfb6c8', glove='#1a1420') + rot(-32, b.chest - 10, -40, W_dagger(20, '#c79cff', False, '#e8d8ff')), sh_b),
        front_arm=(arm(sh_f, (24, b.chest + 8), (32, b.waist - 2), 4.6, '#3a3448', '#bfb6c8', glove='#1a1420') + rot(32, b.waist - 2, 120, W_dagger(20, '#c79cff', False, '#e8d8ff')), sh_f),
        hand=(38, b.waist + 10), period=2.4)

    # ——— Морок, сумеречный шут: колпак с бубенцами, маска, карты ———
    b = Body(104, 1.0)
    sh_f, sh_b = (14, b.sh + 3), (-14, b.sh + 3)

    def jester(b):
        cy, r = b.hy, b.hr
        o = ''
        for s, c in ((-1, '#5a3a90'), (1, '#1f1a2a')):
            o += shape(f'M{s * r * 0.2} {cy - r * 0.8} Q{s * r * 1.6} {cy - r * 2.6} {s * r * 2.8} {cy - r * 1.2} Q{s * r * 1.6} {cy - r * 1.6} {s * r * 1.05} {cy - r * 0.3} Z', D.vol(c))
            o += dot(s * r * 2.8, cy - r * 1.2, 2.6, '#f0c860', 1.4)
        o += shape(f'M{-r * 1.05} {cy - r * 0.5} Q0 {cy - r * 1.3} {r * 1.05} {cy - r * 0.5} Q0 {cy - r * 0.8} {-r * 1.05} {cy - r * 0.5} Z', '#2a2438')
        # маска: половина белая, половина чёрная
        o += shape(f'M0 {cy - r * 0.7} Q{-r * 1.1} {cy - r * 0.6} {-r * 0.95} {cy + r * 0.4} Q{-r * 0.5} {cy + r * 0.5} 0 {cy + r * 0.25} Z', '#f4f0f8', sw=1.6)
        o += shape(f'M0 {cy - r * 0.7} Q{r * 1.1} {cy - r * 0.6} {r * 0.95} {cy + r * 0.4} Q{r * 0.5} {cy + r * 0.5} 0 {cy + r * 0.25} Z', '#1a1420', sw=1.6)
        o += shape(f'M{-r * 0.6} {cy - r * 0.05} Q{-r * 0.4} {cy - r * 0.3} {-r * 0.15} {cy - r * 0.05} Q{-r * 0.4} {cy + r * 0.05} {-r * 0.6} {cy - r * 0.05} Z', '#a37cff', sw=1)
        o += shape(f'M{r * 0.15} {cy - r * 0.05} Q{r * 0.4} {cy - r * 0.3} {r * 0.6} {cy - r * 0.05} Q{r * 0.4} {cy + r * 0.05} {r * 0.15} {cy - r * 0.05} Z', '#f0c860', sw=1)
        o += hl(f'M{-r * 0.5} {cy + r * 0.65} Q0 {cy + r * 0.95} {r * 0.5} {cy + r * 0.6}', OUT_LINE, 1.6, 1)
        return o
    cards = ''.join(rot(x, y, a, shape('M-4 -6 L4 -6 L4 6 L-4 6 Z', '#f4f0f8', sw=1.4) + gem(0, 0, 2.2, c)) for x, y, a, c in ((30, b.sh - 14, 20, '#c8343c'), (38, b.sh - 4, 40, '#a37cff'), (24, b.sh - 22, -5, '#f0c860')))
    R['morok'] = humanoid(
        'morok', out, h=104, skin='#e8dcf0',
        legs_kw=dict(pants='#5a3a90', boots='#1f1a2a', stance=1.3, trim='#f0c860'),
        body=lambda b: torso_m(b, '#3a2868', belt='#f0c860', buckle='#a37cff', collar='#f4f0f8',
                               deco=shape(f'M0 {b.sh} L{b.shw} {b.sh + 6} L{b.shw - 2} {b.hip} L0 {b.hip} Z', '#5a3a90', sw=1.6)
                               + ''.join(gem(0, b.sh + 8 + i * 8, 2, '#f0c860') for i in range(3))),
        head_kw=None, blink_p=0, headgear=jester,
        back=[('cape', (0, b.sh), cape(b, '#1f1a2a', 0.85, 1.0, inner='#a37cff', tattered=True), sway(3, 2.6, 0.5))],
        back_arm=(arm(sh_b, (-24, b.chest - 2), (-30, b.sh - 8), 4.6, '#5a3a90', '#e8dcf0', glove='#f4f0f8'), sh_b),
        front_arm=(arm(sh_f, (22, b.chest - 4), (28, b.sh - 6), 4.6, '#3a2868', '#e8dcf0', glove='#1f1a2a') + cards, sh_f),
        fx=[('mist', (-30, b.sh - 10), halo(-30, b.sh - 10, 14, '#a37cff'), pulse(0.5, 1.6))],
        hand=(-30, b.sh - 10), period=2.6, idle='sway')

    # ——— Таласса, Владычица глубин (мифическая): коралловая корона, трезубец, водный вихрь ———
    b = Body(110, 1.05, True)
    sh_f, sh_b = (12, b.sh + 3), (-12, b.sh + 3)
    coral = ''.join(curve(f'M{x} {-0.87 * 110 - 10} Q{x + d} {-0.87 * 110 - 18} {x + d * 1.4} {-0.87 * 110 - 24}', 2.2, '#ff7a8a') for x, d in ((-6, -6), (-2, -2), (2, 2), (6, 6)))
    R['thalassa'] = humanoid(
        'thalassa', out, h=110, build_=1.05, female=True, skin='#cfe8f0', hair_style='long', hair_c='#1f6f8a',
        legs_kw=dict(pants=None, boots='#4fd6e0', skin='#cfe8f0'),
        body=lambda b: skirt(b, '#2f8aa6', 1.0, 1.7, slit=True, trim='#bff7ff') + torso_f(b, '#3fa0b8', trim='#bff7ff', skin='#cfe8f0', belt='#ff7a8a',
                                                                                        deco=''.join(dot(-6 + i * 6, b.chest + 9, 1.6, '#fff4f8', 1) for i in range(3))),
        back=[('vortex', (0, b.waist), f'<ellipse cx="0" cy="{b.waist}" rx="44" ry="14" fill="none" stroke="#7fe7ff" stroke-width="3" opacity=".6" transform="rotate(-12 0 {b.waist})"/>'
               + halo(0, b.chest, 40, '#4fd6e0'), sway(8, 3, 0))],
        head_kw=dict(eye='#2f8aa6', lips='#e0607a'),
        headgear=lambda b: coral + helm(b, '#ff7a8a', 'circlet', '#ff7a8a', '#bff7ff'),
        back_arm=(arm(sh_b, (-20, b.chest + 2), (-26, b.chest - 10), 4.8, None, '#cfe8f0', cuff='#ff7a8a'), sh_b),
        front_arm=(arm(sh_f, (22, b.chest + 6), (22, b.waist - 4), 4.8, None, '#cfe8f0', cuff='#ff7a8a') + rot(22, b.waist - 4, 6, W_trident(76, '#bff7ff', '#2f6f8a')), sh_f),
        fx=[('palm', (-26, b.chest - 10), halo(-26, b.chest - 12, 12, '#7fe7ff'), pulse(0.6, 1.4))],
        hand=(-26, b.chest - 12), period=3.4, idle='float', hair_sway=5, top=122)
    return R
