# 看书动画：待机/待机看书.mp4 (绿幕 720x720) -> assets/videos/read.png (720x960 APNG)
# 动画内容：lolo 坐着看书（翻页 / 低头阅读）。右下角"豆包AI生成"水印由角落静态检测去除，
# 地板上的半透明 AI 水印（黄绿卡其色）由 scrub_floor_watermark 去除。
# 处理口径与 rematte_drink.py 一致（抽帧15fps -> 去水印 -> 抠像 -> 放大裁切 -> APNG）。
import os, sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rematte_lib import FPS, DUR, extract, matte_core, \
    detect_static_watermark, apply_static_watermark

BASE = r'C:/Users/hxw/Desktop/lolo'
SRC = os.path.join(BASE, '待机', '待机看书.mp4')
TMP = r'C:/Users/hxw/AppData/Local/Temp/lolo_read'
OUT = os.path.join(BASE, 'assets', 'videos', 'read.png')
TARGET = (720, 960)

def save_apng(frames, out):
    frames[0].save(out, save_all=True, append_images=frames[1:],
                   duration=DUR, loop=0, disposal=0)
    print('saved', os.path.basename(out), len(frames), 'frames',
          round(os.path.getsize(out)/1e6, 1), 'MB', flush=True)

def scrub_floor_watermark(rgba):
    """地板上的半透明 AI 水印（黄绿卡其色 R≈G>>B）清除，口径与 rematte_drink 相同。"""
    r = rgba[615:, :, 0].astype(np.int32)
    g = rgba[615:, :, 1].astype(np.int32)
    b = rgba[615:, :, 2].astype(np.int32)
    yellowish = (np.minimum(r, g) - b > 8) & (np.abs(r - g) < 20)
    rgba[615:, :, 3] = np.where(yellowish, 0, rgba[615:, :, 3])
    return rgba

def main():
    fs = extract(SRC, TMP)
    print('抽取', len(fs), '帧', flush=True)
    zones, masks = detect_static_watermark(fs)
    print('静态水印像素:', int(sum(m.sum() for m in masks)), flush=True)
    tw, th = TARGET
    mats = []
    for f in fs:
        rgb = np.asarray(Image.open(f).convert('RGB'))
        rgba = matte_core(rgb)
        rgba = apply_static_watermark(rgba, zones, masks)
        rgba = scrub_floor_watermark(rgba)
        im = Image.fromarray(rgba, 'RGBA')
        s = th / im.height
        im = im.resize((round(im.width * s), th), Image.LANCZOS)
        x0 = (im.width - tw) // 2
        im = im.crop((x0, 0, x0 + tw, th))
        mats.append(im)
    save_apng(mats, OUT)

if __name__ == '__main__':
    main()
