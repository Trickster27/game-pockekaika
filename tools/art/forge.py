"""Клан Глубинного Горна: гномы, руны, сталь, бороды и пар."""
from kit import *

RUNE = '#7fe7ff'
DSKIN = '#e8b090'


def goggles(b, lens='#7fe7ff'):
    cy, r = b.hy, b.hr
    o = line([(-r * 1.05, cy - r * 0.15), (r * 1.05, cy - r * 0.15)], 2.4, '#5a3a22')
    for s in (-1, 1):
        o += dot(s * r * 0.42, cy - r * 0.15, r * 0.36, '#a9b4ca', 1.8) + dot(s * r * 0.42, cy - r * 0.15, r * 0.24, lens, 1) + dot(s * r * 0.48, cy - r * 0.25, r * 0.07, '#ffffff', 0)
    return o


def dwarf(key, out, *, beard, armor, front, back, headgear, h=82, female=False, hair_style=None, hair_c=None, fx=None, hand=None, extra_body='', kind=None, legs_c=None, backs=None):
    """Гном: низкий, широкий, борода до пояса (у гномок — косы)."""
    return humanoid(
        key, out, h=h, build_=1.45, female=female, kind=kind, skin=DSKIN, hair_style=hair_style, hair_c=hair_c,
        legs_kw=dict(pants=legs_c or '#5a4a3a', boots='#3a2618', stance=1.7, armor=not female),
        body=lambda b: (torso_f(b, armor, trim='#d9a94a', belt='#5a3a22', bust=0.85) if female else torso_m(b, armor, belt='#5a3a22', buckle='#d9a94a', bulk=1.1)) + extra_body,
        head_kw=dict(eye='#4a3a2a', beard=beard),
        headgear=headgear, back_arm=back, front_arm=front, fx=fx, hand=hand, period=3.2, idle='heavy', back=backs)


