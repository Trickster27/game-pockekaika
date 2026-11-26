"""Набор деталей для «живых» персонажей Каэлмора.

Персонаж — список слоёв (part). У слоя: id, точка вращения, движение, флаг follow
(едет вместе с дыханием торса) и SVG-разметка. Разметку собирают функции ниже:
конечности, торсы, головы с лицами, причёски, оружие, плащи, крылья, хвосты.

Стиль «Тёмный витраж»: жирный тёмный контур, объём градиентом (свет слева сверху),
светящиеся детали стихии. Кадр: viewBox -60 -130 120 135, ноги в (0, 0).
"""
import json, math, os

VB = '-60 -130 120 135'
OUT_LINE = '#0d0912'
SW = 2.4  # толщина контура


# ———————————————————— цвета ————————————————————

def _rgb(c):
    c = c.lstrip('#')
    return [int(c[i:i + 2], 16) for i in (0, 2, 4)]


def _hex(r):
    return '#' + ''.join(f'{max(0, min(255, round(v))):02x}' for v in r)


def mix(a, b, t):
    ra, rb = _rgb(a), _rgb(b)
    return _hex([ra[i] + (rb[i] - ra[i]) * t for i in range(3)])


def light(c, t=0.3):
    return mix(c, '#ffffff', t)


def dark(c, t=0.3):
    return mix(c, '#0d0912', t)


# ———————————————————— градиенты (уникальные id на персонажа) ————————————————————

class Defs:
    """Копит <defs> текущего слоя и выдаёт уникальные id."""

    def __init__(self, prefix):
        self.prefix, self.n, self.items = prefix, 0, []

    def _id(self):
        # Счётчик сквозной на весь запуск: id не пересекаются ни внутри персонажа, ни между ними.
        self.n += 1
        return f'g{self.n}'

    def vol(self, c, horizontal=True, k=0.28):
        """Объём: светлая сторона слева (или сверху) → тень."""
        i = self._id()
        x2, y2 = (1, 0.3) if horizontal else (0.3, 1)
        self.items.append(f'<linearGradient id="{i}" x1="0" y1="0" x2="{x2}" y2="{y2}">'
                          f'<stop offset="0" stop-color="{light(c, k)}"/><stop offset=".55" stop-color="{c}"/>'
                          f'<stop offset="1" stop-color="{dark(c, k)}"/></linearGradient>')
        return f'url(#{i})'

    def lin(self, c1, c2, vertical=True):
        i = self._id()
        x2, y2 = (0, 1) if vertical else (1, 0)
        self.items.append(f'<linearGradient id="{i}" x1="0" y1="0" x2="{x2}" y2="{y2}">'
                          f'<stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient>')
        return f'url(#{i})'

    def glow(self, c, core='#fffbe6'):
        i = self._id()
        self.items.append(f'<radialGradient id="{i}"><stop offset="0" stop-color="{core}"/>'
                          f'<stop offset=".35" stop-color="{c}" stop-opacity=".9"/>'
                          f'<stop offset="1" stop-color="{c}" stop-opacity="0"/></radialGradient>')
        return f'url(#{i})'

    def take(self):
        s = ''.join(self.items)
        self.items = []
        return s


D = Defs('x')  # текущий набор; build() переключает префикс на персонажа


def fmt(v):
    return f'{v:.1f}'.rstrip('0').rstrip('.') if isinstance(v, float) else str(v)


def P(*pts):
    """Точки → строка 'x y x y'."""
    return ' '.join(f'{fmt(x)} {fmt(y)}' for x, y in pts)


# ———————————————————— примитивы ————————————————————

def shape(d, fill, sw=SW, extra=''):
    return f'<path d="{d}" fill="{fill}" stroke-width="{sw}"{extra}/>'


