# Turns the big draft images in assets/ into the small files the game loads from public/.
# Portraits become 512 x 768 WebP; frames lose their white background and become PNG,
# and each frame's red wax seal is lifted out as a grey layer the game colors per nation.
#
# Needs Pillow. One way, from the project folder:
#   python3 -m venv .venv && .venv/bin/pip install pillow==10.4.0
#   .venv/bin/python scripts/portraits.py
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent.parent
DRAFTS = ROOT / "assets"
OUT = ROOT / "public"
SIZE = (512, 768)
QUALITY = 82

# The first cut's ordinary rulers had shorter file names.
ORDINARY = {
    "human-m": "octo-leaders/human-m.png",
    "human-f": "octo-leaders/human-f.png",
    "lelf-m": "octo-leaders/lelf-m.png",
    "lelf-f": "octo-leaders/lelf-f.png",
    "delf-m": "octo-leaders/delf-m.png",
    "delf-f": "octo-leaders/delf-f.png",
    "orc-m": "octo-leaders/orc.png",
    "dwarf-m": "octo-leaders/dwarf.png",
}
FRAMES = {"ordinary": "frame-drafts/frame-parchment-ordinary.png", "great": "frame-drafts/frame-parchment.png"}
# The wax seal is the round red blob at the top center. Wax is redder (hue about 12 of 255),
# brighter and more saturated than the parchment's ink lines.
SEAL_TOP_SHARE = 0.2
SEAL_MAX_HUE = 14
SEAL_MIN_SATURATION = 150
SEAL_MIN_BRIGHTNESS = 110


def save_portrait(source: Path, name: str) -> None:
    image = Image.open(source).convert("RGB").resize(SIZE, Image.LANCZOS)
    image.save(OUT / "portraits" / f"{name}.webp", quality=QUALITY)


def cut_out_frame(source: Path, name: str) -> None:
    """Makes the white outside and inside the frame see-through, by flood-filling from the corners and the middle."""
    frame = Image.open(source).convert("RGB").resize(SIZE, Image.LANCZOS)
    w, h = SIZE
    marked = frame.copy()
    key = (255, 0, 255)
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, h // 2)]:
        ImageDraw.floodfill(marked, seed, key, thresh=40)
    # Anything not marked is frame: fully solid.
    diff = ImageChops.difference(marked, Image.new("RGB", SIZE, key)).convert("L")
    alpha = diff.point(lambda v: 255 if v > 8 else 0)
    frame.putalpha(alpha)
    frame.save(OUT / "frames" / f"{name}.png", optimize=True)
    # Report the see-through middle, for RULER_CARD_OPENINGS in render/palette.ts.
    hole = Image.new("L", SIZE, 0)
    hole.paste(255, mask=ImageChops.invert(alpha))
    ImageDraw.floodfill(hole, (w // 2, h // 2), 128)
    box = hole.point(lambda v: 255 if v == 128 else 0).getbbox()
    print(f"{name} opening (x0, y0, x1, y1 as shares of the frame): " + ", ".join(f"{v / s:.3f}" for v, s in zip(box, (w, h, w, h))))
    cut_out_seal(frame, name)


def cut_out_seal(frame: Image.Image, name: str) -> None:
    """Saves the wax seal alone, in light grey, so multiplying by a nation's color gives wax of that color."""
    w, h = SIZE
    hue, saturation, value = frame.convert("RGB").convert("HSV").split()
    tests = [hue.point(lambda v: 255 if v <= SEAL_MAX_HUE else 0),
             saturation.point(lambda v: 255 if v >= SEAL_MIN_SATURATION else 0),
             value.point(lambda v: 255 if v >= SEAL_MIN_BRIGHTNESS else 0)]
    red = tests[0]
    for test in tests[1:]:
        red = ImageChops.multiply(red, test)
    # Shrinking then growing again wipes out thin lines and specks but keeps a solid blob.
    red = red.filter(ImageFilter.MinFilter(7)).filter(ImageFilter.MaxFilter(7))
    # Keep only the blob that the frame's center line runs into first, near the top.
    start = next((y for y in range(int(h * SEAL_TOP_SHARE)) if red.getpixel((w // 2, y)) == 255), None)
    if start is None:
        print(f"{name}: no wax seal found")
        return
    ImageDraw.floodfill(red, (w // 2, start), 128)
    mask = red.point(lambda v: 255 if v == 128 else 0)
    # Fill the dark folds inside the seal, then soften the edge.
    mask = mask.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(9))
    box = mask.getbbox()
    # Brighten the wax so the darkest folds stay dark but the color reads clearly.
    grey = ImageOps.autocontrast(frame.convert("L"), cutoff=1).point(lambda v: 90 + v * 165 // 255)
    # Paste onto a clear sheet, so the hidden pixels are empty and the file stays small.
    seal = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    seal.paste(grey.convert("RGBA"), mask=mask.filter(ImageFilter.GaussianBlur(1)))
    seal.save(OUT / "frames" / f"{name}-seal.png", optimize=True)
    print(f"{name} seal at " + ", ".join(f"{v / s:.3f}" for v, s in zip(box, (w, h, w, h))))


def main() -> None:
    (OUT / "portraits").mkdir(parents=True, exist_ok=True)
    (OUT / "frames").mkdir(parents=True, exist_ok=True)
    count = 0
    for name, path in ORDINARY.items():
        save_portrait(DRAFTS / "portrait-drafts" / path, f"{name}-ordinary")
        count += 1
    for source in sorted((DRAFTS / "portrait-drafts" / "octo-great").glob("*.png")):
        save_portrait(source, source.stem)
        count += 1
    for name, path in FRAMES.items():
        cut_out_frame(DRAFTS / path, name)
    print(f"{count} portraits written to public/portraits")


if __name__ == "__main__":
    sys.exit(main())
