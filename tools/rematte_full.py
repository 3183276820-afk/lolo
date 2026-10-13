# 主流程：完整1.0/完整2.0 -> 模板匹配定位 6 动作 -> 抠像(时间一致性去水印) -> APNG
import os, sys, glob
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rematte_lib import (FF, FPS, DUR, extract, matte_core, bg_ref_of,
                         detect_static_watermark, apply_static_watermark)

BASE = r'C:/Users/hxw/Desktop/lolo'
TMP = r'C:/Users/hxw/AppData/Local/Temp/lolo_match'
OUT = os.path.join(BASE, 'assets', 'videos')
G = 32

REFS = {
    'sleep':       os.path.join(BASE, '睡觉',   '睡觉',   '睡觉-1.mp4'),
    'walk':        os.path.join(BASE, '走路',   '走路',   '走路-1.mp4'),
    'turn':        os.path.join(BASE, '转身',   '转身',   '转身-1.mp4'),
    'upside_down': os.path.join(BASE, '倒立',   '倒立',   '倒立-1.mp4'),
    'grab_drop':   os.path.join(BASE, '拎起放下','拎起放下','拎起放下-1.mp4'),
    'cheer':       os.path.join(BASE, '加油',   '加油',   '加油-1.mp4'),
}
FULLS = {'完整1.0': os.path.join(BASE, '完整1.0.mp4'),
         '完整2.0': os.path.join(BASE, '完整2.0.mp4')}

# ---------- 剪影匹配 ----------
def green_mask(path):
    im = np.asarray(Image.open(path).convert('RGB')).astype(np.int32)
    r, g, b = im[:, :, 0], im[:, :, 1], im[:, :, 2]
    greenness = g - np.maximum(r, b)
    bg_ref = bg_ref_of(im.astype(np.uint8))
    m = greenness < bg_ref * 0.5
    rows = m.sum(1) >= 3; cols = m.sum(0) >= 3
    ys = np.where(rows)[0]; xs = np.where(cols)[0]
    if len(ys) < 20:
        return np.zeros((G, G), bool)
    m = m[ys.min():ys.max()+1, xs.min():xs.max()+1]
    mi = Image.fromarray((m*255).astype(np.uint8)).resize((G, G))
    return np.asarray(mi) > 128

def iou(a, b):
    inter = (a & b).sum(); union = (a | b).sum()
    return inter / union if union else 0.0

def match(ref, q):
    M, N = len(ref), len(q)
    best = (-1, -1, 1.0)
    for sc in (0.85, 1.0, 1.15):
        span = max(2, int(round(M * sc)))
        idx = [int(round(i * (M - 1) / (span - 1))) for i in range(span)]
        for s in range(0, N - span + 1):
            score = np.mean([iou(q[s + j], ref[idx[j]]) for j in range(span)])
            if score > best[0]:
                best = (score, s, sc)
    return best

def save_apng(frames, out):
    frames[0].save(out, save_all=True, append_images=frames[1:], duration=DUR, loop=0)
    print('saved', os.path.basename(out), len(frames), 'frames',
          round(os.path.getsize(out)/1e6, 1), 'MB', flush=True)

def main():
    # 1) 参考与查询掩码
    refs, qmasks, qfiles = {}, {}, {}
    for key, v in REFS.items():
        rf = extract(v, os.path.join(TMP, 'ref_' + key))
        refs[key] = [green_mask(f) for f in rf]
        print('ref', key, len(rf), 'frames', flush=True)
    for name, v in FULLS.items():
        ff = extract(v, os.path.join(TMP, name))
        qfiles[name] = ff
        qmasks[name] = [green_mask(f) for f in ff]
        print('full', name, len(ff), 'frames', flush=True)

    # 2) 匹配定位
    picks = {}
    print('\n===== 匹配结果 =====')
    for key, ref in refs.items():
        results = {name: match(ref, qmasks[name]) for name in FULLS}
        for name, (sc, s, scl) in results.items():
            print(f'{key:12s} {name}: score={sc:.3f} scale={scl} start={s} ({s/15:.2f}s)', flush=True)
        name = max(results, key=lambda k: results[k][0])
        sc, s, scl = results[name]
        span = int(round(len(ref) * scl))
        picks[key] = (name, s, span, sc)
        print(f'  -> {key}: 选 {name}  frames {s}..{s+span}  score={sc:.3f}', flush=True)

    # 3) 时间一致性去水印掩码（对被选中的完整视频算一次）
    chosen = set(p[0] for p in picks.values())
    wm = {}
    for name in chosen:
        zones, masks = detect_static_watermark(qfiles[name])
        wm[name] = (zones, masks)
        total = int(sum(m.sum() for m in masks))
        print(f'水印静态掩码 {name}: 共 {total} 像素', flush=True)

    # 4) 抠像出帧
    out_frames = {}
    for key, (name, s, span, sc) in picks.items():
        zones, masks = wm[name]
        mats = []
        for f in qfiles[name][s:s+span]:
            rgb = np.asarray(Image.open(f).convert('RGB'))
            rgba = matte_core(rgb)
            rgba = apply_static_watermark(rgba, zones, masks)
            mats.append(Image.fromarray(rgba, 'RGBA'))
        out_frames[key] = mats
        print('matted', key, len(mats), 'frames', flush=True)

    # 5) 保存；grab_drop 按顶 Y 拆分
    for key in ['sleep', 'walk', 'turn', 'upside_down', 'cheer']:
        save_apng(out_frames[key], os.path.join(OUT, key + '.png'))

    mats = out_frames['grab_drop']
    tops = []
    for m in mats:
        al = np.asarray(m)[:, :, 3]
        ys = np.where(al.max(axis=1) > 128)[0]
        tops.append(int(ys.min()) if len(ys) else 99999)
    mid = int(np.argmin(tops))
    if mid <= 0 or mid >= len(mats) - 1:
        mid = len(mats) // 2
    print('grab_drop 拆分点 =', mid, '/', len(mats), flush=True)
    save_apng(mats[:mid+1], os.path.join(OUT, 'grab.png'))
    save_apng(mats[mid:],   os.path.join(OUT, 'drop.png'))
    print('ALL DONE', flush=True)

if __name__ == '__main__':
    main()