def line(pts, w, color, cap='round'):
    """Толстая линия с контуром — основа конечностей, древков и хвостов."""
    d = 'M' + ' L'.join(f'{fmt(x)} {fmt(y)}' for x, y in pts)
    return (f'<path d="{d}" fill="none" stroke="{OUT_LINE}" stroke-width="{w + 2 * SW}" stroke-linecap="{cap}"/>'
            f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{w}" stroke-linecap="{cap}"/>')


def curve(d, w, color):
    """То же для произвольного пути (кривые)."""
    return (f'<path d="{d}" fill="none" stroke="{OUT_LINE}" stroke-width="{w + 2 * SW}"/>'
            f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{w}"/>')


def hl(d, color='#ffffff', w=1.3, op=0.6):
    """Блик/прожилка без контура."""
    return f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{w}" opacity="{op}"/>'


def dot(x, y, r, fill, sw=1.2):
    return f'<circle cx="{fmt(x)}" cy="{fmt(y)}" r="{fmt(r)}" fill="{fill}" stroke-width="{sw}"/>'


def gem(x, y, r, c):
    return (f'<path d="M{fmt(x)} {fmt(y - r)} L{fmt(x + r * .8)} {fmt(y)} L{fmt(x)} {fmt(y + r)} L{fmt(x - r * .8)} {fmt(y)} Z" '
            f'fill="{c}" stroke-width="1.2"/><path d="M{fmt(x - r * .3)} {fmt(y - r * .4)} L{fmt(x)} {fmt(y - r * .7)}" '
            f'stroke="#ffffff" stroke-width="1" opacity=".8"/>')


def halo(x, y, r, c):
    return f'<circle cx="{fmt(x)}" cy="{fmt(y)}" r="{fmt(r)}" fill="{D.glow(c)}" stroke="none"/>'


def rot(x, y, a, inner):
    """Нарисовать inner (оружие «вверх» от 0,0) в точке (x,y) под углом a градусов."""
    return f'<g transform="translate({fmt(x)} {fmt(y)}) rotate({fmt(a)})">{inner}</g>'


def flip(inner):
    return f'<g transform="scale(-1 1)">{inner}</g>'


# ———————————————————— тело ————————————————————

class Body:
    """Опорные точки гуманоида по росту h (макушка = -h)."""

    def __init__(self, h=100, build=1.0, female=False):
        self.h, self.b, self.f = h, build, female
        self.hip = -0.40 * h
        self.waist = -0.52 * h
        self.chest = -0.62 * h
        self.sh = -0.71 * h          # плечи
        self.neck = -0.765 * h
        self.hy = -0.87 * h          # центр головы
        self.hr = 0.105 * h * (1.05 if female else 1.0)  # радиус головы
        self.shw = (14 if female else 17) * build * h / 100  # полуширина плеч


def legs(b, pants, boots, stance=1.0, knee=0.0, skin=None, armor=False, heels=False, trim=None):
    """Две ноги. pants=None → голые (skin). knee>0 — сгиб передней ноги."""
    s = stance
    w = (7.5 if not b.f else 6.5) * b.b * b.h / 100
    hy = b.hip
    out = []
    for side, c in ((-1, pants or skin), (1, dark(pants or skin, 0.18))):
        hx = side * 6 * b.b
        fx = side * (9 + 2 * s) * b.b
        kx = (hx + fx) / 2 + side * knee * 4
        ky = hy * 0.48
        out.append(line([(hx, hy + 2), (kx, ky), (fx, -5)], w, c))
        if armor:
            out.append(dot(kx, ky, w * 0.55, light(c, 0.35)))
        if trim:
            out.append(line([(hx * 1.02, hy * 0.75), (kx, ky - 1)], 1.6, trim))
        bw = w * 0.62 + 1.5
        heel = 3 if heels else 0
        out.append(shape(f'M{fmt(fx - bw)} {fmt(-9 - heel)} L{fmt(fx + bw)} {fmt(-9 - heel)} '
                         f'L{fmt(fx + bw + side * 3)} 0 L{fmt(fx - bw - (0 if side > 0 else 3) + (3 if side > 0 else 0) * 0)} 0 Z',
                         boots))
        if heels:
            out.append(line([(fx - side * bw, -3), (fx - side * bw, 1)], 1.6, boots))
    return ''.join(out)


def torso_m(b, c, belt='#5a3a22', buckle='#d9a94a', collar=None, deco='', bulk=1.0):
    """Мужской торс: плечи шире талии."""
    sw, ww = b.shw * bulk, 12 * b.b * bulk * b.h / 100
    hw = 11 * b.b * b.h / 100
    sy, wy, hy = b.sh - 2, b.waist, b.hip
    d = (f'M{fmt(-sw)} {fmt(sy + 4)} Q{fmt(-sw - 1)} {fmt((sy + wy) / 2)} {fmt(-ww)} {fmt(wy)} L{fmt(-hw)} {fmt(hy + 2)} '
         f'L{fmt(hw)} {fmt(hy + 2)} L{fmt(ww)} {fmt(wy)} Q{fmt(sw + 1)} {fmt((sy + wy) / 2)} {fmt(sw)} {fmt(sy + 4)} '
         f'Q0 {fmt(sy - 5)} {fmt(-sw)} {fmt(sy + 4)} Z')
    out = shape(d, D.vol(c))
    if collar:
        out += shape(f'M-6 {fmt(sy)} Q0 {fmt(sy + 6)} 6 {fmt(sy)} L5 {fmt(sy - 3)} L-5 {fmt(sy - 3)} Z', collar)
    out += deco
    if belt:
        out += f'<rect x="{fmt(-hw - 1)}" y="{fmt(hy - 1)}" width="{fmt(2 * hw + 2)}" height="5" rx="2" fill="{belt}" stroke-width="{SW}"/>'
        out += f'<rect x="-3.5" y="{fmt(hy - 2)}" width="7" height="7" rx="1.5" fill="{buckle}" stroke-width="1.6"/>'
    return out


def torso_f(b, c, trim='#f0c860', skin=None, neckline='sweet', belt=None, deco='', bust=1.0):
    """Женский торс: тонкая талия, широкие бёдра, выраженная грудь. Наряд — облегающий."""
    k = b.h / 100
    sw, ww, hw = b.shw, 8.5 * k * b.b, 14 * k * b.b
    sy, cy, wy, hy = b.sh - 1, b.chest, b.waist, b.hip
    bw = 7.5 * k * bust  # полуширина одной груди
    out = ''
    if skin:  # открытые плечи / декольте
        out += shape(f'M{fmt(-sw)} {fmt(sy + 3)} Q0 {fmt(sy - 5)} {fmt(sw)} {fmt(sy + 3)} L{fmt(sw - 3)} {fmt(cy)} '
                     f'L{fmt(-sw + 3)} {fmt(cy)} Z', D.vol(skin))
    body_top = cy - 4 if skin else sy + 3
    d = (f'M{fmt(-sw + (3 if skin else 0))} {fmt(body_top)} Q{fmt(-sw - 1)} {fmt(cy + 4)} {fmt(-ww)} {fmt(wy)} '
         f'Q{fmt(-hw - 2)} {fmt((wy + hy) / 2)} {fmt(-hw)} {fmt(hy + 3)} L{fmt(hw)} {fmt(hy + 3)} '
         f'Q{fmt(hw + 2)} {fmt((wy + hy) / 2)} {fmt(ww)} {fmt(wy)} Q{fmt(sw + 1)} {fmt(cy + 4)} {fmt(sw - (3 if skin else 0))} {fmt(body_top)} '
         + (f'Q0 {fmt(body_top + 4)} {fmt(-sw + 3)} {fmt(body_top)} Z' if skin else f'Q0 {fmt(sy - 5)} {fmt(-sw)} {fmt(sy + 3)} Z'))
    out += shape(d, D.vol(c))
    # грудь: две округлые чашки с бликом
    for s in (-1, 1):
        x = s * (bw * 0.78)
        out += shape(f'M{fmt(x - bw * 0.95)} {fmt(cy - 1)} Q{fmt(x - bw)} {fmt(cy + bw * 1.05)} {fmt(x)} {fmt(cy + bw * 0.95)} '
                     f'Q{fmt(x + bw)} {fmt(cy + bw * 1.05)} {fmt(x + bw * 0.95)} {fmt(cy - 1)} Q{fmt(x)} {fmt(cy - bw * 0.5)} '
                     f'{fmt(x - bw * 0.95)} {fmt(cy - 1)} Z', D.vol(c, k=0.22), sw=1.8)
        out += hl(f'M{fmt(x - bw * 0.5)} {fmt(cy + 1)} Q{fmt(x - bw * 0.2)} {fmt(cy - 1.5)} {fmt(x + bw * 0.2)} {fmt(cy)}', '#ffffff', 1.2, 0.45)
    if trim:
        out += hl(f'M{fmt(-bw * 1.7)} {fmt(cy - 1)} Q0 {fmt(cy + bw * 0.5)} {fmt(bw * 1.7)} {fmt(cy - 1)}', trim, 1.6, 0.9)
        out += hl(f'M{fmt(-ww)} {fmt(wy)} Q0 {fmt(wy + 3)} {fmt(ww)} {fmt(wy)}', trim, 2, 0.9)
    out += deco
    if belt:
        out += shape(f'M{fmt(-hw)} {fmt(hy)} Q0 {fmt(hy + 4)} {fmt(hw)} {fmt(hy)} L{fmt(hw - 1)} {fmt(hy - 4)} '
                     f'Q0 {fmt(hy)} {fmt(-hw + 1)} {fmt(hy - 4)} Z', belt, sw=1.8)
    return out


def skirt(b, c, length=0.9, flare=1.0, slit=False, trim=None, tattered=False, front=False):
    """Юбка/подол от бёдер. length — доля расстояния до земли."""
    k = b.h / 100
    hw = 14 * k * b.b
    top = b.hip - 2
    bot = top + (-top) * length
    fw = (hw + 9 * flare) * (1 + 0.15 * length)
    if tattered:
        hem = ' '.join(f'L{fmt(fw - i * fw / 3)} {fmt(bot - (4 if i % 2 else 0))}' for i in range(7))
    else:
        hem = f'Q0 {fmt(bot + 4)} {fmt(-fw)} {fmt(bot)}'
    if slit:
        d = (f'M{fmt(-hw)} {fmt(top)} L{fmt(-fw)} {fmt(bot)} Q{fmt(-fw / 2)} {fmt(bot + 3)} {fmt(-2)} {fmt(bot)} '
             f'Q{fmt(1)} {fmt((top + bot) / 2)} {fmt(3)} {fmt(top + 6)} Q{fmt(6)} {fmt((top + bot) / 2)} {fmt(fw * 0.35)} {fmt(bot)} '
             f'Q{fmt(fw * 0.7)} {fmt(bot + 2)} {fmt(fw)} {fmt(bot)} L{fmt(hw)} {fmt(top)} Z')
    elif tattered:
        d = f'M{fmt(-hw)} {fmt(top)} L{fmt(hw)} {fmt(top)} L{fmt(fw)} {fmt(bot)} {hem} Z'
    else:
        d = f'M{fmt(-hw)} {fmt(top)} L{fmt(hw)} {fmt(top)} L{fmt(fw)} {fmt(bot)} {hem} Z'
    out = shape(d, D.vol(c))
    for x in (-0.45, 0.1, 0.55):
        out += hl(f'M{fmt(hw * x)} {fmt(top + 3)} L{fmt(fw * x * 1.1)} {fmt(bot - 3)}', dark(c, 0.35), 1.3, 0.8)
    if trim:
        out += hl(f'M{fmt(-fw + 2)} {fmt(bot - 2)} Q0 {fmt(bot + 2)} {fmt(fw - 2)} {fmt(bot - 2)}', trim, 2.2, 0.95)
    return out


def robe(b, c, trim=None, open_front=None, hem_y=-1):
    """Длинное одеяние от плеч до пола (маги, жрецы)."""
    k = b.h / 100
    sw = b.shw
    sy = b.sh - 1
    fw = 22 * k * b.b
    d = (f'M{fmt(-sw)} {fmt(sy + 4)} Q{fmt(-sw - 3)} {fmt(b.waist)} {fmt(-fw)} {fmt(hem_y)} Q0 {fmt(hem_y + 4)} {fmt(fw)} {fmt(hem_y)} '
         f'Q{fmt(sw + 3)} {fmt(b.waist)} {fmt(sw)} {fmt(sy + 4)} Q0 {fmt(sy - 5)} {fmt(-sw)} {fmt(sy + 4)} Z')
    out = shape(d, D.vol(c))
    if open_front:
        out += shape(f'M-5 {fmt(sy + 2)} L5 {fmt(sy + 2)} L{fmt(fw * 0.35)} {fmt(hem_y)} L{fmt(-fw * 0.35)} {fmt(hem_y)} Z', D.vol(open_front, k=0.2))
    for x in (-0.6, 0.6):
        out += hl(f'M{fmt(sw * x * 0.6)} {fmt(b.waist)} L{fmt(fw * x)} {fmt(hem_y - 3)}', dark(c, 0.35), 1.3, 0.8)
    if trim:
        out += hl(f'M{fmt(-fw + 2)} {fmt(hem_y - 2)} Q0 {fmt(hem_y + 2)} {fmt(fw - 2)} {fmt(hem_y - 2)}', trim, 2.4, 0.95)
        out += hl(f'M-5 {fmt(sy + 2)} L{fmt(-fw * 0.35)} {fmt(hem_y - 1)} M5 {fmt(sy + 2)} L{fmt(fw * 0.35)} {fmt(hem_y - 1)}', trim, 1.6, 0.9)
    return out


def cape(b, c, length=1.0, width=1.0, inner=None, tattered=False, hood=False):
    k = b.h / 100
    sw = b.shw + 2
    sy = b.sh - 2
    bot = sy + (-sy) * length + 2
    fw = (sw + 12 * width) * k
    if tattered:
        hem = ' '.join(f'L{fmt(fw - i * fw / 4)} {fmt(bot - (6 if i % 2 else 0))}' for i in range(9))
    else:
        hem = (f'Q{fmt(fw * 0.75)} {fmt(bot - 5)} {fmt(fw * 0.5)} {fmt(bot)} Q{fmt(fw * 0.2)} {fmt(bot - 5)} 0 {fmt(bot)} '
               f'Q{fmt(-fw * 0.2)} {fmt(bot - 5)} {fmt(-fw * 0.5)} {fmt(bot)} Q{fmt(-fw * 0.75)} {fmt(bot - 5)} {fmt(-fw)} {fmt(bot)}')
    d = f'M{fmt(-sw)} {fmt(sy)} Q{fmt(-fw)} {fmt((sy + bot) / 2)} {fmt(-fw)} {fmt(bot)} ' if tattered else \
        f'M{fmt(-sw)} {fmt(sy)} Q{fmt(-fw - 2)} {fmt((sy + bot) / 2)} {fmt(-fw)} {fmt(bot)} '
    if tattered:
        d = f'M{fmt(-sw)} {fmt(sy)} L{fmt(sw)} {fmt(sy)} Q{fmt(fw + 2)} {fmt((sy + bot) / 2)} {fmt(fw)} {fmt(bot)} {hem} Q{fmt(-fw - 2)} {fmt((sy + bot) / 2)} {fmt(-sw)} {fmt(sy)} Z'
    else:
        d = (f'M{fmt(-sw)} {fmt(sy)} L{fmt(sw)} {fmt(sy)} Q{fmt(fw + 2)} {fmt((sy + bot) / 2)} {fmt(fw)} {fmt(bot)} '
             f'{hem} Q{fmt(-fw - 2)} {fmt((sy + bot) / 2)} {fmt(-sw)} {fmt(sy)} Z')
    out = shape(d, D.lin(light(c, 0.15), dark(c, 0.4)))
    if inner:
        out += hl(f'M{fmt(-fw + 3)} {fmt(bot - 2)} Q{fmt(-fw)} {fmt((sy + bot) / 2)} {fmt(-sw + 2)} {fmt(sy + 2)}', inner, 3, 0.9)
    for x in (-0.55, 0, 0.55):
        out += hl(f'M{fmt(sw * x)} {fmt(sy + 4)} Q{fmt(fw * x * 1.2)} {fmt((sy + bot) / 2)} {fmt(fw * x * 1.1)} {fmt(bot - 3)}',
                  dark(c, 0.5), 1.4, 0.8)
    return out


def arm(sh, el, hd, w, sleeve, skin, glove=None, cuff=None):
    """Рука: плечо → локоть → кисть. sleeve=None — голая рука."""
    out = line([sh, el], w, sleeve or skin)
    out += line([el, hd], w * 0.85, sleeve or skin)
    if cuff:
        mx, my = el[0] + (hd[0] - el[0]) * 0.75, el[1] + (hd[1] - el[1]) * 0.75
        out += dot(mx, my, w * 0.5, cuff)
    out += dot(hd[0], hd[1], w * 0.55, glove or skin, 1.6)
    return out


def pauldron(x, y, r, c, spikes=0, side=1):
    out = shape(f'M{fmt(x - r)} {fmt(y + 2)} Q{fmt(x - r)} {fmt(y - r)} {fmt(x)} {fmt(y - r)} Q{fmt(x + r)} {fmt(y - r)} {fmt(x + r)} {fmt(y + 2)} '
                f'Q{fmt(x)} {fmt(y + 5)} {fmt(x - r)} {fmt(y + 2)} Z', D.vol(c))
    for i in range(spikes):
        sx = x - r * 0.6 + i * r * 0.6
        out += shape(f'M{fmt(sx - 2)} {fmt(y - r + 1)} L{fmt(sx + side * 2)} {fmt(y - r - 7)} L{fmt(sx + 2)} {fmt(y - r + 1)} Z', light(c, 0.4), sw=1.6)
    return out


# ———————————————————— голова ————————————————————

def head(b, skin, kind='m', eye='#3a2a1a', glow_eyes=False, ears=False, beard=None, mark=None, lips='#c8243a', age=0):
    """Лицо. kind: m (мужское), f (женское), y (юное), o (старое), beast."""
    cx, cy, r = 0, b.hy, b.hr
    k = r / 10
    out = ''
    if ears:  # острые уши
        for s in (-1, 1):
            out += shape(f'M{fmt(s * r * 0.85)} {fmt(cy - 1)} L{fmt(s * r * 1.9)} {fmt(cy - r * 0.9)} L{fmt(s * r * 0.9)} {fmt(cy + 3)} Z', D.vol(skin))
    out += line([(0, b.neck + 2), (0, b.sh + 1)], 5.5 * k, dark(skin, 0.12))
    chin = cy + r * (1.08 if kind == 'm' or kind == 'o' else 1.0)
    jaw = r * (0.92 if kind == 'm' else 0.8 if kind == 'f' else 0.85)
    d = (f'M{fmt(-r)} {fmt(cy - 1)} Q{fmt(-r)} {fmt(cy - r * 1.15)} 0 {fmt(cy - r * 1.1)} Q{fmt(r)} {fmt(cy - r * 1.15)} {fmt(r)} {fmt(cy - 1)} '
         f'Q{fmt(jaw)} {fmt(chin - r * 0.25)} 0 {fmt(chin)} Q{fmt(-jaw)} {fmt(chin - r * 0.25)} {fmt(-r)} {fmt(cy - 1)} Z')
    out += shape(d, D.vol(skin, k=0.2))
    ey = cy + r * 0.05
    ex = r * 0.42
    if kind == 'beast':
        for s in (-1, 1):
            out += shape(f'M{fmt(s * ex - 3 * k)} {fmt(ey)} L{fmt(s * ex + 3 * k)} {fmt(ey - 1.5 * k)} L{fmt(s * ex + 2 * k)} {fmt(ey + 1.5 * k)} Z', eye, sw=1)
    else:
        for s in (-1, 1):
            x = s * ex
            if kind == 'f' or kind == 'y':
                out += shape(f'M{fmt(x - 2.6 * k)} {fmt(ey)} Q{fmt(x)} {fmt(ey - 3.4 * k)} {fmt(x + 2.6 * k)} {fmt(ey)} '
                             f'Q{fmt(x)} {fmt(ey + 2.4 * k)} {fmt(x - 2.6 * k)} {fmt(ey)} Z', '#ffffff', sw=1)
                out += dot(x + s * 0.2, ey - 0.2 * k, 1.5 * k, eye, sw=0.6)
                out += dot(x + s * 0.2 - 0.5, ey - 0.9 * k, 0.5 * k, '#ffffff', sw=0)
                out += hl(f'M{fmt(x - 3 * k)} {fmt(ey - 0.4 * k)} Q{fmt(x)} {fmt(ey - 3.8 * k)} {fmt(x + 3.2 * k)} {fmt(ey - 1 * k)}', OUT_LINE, 1.5, 1)
                out += hl(f'M{fmt(x + s * 2.8 * k)} {fmt(ey - 1.2 * k)} L{fmt(x + s * 4 * k)} {fmt(ey - 2.4 * k)}', OUT_LINE, 1.1, 1)
            else:
                out += shape(f'M{fmt(x - 2.4 * k)} {fmt(ey)} L{fmt(x + 2.4 * k)} {fmt(ey)} L{fmt(x + 1.6 * k)} {fmt(ey + 1.6 * k)} '
                             f'L{fmt(x - 1.6 * k)} {fmt(ey + 1.6 * k)} Z', '#ffffff', sw=0.9)
                out += dot(x, ey + 0.7 * k, 1.1 * k, eye, sw=0)
                out += hl(f'M{fmt(x - 3 * k)} {fmt(ey - 2.2 * k - age)} L{fmt(x + 2.6 * k)} {fmt(ey - (1.4 if s < 0 else 2.8) * k)}', OUT_LINE, 1.8, 1)
            if glow_eyes:
                out += dot(x, ey, 1.6 * k, glow_eyes, sw=0)
    # нос и рот
    out += hl(f'M{fmt(0.3 * k)} {fmt(ey + 2 * k)} L{fmt(1 * k)} {fmt(ey + 4.2 * k)} L{fmt(-0.4 * k)} {fmt(ey + 4.4 * k)}', dark(skin, 0.45), 1, 1)
    my = cy + r * 0.68
    if kind in ('f', 'y'):
        out += shape(f'M{fmt(-2.2 * k)} {fmt(my)} Q0 {fmt(my - 1 * k)} {fmt(2.2 * k)} {fmt(my)} Q0 {fmt(my + 1.8 * k)} {fmt(-2.2 * k)} {fmt(my)} Z', lips, sw=0.9)
    elif kind != 'beast':
        out += hl(f'M{fmt(-2.6 * k)} {fmt(my)} Q0 {fmt(my + 1 * k)} {fmt(2.6 * k)} {fmt(my - 0.3 * k)}', OUT_LINE, 1.3, 1)
    if beard:
        out += shape(f'M{fmt(-r * 0.95)} {fmt(cy + 1)} Q{fmt(-r)} {fmt(chin + r * 0.9)} 0 {fmt(chin + r * 1.1)} Q{fmt(r)} {fmt(chin + r * 0.9)} {fmt(r * 0.95)} {fmt(cy + 1)} '
                     f'Q{fmt(r * 0.5)} {fmt(my + 2 * k)} 0 {fmt(my - 1 * k)} Q{fmt(-r * 0.5)} {fmt(my + 2 * k)} {fmt(-r * 0.95)} {fmt(cy + 1)} Z', D.vol(beard))
        out += hl(f'M{fmt(-r * 0.4)} {fmt(chin)} L{fmt(-r * 0.3)} {fmt(chin + r * 0.6)} M{fmt(r * 0.4)} {fmt(chin)} L{fmt(r * 0.3)} {fmt(chin + r * 0.6)}', dark(beard, 0.4), 1.2, 0.9)
    if mark:
        out += hl(f'M0 {fmt(cy - r * 0.75)} L0 {fmt(cy - r * 0.35)}', mark, 1.8, 1)
    if kind in ('f', 'y'):
        out += dot(-r * 0.62, cy + r * 0.42, 1.5 * k, '#ff8a9a', sw=0).replace('/>', ' opacity=".35"/>')
        out += dot(r * 0.62, cy + r * 0.42, 1.5 * k, '#ff8a9a', sw=0).replace('/>', ' opacity=".35"/>')
    return out


def eyes_closed(b, skin, kind='m'):
    """Слой моргания: веки поверх глаз."""
    cy, r = b.hy, b.hr
    k = r / 10
    ey, ex = cy + r * 0.05, r * 0.42
    out = ''
    for s in (-1, 1):
        x = s * ex
        out += f'<path d="M{fmt(x - 3 * k)} {fmt(ey - 3 * k)} L{fmt(x + 3 * k)} {fmt(ey - 3 * k)} L{fmt(x + 3 * k)} {fmt(ey + 2.2 * k)} L{fmt(x - 3 * k)} {fmt(ey + 2.2 * k)} Z" fill="{skin}" stroke="none"/>'
        out += hl(f'M{fmt(x - 2.8 * k)} {fmt(ey)} Q{fmt(x)} {fmt(ey + 1.6 * k)} {fmt(x + 2.8 * k)} {fmt(ey)}', OUT_LINE, 1.5, 1)
    return out


# ———————————————————— волосы и головные уборы ————————————————————

def hair(b, c, style, back=True):
    """Причёски. Возвращает (сзади, спереди)."""
    cy, r = b.hy, b.hr
    hc = D.lin(light(c, 0.3), dark(c, 0.2))
    bk, fr = '', ''
    top = cy - r * 1.15
    # чёлка/шапка волос — общая для большинства
    cap = (f'M{fmt(-r * 1.08)} {fmt(cy + 1)} Q{fmt(-r * 1.2)} {fmt(top - 1)} 0 {fmt(top - 2)} Q{fmt(r * 1.2)} {fmt(top - 1)} {fmt(r * 1.08)} {fmt(cy + 1)} '
           f'Q{fmt(r * 0.8)} {fmt(cy - r * 0.6)} {fmt(r * 0.3)} {fmt(cy - r * 0.55)} Q{fmt(r * 0.1)} {fmt(cy - r * 0.3)} {fmt(-r * 0.15)} {fmt(cy - r * 0.6)} '
           f'Q{fmt(-r * 0.6)} {fmt(cy - r * 0.4)} {fmt(-r * 1.08)} {fmt(cy + 1)} Z')
    if style == 'long':
        bk = shape(f'M{fmt(-r * 1.1)} {fmt(cy - r * 0.6)} Q{fmt(-r * 1.6)} {fmt(cy + r * 2)} {fmt(-r * 1.4)} {fmt(cy + r * 4.6)} '
                   f'Q{fmt(-r * 0.6)} {fmt(cy + r * 4)} 0 {fmt(cy + r * 4.4)} Q{fmt(r * 0.6)} {fmt(cy + r * 4)} {fmt(r * 1.4)} {fmt(cy + r * 4.6)} '
                   f'Q{fmt(r * 1.6)} {fmt(cy + r * 2)} {fmt(r * 1.1)} {fmt(cy - r * 0.6)} Z', hc)
        bk += hl(f'M{fmt(-r * 1.1)} {fmt(cy + r)} Q{fmt(-r * 1.3)} {fmt(cy + r * 2.6)} {fmt(-r * 1.1)} {fmt(cy + r * 4)}', light(c, 0.4), 1.4, 0.7)
        fr = shape(cap, hc)
        fr += shape(f'M{fmt(-r * 1.08)} {fmt(cy)} Q{fmt(-r * 1.3)} {fmt(cy + r * 1.4)} {fmt(-r * 1.1)} {fmt(cy + r * 2.2)} Q{fmt(-r * 0.8)} {fmt(cy + r)} {fmt(-r * 0.85)} {fmt(cy)} Z', hc, sw=1.8)
    elif style == 'pony':
        bk = shape(f'M{fmt(-r * 0.3)} {fmt(top + 1)} Q{fmt(-r * 2.6)} {fmt(top - r * 0.4)} {fmt(-r * 2.4)} {fmt(cy + r * 2.4)} '
                   f'Q{fmt(-r * 2)} {fmt(cy + r * 3.6)} {fmt(-r * 1.6)} {fmt(cy + r * 4)} Q{fmt(-r * 1.4)} {fmt(cy + r * 1.4)} {fmt(-r * 0.6)} {fmt(cy - r * 0.4)} Z', hc)
        fr = shape(cap, hc)
    elif style == 'short':
        fr = shape(cap.replace(f'{fmt(-r * 1.08)} {fmt(cy + 1)}', f'{fmt(-r * 1.05)} {fmt(cy - r * 0.2)}'), hc)
    elif style == 'spiky':
        sp = ' '.join(f'L{fmt(-r * 1.1 + i * r * 0.44)} {fmt(top - (r * 0.55 if i % 2 else -r * 0.05))}' for i in range(6))
        fr = shape(f'M{fmt(-r * 1.1)} {fmt(cy)} {sp} L{fmt(r * 1.1)} {fmt(cy)} Q{fmt(r * 0.5)} {fmt(cy - r * 0.7)} 0 {fmt(cy - r * 0.5)} '
                   f'Q{fmt(-r * 0.5)} {fmt(cy - r * 0.7)} {fmt(-r * 1.1)} {fmt(cy)} Z', hc)
    elif style == 'bun':
        bk = dot(0, top - r * 0.2, r * 0.55, c, SW)
        fr = shape(cap, hc) + hl(f'M{fmt(-r * 0.6)} {fmt(top + 1)} Q0 {fmt(top - 1)} {fmt(r * 0.6)} {fmt(top + 1)}', light(c, 0.4), 1.3, 0.7)
    elif style == 'braid':
        pts = [(-r * 0.9, cy + r * 0.4), (-r * 1.3, cy + r * 1.6), (-r * 1.2, cy + r * 2.8), (-r * 1.4, cy + r * 3.8)]
        bk = ''.join(dot(x, y, r * 0.42, c, 1.8) for x, y in pts)
        fr = shape(cap, hc)
    elif style == 'wild':
        sp = ' '.join(f'Q{fmt(-r * 1.6 + i * r * 0.55)} {fmt(top - r * 0.9)} {fmt(-r * 1.3 + i * r * 0.55)} {fmt(top + r * 0.1)}' for i in range(6))
        bk = shape(f'M{fmt(-r * 1.3)} {fmt(cy + r * 1.2)} Q{fmt(-r * 2)} {fmt(cy)} {fmt(-r * 1.3)} {fmt(top + r * 0.1)} {sp} '
                   f'Q{fmt(r * 2)} {fmt(cy)} {fmt(r * 1.3)} {fmt(cy + r * 1.2)} Z', hc)
        fr = shape(cap, hc)
    elif style == 'bob':
        bk = shape(f'M{fmt(-r * 1.15)} {fmt(cy - r * 0.4)} Q{fmt(-r * 1.4)} {fmt(cy + r * 1)} {fmt(-r * 1.1)} {fmt(cy + r * 1.3)} L{fmt(r * 1.1)} {fmt(cy + r * 1.3)} '
                   f'Q{fmt(r * 1.4)} {fmt(cy + r * 1)} {fmt(r * 1.15)} {fmt(cy - r * 0.4)} Z', hc)
        fr = shape(cap, hc)
    if style not in ('bald', 'none') and fr:
        fr += hl(f'M{fmt(-r * 0.7)} {fmt(top + r * 0.3)} Q{fmt(-r * 0.2)} {fmt(top - r * 0.1)} {fmt(r * 0.4)} {fmt(top + r * 0.2)}', light(c, 0.5), 1.4, 0.7)
    return bk, fr


def horns(b, c, kind='curl', size=1.0):
    cy, r = b.hy, b.hr
    out = ''
    for s in (-1, 1):
        x0 = s * r * 0.55
        y0 = cy - r * 0.8
        if kind == 'curl':
            d = (f'M{fmt(x0 - s * 2)} {fmt(y0)} Q{fmt(x0 + s * r * 1.2 * size)} {fmt(y0 - r * 0.6 * size)} {fmt(x0 + s * r * 1.1 * size)} {fmt(y0 - r * 1.6 * size)} '
                 f'Q{fmt(x0 + s * r * 0.7 * size)} {fmt(y0 - r * 0.8 * size)} {fmt(x0 + s * 2)} {fmt(y0 + 1)} Z')
        else:  # straight back
            d = (f'M{fmt(x0 - s * 2)} {fmt(y0)} L{fmt(x0 + s * r * 0.5 * size)} {fmt(y0 - r * 1.7 * size)} L{fmt(x0 + s * 3)} {fmt(y0 + 1)} Z')
        out += shape(d, D.lin(light(c, 0.3), dark(c, 0.3)))
    return out


def helm(b, c, kind='knight', trim='#f0c860', visor_glow='#ffe7a0'):
    cy, r = b.hy, b.hr * 1.18
    out = ''
    if kind == 'knight':
        out += shape(f'M{fmt(-r)} {fmt(cy + r * 0.5)} Q{fmt(-r * 1.1)} {fmt(cy - r * 1.2)} 0 {fmt(cy - r * 1.25)} Q{fmt(r * 1.1)} {fmt(cy - r * 1.2)} {fmt(r)} {fmt(cy + r * 0.5)} '
                     f'L{fmt(r * 0.7)} {fmt(cy + r * 0.95)} L{fmt(-r * 0.7)} {fmt(cy + r * 0.95)} Z', D.vol(c))
        out += shape(f'M{fmt(-r * 0.85)} {fmt(cy - r * 0.15)} L{fmt(r * 0.85)} {fmt(cy - r * 0.15)} L{fmt(r * 0.8)} {fmt(cy + r * 0.25)} L{fmt(-r * 0.8)} {fmt(cy + r * 0.25)} Z', OUT_LINE)
        out += f'<rect x="{fmt(-r * 0.6)}" y="{fmt(cy - r * 0.05)}" width="{fmt(r * 0.45)}" height="1.8" fill="{visor_glow}" stroke="none"/>'
        out += f'<rect x="{fmt(r * 0.15)}" y="{fmt(cy - r * 0.05)}" width="{fmt(r * 0.45)}" height="1.8" fill="{visor_glow}" stroke="none"/>'
        out += hl(f'M0 {fmt(cy - r * 1.2)} L0 {fmt(cy - r * 0.2)}', dark(c, 0.4), 1.4, 1)
    elif kind == 'horned':
        out += helm(b, c, 'knight', trim, visor_glow)
        out += horns(b, light(c, 0.5), 'curl', 1.1)
    elif kind == 'hood':
        out += shape(f'M{fmt(-r * 1.15)} {fmt(cy + r * 0.9)} Q{fmt(-r * 1.3)} {fmt(cy - r * 1.3)} 0 {fmt(cy - r * 1.45)} Q{fmt(r * 1.3)} {fmt(cy - r * 1.3)} {fmt(r * 1.15)} {fmt(cy + r * 0.9)} '
                     f'Q{fmt(r * 0.6)} {fmt(cy - r * 0.6)} 0 {fmt(cy - r * 0.75)} Q{fmt(-r * 0.6)} {fmt(cy - r * 0.6)} {fmt(-r * 1.15)} {fmt(cy + r * 0.9)} Z', D.vol(c))
    elif kind == 'crown':
        out += shape(f'M{fmt(-r * 0.85)} {fmt(cy - r * 0.55)} L{fmt(-r * 0.95)} {fmt(cy - r * 1.35)} L{fmt(-r * 0.45)} {fmt(cy - r * 0.95)} L0 {fmt(cy - r * 1.6)} '
                     f'L{fmt(r * 0.45)} {fmt(cy - r * 0.95)} L{fmt(r * 0.95)} {fmt(cy - r * 1.35)} L{fmt(r * 0.85)} {fmt(cy - r * 0.55)} Q0 {fmt(cy - r * 0.8)} {fmt(-r * 0.85)} {fmt(cy - r * 0.55)} Z', D.vol(trim))
        out += gem(0, cy - r * 0.85, 2.4, visor_glow)
    elif kind == 'circlet':
        out += hl(f'M{fmt(-r * 0.9)} {fmt(cy - r * 0.5)} Q0 {fmt(cy - r * 0.85)} {fmt(r * 0.9)} {fmt(cy - r * 0.5)}', trim, 2.2, 1)
        out += gem(0, cy - r * 0.72, 2.2, visor_glow)
    elif kind == 'cap':  # гномий шлем-котелок
        out += shape(f'M{fmt(-r * 1.05)} {fmt(cy - r * 0.2)} Q{fmt(-r)} {fmt(cy - r * 1.3)} 0 {fmt(cy - r * 1.3)} Q{fmt(r)} {fmt(cy - r * 1.3)} {fmt(r * 1.05)} {fmt(cy - r * 0.2)} Z', D.vol(c))
        out += f'<rect x="{fmt(-r * 1.15)}" y="{fmt(cy - r * 0.35)}" width="{fmt(r * 2.3)}" height="4" rx="2" fill="{trim}" stroke-width="1.8"/>'
    return out


# ———————————————————— оружие (рисуется «вверх» от точки хвата 0,0) ————————————————————

def W_sword(len_=46, blade='#eef2f8', guard='#d9a94a', grip='#6b4a2b', glow=None, wide=1.0):
    w = 3 * wide
    out = shape(f'M{fmt(-w)} -6 L{fmt(-w)} {fmt(-len_)} L0 {fmt(-len_ - 6)} L{fmt(w)} {fmt(-len_)} L{fmt(w)} -6 Z', D.lin('#ffffff', blade, False))
    out += hl(f'M0 -8 L0 {fmt(-len_ - 2)}', '#ffffff' if not glow else glow, 1.2, 0.9)
    out += shape(f'M{fmt(-9 * wide)} -7 L{fmt(9 * wide)} -7 L{fmt(8 * wide)} -3 L{fmt(-8 * wide)} -3 Z', guard, sw=1.8)
    out += line([(0, -3), (0, 7)], 3.2, grip)
    out += dot(0, 9, 2.6, guard, 1.4)
    return out


def W_spear(len_=70, shaft='#8a5a32', tip='#dfe5ef', back=14):
    out = line([(0, back), (0, -len_ + 10)], 3, shaft)
    out += shape(f'M-4 {fmt(-len_ + 12)} L0 {fmt(-len_ - 4)} L4 {fmt(-len_ + 12)} L0 {fmt(-len_ + 8)} Z', D.lin('#ffffff', tip, False), sw=1.8)
    out += line([(-3, -len_ + 14), (3, -len_ + 14)], 2.2, '#d9a94a')
    return out


def W_staff(len_=64, wood='#6b4a2b', orb='#7fd0ff', head='claw', back=10):
    out = line([(0, back), (0, -len_ + 4)], 3, wood)
    y = -len_
    if head == 'claw':
        out += curve(f'M-5 {fmt(y + 6)} Q-8 {fmt(y - 4)} -2 {fmt(y - 8)} M5 {fmt(y + 6)} Q8 {fmt(y - 4)} 2 {fmt(y - 8)}', 2, '#d9a94a')
    elif head == 'sun':
        out += ''.join(line([(0, y), (6 * math.cos(a), y + 6 * math.sin(a))], 1.6, '#f0c860') for a in [i * math.pi / 4 for i in range(8)])
    elif head == 'crescent':
        out += shape(f'M-7 {fmt(y - 2)} Q0 {fmt(y + 10)} 7 {fmt(y - 2)} Q0 {fmt(y + 5)} -7 {fmt(y - 2)} Z', '#c8ccdc', sw=1.6)
    out += dot(0, y, 4.2, orb, 1.6)
    out += dot(-1.2, y - 1.4, 1.2, '#ffffff', 0)
    return out


def W_bow(h=50, wood='#6b4a2b', string='#e8e0c8', arrow=True, glow=None):
    out = curve(f'M0 {fmt(-h / 2)} Q14 0 0 {fmt(h / 2)}', 3.2, wood)
    out += f'<path d="M0 {fmt(-h / 2)} L0 {fmt(h / 2)}" stroke="{string}" stroke-width="1" fill="none"/>'
    if arrow:
        out += line([(-2, 0), (26, 0)], 1.6, '#c9a46a')
        out += shape('M26 -3 L33 0 L26 3 Z', glow or '#dfe5ef', sw=1.2)
    return out


def W_hammer(len_=40, head='#a9b4ca', shaft='#6b4a2b', rune=None):
    out = line([(0, 8), (0, -len_ + 6)], 3.4, shaft)
    out += shape(f'M-11 {fmt(-len_ + 8)} L11 {fmt(-len_ + 8)} L12 {fmt(-len_ - 6)} L-12 {fmt(-len_ - 6)} Z', D.vol(head))
    if rune:
        out += hl(f'M-3 {fmt(-len_ + 4)} L0 {fmt(-len_ - 3)} L3 {fmt(-len_ + 4)}', rune, 1.6, 1)
    return out


def W_axe(len_=40, head='#c8ccdc', shaft='#6b4a2b', double=False):
    out = line([(0, 8), (0, -len_)], 3.2, shaft)
    out += shape(f'M0 {fmt(-len_ + 2)} Q14 {fmt(-len_ - 4)} 16 {fmt(-len_ + 8)} Q12 {fmt(-len_ + 16)} 0 {fmt(-len_ + 14)} Z', D.vol(head))
    if double:
        out += shape(f'M0 {fmt(-len_ + 2)} Q-14 {fmt(-len_ - 4)} -16 {fmt(-len_ + 8)} Q-12 {fmt(-len_ + 16)} 0 {fmt(-len_ + 14)} Z', D.vol(head))
    return out


def W_dagger(len_=18, blade='#dfe5ef', curved=False, glow=None):
    if curved:
        out = shape(f'M-2 -3 Q-8 {fmt(-len_ * 0.6)} 4 {fmt(-len_ - 2)} Q0 {fmt(-len_ * 0.6)} 2 -3 Z', D.lin('#ffffff', blade, False), sw=1.8)
    else:
        out = shape(f'M-2.4 -3 L0 {fmt(-len_)} L2.4 -3 Z', D.lin('#ffffff', blade, False), sw=1.8)
    out += line([(-5, -3), (5, -3)], 2, '#5a4a6a')
    out += line([(0, -2), (0, 5)], 2.6, '#3a2a40')
    if glow:
        out += hl(f'M0 -5 L{fmt(1 if curved else 0)} {fmt(-len_ + 2)}', glow, 1.4, 0.9)
    return out


def W_scythe(len_=64, blade='#c8ccdc', shaft='#3a2a2a'):
    out = line([(0, 12), (0, -len_)], 3, shaft)
    out += shape(f'M0 {fmt(-len_)} Q-26 {fmt(-len_ - 8)} -34 {fmt(-len_ + 12)} Q-20 {fmt(-len_ + 0)} 0 {fmt(-len_ + 6)} Z', D.lin('#ffffff', blade, False))
    return out


def W_book(c='#7a1f2a', glow='#a37cff'):
    out = shape('M-9 -7 L9 -7 L9 7 L-9 7 Z', D.vol(c))
    out += shape('M-7 -5 L7 -5 L7 5 L-7 5 Z', '#efe6cf', sw=1.2)
    out += hl('M0 -5 L0 5 M-5 -2 L-2 -2 M2 -2 L5 -2 M-5 1 L-2 1 M2 1 L5 1', glow, 1, 0.9)
    return out


def W_shield_round(r=13, c='#8a5a32', boss='#c8ccdc', rim='#a9b4ca', emblem=None):
    out = dot(0, 0, r, D.vol(c), SW)
    out += f'<circle cx="0" cy="0" r="{fmt(r - 1.5)}" fill="none" stroke="{rim}" stroke-width="2"/>'
    out += dot(0, 0, r * 0.3, boss, 1.6)
    if emblem:
        out += hl(f'M0 {fmt(-r + 3)} L0 {fmt(r - 3)} M{fmt(-r + 3)} 0 L{fmt(r - 3)} 0', emblem, 1.6, 0.9)
    return out


def W_shield_kite(w=14, h=30, c='#3e5aa8', rim='#d9a94a', emblem='#f0c860'):
    out = shape(f'M{fmt(-w)} {fmt(-h / 2)} L{fmt(w)} {fmt(-h / 2)} L{fmt(w)} {fmt(h * 0.1)} Q{fmt(w * 0.4)} {fmt(h * 0.45)} 0 {fmt(h / 2 + 2)} '
                f'Q{fmt(-w * 0.4)} {fmt(h * 0.45)} {fmt(-w)} {fmt(h * 0.1)} Z', D.vol(c))
    out += f'<path d="M{fmt(-w + 2)} {fmt(-h / 2 + 2)} L{fmt(w - 2)} {fmt(-h / 2 + 2)} L{fmt(w - 2)} {fmt(h * 0.1)} Q{fmt(w * 0.4)} {fmt(h * 0.42)} 0 {fmt(h / 2 - 1)} Q{fmt(-w * 0.4)} {fmt(h * 0.42)} {fmt(-w + 2)} {fmt(h * 0.1)} Z" fill="none" stroke="{rim}" stroke-width="1.6"/>'
    if emblem:
        out += hl(f'M0 {fmt(-h / 2 + 5)} L0 {fmt(h / 2 - 5)} M{fmt(-w + 5)} {fmt(-h * 0.1)} L{fmt(w - 5)} {fmt(-h * 0.1)}', emblem, 2.6, 1)
    return out


def W_crossbow(c='#6b4a2b', metal='#a9b4ca'):
    out = line([(0, 6), (0, -26)], 3.4, c)
    out += curve('M-16 -18 Q0 -28 16 -18', 2.6, metal)
    out += '<path d="M-16 -18 L0 -12 L16 -18" stroke="#e8e0c8" stroke-width="1" fill="none"/>'
    out += line([(0, -12), (0, -32)], 1.6, '#c9a46a')
    out += shape('M-2.6 -32 L0 -37 L2.6 -32 Z', metal, sw=1.2)
    return out


def W_cannon(c='#4a5470', rim='#d9a94a'):
    out = shape('M-6 4 L-8 -30 L8 -30 L6 4 Z', D.vol(c))
    out += f'<ellipse cx="0" cy="-30" rx="8.5" ry="3" fill="{OUT_LINE}" stroke-width="1.6"/>'
    out += line([(-8, -22), (8, -22)], 2.4, rim) + line([(-7, -6), (7, -6)], 2.4, rim)
    return out


def W_whip(c='#c8343c', glow='#ffb347'):
    out = line([(0, 6), (0, -6)], 3, '#3a2618')
    out += curve('M0 -6 Q-14 -22 4 -32 Q20 -40 10 -56 Q4 -64 14 -70', 2, c)
    out += hl('M0 -6 Q-14 -22 4 -32 Q20 -40 10 -56', glow, 1, 0.8)
    return out


def W_lantern(c='#d9a94a', light_c='#fff0b8'):
    out = line([(0, 0), (0, 8)], 1.6, '#3a2a1a')
    out += shape('M-6 8 L6 8 L5 22 L-5 22 Z', light_c, sw=1.8)
    out += line([(-6, 8), (6, 8)], 2.4, c) + line([(-5, 22), (5, 22)], 2.4, c)
    out += hl('M-2 11 L-2 19 M2 11 L2 19', c, 1.2, 1)
    return out


def W_wrench(c='#a9b4ca'):
    out = line([(0, 6), (0, -24)], 3.4, c)
    out += shape('M-7 -24 Q-8 -34 -2 -36 L-2 -30 L2 -30 L2 -36 Q8 -34 7 -24 Q0 -20 -7 -24 Z', D.vol(c), sw=1.8)
    return out


def W_trident(len_=66, c='#4fd6e0', shaft='#2f6f8a'):
    out = line([(0, 12), (0, -len_ + 8)], 3, shaft)
    y = -len_ + 8
    out += curve(f'M-9 {fmt(y - 12)} Q-9 {fmt(y)} 0 {fmt(y)} Q9 {fmt(y)} 9 {fmt(y - 12)} M0 {fmt(y)} L0 {fmt(y - 16)}', 2.6, c)
    out += shape(f'M-11 {fmt(y - 12)} L-9 {fmt(y - 18)} L-7 {fmt(y - 12)} Z M-2 {fmt(y - 16)} L0 {fmt(y - 22)} L2 {fmt(y - 16)} Z M7 {fmt(y - 12)} L9 {fmt(y - 18)} L11 {fmt(y - 12)} Z', '#ffffff', sw=1.2)
    return out


def W_club(c='#8a5a32'):
    out = shape('M-3 6 Q-4 -20 -9 -44 Q0 -52 9 -44 Q4 -20 3 6 Z', D.vol(c))
    out += hl('M-4 -40 L-11 -42 M5 -30 L11 -31 M-3 -24 L-9 -24', '#c8ccdc', 2.4, 1)
    return out


def W_orb(c='#a37cff', r=6):
    return halo(0, 0, r * 2.2, c) + dot(0, 0, r, D.glow(c, '#ffffff'), 1.6) + dot(-r * 0.35, -r * 0.35, r * 0.25, '#ffffff', 0)


# ———————————————————— крылья, хвосты, прочее ————————————————————

def wings(kind, c, span=1.0, y=-66, membrane=None, top='#ffffff'):
    out = ''
    for s in (-1, 1):
        if kind == 'bat':
            d = (f'M{fmt(s * 6)} {fmt(y)} Q{fmt(s * 30 * span)} {fmt(y - 34 * span)} {fmt(s * 52 * span)} {fmt(y - 24 * span)} '
                 f'Q{fmt(s * 46 * span)} {fmt(y - 4)} {fmt(s * 50 * span)} {fmt(y + 10 * span)} Q{fmt(s * 40 * span)} {fmt(y + 2)} {fmt(s * 36 * span)} {fmt(y + 16 * span)} '
                 f'Q{fmt(s * 26 * span)} {fmt(y + 6)} {fmt(s * 20 * span)} {fmt(y + 18 * span)} Q{fmt(s * 14)} {fmt(y + 6)} {fmt(s * 6)} {fmt(y + 8)} Z')
            out += shape(d, D.lin(light(membrane or c, 0.2), dark(membrane or c, 0.35)))
            out += hl(f'M{fmt(s * 8)} {fmt(y)} L{fmt(s * 50 * span)} {fmt(y - 22 * span)} M{fmt(s * 30 * span)} {fmt(y - 14 * span)} L{fmt(s * 36 * span)} {fmt(y + 14 * span)} '
                      f'M{fmt(s * 20 * span)} {fmt(y - 6 * span)} L{fmt(s * 20 * span)} {fmt(y + 16 * span)}', dark(c, 0.4), 1.4, 0.9)
        elif kind == 'feather':
            d = (f'M{fmt(s * 6)} {fmt(y)} Q{fmt(s * 34 * span)} {fmt(y - 40 * span)} {fmt(s * 54 * span)} {fmt(y - 30 * span)} '
                 + ' '.join(f'Q{fmt(s * (52 - i * 8) * span)} {fmt(y - 10 + i * 6)} {fmt(s * (46 - i * 9) * span)} {fmt(y + (i * 9 - 4) * span)}' for i in range(5))
                 + f' L{fmt(s * 6)} {fmt(y + 8)} Z')
            out += shape(d, D.lin(top, mix(c, '#c8b890', 0.35) if top == '#ffffff' else dark(c, 0.3)))
            for i in range(4):
                out += hl(f'M{fmt(s * 10)} {fmt(y + 2)} L{fmt(s * (46 - i * 9) * span)} {fmt(y + (i * 9 - 8) * span)}', mix(c, '#a89870', 0.6), 1.1, 0.8)
        elif kind == 'fairy':
            for (dy, sc) in ((-8, 1.0), (10, 0.7)):
                out += f'<ellipse cx="{fmt(s * 18 * span * sc)}" cy="{fmt(y + dy)}" rx="{fmt(16 * span * sc)}" ry="{fmt(9 * span * sc)}" transform="rotate({s * -25} {fmt(s * 18 * span * sc)} {fmt(y + dy)})" fill="{c}" fill-opacity=".55" stroke-width="1.6"/>'
    return out


def tail(kind, c, x0=0, y0=-40, side=-1, tip=None):
    if kind == 'devil':
        d = f'M{fmt(x0)} {fmt(y0)} Q{fmt(x0 + side * 26)} {fmt(y0 + 30)} {fmt(x0 + side * 34)} {fmt(y0 + 8)} Q{fmt(x0 + side * 40)} {fmt(y0 - 8)} {fmt(x0 + side * 30)} {fmt(y0 - 14)}'
        out = curve(d, 3, c)
        tx, ty = x0 + side * 30, y0 - 14
        out += shape(f'M{fmt(tx)} {fmt(ty - 6)} L{fmt(tx + side * 6)} {fmt(ty + 2)} L{fmt(tx - side * 4)} {fmt(ty + 2)} Z', tip or c, sw=1.6)
        return out
    if kind == 'fox':
        return shape(f'M{fmt(x0)} {fmt(y0)} Q{fmt(x0 + side * 30)} {fmt(y0 + 10)} {fmt(x0 + side * 36)} {fmt(y0 - 20)} Q{fmt(x0 + side * 24)} {fmt(y0 - 8)} {fmt(x0)} {fmt(y0 - 6)} Z', D.vol(c))
    return ''


def aura(r, c, y=-50, op=0.16):
    return f'<circle cx="0" cy="{fmt(y)}" r="{fmt(r)}" fill="{c}" opacity="{op}" stroke="none"/>'


# ———————————————————— сборка ————————————————————

def wrap(inner, defs=''):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VB}" width="240" height="270">'
            f'{"<defs>" + defs + "</defs>" if defs else ""}'
            f'<g stroke="{OUT_LINE}" stroke-width="{SW}" stroke-linejoin="round" stroke-linecap="round">{inner}</g></svg>\n')


