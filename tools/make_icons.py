"""Gera os ícones do PWA (192, 512, maskable, apple-touch). Uso: python3 tools/make_icons.py"""
from PIL import Image, ImageDraw, ImageFont

BG, CY, BL = (10, 18, 32), (34, 211, 238), (59, 130, 246)

def draw(size, safe=1.0):
    S = size * 4                                   # supersampling p/ bordas suaves
    im = Image.new("RGB", (S, S), BG)
    d = ImageDraw.Draw(im)
    k = S * safe / 512
    ox = oy = S * (1 - safe) / 2
    P = lambda x, y: (ox + x * k, oy + y * k)
    # silhueta de carro (contorno neon)
    body = [P(70, 300), P(110, 230), P(190, 200), P(250, 150), P(360, 150), P(410, 205), P(450, 220), P(460, 290), P(440, 300)]
    d.line(body + [P(70, 300)], fill=CY, width=int(14 * k), joint="curve")
    d.line([P(190, 205), P(255, 158), P(355, 158), P(395, 208), P(190, 205)], fill=BL, width=int(8 * k), joint="curve")
    for cx in (155, 365):
        d.ellipse([*P(cx - 42, 265), *P(cx + 42, 349)], fill=BG, outline=CY, width=int(14 * k))
        d.ellipse([*P(cx - 12, 295), *P(cx + 12, 319)], fill=BL)
    f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", int(68 * k))
    d.text(P(256, 415), "LAV", font=f, fill=CY, anchor="rm")
    d.text(P(256, 415), "BOX", font=f, fill=(255, 255, 255), anchor="lm")
    return im.resize((size, size), Image.LANCZOS)

draw(192).save("icons/icon-192.png")
draw(512).save("icons/icon-512.png")
draw(512, safe=0.72).save("icons/maskable-512.png")   # área segura p/ máscaras adaptativas
draw(180).save("icons/apple-touch-icon.png")
print("ok")
