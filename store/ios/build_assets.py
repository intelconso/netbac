"""Generates the App Store screenshots into store/ios/out/.

    python3 store/ios/build_assets.py

Same layout as the HalalConso store shots (../pro-app-halalconso/store/ios/build_assets.py): gradient,
faint discs, a two-line French caption, the capture with rounded corners, a soft shadow and a light rim.
NETBAC colors: emerald gradient from the brand primary #10B981, darkened so white text reads, mint
second line. The whole screen is kept (fitted, not cropped): the tab bar is part of what the shot shows.

- raw/iphone/NN-*.png  real iPhone captures (any iPhone size)   -> out/iphone/  1290x2796 (6.9")
- raw/ipad/NN-*.png    real iPad captures (optional)            -> out/ipad/    2048x2732 (13")
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw"
OUT = HERE / "out"
FONT = HERE / "fonts/PlusJakartaSans_800ExtraBold.ttf"

GREEN_TOP = (5, 150, 105)  # emerald-600
GREEN_BOTTOM = (6, 78, 59)  # emerald-900
AMBER = (167, 243, 208)  # emerald-200 (name kept from the HalalConso script: the second-line accent)
WHITE = (255, 255, 255)

SCREENSHOTS = [
    ("01-tableau-de-bord.png", "Votre traçabilité HACCP", "sur un seul écran"),
    ("02-tracabilite.png", "Vos contrôles du jour", "sans un papier"),
    ("03-etiquetage.png", "Étiquetez vos produits", "en quelques secondes"),
    ("04-alertes-dlc.png", "Les DLC sous contrôle", "alertes avant expiration"),
    ("05-taches.png", "Les tâches de l’équipe", "cochées et tracées"),
    ("06-vue-spatiale.png", "Chaque frigo, chaque bac", "en un coup d’œil"),
    ("07-inventaire.png", "Votre stock", "suivi automatiquement"),
    ("08-courses.png", "La liste de courses", "partagée en un geste"),
    ("09-notes.png", "Les notes de l’équipe", "sur tous les téléphones"),
]

# Status bar height in points by screen width in points (pixels / scale): notch 47, Dynamic Island 54-62.
STATUS_BAR_PT = {375: 44, 390: 47, 428: 47, 393: 54, 430: 54, 402: 62, 440: 62}
IPAD_STATUS_BAR_PT = 24

SIZES = {"iphone": (1290, 2796), "ipad": (2048, 2732)}


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT), size)


def gradient(w: int, h: int) -> Image.Image:
    # Built at 1/8 size and scaled up: same diagonal blend, far faster than per pixel at full size.
    sw, sh = w // 8, h // 8
    img = Image.new("RGB", (sw, sh))
    px = img.load()
    for y in range(sh):
        for x in range(sw):
            t = x / sw * 0.35 + y / sh * 0.65
            px[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(GREEN_TOP, GREEN_BOTTOM))
    return img.resize((w, h), Image.BICUBIC)


def soft_circles(img: Image.Image, circles) -> Image.Image:
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for cx, cy, r in circles:
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(255, 255, 255, 14))
    return Image.alpha_composite(img.convert("RGBA"), layer)


def rounded(img: Image.Image, r: int) -> Image.Image:
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, *img.size), r, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def status_bar_px(shot: Image.Image, kind: str) -> int:
    if kind == "ipad":
        return IPAD_STATUS_BAR_PT * 2
    scale = 3 if shot.width >= 1080 else 2
    return STATUS_BAR_PT.get(round(shot.width / scale), 54) * scale


def build(kind: str, raw: Path, line1: str, line2: str):
    w, h = SIZES[kind]
    ipad = kind == "ipad"
    img = soft_circles(gradient(w, h), [(w - 120, 150, 320), (70, h - 180, 280)])
    d = ImageDraw.Draw(img)
    size, top, gap = (96, 130, 120) if ipad else (80, 150, 102)
    f = font(size)
    for i, (text, color) in enumerate(((line1, WHITE), (line2, AMBER))):
        d.text(((w - d.textlength(text, font=f)) / 2, top + i * gap), text, font=f, fill=color)

    shot = Image.open(raw).convert("RGB")
    shot = shot.crop((0, status_bar_px(shot, kind), shot.width, shot.height))
    y = top + 2 * gap + (100 if ipad else 70)
    box_w, box_h = w - (240 if ipad else 160), h - y - 90
    k = min(box_w / shot.width, box_h / shot.height)
    shot = shot.resize((round(shot.width * k), round(shot.height * k)), Image.LANCZOS)
    r = 40 if ipad else 56
    shot = rounded(shot, r)
    x = (w - shot.width) // 2

    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((x, y + 16, x + shot.width, y + shot.height + 16), r, fill=(0, 0, 0, 110))
    img = Image.alpha_composite(img, shadow.filter(ImageFilter.GaussianBlur(26)))
    rim = Image.new("RGBA", (shot.width + 14, shot.height + 14), (0, 0, 0, 0))
    ImageDraw.Draw(rim).rounded_rectangle((0, 0, *rim.size), r + 7, fill=(255, 255, 255, 60))
    img.alpha_composite(rim, (x - 7, y - 7))
    img.alpha_composite(shot, (x, y))
    img.convert("RGB").save(OUT / kind / raw.name)


if __name__ == "__main__":
    for kind in SIZES:
        (OUT / kind).mkdir(parents=True, exist_ok=True)
        for name, l1, l2 in SCREENSHOTS:
            raw = RAW / kind / name
            if raw.exists():
                build(kind, raw, l1, l2)
                print("built", OUT / kind / name)
            else:
                print("missing", raw)
