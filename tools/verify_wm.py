# 验证保守去水印效果：四角显眼水印残留 + 角色白肚皮保留
from PIL import Image
import numpy as np

V = r'C:/Users/hxw/Desktop/lolo/assets/videos'
for n in ['cheer', 'walk', 'sleep']:
    im = Image.open(V + '/' + n + '.png'); nf = im.n_frames
    corner_wm = 0; body_white = 0
    for f in range(0, nf, max(1, nf // 4)):
        im.seek(f)
        a = np.asarray(im.convert('RGBA'))
        h, w, _ = a.shape
        r, g, b = a[:, :, 0].astype(int), a[:, :, 1].astype(int), a[:, :, 2].astype(int)
        al = a[:, :, 3].astype(int)
        lum = (r + g + b) / 3
        sat = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
        for (y0, x0, y1, x1) in [(0, 0, 160, 420), (0, w - 420, 160, w), (h - 160, 0, h, 420), (h - 160, w - 420, h, w)]:
            zr = a[y0:y1, x0:x1]
            zl = (zr[:, :, 0] + zr[:, :, 1] + zr[:, :, 2]) / 3
            zg = zr[:, :, 1] - np.maximum(zr[:, :, 0], zr[:, :, 2])
            zs = np.maximum(np.maximum(zr[:, :, 0], zr[:, :, 1]), zr[:, :, 2]) - np.minimum(np.minimum(zr[:, :, 0], zr[:, :, 1]), zr[:, :, 2])
            bgpix = zg > 12
            bgl = zl[bgpix].mean() if bgpix.sum() else 0
            corner_wm += int(((zg < 12) & (zl > bgl + 20) & (zs < 80) & (zr[:, :, 3] > 128)).sum())
        # 角色白肚皮：中心区域白色不透明像素
        body_white += int(((lum > 200) & (sat < 50) & (al > 0))[int(h * 0.3):int(h * 0.7), int(w * 0.3):int(w * 0.7)].sum())
    print(f'{n}: 四角显眼水印残留={corner_wm}   角色白色(肚皮)像素={body_white}')
