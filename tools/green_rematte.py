# 绿幕素材批处理：抠像 + 拎起放下拆分 + APNG 合成
# 素材：豆包AI生成的绿幕视频（10月11日*），抠像后黑眼/黑纹/深色爪垫全保留
import os, glob, shutil, subprocess
import numpy as np
from PIL import Image

FF = r'C:/Users/hxw/Desktop/lolo/node_modules/ffmpeg-static/ffmpeg.exe'
BASE = r'C:/Users/hxw/Desktop/lolo'
OUT = os.path.join(BASE, 'assets', 'videos')
TMP = r'C:/Users/hxw/AppData/Local/Temp/lolo_green_frames'
FPS = 15  # 卡通动作 15fps 足够流畅，文件更小
DUR = round(1000 / FPS)  # 67ms/帧

VIDS = {
    'upside_down': os.path.join(BASE, '10月11日',   '倒立-1.mp4'),
    'sleep':       os.path.join(BASE, '10月11日(1)', '睡觉-1.mp4'),
    'walk':        os.path.join(BASE, '10月11日(2)', '走路', '走路-1.mp4'),
    'grab_drop':   os.path.join(BASE, '10月11日(3)', '拎起放下', '拎起放下-1.mp4'),
    'turn':        os.path.join(BASE, '10月11日(4)', '转身', '转身-1.mp4'),
    'cheer':       os.path.join(BASE, '10月11日(5)', '加油', '加油-1.mp4'),
}

def dilate(b, n=1):
    for _ in range(n):
        b = b | np.roll(b, 1, 0) | np.roll(b, -1, 0) | np.roll(b, 1, 1) | np.roll(b, -1, 1)
    return b

def erode(b, n=1):
    for _ in range(n):
        b = b & np.roll(b, 1, 0) & np.roll(b, -1, 0) & np.roll(b, 1, 1) & np.roll(b, -1, 1)
    return b

def gblur(a):
    k = np.array([1, 2, 1], float) / 4
    a = np.apply_along_axis(lambda x: np.convolve(x, k, 'same'), 0, a)
    a = np.apply_along_axis(lambda x: np.convolve(x, k, 'same'), 1, a)
    return a

def clear_watermark(rgba):
    """仅清除四角明显的浅色水印大字，不触及角色、不做全图强行去水印。
    用户要求：水印只去"显眼的"，满屏浅雾/细字保留。"""
    h, w, _ = rgba.shape
    mh, mw = 160, 420
    zones = [(0, 0, mh, mw), (0, w - mw, mh, w), (h - mh, 0, h, mw), (h - mh, w - mw, h, w)]
    for (y0, x0, y1, x1) in zones:
        reg = rgba[y0:y1, x0:x1]
        r = reg[:, :, 0].astype(np.int32); g = reg[:, :, 1].astype(np.int32); b = reg[:, :, 2].astype(np.int32)
        greenness = g - np.maximum(r, b)
        lum = (r + g + b) / 3
        sat = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
        bgpix = greenness > 12
        bg_lum = lum[bgpix].mean() if bgpix.sum() else lum.mean()
        wm = (greenness < 12) & (lum > bg_lum + 20) & (sat < 80)
        reg[:, :, 3] = np.where(wm, 0, reg[:, :, 3])
    return rgba

def matte(arr):
    r, g, b = arr[:, :, 0].astype(np.int32), arr[:, :, 1].astype(np.int32), arr[:, :, 2].astype(np.int32)
    greenness = g - np.maximum(r, b)
    h, w = greenness.shape
    corners = np.concatenate([greenness[:40, :40].ravel(), greenness[:40, -40:].ravel(),
                              greenness[-40:, :40].ravel(), greenness[-40:, -40:].ravel()])
    bg_ref = float(np.median(corners))
    # 硬背景判定（激进，保证背景彻底透明）
    bg = greenness > bg_ref * 0.5
    bg = dilate(bg, 2)  # 膨胀吃掉角色边缘半透明绿边与离散绿噪点
    fg = ~bg
    spill = (greenness > 0) & fg  # 去绿溢出
    g2 = np.where(spill, np.maximum(r, b), g)
    alpha = gblur(fg.astype(np.float32) * 255)  # 轻度高斯模糊柔化硬边
    rgba = np.dstack([r, g2, b, np.clip(alpha, 0, 255)]).astype(np.uint8)
    rgba = clear_watermark(rgba)
    return Image.fromarray(rgba, 'RGBA')

def frames_of(key):
    d = os.path.join(TMP, key)
    shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', VIDS[key],
                    '-r', '15', os.path.join(d, 'f%04d.png')], check=True)
    return sorted(glob.glob(os.path.join(d, 'f*.png')))

def save_apng(frames, out):
    frames[0].save(out, save_all=True, append_images=frames[1:],
                   duration=DUR, loop=0)
    print('saved', os.path.basename(out), len(frames), 'frames',
          round(os.path.getsize(out)/1e6, 1), 'MB', flush=True)

if __name__ == '__main__':
    for key in ['sleep', 'walk', 'turn', 'upside_down', 'cheer']:
        mats = [matte(np.asarray(Image.open(f).convert('RGB'))) for f in frames_of(key)]
        save_apng(mats, os.path.join(OUT, key + '.png'))

    # 拎起放下：按角色 bbox 顶 Y 最低帧（被举最高）拆成 grab / drop
    files = frames_of('grab_drop')
    mats = [matte(np.asarray(Image.open(f).convert('RGB'))) for f in files]
    tops = []
    for m in mats:
        al = np.asarray(m)[:, :, 3]
        ys = np.where(al.max(axis=1) > 128)[0]
        tops.append(int(ys.min()) if len(ys) else 99999)
    mid = int(np.argmin(tops))
    if mid <= 0 or mid >= len(mats) - 1:
        mid = len(mats) // 2
    print('grab_drop 共', len(mats), '帧, 拆分点 =', mid, flush=True)
    save_apng(mats[:mid+1], os.path.join(OUT, 'grab.png'))
    save_apng(mats[mid:],   os.path.join(OUT, 'drop.png'))
    old = os.path.join(OUT, 'grab_drop.png')
    if os.path.exists(old):
        os.replace(old, os.path.join(OUT, 'old_grab_drop_blackbg.png'))
    print('ALL DONE', flush=True)
