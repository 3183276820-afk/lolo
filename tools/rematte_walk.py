# 走路左右两个方向片段 -> walk.png(右) / walk_left.png(左)
import os, sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rematte_lib import FPS, DUR, extract, matte_core, \
    detect_static_watermark, apply_static_watermark

BASE = r'C:/Users/hxw/Desktop/lolo'
TMP  = r'C:/Users/hxw/AppData/Local/Temp/lolo_walk'
OUT  = os.path.join(BASE, 'assets', 'videos')
TARGET = (720, 960)

CLIPS = {
    'walk':       os.path.join(BASE, '走路', '走路右.mp4'),
    'walk_left':  os.path.join(BASE, '走路', '走路左.mp4'),
}

def save_apng(frames, out):
    frames[0].save(out, save_all=True, append_images=frames[1:],
                   duration=DUR, loop=0, disposal=0)
    print('saved', os.path.basename(out), len(frames), 'frames',
          round(os.path.getsize(out)/1e6, 1), 'MB', flush=True)
    return len(frames)

def main():
    for key, v in CLIPS.items():
        print('\n=====', key, '=====', flush=True)
        fs = extract(v, os.path.join(TMP, key))
        print('抽取', len(fs), '帧', flush=True)
        zones, masks = detect_static_watermark(fs)
        wm = int(sum(m.sum() for m in masks))
        print('静态水印像素:', wm, flush=True)
        mats = []
        for f in fs:
            rgb = np.asarray(Image.open(f).convert('RGB'))
            rgba = matte_core(rgb)
            rgba = apply_static_watermark(rgba, zones, masks)
            im = Image.fromarray(rgba, 'RGBA').resize(TARGET, Image.LANCZOS)
            mats.append(im)
        # 走路片段首尾常含起步/收尾静止帧，去掉最后 1 帧避免回弹观感（可选）
        save_apng(mats, os.path.join(OUT, key + '.png'))

if __name__ == '__main__':
    main()
