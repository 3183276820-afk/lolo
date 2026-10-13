# 分析完整原素材：分段（运动量低谷）+ 时长，用于匹配之前 6 个动作
import subprocess, os, glob
import numpy as np
from PIL import Image

FF = r'C:/Users/hxw/Desktop/lolo/node_modules/ffmpeg-static/ffmpeg.exe'
BASE = r'C:/Users/hxw/Desktop/lolo'
T = r'C:/Users/hxw/AppData/Local/Temp/lolo_full'
os.makedirs(T, exist_ok=True)

def quick_mask_feats(path):
    """快速估算角色 mask 特征（中心/面积/顶Y），不做完整抠像"""
    im = np.asarray(Image.open(path).convert('RGB')).astype(int)
    r, g, b = im[:, :, 0], im[:, :, 1], im[:, :, 2]
    greenness = g - np.maximum(r, b)
    h, w = greenness.shape
    corners = np.concatenate([greenness[:40, :40].ravel(), greenness[:40, -40:].ravel(),
                              greenness[-40:, :40].ravel(), greenness[-40:, -40:].ravel()])
    bg_ref = float(np.median(corners))
    fg = greenness < bg_ref * 0.5
    ys, xs = np.where(fg)
    if len(ys) < 500:
        return None
    return (float(xs.mean()), float(ys.mean()), int(len(ys)), int(ys.min()))

for name in ['完整1.0', '完整2.0']:
    v = os.path.join(BASE, name + '.mp4')
    if not os.path.exists(v):
        print('MISS', v); continue
    # 时长
    out = subprocess.run([FF, '-hide_banner', '-i', v], capture_output=True, text=True).stderr
    dur = 'unknown'
    for line in out.splitlines():
        if 'Duration' in line:
            dur = line.split('Duration:')[1].split(',')[0].strip()
    print(f'\n===== {name}  时长={dur} =====')
    d = os.path.join(T, name); os.makedirs(d, exist_ok=True)
    for f in glob.glob(d + '/*.png'): os.remove(f)
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', v, '-r', '15', os.path.join(d, 'f%04d.png')], check=True)
    files = sorted(glob.glob(os.path.join(d, 'f*.png')))
    feats = []
    for f in files:
        feats.append(quick_mask_feats(f))
    # 相邻帧运动量
    motions = [0.0]
    for i in range(1, len(feats)):
        a, p = feats[i], feats[i-1]
        if a is None or p is None:
            motions.append(0.0); continue
        m = abs(a[0]-p[0]) + abs(a[1]-p[1]) + abs(a[2]-p[2])/2000 + abs(a[3]-p[3])
        motions.append(m)
    # 每 0.4s 窗口平均运动量（3~6帧）
    win = max(2, int(0.4*15))
    print('时间窗口运动量（低=静止/段边界）:')
    i = 0
    while i < len(motions):
        seg = motions[i:i+win]
        print(f'  {i/15:5.2f}s ~ {(i+len(seg))/15:5.2f}s  motion={np.mean(seg):7.1f}')
        i += win