def make(out):
    R = {}

    # ——— Торвальд, Рунный молот: рогатый шлем, светящиеся руны, огромный молот ———
    b = Body(84, 1.45)
    sh_f, sh_b = (18, b.sh + 3), (-18, b.sh + 3)
    R['torvald'] = dwarf(
        'torvald', out, h=84, beard='#e8e0d0', armor='#8a97b2',
        extra_body=hl('M-6 -50 L0 -56 L6 -50 M0 -56 L0 -44', RUNE, 1.8, 1),
        headgear=lambda b: helm(b, '#a9b4ca', 'horned', '#d9a94a', RUNE),
        back=(pauldron(-18, b.sh + 3, 8, '#a9b4ca', 0, -1) + arm(sh_b, (-26, b.chest + 6), (-24, b.waist + 4), 7, '#6a7592', DSKIN, glove='#3a2618'), sh_b),
        front=(pauldron(18, b.sh + 3, 8, '#a9b4ca', 0, 1) + arm(sh_f, (28, b.chest + 4), (24, b.waist - 2), 7, '#6a7592', DSKIN, glove='#3a2618')
               + rot(24, b.waist - 2, 14, W_hammer(46, '#a9b4ca', '#5a3a22', RUNE)), sh_f),
        fx=[('rune', (37, b.waist - 46), halo(37, b.waist - 46, 14, RUNE), pulse(0.55, 1.8))],
        hand=(37, b.waist - 46))

    # ——— Гримса, канонирша: косы, очки, ручная рунная пушка ———
    b = Body(80, 1.45, True)
    sh_f, sh_b = (15, b.sh + 3), (-15, b.sh + 3)
    R['grimsa'] = dwarf(
        'grimsa', out, h=80, female=True, kind='f', beard=None, armor='#a8682e', hair_style='braid', hair_c='#c8482a', legs_c='#4a4a5a',
        headgear=lambda b: goggles(b, '#ffb02a'),
        back=(arm(sh_b, (-22, b.chest + 6), (-4, b.chest + 4), 6, '#a8682e', DSKIN, glove='#3a2618'), sh_b),
        front=(arm(sh_f, (24, b.chest + 2), (26, b.chest - 4), 6, '#a8682e', DSKIN, glove='#3a2618') + rot(14, b.chest, 72, W_cannon('#4a5470', '#d9a94a')), sh_f),
        fx=[('muzzle', (46, b.chest - 9), halo(46, b.chest - 9, 10, '#ffb02a'), pulse(0.7, 1.1))],
        hand=(46, b.chest - 9))

    # ——— Брум, щит клана: башенный щит с руной, кольчуга, борода в кольцах ———
    b = Body(82, 1.5)
    sh_f, sh_b = (19, b.sh + 3), (-19, b.sh + 3)
    R['dwarf'] = dwarf(
        'dwarf', out, h=82, beard='#8a5a32', armor='#7a8aa8',
        extra_body=''.join(dot(-10 + i * 10, -38, 1.6, '#d9a94a') for i in range(3)),
        headgear=lambda b: helm(b, '#8a97b2', 'cap', '#d9a94a'),
        back=(arm(sh_b, (-26, b.chest + 6), (-22, b.waist + 4), 7, '#6a7592', DSKIN, glove='#3a2618') + rot(-22, b.waist + 4, -10, W_hammer(26, '#a9b4ca', '#5a3a22')), sh_b),
        front=(arm(sh_f, (26, b.chest + 6), (20, b.waist), 7, '#6a7592', DSKIN, glove='#3a2618')
               + rot(22, b.waist - 2, 0, shape('M-15 -20 L15 -20 L15 14 Q0 26 -15 14 Z', D.vol('#5a6a8a')) + hl('M-12 -17 L12 -17 L12 12 Q0 22 -12 12 Z', '#d9a94a', 1.8, 1)
                                      + hl('M-6 -8 L0 -14 L6 -8 M0 -14 L0 10 M-6 2 L6 2', RUNE, 2.2, 1)), sh_f),
        fx=[('rune', (22, b.waist - 4), halo(22, b.waist - 4, 13, RUNE), pulse(0.6, 2.4))],
        hand=(22, b.waist - 8))

    # ——— Дорн, подмастерье: фартук, кайло, кружка эля ———
    b = Body(78, 1.4)
    sh_f, sh_b = (17, b.sh + 3), (-17, b.sh + 3)
    mug = shape('M-5 -6 L5 -6 L5 6 L-5 6 Z', '#a8682e', sw=1.8) + curve('M5 -3 Q10 -3 10 1 Q10 4 5 4', 1.4, '#a8682e') + shape('M-6 -8 Q0 -12 6 -8 L5 -5 L-5 -5 Z', '#fff4d8', sw=1.4)
    R['dorn'] = dwarf(
        'dorn', out, h=78, kind='y', beard='#c8803a', armor='#8a6a4a',
        extra_body=shape('M-10 -44 L10 -44 L11 -24 L-11 -24 Z', '#c9b48a', sw=1.8),
        headgear=lambda b: hair(b, '#c8803a', 'spiky')[1],
        back=(arm(sh_b, (-24, b.chest + 4), (-26, b.chest - 6), 6.4, None, DSKIN) + rot(-26, b.chest - 8, 0, mug), sh_b),
        front=(arm(sh_f, (24, b.chest + 6), (22, b.waist - 2), 6.4, None, DSKIN, glove='#5a3a22')
               + rot(22, b.waist - 2, 20, line([(0, 8), (0, -34)], 3, '#6b4a2b') + curve('M-14 -30 Q0 -40 14 -30', 3.4, '#a9b4ca')), sh_f),
        fx=[('foam', (-26, b.chest - 18), halo(-26, b.chest - 18, 8, '#fff4c8'), pulse(0.5, 2))],
        hand=(-26, b.chest - 16))

    # ——— Сигрун, валькирия рун: крылатый шлем, перьевые крылья, копьё, лечение ———
    b = Body(106, 1.05, True)
    sh_f, sh_b = (12, b.sh + 3), (-12, b.sh + 3)
    R['sigrun'] = humanoid(
        'sigrun', out, h=106, build_=1.05, female=True, skin='#f3d2b8', hair_style='braid', hair_c='#f0d890',
        legs_kw=dict(pants='#6a7592', boots='#3a4a6a', stance=1.4, armor=True, trim=RUNE),
        body=lambda b: skirt(b, '#3a5a8a', 0.45, 0.8, trim='#c8ccdc') + torso_f(b, '#a9b4ca', trim=RUNE, belt='#5a3a22'),
        back=[('wings', (0, b.sh), wings('feather', '#e8ecf4', 0.9, b.sh + 2), sway(3.5, 2.6, 0))],
        head_kw=dict(eye='#3a6ab0'),
        headgear=lambda b: helm(b, '#c8ccdc', 'circlet', '#c8ccdc', RUNE) + ''.join(
            shape(f'M{s * b.hr * 0.9} {b.hy - b.hr * 0.6} Q{s * b.hr * 2.4} {b.hy - b.hr * 1.6} {s * b.hr * 2.2} {b.hy - b.hr * 0.4} Q{s * b.hr * 1.6} {b.hy - b.hr * 0.6} {s * b.hr * 1.0} {b.hy - b.hr * 0.2} Z', '#f4f6fb', sw=1.6) for s in (-1, 1)),
        back_arm=(arm(sh_b, (-20, b.chest + 2), (-26, b.chest - 8), 4.8, '#a9b4ca', '#f3d2b8'), sh_b),
        front_arm=(arm(sh_f, (22, b.chest + 6), (20, b.waist - 2), 4.8, '#a9b4ca', '#f3d2b8') + rot(20, b.waist - 2, 8, W_spear(74, '#c8ccdc', RUNE, 20)), sh_f),
        fx=[('heal', (-26, b.chest - 10), halo(-26, b.chest - 10, 12, RUNE), pulse(0.6, 1.6))],
        hand=(-26, b.chest - 10), period=3.0)

    # ——— Винт, инженер: очки, ранец с трубами, гаечный ключ, маленькая турель ———
    b = Body(80, 1.35)
    sh_f, sh_b = (16, b.sh + 3), (-16, b.sh + 3)
    pack = shape(f'M-26 {b.sh - 6} L-6 {b.sh - 6} L-6 {b.waist + 4} L-26 {b.waist + 4} Z', D.vol('#8a6a4a')) + line([(-22, b.sh - 6), (-22, b.sh - 18)], 3.4, '#a9b4ca') + dot(-22, b.sh - 20, 3, '#d9a94a')
    R['vint'] = dwarf(
        'vint', out, h=80, beard='#5a3a22', armor='#6a7a5a', kind='y',
        headgear=lambda b: goggles(b, RUNE) + hair(b, '#5a3a22', 'short')[1],
        back=(arm(sh_b, (-22, b.chest + 4), (-26, b.chest - 6), 6, '#6a7a5a', DSKIN, glove='#3a2618'), sh_b),
        front=(arm(sh_f, (24, b.chest + 4), (24, b.waist - 4), 6, '#6a7a5a', DSKIN, glove='#3a2618') + rot(24, b.waist - 4, 26, W_wrench('#c8ccdc')), sh_f),
        fx=[('steam', (-22, b.sh - 24), ''.join(f'<circle cx="{-22 + i * 2}" cy="{b.sh - 26 - i * 6}" r="{3 + i}" fill="#e8ecf4" opacity=".55" stroke="none"/>' for i in range(3)), bob(2, 1.4, 0)),
            ],
        backs=[('pack', (-16, b.sh), pack, None)],
        hand=(-26, b.chest - 8))

    # ——— Горран, Сердце горы (мифический): каменный великан с кристаллами ———
    b = Body(116, 1.55)
    stone = '#8a8478'
    sh_f, sh_b = (24, b.sh + 4), (-24, b.sh + 4)
    crystals = ''.join(rot(x, y, a, shape('M-4 0 L0 -14 L4 0 L0 4 Z', D.lin('#e0fbff', RUNE), sw=1.6)) for x, y, a in ((-30, -80, -30), (-22, -84, -12), (22, -84, 12), (30, -80, 30), (-6, -116, -8), (6, -117, 10)))
    R['gorran'] = humanoid(
        'gorran', out, h=116, build_=1.55, kind='beast', skin=stone,
        legs_kw=dict(pants='#6a6458', boots='#4a463e', stance=1.7),
        body=lambda b: torso_m(b, stone, belt=None, bulk=1.2,
                               deco=hl(f'M-14 {b.sh + 10} L-6 {b.chest} L-12 {b.waist} M10 {b.sh + 8} L4 {b.chest + 6} L12 {b.hip}', '#5a564c', 2.2, 1)
                               + halo(0, b.chest, 14, RUNE) + gem(0, b.chest, 6, '#bff7ff')),
        head_kw=dict(eye=RUNE, glow_eyes=RUNE, beard='#6a6458'),
        headgear=lambda b: crystals,
        back_arm=(arm(sh_b, (-36, b.chest + 10), (-36, b.waist + 10), 10, stone, stone, glove='#6a6458'), sh_b),
        front_arm=(arm(sh_f, (38, b.chest + 8), (38, b.waist + 8), 10, stone, stone, glove='#6a6458')
                   + rot(38, b.waist + 10, 0, shape('M-6 -2 L0 -16 L6 -2 Z', D.lin('#e0fbff', RUNE), sw=1.6)), sh_f),
        fx=[('core', (0, b.chest), halo(0, b.chest, 22, RUNE), pulse(0.55, 2.6))],
        hand=(38, b.waist + 6), period=4.2, breath_amp=0.02, idle='heavy', top=124)
    return R