def smil(m, px, py):
    kind, amp, per, ph = m['kind'], m.get('amp', 0), m.get('period', 2), m.get('phase', 0)
    begin = f'{-ph / (2 * math.pi) * per:.2f}s'
    n = 12
    sines = [math.sin(2 * math.pi * i / n) for i in range(n + 1)]
    if kind in ('sway', 'swing'):
        vals = ';'.join(f'{amp * s:.2f} {fmt(px)} {fmt(py)}' for s in sines)
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


def part(id_, pivot, svg, motion=None, follow=False, breath=False, role=None):
    """Слой персонажа. defs забираются из текущего набора градиентов."""
    p = {'id': id_, 'pivot': pivot, 'svg': svg}
    if motion:
        p['motion'] = motion
    if follow:
        p['follow'] = True
    if breath:
        p['breath'] = True
    if role:
        p['role'] = role
    return p


def sway(amp, period, phase=0.0):
    return {'kind': 'sway', 'amp': amp, 'period': period, 'phase': phase}


def swing(amp, period, phase=0.0):
    return {'kind': 'swing', 'amp': amp, 'period': period, 'phase': phase}


def breathe(amp, period, phase=0.0):
    return {'kind': 'breathe', 'amp': amp, 'period': period, 'phase': phase}


def bob(amp, period, phase=0.0):
    return {'kind': 'bob', 'amp': amp, 'period': period, 'phase': phase}


