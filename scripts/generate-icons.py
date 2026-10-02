"""Export the temporary Shopping Concierge mark. Requires Pillow (tooling only)."""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / 'apps/mobile/assets'
SCALE = 4
PINE = '#244d3a'
IVORY = '#fffaf0'
GOLD = '#caa45b'

def draw_icon(background, monochrome=False):
    image = Image.new('RGBA', (1024 * SCALE, 1024 * SCALE), background)
    d = ImageDraw.Draw(image)
    box = lambda coords: tuple(v * SCALE for v in coords)
    ink = 'white' if monochrome else IVORY
    d.rounded_rectangle(box((408, 290, 616, 520)), radius=104 * SCALE, outline=ink, width=34 * SCALE)
    d.rounded_rectangle(box((304, 410, 720, 736)), radius=48 * SCALE, fill=ink)
    diamond = [(512, 477), (574, 560), (512, 643), (450, 560)]
    d.polygon([(x * SCALE, y * SCALE) for x, y in diamond], fill=(0, 0, 0, 0) if monochrome else GOLD)
    return image.resize((1024, 1024), Image.Resampling.LANCZOS)

OUT.mkdir(parents=True, exist_ok=True)
draw_icon(PINE).convert('RGB').save(OUT / 'icon.png')
draw_icon((0, 0, 0, 0)).save(OUT / 'adaptive-foreground.png')
draw_icon((0, 0, 0, 0), True).save(OUT / 'adaptive-monochrome.png')
print('Generated 1024px icon, transparent adaptive foreground, and monochrome mask.')
