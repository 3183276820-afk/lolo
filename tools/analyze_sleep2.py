import sys, os
sys.path.insert(0, 'tools')
import numpy as np
from PIL import Image
from rematte_lib import extract

BASE = r'C:/Users/hxw/Desktop/lolo'
v = os.path.join(BASE, r'睡觉\睡觉\睡觉-1.mp4')
d = os.path.join(os.environ['TEMP'], 'lolo_sleep2')
fs = extract(v, d)
print('frames:', len(fs))

def metrics(rgb):
    r = rgb[:, :, 0].astype(int); g = rgb[:, :, 1].astype(int); b = rgb[:, :, 2].astype(int)
    green = g - np.maximum(r, b)
    bg_ref = np.median(green)  # 背景占多数
    bg = green > bg_ref * 0.5
    fg = ~bg
    area = fg.sum()
    if area < 100:
        return 0, 0, 0
    # 白肚皮指标: bbox 内亮且低饱和像素占比
    ys, xs = np.where(fg)
    top, bot, left, right = ys.min(), ys.max(), xs.min(), xs.max()
    sub = np.s_[top:bot+1, left:right+1]
    fgs = fg[sub]
    bright = fgs & (np.minimum(np.minimum(r[sub], g[sub]), b[sub]) > 170) & ((np.maximum(np.maximum(r[sub], g[sub]), b[sub]) - np.minimum(np.minimum(r[sub], g[sub]), b[sub])) < 45)
    white_frac = bright.sum() / fgs.sum()
    aspect = (bot - top) / max(right - left, 1)
    return round(white_frac, 3), round(aspect, 3), area

print('i  white_frac  aspect  area')
for i, f in enumerate(fs):
    rgb = np.asarray(Image.open(f).convert('RGB'))
    wf, asp, area = metrics(rgb)
    mark = ''
    if i >= 1:
        pw = rows_prev[0] if 'rows_prev' in dir() else 0
    print(f'{i:3d}  {wf:.3f}  {asp:.3f}  {area}')
    rows_prev = (wf,)
