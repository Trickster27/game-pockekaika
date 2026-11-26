"""Дети Вечнолиста: зелень, кора, листья, роса."""
from kit import *

LEAF = '#5fb070'
SKIN = '#f3d2b0'


def leaves(cx, cy, n, r, c, spread=1.0):
    out = ''
    for i in range(n):
        a = -math.pi / 2 + (i - (n - 1) / 2) * 0.55 * spread
        x, y = cx + math.cos(a) * r, cy + math.sin(a) * r
        out += rot(x, y, math.degrees(a) + 90, shape('M0 0 Q-4 -6 0 -12 Q4 -6 0 0 Z', D.vol(c), sw=1.4))
    return out


def bear_head(b, fur):
    cy, r = b.hy, b.hr * 1.25
    out = ''
    for s in (-1, 1):
        out += dot(s * r * 0.75, cy - r * 0.8, r * 0.38, D.vol(fur), SW) + dot(s * r * 0.75, cy - r * 0.8, r * 0.18, '#c98a6a', 1)
    out += shape(f'M{-r} {cy} Q{-r * 1.05} {cy - r * 1.1} 0 {cy - r * 1.05} Q{r * 1.05} {cy - r * 1.1} {r} {cy} Q{r * 0.9} {cy + r * 0.9} 0 {cy + r * 0.95} '
                 f'Q{-r * 0.9} {cy + r * 0.9} {-r} {cy} Z', D.vol(fur))
    out += shape(f'M{-r * 0.45} {cy + r * 0.15} Q0 {cy - r * 0.1} {r * 0.45} {cy + r * 0.15} Q{r * 0.5} {cy + r * 0.75} 0 {cy + r * 0.8} '
                 f'Q{-r * 0.5} {cy + r * 0.75} {-r * 0.45} {cy + r * 0.15} Z', '#c9a07a', sw=1.8)
    out += shape(f'M{-r * 0.18} {cy + r * 0.2} L{r * 0.18} {cy + r * 0.2} L0 {cy + r * 0.4} Z', '#2a1a10', sw=1.2)
    for s in (-1, 1):
        out += dot(s * r * 0.42, cy - r * 0.28, r * 0.13, '#9fe07a', 1.2)
    out += hl(f'M{-r * 0.6} {cy - r * 0.62} L{-r * 0.2} {cy - r * 0.5} M{r * 0.6} {cy - r * 0.62} L{r * 0.2} {cy - r * 0.5}', '#2a1a10', 1.8, 1)
    out += hl(f'M{-r * 0.3} {cy + r * 0.85} L{-r * 0.5} {cy + r * 0.3}', LEAF, 2.2, 0.9)  # боевая раскраска
    return out