def pulse(amp, period, phase=0.0):
    return {'kind': 'pulse', 'amp': amp, 'period': period, 'phase': phase}


def blink(period, phase=0.0):
    return {'kind': 'blink', 'period': period, 'phase': phase}


def start(key):
    """Совместимость: градиенты копятся до build() и целиком попадают во все слои персонажа."""


def build(out_dir, key, parts, hand=None, top=None, idle=None):
    """Пишет units/<key>.svg (с анимацией), rig/<key>/*.svg и возвращает запись для rigs.json."""
    rdir = os.path.join(out_dir, 'rig', key)
    os.makedirs(rdir, exist_ok=True)
    for f in os.listdir(rdir):
        os.remove(os.path.join(rdir, f))
    comp, still, meta = [], [], []
    torso = next((p for p in parts if p.get('breath')), None)
    # Все градиенты персонажа (накопленные с прошлого build) — в каждый слой: слой не зависит от соседей.
    defs = D.take() + ''.join(p.get('defs', '') for p in parts)
    # Каждому слою — только его градиенты (иначе слои раздуваются в разы).
    import re
    items = re.findall(r'<(?:linear|radial)Gradient id="([^"]+)".*?</(?:linear|radial)Gradient>', defs, flags=re.S)
    blocks = dict(zip(items, re.findall(r'<(?:linear|radial)Gradient id="[^"]+".*?</(?:linear|radial)Gradient>', defs, flags=re.S)))
    for p in parts:
        px, py = p['pivot']
        used = ''.join(blocks[i] for i in set(re.findall(r'url\(#([^)]+)\)', p['svg'])) if i in blocks)
        open(os.path.join(rdir, p['id'] + '.svg'), 'w').write(wrap(p['svg'], used))
        inner = p['svg']
        m = p.get('motion')
        # Статичный кадр для плиток списков: моргание и вспышки в покое.
        if not (m and m['kind'] == 'blink'):
            still.append(p['svg'])
        if m and m['kind'] == 'breathe':
            inner = f'<g transform="translate({fmt(px)} {fmt(py)})"><g>{smil(m, px, py)}<g transform="translate({fmt(-px)} {fmt(-py)})">{inner}</g></g></g>'
        elif m:
            inner = f'<g>{smil(m, px, py)}{inner}</g>'
        if p.get('follow') and torso:
            tm = torso['motion']
            lift = round(tm['amp'] * (torso['pivot'][1] - py), 2)
            inner = f'<g>{smil({"kind": "bob", "amp": -lift, "period": tm["period"], "phase": tm.get("phase", 0)}, 0, 0)}{inner}</g>'
        comp.append(inner)
        meta.append({'id': p['id'], 'pivot': [round(px, 1), round(py, 1)],
                     **({'motion': m} if m else {}), **({'follow': True} if p.get('follow') else {}),
                     **({'role': p['role']} if p.get('role') else {})})
    open(os.path.join(out_dir, 'units', key + '.svg'), 'w').write(wrap(''.join(comp), defs))
    os.makedirs(os.path.join(out_dir, 'still'), exist_ok=True)
    open(os.path.join(out_dir, 'still', key + '.svg'), 'w').write(wrap(''.join(still), defs))
    rec = {'parts': meta}
    if hand:
        rec['hand'] = [round(hand[0], 1), round(hand[1], 1)]
    if top:
        rec['top'] = top
    if idle:
        rec['idle'] = idle
    return rec


