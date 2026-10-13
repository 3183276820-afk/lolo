import sys, os
sys.path.insert(0, 'tools')
import numpy as np
from PIL import Image
from rematte_lib import extract

BASE = r'C:/Users/hxw/Desktop/lolo'
v = os.path.join(BASE, r'睡觉\睡觉\睡觉-1.mp4')
d = os.path.join(os.environ['TEMP'], 'lolo_sleep')
fs = extract(v, d)
print('frames:', len(fs))

def fg_mask(rgb):
    r = rgb[:, :, 0].astype(int); g = rgb[:, :, 1].astype(int); b = rgb[:, :, 2].astype(int)
    green = g - np.maximum(r, b)
    bg_ref = np.percentile(green[green > 0], 30) if (green > 0).any() else 30
    bg = green > max(bg_ref * 0.5, 8)
    return bg

rows = []
for i, f in enumerate(fs):
    im = np.asarray(Image.open(f).convert('RGB'))
    m = fg_mask(im)
    ys, xs = np.where(m)
    if len(ys) == 0:
        rows.append((i, 0, 0, 0, 0, 0, 0)); continue
    top, bot = ys.min(), ys.max(); left, right = xs.min(), xs.max()
    h = bot - top; w = right - left
    cy = (top + bot) / 2 / im.shape[0]
    rows.append((i, top, bot, left, right, h, w, round(cy, 3)))

print('i  top  bot  left right  h    w    cy')
for r in rows[::2]:
    print(r)

# 接触表
n = min(24, len(fs)); idxs = [int(round(k * (len(fs) - 1) / (n - 1))) for k in range(n)]
tw, th = 200, 266; cols = 8
sheet = Image.new('RGB', (cols * tw, ((n + cols - 1) // cols) * th), (60, 60, 60))
for c, fi in enumerate(idxs):
    im = Image.open(fs[fi]).convert('RGBA')
    bg = Image.new('RGBA', im.size, (90, 90, 90, 255)); bg.alpha_composite(im)
    sheet.paste(bg.convert('RGB').resize((tw, th)), ((c % cols) * tw, (c // cols) * th))
sheet.save(os.path.join(os.environ['TEMP'], 'lolo_sleep', 'sheet.png'))
print('sheet saved ->', os.path.join(os.environ['TEMP'], 'lolo_sleep', 'sheet.png'))
