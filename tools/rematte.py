# lolo 素材重抠：边缘洪泛填充（保留被脸包围的黑色眼睛）
# 背景：原 colorkey 黑色方案会把纯黑眼睛与黑背景一起抠透明。
# 原理：背景黑与画面边缘连通；眼睛黑是被橙色脸包围的"孤岛"，不与边缘连通。
# 用法：python rematte.py  → 重新生成 5 个状态 APNG + 拆分 grab.png/drop.png
import os, sys, glob, shutil, subprocess
import numpy as np
from PIL import Image

FF = r'C:/Users/hxw/Desktop/lolo/node_modules/ffmpeg-static/ffmpeg.exe'
VID = r'C:/Users/hxw/Desktop/lolo/assets/videos'
TMP = r'C:/Users/hxw/AppData/Local/Temp/lolo_rematte'
TH = 40  # 近黑阈值（背景纯黑，留裕量给压缩噪声）

def extract(mp4, outdir):
    os.makedirs(outdir, exist_ok=True)
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', mp4,
                    '-vsync', '0', os.path.join(outdir, 'f%04d.png')], check=True)
    return sorted(glob.glob(os.path.join(outdir, 'f*.png')))

def dilate(b):
    return b | np.roll(b, 1, 0) | np.roll(b, -1, 0) | np.roll(b, 1, 1) | np.roll(b, -1, 1)

def matte(path):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(np.int32)
    h, w, _ = a.shape
    lum = a.mean(axis=2)
    near = lum < TH
    # pad 一圈再洪泛，避免 np.roll 环绕串色
    pad = np.zeros((h + 2, w + 2), bool)
    pad[1:-1, 1:-1] = near
    bg = pad.copy()
    for _ in range(h + w + 4):
        nb = bg | np.roll(bg, 1, 0) | np.roll(bg, -1, 0) | np.roll(bg, 1, 1) | np.roll(bg, -1, 1)
        if nb.sum() == bg.sum():
            break
        bg = nb
    bg = bg[1:-1, 1:-1]
    alpha = np.where(bg, 0, 255).astype(np.float32)
    # 边缘羽化：与背景相邻的暗像素按亮度渐变 alpha，减少硬边锯齿
    adj = dilate(bg) & ~bg
    soft = np.clip(lum / (TH * 2.2) * 255, 0, 255)
    alpha[adj] = np.minimum(alpha[adj], soft[adj])
    out = np.dstack([a.astype(np.uint8), alpha.astype(np.uint8)])
    return Image.fromarray(out, 'RGBA')

def save_apng(frames, out, dur=40):
    frames[0].save(out, save_all=True, append_images=frames[1:],
                   duration=dur, loop=0, disposal=2)
    print('saved', os.path.basename(out), len(frames), 'frames')

def process(mp4, outpng):
    d = os.path.join(TMP, os.path.basename(mp4)[:-4])
    shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
    files = extract(mp4, d)
    frames = [matte(f) for f in files]
    save_apng(frames, outpng)

def split_grab_drop():
    d = os.path.join(TMP, 'grab_drop')
    shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
    files = extract(os.path.join(VID, 'grab_drop.mp4'), d)
    mats = [matte(f) for f in files]
    # 用角色包围盒顶 Y 找"被举最高"的帧作为拎起/放下分界
    tops = []
    for m in mats:
        al = np.asarray(m)[:, :, 3]
        ys = np.where(al.max(axis=1) > 128)[0]
        tops.append(int(ys.min()) if len(ys) else 9999)
    mid = int(np.argmin(tops))
    if mid <= 0 or mid >= len(mats) - 1:
        mid = len(mats) // 2
    print('grab_drop 共', len(mats), '帧, 拆分点 =', mid)
    save_apng(mats[:mid + 1], os.path.join(VID, 'grab.png'))
    save_apng(mats[mid:], os.path.join(VID, 'drop.png'))

if __name__ == '__main__':
    for name in ['sleep', 'walk', 'turn', 'upside_down', 'cheer']:
        process(os.path.join(VID, name + '.mp4'), os.path.join(VID, name + '.png'))
    split_grab_drop()
    print('ALL DONE')
