"""Render the existing OWL vector identity with Pillow; no generated image assets."""
from pathlib import Path
from PIL import Image, ImageDraw

target = Path(__file__).resolve().parents[1] / 'apps/web/public/icons'
target.mkdir(parents=True, exist_ok=True)
for name, size, safe in [('owl-192.png', 192, False), ('owl-512.png', 512, False), ('owl-maskable.png', 512, True)]:
    image = Image.new('RGB', (size, size), '#183c35')
    draw = ImageDraw.Draw(image)
    scale = size / 64 * (0.78 if safe else 1)
    offset = (size - 64 * scale) / 2
    def point(x, y): return (round(offset+x*scale), round(offset+y*scale))
    width = max(2, round(2*scale))
    path = [(13,16),(24,21),(32,15),(40,21),(51,16),(48,39),(32,49),(16,39),(13,16)]
    draw.line([point(*p) for p in path], fill='#d9edac', width=width, joint='curve')
    for cx in [24,40]:
        draw.ellipse([point(cx-7,24),point(cx+7,38)],outline='#d9edac',width=width)
        draw.ellipse([point(cx-2,29),point(cx+2,33)],fill='#d9edac')
    draw.line([point(29,38),point(32,42),point(35,38)],fill='#d9edac',width=width)
    image.save(target / name)
