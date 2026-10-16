"""App icon + iOS launch screens. Drawn at 4096px and downsampled for crisp edges.
Usage: python3 scripts/make-icons.py assets/icons   (needs Pillow, Inter and WenQuanYi Zen Hei fonts)"""
import sys, os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
S = 4096
INTER = '/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf'
WQY = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def gradient(size, c1, c2):
    # diagonal gradient top-left -> bottom-right
    small = Image.new('RGB', (256, 256))
    px = small.load()
    for y in range(256):
        for x in range(256):
            px[x, y] = lerp(c1, c2, (x + y) / 510)
    return small.resize((size, size), Image.BICUBIC)

def bubble(layer_size, box, tail, fill, radius):
    """Rounded-rect speech bubble with a tail, returned as RGBA layer + shadow."""
    im = Image.new('RGBA', (layer_size, layer_size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle(box, radius=radius, fill=fill)
    d.polygon(tail, fill=fill)
    return im

def shadow_of(layer, offset, blur, alpha):
    a = layer.split()[3].point(lambda v: int(v * alpha))
    sh = Image.new('RGBA', layer.size, (20, 6, 70, 0))
    sh.putalpha(a)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    out = Image.new('RGBA', layer.size, (0, 0, 0, 0))
    out.paste(sh, offset, sh)
    return out

def text_center(d, cx, cy, txt, font, fill, stroke=0):
    bb = d.textbbox((0, 0), txt, font=font, stroke_width=stroke)
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    d.text((cx - w / 2 - bb[0], cy - h / 2 - bb[1]), txt, font=font, fill=fill, stroke_width=stroke, stroke_fill=fill)

def icon(full_bleed=True):
    bg = gradient(S, (132, 98, 255), (74, 38, 214)).convert('RGBA')
    # soft glow top-left
    glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([-S * 0.25, -S * 0.3, S * 0.75, S * 0.6], fill=(255, 255, 255, 40))
    bg = Image.alpha_composite(bg, glow.filter(ImageFilter.GaussianBlur(S * 0.14)))

    k = S / 1024
    # scale artwork down a bit so it survives the maskable safe zone (80%)
    def B(x0, y0, x1, y1):
        return [x0 * k, y0 * k, x1 * k, y1 * k]
    def P(pts):
        return [(x * k, y * k) for x, y in pts]

    layers = []
    # back-right coral bubble: Korean
    b1 = bubble(S, B(520, 190, 850, 480), P([(760, 470), (820, 560), (690, 475)]), (238, 84, 140, 255), 80 * k)
    # back-left amber bubble: Japanese
    b2 = bubble(S, B(170, 230, 450, 490), P([(220, 480), (190, 560), (300, 482)]), (255, 196, 61, 255), 72 * k)
    # front white bubble: English
    b3 = bubble(S, B(250, 400, 780, 820), P([(380, 810), (330, 930), (500, 815)]), (255, 255, 255, 255), 120 * k)
    for b in (b2, b1, b3):
        bg = Image.alpha_composite(bg, shadow_of(b, (0, int(18 * k)), 28 * k, 0.45))
        bg = Image.alpha_composite(bg, b)

    d = ImageDraw.Draw(bg)
    hangul = ImageFont.truetype(WQY, int(200 * k))
    kana = ImageFont.truetype(WQY, int(180 * k))
    latin = ImageFont.truetype(INTER, int(300 * k))
    text_center(d, 685 * k, 335 * k, '가', hangul, (255, 255, 255, 255), stroke=int(9 * k))
    text_center(d, 310 * k, 360 * k, 'あ', kana, (92, 52, 0, 255), stroke=int(8 * k))
    text_center(d, 515 * k, 605 * k, 'Aa', latin, (98, 64, 240, 255))
    return bg.convert('RGB')

master = icon()
for size, name in [(180, 'apple-touch-icon.png'), (167, 'apple-touch-icon-167.png'), (152, 'apple-touch-icon-152.png'),
                   (120, 'apple-touch-icon-120.png'), (192, 'icon-192.png'), (512, 'icon-512.png'), (64, 'favicon-64.png')]:
    master.resize((size, size), Image.LANCZOS).save(f'{OUT}/{name}', optimize=True)

# maskable: artwork scaled to 80% on the same background so nothing is clipped by circle masks
bgonly = gradient(1024, (132, 98, 255), (74, 38, 214))
art = master.resize((820, 820), Image.LANCZOS)
bgonly.paste(art, (102, 102))
bgonly.resize((512, 512), Image.LANCZOS).save(f'{OUT}/icon-maskable-512.png', optimize=True)

# launch screens (portrait + landscape, light + dark): centered icon on the app background
SPLASH = {
    'iphone-pro-max': (1320, 2868),   # iPhone 16/17 Pro Max, 440x956 @3x
    'ipad-air-11': (1640, 2360),      # iPad Air 11" (M2-M5), 820x1180 @2x
    'ipad-air-13': (2048, 2732),      # iPad Air 13" (M2-M5), 1024x1366 @2x
}
BG = {'light': (246, 244, 255), 'dark': (20, 18, 31)}
icon_r = master.resize((512, 512), Image.LANCZOS)
mask = Image.new('L', (512, 512), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, 511, 511], radius=115, fill=255)
for name, (w, h) in SPLASH.items():
    for orient, (W, H) in (('portrait', (w, h)), ('landscape', (h, w))):
        for theme, color in BG.items():
            im = Image.new('RGB', (W, H), color)
            side = int(min(W, H) * 0.28)
            ic = icon_r.resize((side, side), Image.LANCZOS)
            m = mask.resize((side, side), Image.LANCZOS)
            im.paste(ic, ((W - side) // 2, (H - side) // 2 - side // 6), m)
            im.save(f'{OUT}/splash-{name}-{orient}-{theme}.png', optimize=True)
print('ok')
