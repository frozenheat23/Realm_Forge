# Turns the big draft images in assets/ into the small files the game loads from public/.
# Portraits become 512 x 768 WebP; frames lose their white background and become PNG.
#
# Needs Pillow. One way, from the project folder:
#   python3 -m venv .venv && .venv/bin/pip install pillow==10.4.0
#   .venv/bin/python scripts/portraits.py
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

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
FRAMES = {"ordinary": "frame-drafts/frame-ordinary.png", "great": "frame-drafts/frame-great-v2.png"}


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
