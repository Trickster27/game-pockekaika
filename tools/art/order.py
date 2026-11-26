"""Орден Рассветного Щита: свет, золото, белый и синий."""
from kit import *

GOLD = '#f0c860'
SKIN = '#f3c9a8'
SKIN_D = '#e0ac8a'


def make(out):
    R = {}

    # ——— Селеста, слепая Жрица Зари: повязка на глазах, нимб, солнечный посох ———
    b = Body(100, 1.0, True)
    sh_f, sh_b = (11, b.sh + 3), (-11, b.sh + 3)
    R['selesta'] = humanoid(
        'selesta', out, female=True, skin=SKIN, hair_style='long', hair_c='#f6e7b8',
        legs_kw=dict(pants=None, boots='#e8dcc0', skin=SKIN),
        body=lambda b: robe(b, '#fbf6ea', trim=GOLD, open_front='#f0d890') + torso_f(b, '#fbf6ea', trim=GOLD, belt=GOLD),
        head_kw=dict(eye='#6a90d0'),
        headgear=lambda b: shape(f'M{-b.hr * 1.05} {b.hy - 2} L{b.hr * 1.05} {b.hy - 2} L{b.hr * 1.0} {b.hy + 3} L{-b.hr * 1.0} {b.hy + 3} Z', '#fffaf0', sw=1.6)
        + hl(f'M{-b.hr} {b.hy + 0.5} L{b.hr} {b.hy + 0.5}', GOLD, 1.2, 1) + helm(b, GOLD, 'circlet', GOLD, '#fff4c8'),
        back=[('halo', (0, b.hy), halo(0, b.hy - 2, 20, '#fff0b8') + f'<circle cx="0" cy="{b.hy - 2}" r="15" fill="none" stroke="{GOLD}" stroke-width="2.2"/>', pulse(0.4, 2.6))],
        back_arm=(arm(sh_b, (-17, b.chest + 6), (-10, b.waist + 2), 5, '#fbf6ea', SKIN, cuff=GOLD), sh_b),
        front_arm=(arm(sh_f, (20, b.chest + 2), (24, b.waist - 2), 5, '#fbf6ea', SKIN, cuff=GOLD)
                   + rot(24, b.waist - 2, 6, W_staff(66, '#e8dcc0', '#fff4c8', 'sun')), sh_f),
        fx=[('staffGlow', (24 + 6.9, b.waist - 67), halo(24 + 6.9, b.waist - 67.5, 12, '#fff0b8'), pulse(0.6, 1.8))],
        hand=(31, b.waist - 66), period=3.4, blink_p=0)

    # ——— Мирна, копейщица из утонувшего порта: хвост, бирюзовый плащ, длинное копьё ———
    b = Body(100, 1.0, True)
    sh_f, sh_b = (11, b.sh + 3), (-11, b.sh + 3)
    R['mirna'] = humanoid(
        'mirna', out, female=True, skin=SKIN, hair_style='pony', hair_c='#3a4a6a',
        legs_kw=dict(pants='#4a5a80', boots='#2e3448', stance=1.6, knee=1, armor=True),
        body=lambda b: skirt(b, '#2f8a96', 0.35, 0.7, trim='#d9a94a') + torso_f(b, '#9fb0cc', trim='#4fd6e0', belt='#5a3a22',
                                                                                  deco=hl(f'M0 {b.chest - 4} L0 {b.waist}', '#4fd6e0', 1.2, 0.9)),
        back=[('cape', (0, b.sh), cape(b, '#2f8a96', 0.75, 0.7, inner='#7fe7ff'), sway(2.5, 2.8, 0.6))],
        head_kw=dict(eye='#2f8a96'),
        back_arm=(arm(sh_b, (-20, b.chest + 4), (-14, b.waist - 6), 5, '#9fb0cc', SKIN, glove='#4a5470'), sh_b),
        front_arm=(arm(sh_f, (20, b.chest + 6), (16, b.waist), 5, '#9fb0cc', SKIN, glove='#4a5470')
                   + rot(16, b.waist, 32, W_spear(78, '#6b4a2b', '#bff7ff', 26))
                   + rot(-14, b.waist - 6, 32, ''), sh_f),
        fx=[('tip', (16 + 39, b.waist - 62), halo(16 + 38.5, b.waist - 62, 7, '#7fe7ff'), pulse(0.7, 1.5))],
        hand=(56, b.waist - 62), period=2.8)

    # ——— Рихт, юный оруженосец: вихры, простая туника, короткий меч и баклер ———
    b = Body(90, 0.95)
    sh_f, sh_b = (13, b.sh + 3), (-13, b.sh + 3)
    R['rikht'] = humanoid(
        'rikht', out, h=90, build_=0.95, kind='y', skin=SKIN, hair_style='spiky', hair_c='#b8743a',
        legs_kw=dict(pants='#6b5a8a', boots='#5a3a22', stance=1.3),
        body=lambda b: torso_m(b, '#c9b48a', collar='#8a6a4a',
                               deco=shape(f'M-8 {b.sh + 2} L8 {b.sh + 2} L9 {b.hip} L-9 {b.hip} Z', '#3e5aa8', sw=1.8)
                               + hl(f'M0 {b.sh + 6} L0 {b.hip - 2} M-6 {b.chest} L6 {b.chest}', GOLD, 2, 1)),
        head_kw=dict(eye='#4a6a3a'),
        back_arm=(arm(sh_b, (-20, b.chest + 6), (-22, b.waist + 2), 5, '#c9b48a', SKIN)
                  + rot(-24, b.waist + 2, -10, W_shield_round(11, '#8a5a32', '#c8ccdc', '#a9b4ca')), sh_b),
        front_arm=(arm(sh_f, (22, b.chest + 2), (26, b.waist - 6), 5, '#c9b48a', SKIN, glove='#6b4a2b')
                   + rot(26, b.waist - 6, 28, W_sword(30, '#dfe5ef', '#a9b4ca', '#6b4a2b')), sh_f),
        hand=(42, b.waist - 34), period=2.6)

    # ——— Валерия, Паладин зари: латы, знамя-плащ, огромный освящённый молот ———
    b = Body(100, 1.05, True)
    sh_f, sh_b = (12, b.sh + 3), (-12, b.sh + 3)
    R['valeria'] = humanoid(
        'valeria', out, female=True, build_=1.05, skin=SKIN, hair_style='long', hair_c='#d9a94a',
        legs_kw=dict(pants='#b8c4dc', boots='#6a7592', stance=1.4, armor=True, trim=GOLD),
        body=lambda b: skirt(b, '#fbf6ea', 0.5, 0.6, trim=GOLD) + torso_f(b, '#c8d2e6', trim=GOLD, belt='#7a1f2a', bust=0.95,
                                                                            deco=dot(0, b.chest + 9, 3.2, '#fff4c8', 1.4)),
        back=[('cape', (0, b.sh), cape(b, '#c8343c', 0.95, 1.0, inner=GOLD), sway(2.2, 3.2, 0.6))],
        head_kw=dict(eye='#3a6ab0'),
        headgear=lambda b: helm(b, GOLD, 'circlet', GOLD, '#fff4c8'),
        back_arm=(arm(sh_b, (-20, b.chest + 2), (-16, b.waist - 4), 5.5, '#c8d2e6', SKIN, glove='#8592ae')
                  + pauldron(-14, b.sh + 3, 7, '#dfe5ef', 0, -1), sh_b),
        front_arm=(pauldron(14, b.sh + 3, 7, '#dfe5ef', 0, 1) + arm(sh_f, (22, b.chest + 4), (20, b.waist - 2), 5.5, '#c8d2e6', SKIN, glove='#8592ae')
                   + rot(20, b.waist - 2, 18, W_hammer(52, '#f2ead8', '#6b4a2b', '#f0c860')), sh_f),
        fx=[('hammerGlow', (37, b.waist - 52), halo(37, b.waist - 52, 13, '#fff0b8'), pulse(0.6, 2.0))],
        hand=(37, b.waist - 52), period=3.2)

    # ——— Тобиас, болтливый арбалетчик: капюшон, колчан, арбалет наизготовку ———
    b = Body(98, 1.0)
    sh_f, sh_b = (14, b.sh + 3), (-14, b.sh + 3)
    R['tobias'] = humanoid(
        'tobias', out, h=98, skin=SKIN_D, hair_style='short', hair_c='#5a3a22',
        legs_kw=dict(pants='#6a5a4a', boots='#3a2618', stance=1.5, knee=1),
        body=lambda b: torso_m(b, '#5f7a4a', collar='#c9b48a',
                               deco=line([(-14, b.sh + 4), (12, b.hip - 2)], 3, '#6b4a2b')),
        back=[('quiver', (-10, b.sh), shape(f'M-18 {b.sh - 12} L-10 {b.sh - 14} L-6 {b.waist} L-14 {b.waist + 2} Z', '#6b4a2b')
               + ''.join(line([(-16 + i * 3, b.sh - 12), (-17 + i * 3, b.sh - 20)], 1.4, '#c9b48a') for i in range(3)), sway(1.5, 3, 0))],
        head_kw=dict(eye='#4a3a2a', beard='#5a3a22'),
        headgear=lambda b: helm(b, '#5f7a4a', 'hood'),
        back_arm=(arm(sh_b, (-8, b.chest + 6), (12, b.chest + 2), 5, '#5f7a4a', SKIN_D, glove='#6b4a2b'), sh_b),
        front_arm=(arm(sh_f, (22, b.chest + 6), (26, b.chest), 5, '#5f7a4a', SKIN_D, glove='#6b4a2b')
                   + rot(20, b.chest + 1, 80, W_crossbow('#6b4a2b', '#a9b4ca')), sh_f),
        hand=(56, b.chest - 3), period=3.0)

    # ——— Аурэль, Страж Полудня: белое с золотом, лампа с последним полднем ———
    b = Body(100, 1.0)
    sh_f, sh_b = (14, b.sh + 3), (-14, b.sh + 3)
    R['aurel'] = humanoid(
        'aurel', out, skin=SKIN, hair_style='long', hair_c='#fff4d8',
        legs_kw=dict(pants='#e8dcc0', boots='#d9a94a'),
        body=lambda b: robe(b, '#fffaf0', trim=GOLD, open_front='#f0c860') + torso_m(b, '#fffaf0', belt=GOLD, buckle='#fff4c8',
                                                                                     deco=dot(0, b.chest, 3, '#fff4c8', 1.4)),
        head_kw=dict(eye='#d9a94a', mark=GOLD),
        headgear=lambda b: helm(b, GOLD, 'circlet', GOLD, '#fff4c8'),
        back=[('sunring', (0, b.hy), f'<circle cx="0" cy="{b.hy}" r="22" fill="none" stroke="{GOLD}" stroke-width="2" stroke-dasharray="4 4"/>' + halo(0, b.hy, 22, '#fff0b8'), sway(6, 6, 0))],
        back_arm=(arm(sh_b, (-20, b.chest + 6), (-14, b.waist), 5, '#fffaf0', SKIN, cuff=GOLD), sh_b),
        front_arm=(arm(sh_f, (22, b.chest), (30, b.chest - 10), 5, '#fffaf0', SKIN, cuff=GOLD)
                   + rot(30, b.chest - 10, 0, W_lantern(GOLD, '#fff4c8')), sh_f),
        fx=[('lamp', (30, b.chest + 5), halo(30, b.chest + 5, 16, '#fff0b8'), pulse(0.5, 1.6))],
        hand=(30, b.chest + 5), period=3.6)

    # ——— Соларион, Солнечный император (мифический): корона, золотые латы, пылающий клинок ———
    b = Body(106, 1.1)
    sh_f, sh_b = (16, b.sh + 3), (-16, b.sh + 3)
    R['solarion'] = humanoid(
        'solarion', out, h=106, build_=1.1, skin='#e8b48a', hair_style='long', hair_c='#ffb02a',
        legs_kw=dict(pants='#d9a94a', boots='#8a5a22', stance=1.4, armor=True, trim='#fff4c8'),
        body=lambda b: torso_m(b, '#f0c860', belt='#7a1f2a', buckle='#fff4c8',
                               deco=halo(0, b.chest, 9, '#ff7a2a') + dot(0, b.chest, 4, '#fff4c8', 1.6)
                               + hl(f'M{-b.shw + 4} {b.sh + 8} Q0 {b.sh + 14} {b.shw - 4} {b.sh + 8}', '#fff4c8', 1.6, 0.9)),
        back=[('cape', (0, b.sh), cape(b, '#c8282a', 1.0, 1.3, inner='#ffb02a'), sway(2.4, 3.0, 0.6)),
              ('sun', (0, b.hy - 6), halo(0, b.hy - 6, 34, '#ffb02a') + ''.join(line([(math.cos(a) * 26, b.hy - 6 + math.sin(a) * 26), (math.cos(a) * 34, b.hy - 6 + math.sin(a) * 34)], 2, '#ffd36b') for a in [i * math.pi / 6 for i in range(12)]), sway(4, 8, 0))],
        head_kw=dict(eye='#ff7a2a', beard=None),
        headgear=lambda b: helm(b, '#f0c860', 'crown', '#f0c860', '#ff7a2a'),
        back_arm=(pauldron(-16, b.sh + 3, 9, '#f0c860', 2, -1) + arm(sh_b, (-24, b.chest + 6), (-18, b.waist - 2), 6, '#d9a94a', '#e8b48a', glove='#8a5a22'), sh_b),
        front_arm=(pauldron(16, b.sh + 3, 9, '#f0c860', 2, 1) + arm(sh_f, (26, b.chest + 4), (24, b.waist - 4), 6, '#d9a94a', '#e8b48a', glove='#8a5a22')
                   + rot(24, b.waist - 4, 24, W_sword(56, '#ffe08a', '#f0c860', '#7a1f2a', '#fff4c8', 1.2)), sh_f),
        fx=[('blade', (24 + 25, b.waist - 60), halo(24 + 25, b.waist - 60, 14, '#ff7a2a'), pulse(0.55, 1.2))],
        hand=(49, b.waist - 60), period=3.4, top=114)

    # ——— Илия, Солнцелицая (слияние): крылья света, сияющее платье, нимб ———
    b = Body(100, 1.0, True)
    sh_f, sh_b = (11, b.sh + 3), (-11, b.sh + 3)
    R['ilia'] = humanoid(
        'ilia', out, female=True, skin='#f6d6b8', hair_style='long', hair_c='#fff0b8',
        legs_kw=dict(pants=None, boots='#f0c860', skin='#f6d6b8', heels=True),
        body=lambda b: skirt(b, '#fffaf0', 0.92, 1.3, slit=True, trim=GOLD) + torso_f(b, '#fffaf0', trim=GOLD, skin='#f6d6b8', belt=GOLD),
        back=[('wings', (0, b.sh), wings('feather', '#fff4d8', 0.85, b.sh + 4), sway(3, 2.4, 0)),
              ('halo', (0, b.hy), f'<circle cx="0" cy="{b.hy - 3}" r="16" fill="none" stroke="{GOLD}" stroke-width="2.4"/>' + halo(0, b.hy - 3, 22, '#fff0b8'), pulse(0.35, 2.2))],
        head_kw=dict(eye='#d9a94a', mark=GOLD),
        headgear=lambda b: helm(b, GOLD, 'circlet', GOLD, '#fff4c8'),
        back_arm=(arm(sh_b, (-18, b.chest + 6), (-22, b.waist - 6), 4.6, None, '#f6d6b8', cuff=GOLD), sh_b),
        front_arm=(arm(sh_f, (20, b.chest - 2), (28, b.sh - 8), 4.6, None, '#f6d6b8', cuff=GOLD)
                   + rot(28, b.sh - 8, 0, W_orb('#fff0b8', 5)), sh_f),
        hand=(28, b.sh - 8), period=3.0, hair_sway=5)
    return R
