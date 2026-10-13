# 验证新 APNG：每个动作抽 6 帧拼成一张图，目测眼/白脸/绿边/动作
import os, math
import numpy as np
from PIL import Image

BASE = r'C:/Users/hxw/Desktop/lolo'
OUTD = r'C:/Users/hxw/AppData/Local/Temp/lolo_verify'
os.makedirs(OUTD, exist_ok=True)

NAMES = ['sleep', 'walk', 'turn', 'upside_down', 'cheer', 'grab', 'drop']
PICK = 6
TW, TH = 160, 213  # 1080x1440 比例

rows = []
for name in NAMES:
    im = Image.open(os.path.join(BASE, 'assets', 'videos', name + '.png'))
    n = im.n_frames
    idxs = [int(round(i * (n - 1) / (PICK - 1))) for i in range(PICK)]
    row = Image.new('RGB', (PICK * TW, TH), (40, 40, 40))
    for c, fi in enumerate(idxs):
        im.seek(fi)
        fr = im.convert('RGBA')
        # 铺深灰底看透明效果
        bg = Image.new('RGBA', fr.size, (70, 70, 70, 255))
        bg.alpha_composite(fr)
        bg = bg.convert('RGB').resize((TW, TH))
        row.paste(bg, (c * TW, 0))
    rows.append(row)

sheet = Image.new('RGB', (PICK * TW, len(rows) * TH), (40, 40, 40))
for r, row in enumerate(rows):
    sheet.paste(row, (0, r * TH))
out = os.path.join(OUTD, 'verify_apng.png')
sheet.save(out)
print('SAVED', out)
