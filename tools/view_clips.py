# 目测：当前 walk/sleep APNG + 新走路/加油 -1 片段
import os, shutil, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rematte_lib import extract

BASE = r'C:/Users/hxw/Desktop/lolo'
T = r'C:/Users/hxw/AppData/Local/Temp/lolo_insp'
os.makedirs(T, exist_ok=True)

def sheet_apng(name, n=8, tw=180, th=240):
    im = Image.open(os.path.join(BASE, 'assets/videos', name + '.png'))
    N = im.n_frames
    idxs = [int(round(i*(N-1)/(n-1))) for i in range(n)]
    row = Image.new('RGB', (n*tw, th), (50,50,50))
    for c,fi in enumerate(idxs):
        im.seek(fi)
        bg = Image.new('RGBA', im.size, (90,90,90,255)); bg.alpha_composite(im.convert('RGBA'))
        row.paste(bg.convert('RGB').resize((tw,th)), (c*tw,0))
    return row

def sheet_clip(v, name, n=8, tw=180, th=240):
    d = os.path.join(T, name); shutil.rmtree(d, ignore_errors=True); os.makedirs(d, exist_ok=True)
    fs = extract(v, d)
    N = len(fs)
    idxs = [int(round(i*(N-1)/(n-1))) for i in range(n)]
    row = Image.new('RGB', (n*tw, th), (50,50,50))
    for c,fi in enumerate(idxs):
        im = Image.open(fs[fi]).convert('RGB'); row.paste(im.resize((tw,th)), (c*tw,0))
    return row

rows = [
    sheet_apng('walk', 8),
    sheet_apng('sleep', 8),
    sheet_clip(r'走路\走路\走路-1.mp4', 'walknew'),
    sheet_clip(r'加油\加油\加油\加油-1.mp4', 'cheernew'),
]
H = sum(r.height for r in rows)
sheet = Image.new('RGB', (rows[0].width, H), (50,50,50))
y=0
for r in rows:
    sheet.paste(r,(0,y)); y+=r.height
out = os.path.join(T,'inspect.png'); sheet.save(out)
print('SAVED', out)
