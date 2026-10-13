import sys, os
sys.path.insert(0, 'tools')
import numpy as np
from PIL import Image
from rematte_lib import extract, matte_core

BASE = r'C:/Users/hxw/Desktop/lolo'
v = os.path.join(BASE, r'睡觉\睡觉\睡觉-1.mp4')
d = os.path.join(os.environ['TEMP'], 'lolo_ds')
fs = extract(v, d)
print('frames:', len(fs))

TARGET = (720, 960)

def matte_one(i):
    rgb = np.asarray(Image.open(fs[i]).convert('RGB'))
    rgba = matte_core(rgb)
    return Image.fromarray(rgba).resize(TARGET, Image.LANCZOS)

def save_seq(idxs, path):
    frames = [matte_one(i) for i in idxs]
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=67, loop=0)
    print(os.path.basename(path), len(frames), 'frames')

# 1) 纯趴着循环（帧0-33，翻身前）
save_seq(range(0, 34), os.path.join(BASE, 'assets/videos/sleep.png'))
# 2) 翻身过渡（帧34-49，播一遍）
save_seq(range(34, 50), os.path.join(BASE, 'assets/videos/roll_over.png'))
# 3) 仰躺定格（单帧=帧49，与翻身末帧一致，衔接无缝）
save_seq([49], os.path.join(BASE, 'assets/videos/lying_back.png'))
print('DONE')
