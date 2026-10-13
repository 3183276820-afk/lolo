# 验证拼图：每个动作抽若干帧，灰底显示，目测白脸/绿边/动作内容
import os
import numpy as np
from PIL import Image

BASE = r'C:/Users/hxw/Desktop/lolo'
OUT = os.path.join(BASE, 'assets', 'videos')
TMP = r'C:/Users/hxw/AppData/Local/Temp/lolo_verify2'
os.makedirs(TMP, exist_ok=True)
BG = (110, 110, 110)

ITEMS = [('sleep',6),('walk',6),('walk_left',6),('turn',5),('upside_down',4),('cheer',5),('grab',4),('drop',5)]
tw, th = 200, 266
rows = []
for name, n in ITEMS:
    im = Image.open(os.path.join(OUT, name + '.png'))
    N = im.n_frames
    idxs = [int(round(i*(N-1)/(n-1))) for i in range(n)] if N > 1 else [0]
    row = Image.new('RGB', (n*tw, th + 24), (40,40,40))
    for c, fi in enumerate(idxs):
        im.seek(fi)
        fr = im.convert('RGBA')
        bg = Image.new('RGBA', fr.size, BG + (255,)); bg.alpha_composite(fr)
        row.paste(bg.convert('RGB').resize((tw,th)), (c*tw, 24))
    # 标题
    from PIL import ImageDraw
    d = ImageDraw.Draw(row); d.text((4,4), name + ' ('+str(N)+'f)', fill=(255,255,80))
    rows.append(row)

sheet = Image.new('RGB', (max(r.width for r in rows), sum(r.height for r in rows)))
y = 0
for r in rows:
    sheet.paste(r, (0, y)); y += r.height
p = os.path.join(TMP, 'verify2.png')
sheet.save(p)
print('saved', p, sheet.size)
