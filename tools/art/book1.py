"""Книга I: новые героини (суккуба, графиня-вампир, амазонка, жемчужная дева, эльфийка-наёмница)
и твари Звёздного разлома (глава 6)."""
from kit import *
from mobs import quadruped

GOLD = '#f0c860'
VOID = '#c79cff'


def make(out):
    R = {}

    # ——— Лилит, суккуба Горнила: перепончатые крылья, рога, хвост, облегающий корсет, сфера тьмы ———
    b = Body(104, 1.0, True)
    skin = '#f0c8d4'
    sh_f, sh_b = (11, b.sh + 3), (-11, b.sh + 3)
    R['lilith'] = humanoid(
        'lilith', out, h=104, female=True, skin=skin, hair_style='long', hair_c='#5a2a6a',
        legs_kw=dict(pants='#1a0a14', boots='#1a0a14', stance=1.1, heels=True, trim='#c8343c'),
        body=lambda b: skirt(b, '#2a0c1a', 0.55, 1.0, slit=True, trim=GOLD)
        + torso_f(b, '#7a1a34', trim=GOLD, skin=skin, belt='#1a0a14', bust=1.12,
                  deco=hl(f'M-3 {b.chest + 9} L3 {b.chest + 12} M3 {b.chest + 9} L-3 {b.chest + 12}', GOLD, 1.2, 0.9)
                  + gem(0, b.chest - 2, 2.2, '#ff5d7a')),
        back=[('wings', (0, b.sh), wings('bat', '#3a0c1a', 1.05, b.sh + 2, membrane='#8a1a3a'), sway(5, 1.8, 0)),
              ('tail', (-4, b.hip), tail('devil', '#7a1a34', -4, b.hip, -1, '#ff5d7a'), sway(9, 1.6, 0.6))],
        head_kw=dict(eye='#ff5d7a', lips='#c8243a'),
        headgear=lambda b: horns(b, '#2a0c1a', 'curl', 1.0),
        back_arm=(arm(sh_b, (-17, b.chest + 6), (-12, b.waist + 2), 4.4, None, skin, cuff=GOLD), sh_b),
        front_arm=(arm(sh_f, (20, b.chest - 2), (27, b.sh - 8), 4.4, None, skin, cuff=GOLD) + rot(27, b.sh - 12, 0, W_orb('#c8243a', 5)), sh_f),
        fx=[('aura', (0, b.chest), halo(0, b.chest, 36, '#ff5d7a').replace('/>', ' opacity=".55"/>'), pulse(0.5, 2.2))],
        hand=(27, b.sh - 12), period=2.8, hair_sway=5, top=114)

    # ——— Эльвира, багровая графиня: высокий воротник, корсетное платье, рапира, летучие мыши ———
    b = Body(106, 1.0, True)
    skin = '#ece4ee'
    sh_f, sh_b = (11, b.sh + 3), (-11, b.sh + 3)
    collar = shape(f'M-16 {b.sh - 2} Q-22 {b.hy - 6} -14 {b.hy - 16} Q-12 {b.hy - 2} -7 {b.sh - 2} Z M16 {b.sh - 2} Q22 {b.hy - 6} 14 {b.hy - 16} Q12 {b.hy - 2} 7 {b.sh - 2} Z', '#8a0c1c')
    bats = ''.join(rot(x, y, a, shape('M0 0 Q-4 -4 -8 -1 Q-5 0 -4 3 Q-2 0 0 2 Q2 0 4 3 Q5 0 8 -1 Q4 -4 0 0 Z', '#1a0c14', sw=1)) for x, y, a in ((-36, -96, -10), (40, -104, 15), (-44, -60, 8)))
    R['elvira'] = humanoid(
        'elvira', out, h=106, female=True, skin=skin, hair_style='long', hair_c='#14080e',
        legs_kw=dict(pants='#1a0a10', boots='#1a0a10', heels=True),
        body=lambda b: skirt(b, '#3a0812', 0.97, 1.5, slit=True, trim='#c8343c') + torso_f(b, '#5a0c1a', trim='#c8343c', skin=skin, belt='#14080e', bust=1.05,
                                                                                          deco=gem(0, b.chest + 10, 2.4, '#ff3a4a')),
        back=[('cape', (0, b.sh), cape(b, '#14080e', 0.95, 1.2, inner='#c8343c'), sway(2.6, 3, 0.5)),
              ('collar', (0, b.sh), collar, None)],
        head_kw=dict(eye='#ff3a4a', lips='#8a0c1c'),
        headgear=lambda b: helm(b, '#c8ccdc', 'circlet', '#c8ccdc', '#ff3a4a'),
        back_arm=(arm(sh_b, (-18, b.chest + 2), (-24, b.chest - 8), 4.2, '#5a0c1a', skin)
                  + ''.join(line([(-25 + i * 2, b.chest - 11), (-26 + i * 2, b.chest - 16)], 1, '#14080e') for i in range(3)), sh_b),
        front_arm=(arm(sh_f, (20, b.chest + 6), (22, b.waist - 4), 4.2, '#5a0c1a', skin) + rot(22, b.waist - 4, 28, W_sword(52, '#e8ecf4', '#c8343c', '#14080e', '#ff8a9a', 0.55)), sh_f),
        fx=[('bats', (0, b.hy), bats, sway(10, 2.6, 0)), ('moon', (-30, -116), halo(-36, -114, 12, '#ff3a4a') + dot(-36, -114, 6, '#ff6a6a', 1.4), pulse(0.4, 3))],
        hand=(44, b.waist - 48), period=3.2, hair_sway=4, top=114)

    # ——— Тайра, воительница прайда: загар, коса, перья, кожаный доспех, копьё с наконечником-клыком ———
    b = Body(104, 1.05, True)
    skin = '#c88a5a'
    sh_f, sh_b = (12, b.sh + 3), (-12, b.sh + 3)
    spots = ''.join(dot(x, y, 1.3, '#3a2010', 0) for x, y in ((-8, -60), (6, -62), (-4, -52), (8, -50), (-10, -44), (4, -42)))
    R['taira'] = humanoid(
        'taira', out, h=104, build_=1.05, female=True, skin=skin, hair_style='braid', hair_c='#2a1a10',
        legs_kw=dict(pants=None, boots='#6b4a2b', skin=skin, stance=1.7, knee=1, trim='#e0c070'),
        body=lambda b: skirt(b, '#d8a860', 0.3, 0.9, tattered=True, trim='#6b4a2b') + torso_f(b, '#d8a860', trim='#6b4a2b', skin=skin, belt='#6b4a2b', bust=1.05, deco=spots),
        head_kw=dict(eye='#3f8a3a', lips='#a8483a'),
        headgear=lambda b: hl(f'M{-b.hr} {b.hy - b.hr * 0.55} Q0 {b.hy - b.hr * 0.85} {b.hr} {b.hy - b.hr * 0.55}', '#c8343c', 2.4, 1)
        + ''.join(rot(b.hr * 0.9 + i * 3, b.hy - b.hr * 0.7, 30 + i * 12, shape('M0 0 Q-3 -8 0 -16 Q3 -8 0 0 Z', c, sw=1.2)) for i, c in enumerate(('#ffffff', '#5fb070', '#c8343c'))),
        back_arm=(arm(sh_b, (-20, b.chest + 4), (-24, b.waist - 4), 5, None, skin, cuff='#e0c070'), sh_b),
        front_arm=(arm(sh_f, (22, b.chest - 2), (26, b.sh - 6), 5, None, skin, cuff='#e0c070') + rot(26, b.sh - 6, 32, W_spear(66, '#6b4a2b', '#f4ead2', 22)), sh_f),
        fx=[('war', (0, 0), halo(0, -10, 22, '#9be07a').replace('/>', ' opacity=".4"/>'), pulse(0.5, 2))],
        hand=(55, b.sh - 52), period=2.6, hair_sway=5, top=110)

    # ——— Марина, жемчужная дева: раковины, саронг с жемчугом, сияющая жемчужина ———
    b = Body(98, 1.0, True)
    skin = '#f6dcc8'
    sh_f, sh_b = (11, b.sh + 3), (-11, b.sh + 3)
    pearls = ''.join(dot(-12 + i * 4, b.hip + 3 + (i % 2), 1.6, '#fff8fc', 1) for i in range(7))
    R['marina'] = humanoid(
        'marina', out, h=98, female=True, skin=skin, hair_style='long', hair_c='#4fd6e0',
        legs_kw=dict(pants=None, boots='#f6dcc8', skin=skin),
        body=lambda b: skirt(b, '#2f8aa6', 0.85, 1.2, slit=True, trim='#fff8fc') + torso_f(b, '#ff9aa8', trim='#fff8fc', skin=skin, bust=1.0, deco=pearls),
        head_kw=dict(eye='#2f8aa6', lips='#e0607a'),
        headgear=lambda b: ''.join(rot(x, b.hy - b.hr * 0.9, a, shape('M0 0 Q-5 -2 -6 -8 Q0 -10 6 -8 Q5 -2 0 0 Z', '#ffd0dc', sw=1.2)) for x, a in ((-6, -20), (6, 20)))
        + dot(0, b.hy - b.hr * 1.0, 2.2, '#fff8fc', 1),
        back_arm=(arm(sh_b, (-18, b.chest + 6), (-8, b.waist - 6), 4.4, None, skin, cuff='#fff8fc'), sh_b),
        front_arm=(arm(sh_f, (18, b.chest + 6), (8, b.waist - 8), 4.4, None, skin, cuff='#fff8fc'), sh_f),
        fx=[('pearl', (0, b.waist - 14), halo(0, b.waist - 14, 16, '#bff7ff') + dot(0, b.waist - 14, 6.5, D.glow('#bff7ff', '#ffffff'), 1.6), bob(1.5, 2.2, 0))],
        hand=(0, b.waist - 14), period=3.0, hair_sway=5, idle='sway')

    # ——— Аэрин, эльфийка-наёмница: каре, длинные уши, кожаный плащ, кинжалы, пояс с флаконами ———
    b = Body(100, 0.98, True)
    skin = '#f3d6c0'
    sh_f, sh_b = (11, b.sh + 3), (-11, b.sh + 3)
    vials = ''.join(shape(f'M{x - 2} {b.hip - 2} L{x + 2} {b.hip - 2} L{x + 2.5} {b.hip + 5} L{x - 2.5} {b.hip + 5} Z', c, sw=1.2) for x, c in ((-9, '#9be07a'), (-3, '#c79cff'), (9, '#ff7a2a')))
    R['aerin'] = humanoid(
        'aerin', out, female=True, skin=skin, hair_style='bob', hair_c='#e8ecf4',
        legs_kw=dict(pants='#3a2a20', boots='#1a1410', stance=1.6, knee=2, trim=GOLD),
        body=lambda b: torso_f(b, '#4a3a2a', trim=GOLD, belt='#2a1a10', bust=0.95, deco=line([(-12, b.sh + 4), (10, b.hip - 2)], 2.4, '#2a1a10')) + vials,
        back=[('coat', (0, b.sh), cape(b, '#3a2a20', 0.7, 0.9, inner=GOLD, tattered=True), sway(3.5, 2.2, 0.4))],
        head_kw=dict(eye='#7fe7ff', ears=True, lips='#c87a6a'),
        back_arm=(arm(sh_b, (-22, b.chest), (-30, b.chest - 10), 4.4, '#4a3a2a', skin, glove='#1a1410') + rot(-30, b.chest - 10, -40, W_dagger(20, '#fff4c8', False, '#ffffff')), sh_b),
        front_arm=(arm(sh_f, (22, b.chest + 6), (30, b.waist - 2), 4.4, '#4a3a2a', skin, glove='#1a1410') + rot(30, b.waist - 2, 120, W_dagger(20, '#fff4c8', False, '#ffffff')), sh_f),
        fx=[('glint', (36, b.waist + 10), halo(37, b.waist + 12, 7, '#fff4c8'), pulse(0.8, 1.1))],
        hand=(37, b.waist + 12), period=2.4, hair_sway=3)

    # ═════════ Глава 6: Звёздный разлом ═════════
    R['rift_spawn'] = quadruped('rift_spawn', out, c='#2a1a4a', belly='#4a3a7a', eye='#ff5dff', crystals=VOID, size=1.05, top=66,
                                extra=''.join(shape(f'M{x} -42 L{x + 3} -54 L{x + 6} -42 Z', '#e8d8ff', sw=1.2) for x in (-20, -10, 0, 10)))
    b = Body(104, 1.25)
    sh_f, sh_b = (19, b.sh + 4), (-19, b.sh + 4)
    mirror = shape('M-15 -24 L15 -24 L15 16 Q0 26 -15 16 Z', D.lin('#ffffff', '#b8a8e8')) + hl('M-10 -18 L4 -4 M-12 2 L-2 12', '#ffffff', 2, 0.8) + hl('M-13 -22 L13 -22 L13 15 Q0 24 -13 15 Z', VOID, 1.6, 1)
    R['void_mirror'] = humanoid('void_mirror', out, h=104, build_=1.25, skin='#a8a0c8', kind='beast',
                                legs_kw=dict(pants='#4a4470', boots='#2a2448', stance=1.5, armor=True, trim=VOID),
                                body=lambda b: torso_m(b, '#8a80b8', belt='#2a2448', buckle=VOID, deco=gem(0, b.chest, 4, '#e8d8ff')),
                                head_kw=dict(eye=VOID, glow_eyes=VOID), headgear=lambda b: helm(b, '#b8b0d8', 'knight', VOID, '#ffffff'),
                                back_arm=(pauldron(-19, b.sh + 4, 9, '#b8b0d8', 2, -1) + arm(sh_b, (-26, b.chest + 6), (-22, b.waist), 6, '#8a80b8', '#a8a0c8') + rot(-24, b.waist - 2, 0, W_sword(34, '#e8d8ff', '#4a4470', '#2a2448')), sh_b),
                                front_arm=(pauldron(19, b.sh + 4, 9, '#b8b0d8', 2, 1) + arm(sh_f, (26, b.chest + 8), (20, b.waist), 6, '#8a80b8', '#a8a0c8') + rot(22, b.waist - 4, 0, mirror), sh_f),
                                fx=[('shine', (22, b.waist - 4), halo(22, b.waist - 4, 16, '#ffffff'), pulse(0.7, 1.8))],
                                hand=(22, b.waist - 4), period=3.2, idle='heavy', blink_p=0)
    start('star_wraith')
    parts = [
        part('tail', (0, -30), shape('M-16 -60 Q-26 -30 -20 -4 Q-14 -12 -8 -2 Q-2 -12 4 -2 Q10 -12 16 -4 Q24 -30 16 -60 Z', D.lin('#4a3a9a', '#0a0618')), sway(3, 2, 0)),
        part('body', (0, -40), shape('M-18 -56 Q-20 -88 0 -98 Q20 -88 18 -56 Q10 -48 0 -50 Q-10 -48 -18 -56 Z', D.vol('#3a2a7a'))
             + shape('M-10 -80 Q0 -92 10 -80 Q8 -66 0 -64 Q-8 -66 -10 -80 Z', '#0d0912', sw=1.6) + dot(-4.5, -78, 2.2, '#fff4c8', 0) + dot(4.5, -78, 2.2, '#fff4c8', 0)
             + ''.join(gem(x, y, 2.2, '#fff4c8') for x, y in ((-12, -96), (0, -104), (12, -96))), breathe(0.03, 2), breath=True),
        part('armFront', (16, -68), line([(16, -68), (30, -78), (36, -92)], 4, '#3a2a7a') + gem(38, -96, 3.4, '#fff4c8'), swing(6, 2, 0), follow=True, role='weapon'),
        part('glow', (0, -78), halo(0, -78, 18, '#fff4c8'), pulse(0.5, 1.6), follow=True, role='fx'),
    ]
    R['star_wraith'] = build(out, 'star_wraith', parts, hand=(38, -96), top=110, idle='float')
    b = Body(102)
    sh_f, sh_b = (14, b.sh + 3), (-14, b.sh + 3)
    R['null_priest'] = humanoid('null_priest', out, h=102, skin='#9a90b8', kind='beast',
                                legs_kw=dict(pants='#1a1430', boots='#0a0814'),
                                body=lambda b: robe(b, '#1f1838', trim=VOID, open_front='#0a0814') + torso_m(b, '#2a2248', belt='#0a0814', buckle=VOID),
                                head_kw=dict(eye='#4fd6e0', glow_eyes='#4fd6e0'),
                                headgear=lambda b: helm(b, '#1a1430', 'hood') + f'<circle cx="0" cy="{b.hy}" r="{b.hr * 1.9}" fill="none" stroke="{VOID}" stroke-width="2" stroke-dasharray="3 4"/>',
                                back_arm=(arm(sh_b, (-22, b.chest + 2), (-26, b.chest - 8), 5, '#2a2248', '#9a90b8'), sh_b),
                                front_arm=(arm(sh_f, (22, b.chest + 6), (22, b.waist - 6), 5, '#2a2248', '#9a90b8') + rot(22, b.waist - 6, 4, W_staff(64, '#0a0814', '#4fd6e0', 'crescent')), sh_f),
                                fx=[('void', (26, b.waist - 70), halo(26, b.waist - 70, 12, '#4fd6e0'), pulse(0.6, 1.4))],
                                hand=(26, b.waist - 70), period=3.2, blink_p=0)

    # Глашатай Пожирателя: высокая тёмная фигура, глаз на груди, шипы, посох с оком
    b = Body(120, 1.4)
    sh_f, sh_b = (20, b.sh + 4), (-20, b.sh + 4)
    eye = shape(f'M-10 {b.chest} Q0 {b.chest - 9} 10 {b.chest} Q0 {b.chest + 9} -10 {b.chest} Z', '#efe6ff', sw=1.8) + dot(0, b.chest, 4.2, VOID, 1.2) + dot(0, b.chest, 1.8, '#0d0912', 0)
    spikes = ''.join(shape(f'M{x - 3} {y} L{x + d} {y - 12} L{x + 3} {y} Z', '#e8d8ff', sw=1.2) for x, y, d in ((-22, b.sh + 2, -4), (-16, b.sh - 2, -2), (16, b.sh - 2, 2), (22, b.sh + 2, 4)))
    R['void_herald'] = humanoid('void_herald', out, h=120, build_=1.4, skin='#2a2048', kind='beast',
                                legs_kw=dict(pants='#1a1430', boots='#0a0814', stance=1.6, armor=True, trim=VOID),
                                body=lambda b: torso_m(b, '#2a2048', belt='#0a0814', buckle=VOID, bulk=1.1, deco=halo(0, b.chest, 14, VOID) + eye),
                                back=[('cape', (0, b.sh), cape(b, '#0a0618', 1.0, 1.4, inner=VOID, tattered=True), sway(3, 2.8, 0.5)),
                                      ('stars', (0, b.hy), ''.join(dot(x, y, 1.6, '#fff4c8', 0) for x, y in ((-46, -120), (40, -112), (-40, -70), (46, -60), (30, -126))) + halo(0, b.hy, 50, '#3a1a6a'), pulse(0.4, 3))],
                                head_kw=dict(eye=VOID, glow_eyes='#ffffff'),
                                headgear=lambda b: helm(b, '#1a1430', 'hood') + horns(b, '#e8d8ff', 'straight', 1.2) + spikes,
                                back_arm=(arm(sh_b, (-30, b.chest + 6), (-34, b.chest - 8), 7, '#2a2048', '#2a2048') + halo(-36, b.chest - 12, 12, VOID), sh_b),
                                front_arm=(arm(sh_f, (30, b.chest + 8), (28, b.waist - 6), 7, '#2a2048', '#2a2048') + rot(28, b.waist - 6, 6, W_staff(84, '#0a0814', VOID, 'claw')), sh_f),
                                fx=[('orb', (37, b.waist - 90), halo(37, b.waist - 90, 16, VOID), pulse(0.6, 1.4)), ('chest', (0, b.chest), halo(0, b.chest, 20, VOID), pulse(0.5, 2))],
                                hand=(37, b.waist - 90), period=3.4, idle='heavy', top=134, blink_p=0)
    return R
