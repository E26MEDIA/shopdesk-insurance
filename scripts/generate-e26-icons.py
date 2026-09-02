#!/usr/bin/env python3
"""Generate E26 app icons for Windows installer and desktop."""
from __future__ import annotations

import struct
import zlib
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Pillow required: pip install pillow") from exc

ROOT = Path(__file__).resolve().parents[1]
OUT_PNG = ROOT / "resources" / "icon.png"
OUT_ICO = ROOT / "resources" / "icon.ico"
BG = "#0f3d3e"
FG = "#ffffff"


def _font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
    ):
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def render(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    radius = max(4, size // 6)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=BG)
    font_size = max(10, int(size * 0.34))
    font = _font(font_size)
    text = "E26"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    draw.text(((size - tw) / 2, (size - th) / 2 - bbox[1]), text, fill=FG, font=font)
    return img


def main() -> None:
    OUT_PNG.parent.mkdir(parents=True, exist_ok=True)
    png = render(256)
    png.save(OUT_PNG, format="PNG")
    sizes = [16, 32, 48, 64, 128, 256]
    png.save(OUT_ICO, format="ICO", sizes=[(s, s) for s in sizes])
    print(f"Wrote {OUT_PNG} and {OUT_ICO}")


if __name__ == "__main__":
    main()
