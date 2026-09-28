"""Generates Personare's app icons from its logo (docs/specs/app-icon.md).

A placeholder until the final brand asset: the website's logo (a 2x2 grid of
rounded squares, the last in the brand blue) on a dark rounded tile, so it
reads on light and dark docks and taskbars alike. Writes assets/icon.png
(Linux), assets/icon.ico (Windows) and assets/icon.icns (macOS).

Run from the repo root: python scripts/generate-icons.py (needs Pillow).
"""

from pathlib import Path

from PIL import Image, ImageDraw

SIZE = 1024
SUPERSAMPLE = 4
TILE_COLOR = (23, 23, 23, 255)  # #171717, the logo's dark-mode backdrop
SQUARE_COLOR = (250, 250, 250)  # #fafafa
BRAND_BLUE = (59, 108, 246, 255)  # #3b6cf6

# The logo in its 24-unit viewBox: (x, y, color). Opacities as in the
# website's favicon on a dark background.
SQUARES = [
    (1, 1, (*SQUARE_COLOR, round(0.2 * 255))),
    (13, 1, (*SQUARE_COLOR, round(0.45 * 255))),
    (1, 13, (*SQUARE_COLOR, round(0.7 * 255))),
    (13, 13, BRAND_BLUE),
]


def draw_icon() -> Image.Image:
    size = SIZE * SUPERSAMPLE
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    # macOS-style tile: about 10% margin around a rounded square.
    margin = round(size * 0.1)
    draw.rounded_rectangle(
        (margin, margin, size - margin, size - margin),
        radius=round(size * 0.18),
        fill=TILE_COLOR,
    )

    # The logo, centered on the tile.
    logo = round(size * 0.52)
    unit = logo / 24
    origin = (size - logo) / 2
    for x, y, color in SQUARES:
        layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        ImageDraw.Draw(layer).rounded_rectangle(
            (
                origin + x * unit,
                origin + y * unit,
                origin + (x + 10) * unit,
                origin + (y + 10) * unit,
            ),
            radius=2.5 * unit,
            fill=color,
        )
        image = Image.alpha_composite(image, layer)

    return image.resize((SIZE, SIZE), Image.LANCZOS)


def main() -> None:
    assets = Path(__file__).resolve().parent.parent / "assets"
    assets.mkdir(exist_ok=True)
    icon = draw_icon()
    icon.save(assets / "icon.png")
    icon.save(
        assets / "icon.ico",
        sizes=[(s, s) for s in (16, 24, 32, 48, 64, 128, 256)],
    )
    icon.save(assets / "icon.icns")


if __name__ == "__main__":
    main()
