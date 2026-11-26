"""Горнило Бездны: огонь, обсидиан, рога и перепончатые крылья."""
from kit import *

EMBER = '#ff7a2a'
DEMON = '#c8483a'


def flames(cx, cy, n, r, c1='#ffb02a', c2='#ff5a1a'):
    out = ''
    for i in range(n):
        x = cx + (i - (n - 1) / 2) * r * 0.7
        h = r * (1.6 if i % 2 else 1.1)
        out += shape(f'M{fmt(x - r * 0.4)} {fmt(cy)} Q{fmt(x - r * 0.4)} {fmt(cy - h * 0.6)} {fmt(x)} {fmt(cy - h)} Q{fmt(x + r * 0.4)} {fmt(cy - h * 0.6)} {fmt(x + r * 0.4)} {fmt(cy)} Z',
                     D.lin(c1, c2), sw=1.4)
    return out


def make(out):
    R = {}

    # ——— Кхаррас, Князь пепла: рогатый демон, крылья, когти, пылающая грива ———
    b = Body(110, 1.3)
    sh_f, sh_b = (20, b.sh + 4), (-20, b.sh + 4)
    R['demon'] = humanoid(
        'demon', out, h=110, build_=1.3, kind='m', skin=DEMON, hair_style='wild', hair_c='#ffb02a',
        legs_kw=dict(pants='#3a1a1a', boots='#1a0c0c', stance=1.6, armor=True, trim=EMBER),
        body=lambda b: torso_m(b, DEMON, belt='#2a0c0c', buckle=EMBER, bulk=1.1,
                               deco=hl(f'M-10 {b.sh + 8} Q0 {b.sh + 14} 10 {b.sh + 8} M-8 {b.chest + 4} L8 {b.chest + 4} M-7 {b.waist - 4} L7 {b.waist - 4}', '#8a2020', 2, 1)
                               + hl(f'M-4 {b.chest - 4} L0 {b.chest + 8} L4 {b.chest - 4}', '#ffd36b', 1.6, 0.9)),
        back=[('wings', (0, b.sh), wings('bat', '#5a1a1a', 1.0, b.sh + 2, membrane='#8a2a2a'), sway(4, 2.0, 0))],
        head_kw=dict(eye='#ffd36b', glow_eyes='#ffd36b'),
        headgear=lambda b: horns(b, '#2a1a1a', 'curl', 1.25),
        back_arm=(pauldron(-20, b.sh + 4, 9, '#2a1a1a', 3, -1) + arm(sh_b, (-30, b.chest + 8), (-32, b.waist + 2), 7, DEMON, DEMON)
                  + ''.join(line([(-36 + i * 3, b.waist + 5), (-38 + i * 3, b.waist + 11)], 1.6, '#1a0c0c') for i in range(3)), sh_b),
        front_arm=(pauldron(20, b.sh + 4, 9, '#2a1a1a', 3, 1) + arm(sh_f, (32, b.chest + 2), (36, b.chest - 12), 7, DEMON, DEMON)
                   + ''.join(line([(32 + i * 3, b.chest - 15), (34 + i * 3, b.chest - 22)], 1.8, '#1a0c0c') for i in range(3)), sh_f),
        fx=[('fire', (36, b.chest - 26), halo(36, b.chest - 26, 14, EMBER) + flames(36, b.chest - 18, 3, 5), pulse(0.45, 0.9))],
        hand=(36, b.chest - 26), period=2.8, top=118)

    # ——— Сирра, огненный хлыст: бывшая надсмотрщица — кожа, шипы, хлыст из пламени ———
    b = Body(102, 1.0, True)
    sh_f, sh_b = (11, b.sh + 3), (-11, b.sh + 3)
    R['sirra'] = humanoid(
        'sirra', out, h=102, female=True, skin='#e8a088', hair_style='pony', hair_c='#2a0c12',
        legs_kw=dict(pants='#2a1218', boots='#1a0a0e', stance=1.5, heels=True, trim=EMBER),
        body=lambda b: skirt(b, '#3a1218', 0.3, 0.8, slit=True, trim=EMBER) + torso_f(b, '#5a1a22', trim=EMBER, skin='#e8a088', belt='#1a0a0e',
                                                                                     deco=hl(f'M0 {b.chest + 8} L0 {b.waist}', EMBER, 1.4, 0.9)),
        back=[('tail', (-4, b.hip), tail('devil', '#5a1a22', -4, b.hip, -1, EMBER), sway(8, 1.8, 0.4))],
        head_kw=dict(eye='#ffb02a', lips='#a01a2a'),
        headgear=lambda b: horns(b, '#2a0c12', 'straight', 0.8),
        back_arm=(arm(sh_b, (-18, b.chest + 6), (-12, b.waist + 2), 4.6, None, '#e8a088', glove='#1a0a0e'), sh_b),
        front_arm=(pauldron(13, b.sh + 2, 6, '#2a0c12', 3, 1) + arm(sh_f, (22, b.chest), (28, b.chest - 12), 4.6, None, '#e8a088', glove='#1a0a0e')
                   + rot(28, b.chest - 12, 20, W_whip('#ff5a1a', '#ffd36b')), sh_f),
        fx=[('lash', (48, b.chest - 74), halo(52, b.chest - 76, 10, EMBER), pulse(0.6, 0.8))],
        hand=(52, b.chest - 76), period=2.6)

    # ——— Азгар, чернокнижник: капюшон, раскрытый гримуар, глаз-фамильяр ———
    b = Body(100, 1.0)
    sh_f, sh_b = (14, b.sh + 3), (-14, b.sh + 3)
    eye = halo(-30, b.sh - 18, 14, '#a37cff') + dot(-30, b.sh - 18, 7, '#efe6cf', 1.8) + dot(-30, b.sh - 18, 3.6, '#a37cff', 1) + dot(-30, b.sh - 18, 1.6, OUT_LINE, 0)
    eye += ''.join(curve(f'M{-30 + s * 6} {b.sh - 14} Q{-30 + s * 10} {b.sh - 4} {-30 + s * 6} {b.sh + 4}', 1.4, '#5a3a90') for s in (-1, 1))
    R['azgar'] = humanoid(
        'azgar', out, skin='#c8a8a0', hair_style=None,
        legs_kw=dict(pants='#2a1a3a', boots='#1a0c1a'),
        body=lambda b: robe(b, '#3a1a4a', trim='#a37cff', open_front='#1a0c1a', hem_y=-2)
        + torso_m(b, '#4a2a5a', belt='#1a0c1a', buckle='#a37cff', deco=gem(0, b.chest, 3, '#a37cff')),
        head_kw=dict(eye='#a37cff', glow_eyes='#c79cff', beard='#2a1a2a', age=1),
        headgear=lambda b: helm(b, '#2a1a3a', 'hood') + horns(b, '#1a0c1a', 'straight', 0.7),
        back=[('familiar', (-30, b.sh - 18), eye, bob(3, 2.4, 0))],
        back_arm=(arm(sh_b, (-22, b.chest + 2), (-26, b.chest - 8), 5, '#4a2a5a', '#c8a8a0'), sh_b),
        front_arm=(arm(sh_f, (22, b.chest + 6), (20, b.waist - 6), 5, '#4a2a5a', '#c8a8a0') + rot(20, b.waist - 8, -10, W_book('#3a1a2a', '#c79cff')), sh_f),
        fx=[('book', (20, b.waist - 16), halo(20, b.waist - 18, 12, '#a37cff') + ''.join(gem(14 + i * 6, b.waist - 26 - i * 4, 1.6, '#c79cff') for i in range(3)), pulse(0.5, 1.5))],
        hand=(-30, b.sh - 18), period=3.2)

    # ——— Чирк, бес-проказник: маленький, большие уши, вилы, хвост, ухмылка ———
    b = Body(66, 1.0)
    sh_f, sh_b = (9, b.sh + 2), (-9, b.sh + 2)
    R['chirk'] = humanoid(
        'chirk', out, h=66, kind='y', skin='#e0604a', hair_style=None,
        legs_kw=dict(pants='#e0604a', boots='#3a1a10', stance=1.6),
        body=lambda b: torso_m(b, '#e0604a', belt='#5a3a22', buckle='#ffd36b',
                               deco=shape(f'M-8 {b.hip} L8 {b.hip} L9 {b.hip + 8} L-9 {b.hip + 8} Z', '#6b4a2b', sw=1.6)),
        back=[('tail', (-3, b.hip), tail('devil', '#e0604a', -3, b.hip, -1, '#3a1a10'), sway(12, 1.2, 0))],
        head_kw=dict(eye='#ffd84a', ears=True),
        headgear=lambda b: horns(b, '#3a1a10', 'curl', 0.7) + hl(f'M{-b.hr * 0.5} {b.hy + b.hr * 0.6} Q0 {b.hy + b.hr * 0.95} {b.hr * 0.6} {b.hy + b.hr * 0.5}', OUT_LINE, 1.6, 1)
        + shape(f'M{b.hr * 0.2} {b.hy + b.hr * 0.75} L{b.hr * 0.32} {b.hy + b.hr * 0.95} L{b.hr * 0.42} {b.hy + b.hr * 0.72} Z', '#ffffff', sw=0.8),
        back_arm=(arm(sh_b, (-14, b.chest + 4), (-16, b.waist + 4), 3.6, None, '#e0604a'), sh_b),
        front_arm=(arm(sh_f, (15, b.chest + 2), (16, b.waist - 2), 3.6, None, '#e0604a')
                   + rot(16, b.waist - 2, 24, line([(0, 10), (0, -40)], 2.4, '#6b4a2b') + curve('M-5 -36 L-5 -46 M0 -38 L0 -50 M5 -36 L5 -46 M-5 -38 L5 -38', 1.8, '#a9b4ca')), sh_f),
        fx=[('spark', (34, b.waist - 46), halo(36, b.waist - 46, 8, EMBER), pulse(0.7, 0.7))],
        hand=(36, b.waist - 46), period=1.8, idle='bob', top=74)

    # ——— Скарн, Владыка Пепла (слияние): обсидиановые латы, рога-корона, огромный топор ———
    b = Body(112, 1.35)
    sh_f, sh_b = (21, b.sh + 4), (-21, b.sh + 4)
    lava = ''.join(hl(f'M{x} {y} L{x + 3} {y + 6} L{x - 1} {y + 11}', '#ff9a3a', 1.6, 1) for x, y in ((-12, -72), (10, -64), (-6, -56), (14, -80)))
    R['skarn'] = humanoid(
        'skarn', out, h=112, build_=1.35, kind='m', skin='#5a2a2a',
        legs_kw=dict(pants='#2a1a1e', boots='#120a0c', stance=1.7, armor=True, trim=EMBER),
        body=lambda b: torso_m(b, '#2a1a1e', belt='#120a0c', buckle=EMBER, bulk=1.15, deco=lava + halo(0, b.chest, 10, EMBER) + gem(0, b.chest, 4, '#ffb02a')),
        back=[('cape', (0, b.sh), cape(b, '#3a0c0c', 1.0, 1.3, inner=EMBER, tattered=True), sway(2.4, 3.2, 0.6)),
              ('embers', (0, b.chest), flames(-30, b.hip, 3, 6) + flames(30, b.hip, 3, 6), pulse(0.4, 0.8))],
        head_kw=dict(eye='#ffb02a', glow_eyes='#ffb02a'),
        headgear=lambda b: helm(b, '#2a1a1e', 'knight', EMBER, '#ffb02a') + horns(b, '#120a0c', 'curl', 1.5) + flames(0, b.hy - b.hr * 1.4, 3, 4),
        back_arm=(pauldron(-21, b.sh + 4, 10, '#2a1a1e', 3, -1) + arm(sh_b, (-30, b.chest + 8), (-28, b.waist + 4), 7.4, '#2a1a1e', '#5a2a2a', glove='#120a0c'), sh_b),
        front_arm=(pauldron(21, b.sh + 4, 10, '#2a1a1e', 3, 1) + arm(sh_f, (32, b.chest + 6), (28, b.waist - 6), 7.4, '#2a1a1e', '#5a2a2a', glove='#120a0c')
                   + rot(28, b.waist - 6, 16, W_axe(58, '#a89a9e', '#2a1a1e', True)), sh_f),
        fx=[('edge', (44, b.waist - 60), halo(46, b.waist - 60, 16, EMBER), pulse(0.55, 1.1))],
        hand=(46, b.waist - 60), period=3.4, top=124, idle='heavy')
    return R
