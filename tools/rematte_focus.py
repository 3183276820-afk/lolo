# 番茄钟启动动画：番茄钟/番茄钟.mp4 (绿幕 720x720) -> assets/videos/focus_start.png (720x960 APNG)
# 动画内容：lolo 弯腰看地上的红色小计时器 -> 起身挥手打气
# 复用 rematte_lib 的抽帧/去水印/绿幕抠像流水线，与睡觉/走路等素材保持同一处理口径。
# 尺寸处理：源是 720x720 方形，其他素材均为 720x960 竖版 ->
#   先等比放大到高 960（变 960x960），再水平居中裁回 720 宽。
import os, sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rematte_lib import FPS, DUR, extract, matte_core, \
    detect_static_watermark, apply_static_watermark

BASE = r'C:/Users/hxw/Desktop/lolo'
SRC = os.path.join(BASE, '番茄钟', '番茄钟.mp4')
TMP = r'C:/Users/hxw/AppData/Local/Temp/lolo_focus'
OUT = os.path.join(BASE, 'assets', 'videos', 'focus_start.png')
TARGET = (720, 960)

def save_apng(frames, out):
    frames[0].save(out, save_all=True, append_images=frames[1:],
                   duration=DUR, loop=0, disposal=0)
    print('saved', os.path.basename(out), len(frames), 'frames',
          round(os.path.getsize(out)/1e6, 1), 'MB', flush=True)

def scrub_floor_watermark(rgba):
    """地面上的半透明 AI 水印：白水印叠绿幕地板后呈「黄绿卡其色」(R≈G>>B, 实测 154/151/130)。
    只处理底部地面带（y>615，源 720 坐标），剔除满足「R≈G 且明显偏黄(B 低一截)」的像素。
    lolo 橙毛 R>>G(差值~90)、红计时器 R>>G、白毛 R≈G≈B，均不会命中。"""
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
        # 等比放大到目标高，再水平居中裁到目标宽
        s = th / im.height
        im = im.resize((round(im.width * s), th), Image.LANCZOS)
        x0 = (im.width - tw) // 2
        im = im.crop((x0, 0, x0 + tw, th))
        mats.append(im)
    save_apng(mats, OUT)

if __name__ == '__main__':
    main()
