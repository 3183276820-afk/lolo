# 用 6 个 -1 绿幕片段做模板，在完整1.0/完整2.0 中定位相同片段（帧级剪影匹配）
import os, glob, shutil, subprocess
import numpy as np
from PIL import Image

FF = r'C:/Users/hxw/Desktop/lolo/node_modules/ffmpeg-static/ffmpeg.exe'
BASE = r'C:/Users/hxw/Desktop/lolo'
TMP = r'C:/Users/hxw/AppData/Local/Temp/lolo_match'
G = 32

REFS = {
    'sleep':       os.path.join(BASE, '睡觉',   '睡觉',   '睡觉-1.mp4'),
    'walk':        os.path.join(BASE, '走路',   '走路',   '走路-1.mp4'),
    'turn':        os.path.join(BASE, '转身',   '转身',   '转身-1.mp4'),
    'upside_down': os.path.join(BASE, '倒立',   '倒立',   '倒立-1.mp4'),
    'grab_drop':   os.path.join(BASE, '拎起放下','拎起放下','拎起放下-1.mp4'),
    'cheer':       os.path.join(BASE, '加油',   '加油',   '加油-1.mp4'),
}
FULLS = {'完整1.0': os.path.join(TMP, '完整1.0'), '完整2.0': os.path.join(TMP, '完整2.0')}

def extract(v, d, fps=15):
    shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', v, '-r', str(fps),
                    os.path.join(d, 'f%04d.png')], check=True)
    return sorted(glob.glob(os.path.join(d, 'f*.png')))

def green_mask(path):
    im = np.asarray(Image.open(path).convert('RGB')).astype(np.int32)
    r, g, b = im[:, :, 0], im[:, :, 1], im[:, :, 2]
    greenness = g - np.maximum(r, b)
    corners = np.concatenate([greenness[:40, :40].ravel(), greenness[:40, -40:].ravel(),
                              greenness[-40:, :40].ravel(), greenness[-40:, -40:].ravel()])
    bg_ref = float(np.median(corners))
    m = greenness < bg_ref * 0.5
    rows = m.sum(1) >= 3; cols = m.sum(0) >= 3
    ys = np.where(rows)[0]; xs = np.where(cols)[0]
    if len(ys) < 20:
        return np.zeros((G, G), bool)
    m = m[ys.min():ys.max()+1, xs.min():xs.max()+1]
    mi = Image.fromarray((m*255).astype(np.uint8)).resize((G, G))
    return np.asarray(mi) > 128

def masks_of(files):
    return [green_mask(f) for f in files]

def iou(a, b):
    inter = (a & b).sum(); union = (a | b).sum()
    return inter / union if union else 0.0

if __name__ == '__main__':
    qs = {}
    for name, d in FULLS.items():
        files = sorted(glob.glob(os.path.join(d, 'f*.png')))
        if not files:
            files = extract(os.path.join(BASE, name + '.mp4'), d)
        qs[name] = masks_of(files)
        print(name, 'frames=', len(qs[name]), flush=True)

    result = {}
    for key, v in REFS.items():
        rf = extract(v, os.path.join(TMP, 'ref_' + key))
        ref = masks_of(rf)
        M = len(ref)
        print(f'\n### {key}  ref_frames={M}', flush=True)
        result[key] = {}
        for name, q in qs.items():
            N = len(q)
            best = (-1, -1, 1.0)
            for sc in (0.85, 1.0, 1.15):
                span = max(2, int(round(M * sc)))
                idx = [int(round(i * (M - 1) / (span - 1))) for i in range(span)]
                for s in range(0, N - span + 1):
                    score = np.mean([iou(q[s + j], ref[idx[j]]) for j in range(span)])
                    if score > best[0]:
                        best = (score, s, sc)
            sc_, s, scl = best
            t0, t1 = s / 15, (s + int(round(M * scl))) / 15
            result[key][name] = (sc_, s, int(round(M * scl)))
            print(f'  {name}: score={sc_:.3f} scale={scl}  {t0:.2f}~{t1:.2f}s (frames {s}..{s+int(round(M*scl))})', flush=True)

    print('\n===== 推荐（分数高者） =====')
    for key in REFS:
        a = result[key].get('完整1.0', (0, 0, 0))
        b = result[key].get('完整2.0', (0, 0, 0))
        pick = '完整1.0' if a[0] >= b[0] else '完整2.0'
        sc_, s, sp = result[key][pick]
        print(f'{key}: {pick}  score={sc_:.3f}  frames {s}..{s+sp}  ({s/15:.2f}~{(s+sp)/15:.2f}s)')