# ———————————————————— готовый гуманоид ————————————————————

def humanoid(key, out_dir, *, h=100, build_=1.0, female=False, skin='#f3c9a8', kind=None,
             legs_kw=None, body=None, head_kw=None, hair_style=None, hair_c=None, headgear=None,
             back=None, front_arm=None, back_arm=None, extras_front=None, extras_back=None, fx=None,
             hand=None, period=3.0, breath_amp=0.018, hair_sway=4.0, blink_p=4.0, idle=None, top=None):
    """Собирает типового гуманоида из деталей.

    back: [(id, pivot, svg, motion)] — слои за телом (плащ, крылья, хвост, волосы сзади).
    body: svg торса (вызывается после legs). front_arm/back_arm: (svg, pivot) — рука вместе с оружием.
    fx: [(id, pivot, svg, motion)] — свечение поверх всего.
    """
    start(key)
    b = Body(h, build_, female)
    kind = kind or ('f' if female else 'm')
    parts = []
    hb, hf = hair(b, hair_c, hair_style) if hair_style else ('', '')
    for (id_, pv, svg, m) in (back or []):
        parts.append(part(id_, pv, svg, m, follow=True))
    if hb:
        parts.append(part('hairBack', (0, b.hy), hb, sway(hair_sway, period * 0.6, 0.5), follow=True))
    if back_arm:
        svg, pv = back_arm[0], back_arm[1]
        parts.append(part('armBack', pv, svg, sway(1.5, period, 2.0), follow=True))
    parts.append(part('legs', (0, b.hip), legs(b, **(legs_kw or {}))))
    parts.append(part('torso', (0, b.hip + 4), body(b) if callable(body) else body, breathe(breath_amp, period), breath=True))
    hk = dict(head_kw or {})
    parts.append(part('head', (0, b.neck), head(b, skin, kind, **hk), sway(1.8, period, 0.4), follow=True, role='head'))
    if blink_p and kind not in ('beast',) and not hk.get('glow_eyes'):
        parts.append(part('eyes', (0, b.hy), eyes_closed(b, skin, kind), blink(blink_p, 0.7), follow=True, role='head'))
    if hf:
        parts.append(part('hairFront', (0, b.hy - b.hr), hf, sway(hair_sway * 0.6, period * 0.6, 1.1), follow=True, role='head'))
    if headgear:
        parts.append(part('headgear', (0, b.hy - b.hr), headgear(b) if callable(headgear) else headgear,
                          sway(2.4, period, 0.9), follow=True, role='head'))
    for (id_, pv, svg, m) in (extras_back or []):
        parts.append(part(id_, pv, svg, m, follow=True))
    if front_arm:
        svg, pv = front_arm[0], front_arm[1]
        parts.append(part('armFront', pv, svg, swing(2.2, period, 1.3), follow=True, role='weapon'))
    for (id_, pv, svg, m) in (extras_front or []):
        parts.append(part(id_, pv, svg, m, follow=True))
    for (id_, pv, svg, m) in (fx or []):
        parts.append(part(id_, pv, svg, m, follow=True, role='fx'))
    return build(out_dir, key, parts, hand=hand, top=top or round(h + 4), idle=idle)