def make(out):
    R = {}

    # ——— Лиэль, терновая лучница-эльфийка: лук из живой лозы ———
    b = Body(100, 1.0, True)
    sh_f, sh_b = (11, b.sh + 3), (-11, b.sh + 3)
    R['elf'] = humanoid(
        'elf', out, female=True, skin=SKIN, hair_style='braid', hair_c='#9be07a',
        legs_kw=dict(pants='#3f6a3a', boots='#5a3a22', stance=1.5, knee=1, trim=LEAF),
        body=lambda b: skirt(b, '#4f8a46', 0.3, 0.6, tattered=True) + torso_f(b, '#6aa85a', trim='#c9e0a0', belt='#5a3a22',
                                                                              deco=leaves(0, b.chest - 6, 3, 4, '#9be07a')),
        back=[('cape', (0, b.sh), cape(b, '#3f6a3a', 0.6, 0.6, tattered=True), sway(3, 2.6, 0.5))],
        head_kw=dict(eye='#3f8a3a', ears=True),
        headgear=lambda b: leaves(0, b.hy - b.hr * 0.9, 5, 3, LEAF, 1.2),
        back_arm=(arm(sh_b, (-4, b.chest + 4), (4, b.chest - 2), 4.6, None, SKIN, cuff=LEAF), sh_b),
        front_arm=(arm(sh_f, (18, b.chest), (22, b.chest - 2), 4.6, None, SKIN, cuff=LEAF)
                   + rot(22, b.chest - 2, 0, W_bow(54, '#5a8a3a', '#e8e0c8', True, '#9be07a'))
                   + leaves(28, b.chest - 26, 2, 2, LEAF) + leaves(28, b.chest + 22, 2, 2, LEAF), sh_f),
        fx=[('arrowGlow', (53, b.chest - 2), halo(53, b.chest - 2, 8, '#9be07a'), pulse(0.7, 1.4))],
        hand=(53, b.chest - 2), period=2.8)

    # ——— Сайра, Ветрогон: летящие ленты, посох с перьями, ветер вокруг ———
    b = Body(100, 1.0, True)
    sh_f, sh_b = (11, b.sh + 3), (-11, b.sh + 3)
    wind = ''.join(hl(f'M{-40 + i * 6} {b.waist + 22 - i * 16} Q{-30 + i * 10} {b.waist + 10 - i * 16} {-18 + i * 6} {b.waist + 18 - i * 16}', '#e8fff0', 1.8, 0.55) for i in range(3))
    R['saira'] = humanoid(
        'saira', out, female=True, skin=SKIN, hair_style='wild', hair_c='#e8f0d0',
        legs_kw=dict(pants='#d8e8c8', boots='#8a6a4a', stance=1.2),
        body=lambda b: skirt(b, '#f2f6e8', 0.55, 1.2, slit=True, trim='#7fd08a') + torso_f(b, '#9fd0a0', trim='#ffffff', skin=SKIN, belt='#7fd08a'),
        back=[('ribbons', (0, b.sh), curve(f'M-8 {b.sh} Q-30 {b.sh + 10} -44 {b.sh - 6} Q-52 {b.sh - 14} -50 {b.sh - 26}', 4, '#7fd08a')
               + curve(f'M8 {b.sh} Q32 {b.sh + 14} 46 {b.sh + 2} Q54 {b.sh - 4} 52 {b.sh - 18}', 4, '#bff7d0'), sway(6, 1.8, 0))],
        head_kw=dict(eye='#3fa08a'),
        headgear=lambda b: leaves(-b.hr * 0.9, b.hy - b.hr * 0.4, 3, 4, '#ffffff'),
        back_arm=(arm(sh_b, (-20, b.chest - 4), (-26, b.sh - 8), 4.6, None, SKIN, cuff='#7fd08a'), sh_b),
        front_arm=(arm(sh_f, (20, b.chest + 4), (22, b.waist - 4), 4.6, None, SKIN, cuff='#7fd08a')
                   + rot(22, b.waist - 4, 10, W_staff(62, '#c9b48a', '#e8fff0', 'crescent'))
                   + leaves(22 + 11, b.waist - 66, 3, 5, '#ffffff'), sh_f),
        fx=[('wind', (0, b.waist), wind, sway(4, 1.6, 0)), ('palm', (-26, b.sh - 8), halo(-26, b.sh - 10, 10, '#e8fff0'), pulse(0.6, 1.5))],
        hand=(-26, b.sh - 10), period=2.6, hair_sway=6)

    # ——— Тирн, древесный страж: тело из коры, руки-ветви, листва на голове ———
    b = Body(112, 1.35)
    bark = '#6b4a2b'
    sh_f, sh_b = (21, b.sh + 4), (-21, b.sh + 4)
    R['tirn'] = humanoid(
        'tirn', out, h=112, build_=1.35, kind='beast', skin='#8a6a42',
        legs_kw=dict(pants=bark, boots='#4a3220', stance=1.6),
        body=lambda b: torso_m(b, '#7a5a34', belt=None, bulk=1.1,
                               deco=hl(f'M-10 {b.sh + 8} Q-4 {b.waist} -12 {b.hip} M6 {b.sh + 6} Q12 {b.chest} 4 {b.hip} M-2 {b.chest} L4 {b.waist}', '#4a3220', 2.2, 1)
                               + leaves(-12, b.chest - 2, 2, 4, LEAF) + halo(0, b.chest + 4, 8, '#9be07a') + dot(0, b.chest + 4, 3, '#c9f0a0', 1.4)),
        head_kw=dict(eye='#c9f0a0', glow_eyes='#c9f0a0', beard='#5f8a46'),
        headgear=lambda b: hl(f'M{-b.hr * 0.8} {b.hy - b.hr * 0.6} Q{-b.hr * 0.5} {b.hy} {-b.hr * 0.85} {b.hy + b.hr * 0.4} M{b.hr * 0.75} {b.hy - b.hr * 0.7} Q{b.hr * 0.4} {b.hy - b.hr * 0.1} {b.hr * 0.8} {b.hy + b.hr * 0.3} M{-b.hr * 0.2} {b.hy - b.hr * 0.9} L{-b.hr * 0.1} {b.hy - b.hr * 0.45}', '#4a3220', 1.8, 1)
        + dot(-b.hr * 0.42, b.hy - b.hr * 0.05, b.hr * 0.3, '#3a2618', 1.4) + dot(b.hr * 0.42, b.hy - b.hr * 0.05, b.hr * 0.3, '#3a2618', 1.4)
        + dot(-b.hr * 0.42, b.hy - b.hr * 0.05, b.hr * 0.16, '#c9f0a0', 0) + dot(b.hr * 0.42, b.hy - b.hr * 0.05, b.hr * 0.16, '#c9f0a0', 0)
        + leaves(0, b.hy - b.hr * 0.4, 7, b.hr * 0.9, LEAF, 1.1) + leaves(0, b.hy - b.hr * 0.9, 5, b.hr * 0.6, '#8fd07a', 1.0),
        back_arm=(arm(sh_b, (-32, b.chest + 8), (-30, b.waist + 6), 8, bark, bark)
                  + curve(f'M-30 {b.waist + 6} Q-38 {b.waist + 12} -36 {b.waist + 20}', 2.6, bark) + leaves(-36, b.waist + 22, 2, 3, LEAF), sh_b),
        front_arm=(arm(sh_f, (32, b.chest + 6), (30, b.waist + 4), 8, bark, bark)
                   + rot(30, b.waist + 6, 0, W_shield_round(15, '#5a3a22', '#9be07a', '#8a6a42', LEAF)), sh_f),
        hand=(30, b.waist + 4), period=4.0, breath_amp=0.022, hair_sway=0, idle='heavy', top=118)

    # ——— Ивушка, дриада ручья: платье из листьев, капля росы в ладонях ———
    b = Body(88, 0.92, True)
    sh_f, sh_b = (10, b.sh + 3), (-10, b.sh + 3)
    R['ivy'] = humanoid(
        'ivy', out, h=88, build_=0.92, female=True, kind='y', skin='#d6f0c8', hair_style='long', hair_c='#5fb070',
        legs_kw=dict(pants=None, boots='#5fb070', skin='#d6f0c8'),
        body=lambda b: skirt(b, '#7fd08a', 0.75, 1.1, tattered=True, trim='#4fd6e0') + torso_f(b, '#7fd08a', trim='#d6f0c8', bust=0.7,
                                                                                               deco=leaves(0, b.chest + 2, 3, 3, '#5fb070')),
        head_kw=dict(eye='#2f8a96', lips='#e0607a'),
        headgear=lambda b: leaves(0, b.hy - b.hr * 0.9, 5, 3, '#9be07a', 1.3) + dot(b.hr * 0.7, b.hy - b.hr * 0.8, 2.2, '#ffb0d0', 1.2),
        back_arm=(arm(sh_b, (-14, b.chest + 6), (-4, b.waist - 4), 4, None, '#d6f0c8'), sh_b),
        front_arm=(arm(sh_f, (14, b.chest + 6), (4, b.waist - 6), 4, None, '#d6f0c8'), sh_f),
        fx=[('drop', (0, b.waist - 10), halo(0, b.waist - 12, 11, '#4fd6e0') + shape(f'M0 {b.waist - 20} Q6 {b.waist - 12} 0 {b.waist - 7} Q-6 {b.waist - 12} 0 {b.waist - 20} Z', '#9ff0ff', sw=1.6), bob(1.5, 2.2, 0))],
        hand=(0, b.waist - 12), period=3.0, hair_sway=4)

    # ——— Ольха, друид-медведица: мощная фигура, медвежья голова, когти, раскраска ———
    b = Body(108, 1.5)
    fur = '#7a5a3a'
    sh_f, sh_b = (22, b.sh + 4), (-22, b.sh + 4)
    R['olkha'] = humanoid(
        'olkha', out, h=108, build_=1.5, kind='beast', skin=fur,
        legs_kw=dict(pants=fur, boots='#4a3220', stance=1.6),
        body=lambda b: torso_m(b, fur, belt='#3f6a3a', buckle='#9be07a', bulk=1.15,
                               deco=shape(f'M-12 {b.chest - 6} Q0 {b.chest + 2} 12 {b.chest - 6} Q14 {b.waist} 0 {b.waist + 6} Q-14 {b.waist} -12 {b.chest - 6} Z', '#c9a07a', sw=1.8)
                               + leaves(-16, b.sh + 6, 3, 4, LEAF) + hl(f'M-14 {b.sh + 10} L-6 {b.chest} M14 {b.sh + 10} L6 {b.chest}', LEAF, 2.4, 0.9)),
        head_kw=None, blink_p=0,
        headgear=lambda b: bear_head(b, fur) + leaves(0, b.hy - b.hr * 1.3, 3, 3, LEAF),
        back_arm=(arm(sh_b, (-34, b.chest + 8), (-34, b.waist + 6), 9, fur, fur)
                  + ''.join(line([(-38 + i * 3.4, b.waist + 10), (-40 + i * 3.4, b.waist + 15)], 1.6, '#f4ead2') for i in range(3)), sh_b),
        front_arm=(arm(sh_f, (36, b.chest + 2), (40, b.chest - 12), 9, fur, fur)
                   + ''.join(line([(36 + i * 3.4, b.chest - 16), (38 + i * 3.4, b.chest - 24)], 1.8, '#f4ead2') for i in range(3)), sh_f),
        fx=[('aura', (0, b.chest), halo(0, b.chest, 30, '#5fb070'), pulse(0.6, 3))],
        hand=(40, b.chest - 16), period=3.6, breath_amp=0.025, idle='heavy', top=114)

    # ——— Фью, фея-светлячок: крошечная, крылышки, фонарик-светлячок ———
    b = Body(62, 0.8, True)
    sh_f, sh_b = (7, b.sh + 2), (-7, b.sh + 2)
    R['fyu'] = humanoid(
        'fyu', out, h=62, build_=0.8, female=True, kind='y', skin='#fff0d8', hair_style='bob', hair_c='#ffd36b',
        legs_kw=dict(pants=None, boots='#7fd08a', skin='#fff0d8'),
        body=lambda b: skirt(b, '#bff07a', 0.4, 1.2, tattered=True) + torso_f(b, '#9be07a', trim='#fff4c8', bust=0.4),
        back=[('wings', (0, b.sh), wings('fairy', '#bff7ff', 0.8, b.sh), sway(10, 0.5, 0))],
        head_kw=dict(eye='#3fa08a'),
        headgear=lambda b: curve(f'M-3 {b.hy - b.hr} Q-6 {b.hy - b.hr * 2} -10 {b.hy - b.hr * 2.1} M3 {b.hy - b.hr} Q6 {b.hy - b.hr * 2} 10 {b.hy - b.hr * 2.1}', 1, '#3a2a1a')
        + dot(-10, b.hy - b.hr * 2.1, 2, '#fff4c8', 1) + dot(10, b.hy - b.hr * 2.1, 2, '#fff4c8', 1),
        back_arm=(arm(sh_b, (-12, b.chest), (-16, b.sh - 4), 3, None, '#fff0d8'), sh_b),
        front_arm=(arm(sh_f, (13, b.chest), (17, b.sh - 4), 3, None, '#fff0d8'), sh_f),
        fx=[('light', (0, b.hy), halo(0, b.waist, 20, '#fff0b8') + halo(-16, b.sh - 6, 8, '#fff4c8') + halo(17, b.sh - 6, 8, '#fff4c8'), pulse(0.5, 1.2))],
        hand=(17, b.sh - 6), period=1.6, idle='float', top=70, breath_amp=0.02)

    # ——— Ирэн, звёздная лучница: тёмно-синий плащ со звёздами, серебряный лук ———
    b = Body(100, 1.0, True)
    sh_f, sh_b = (11, b.sh + 3), (-11, b.sh + 3)
    stars = ''.join(gem(x, y, 1.8, '#fff4c8') for x, y in ((-20, -50), (-12, -30), (16, -40), (22, -20), (-26, -16)))
    R['iren'] = humanoid(
        'iren', out, female=True, skin=SKIN, hair_style='long', hair_c='#c8ccf0',
        legs_kw=dict(pants='#2a3a6a', boots='#c8ccdc', stance=1.5, knee=1),
        body=lambda b: torso_f(b, '#3a4a8a', trim='#c8ccf0', belt='#c8ccdc', deco=gem(0, b.chest + 9, 2.4, '#fff4c8')),
        back=[('cape', (0, b.sh), cape(b, '#1f2a5a', 0.9, 0.9, inner='#c8ccf0') + stars, sway(2.4, 3, 0.5))],
        head_kw=dict(eye='#7fb8ff', ears=True),
        headgear=lambda b: helm(b, '#c8ccdc', 'circlet', '#c8ccdc', '#7fb8ff'),
        back_arm=(arm(sh_b, (-4, b.chest + 2), (4, b.chest - 4), 4.6, '#3a4a8a', SKIN), sh_b),
        front_arm=(arm(sh_f, (18, b.chest - 2), (22, b.chest - 4), 4.6, '#3a4a8a', SKIN)
                   + rot(22, b.chest - 4, 0, W_bow(56, '#c8ccdc', '#bff7ff', True, '#fff4c8')), sh_f),
        fx=[('star', (54, b.chest - 4), halo(54, b.chest - 4, 9, '#fff4c8') + gem(54, b.chest - 4, 3, '#ffffff'), pulse(0.6, 1.3))],
        hand=(54, b.chest - 4), period=3.0)

    # ——— Вердис, Древо мира (мифическая): корона из ветвей, платье-кора с листвой ———
    b = Body(110, 1.05, True)
    sh_f, sh_b = (12, b.sh + 3), (-12, b.sh + 3)
    crown = curve(f'M-6 {b.hy - 10} Q-16 {b.hy - 28} -26 {b.hy - 32} M-4 {b.hy - 11} Q-6 {b.hy - 30} -12 {b.hy - 40} M6 {b.hy - 10} Q16 {b.hy - 28} 26 {b.hy - 32} M4 {b.hy - 11} Q6 {b.hy - 30} 12 {b.hy - 40}', 2.6, '#6b4a2b')
    crown += leaves(-26, b.hy - 34, 3, 4, LEAF) + leaves(26, b.hy - 34, 3, 4, LEAF) + leaves(-12, b.hy - 42, 2, 3, '#9be07a') + leaves(12, b.hy - 42, 2, 3, '#9be07a')
    R['verdis'] = humanoid(
        'verdis', out, h=110, build_=1.05, female=True, skin='#e0f0c8', hair_style='long', hair_c='#3f8a46',
        legs_kw=dict(pants=None, boots='#6b4a2b', skin='#e0f0c8'),
        body=lambda b: skirt(b, '#5a4028', 0.97, 1.6, trim='#9be07a', tattered=True) + torso_f(b, '#7a5a34', trim='#9be07a', skin='#e0f0c8',
                                                                                              deco=leaves(0, b.chest - 4, 5, 5, LEAF, 0.9)),
        back=[('roots', (0, 0), curve('M-20 0 Q-40 -4 -52 4 M20 0 Q40 -4 52 4 M-10 -2 Q-24 -10 -34 -6', 3, '#6b4a2b'), None),
              ('aura', (0, b.chest), halo(0, b.chest - 6, 44, '#9be07a'), pulse(0.5, 3.2))],
        head_kw=dict(eye='#5fb070', mark='#9be07a'),
        headgear=lambda b: crown,
        back_arm=(arm(sh_b, (-20, b.chest + 4), (-24, b.waist - 6), 4.8, None, '#e0f0c8', cuff='#6b4a2b'), sh_b),
        front_arm=(arm(sh_f, (22, b.chest + 2), (24, b.waist - 6), 4.8, None, '#e0f0c8', cuff='#6b4a2b')
                   + rot(24, b.waist - 6, 8, W_staff(70, '#6b4a2b', '#9be07a', 'claw')) + leaves(24 + 10, b.waist - 78, 4, 6, LEAF), sh_f),
        fx=[('orb', (34, b.waist - 75), halo(34, b.waist - 75, 12, '#9be07a'), pulse(0.6, 1.8))],
        hand=(34, b.waist - 75), period=3.6, top=120, hair_sway=3)
    return R
