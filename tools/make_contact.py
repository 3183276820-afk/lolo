# 生成故事板缩略图：把两段完整视频均匀抽帧并拼成网格，便于目测分段
import subprocess, os, glob, math
import numpy as np
from PIL import Image

FF = r'C:/Users/hxw/Desktop/lolo/node_modules/ffmpeg-static/ffmpeg.exe'
BASE = r'C:/Users/hxw/Desktop/lolo'
T = r'C:/Users/hxw/AppData/Local/Temp/lolo_contact'
os.makedirs(T, exist_ok=True)

N_FRAMES = 24   # 每段抽帧数
COLS = 6
ROWS = math.ceil(N_FRAMES / COLS)

for name in ['完整1.0', '完整2.0']:
    v = os.path.join(BASE, name + '.mp4')
    d = os.path.join(T, name)
    os.makedirs(d, exist_ok=True)
    for f in glob.glob(d + '/*.png'):
        os.remove(f)
    # 抽均匀帧
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', v,
                   '-vf', f'fps={N_FRAMES}/(15)', '-frames:v', str(N_FRAMES),
                   os.path.join(d, 'f%03d.png')], check=True)
    files = sorted(glob.glob(os.path.join(d, 'f*.png')))
    if not files:
        print('NO FRAMES', name); continue
    imgs = [Image.open(f).convert('RGB') for f in files]
    # 统一缩到 200x200 缩略
    tw, th = 200, 200
    sheet = Image.new('RGB', (COLS*tw, ROWS*th), (30, 30, 30))
    for i, im in enumerate(imgs):
        im = im.resize((tw, th))
        r, c = divmod(i, COLS)
        sheet.paste(im, (c*tw, r*th))
        # 标注序号
    out = os.path.join(T, name + '_contact.png')
    sheet.save(out)
    print('SAVED', out, 'frames=', len(imgs))
