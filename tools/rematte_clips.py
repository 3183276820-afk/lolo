# 用各自 -1 高清片段整体重抠 7 个动作（含白脸保护 + 小洞填充 + 时间一致性去水印）
# 抠完缩放到 720x960 与现有资源一致，保存为 APNG。
import os, sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rematte_lib import FPS, DUR, extract, matte_core, \
    detect_static_watermark, apply_static_watermark

BASE = r'C:/Users/hxw/Desktop/lolo'
TMP  = r'C:/Users/hxw/AppData/Local/Temp/lolo_clips'
OUT  = os.path.join(BASE, 'assets', 'videos')
TARGET = (720, 960)

CLIPS = {
    'sleep':       os.path.join(BASE, '睡觉',     '睡觉',     '睡觉-1.mp4'),
    'walk':        os.path.join(BASE, '走路',     '走路',     '走路-1.mp4'),
    'turn':        os.path.join(BASE, '转身',     '转身',     '转身-1.mp4'),
    'upside_down': os.path.join(BASE, '倒立',     '倒立',     '倒立-1.mp4'),
    'grab_drop':   os.path.join(BASE, '拎起放下', '拎起放下', '拎起放下-1.mp4'),
    'cheer':       os.path.join(BASE, '加油',     '加油',     '加油', '加油-1.mp4'),  # 新片段
}

def save_apng(frames, out):
    frames[0].save(out, save_all=True, append_images=frames[1:],
                   duration=DUR, loop=0, disposal=0)
    print('saved', os.path.basename(out), len(frames), 'frames',
          round(os.path.getsize(out)/1e6, 1), 'MB', flush=True)
    return len(frames)

def main():
    res = {}
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
        res[key] = mats
        print('抠像完成', key, len(mats), '帧', flush=True)

    # 单人动作
    for key in ['sleep', 'walk', 'turn', 'upside_down', 'cheer']:
        save_apng(res[key], os.path.join(OUT, key + '.png'))

    # 拎起/放下按顶 Y 最低（举最高）拆分
    mats = res['grab_drop']
    tops = []
    for m in mats:
        al = np.asarray(m)[:, :, 3]
        ys = np.where(al.max(axis=1) > 128)[0]
        tops.append(int(ys.min()) if len(ys) else 99999)
    mid = int(np.argmin(tops))
    if mid <= 0 or mid >= len(mats) - 1:
        mid = len(mats) // 2
    print('\ngrab_drop 拆分点 =', mid, '/', len(mats), flush=True)
    save_apng(mats[:mid + 1], os.path.join(OUT, 'grab.png'))
    save_apng(mats[mid:],     os.path.join(OUT, 'drop.png'))
    print('\nALL DONE', flush=True)

if __name__ == '__main__':
    main()
