# 扫描整帧，定位豆包水印真实位置和范围（不限于四角假设）
import subprocess, os
import numpy as np
from PIL import Image

FF = r'C:/Users/hxw/Desktop/lolo/node_modules/ffmpeg-static/ffmpeg.exe'
BASE = r'C:/Users/hxw/Desktop/lolo'
VIDS = {
    'cheer': os.path.join(BASE, '10月11日(5)', '加油.mp4'),
    'walk':  os.path.join(BASE, '10月11日(2)', '走路.mp4'),
    'sleep': os.path.join(BASE, '10月11日(1)', '睡觉.mp4'),
    'turn':  os.path.join(BASE, '10月11日(4)', '转身.mp4'),
}
T = r'C:/Users/hxw/AppData/Local/Temp/lolo_wm'
os.makedirs(T, exist_ok=True)

for name, v in VIDS.items():
    p = os.path.join(T, name + '.png')
    subprocess.run([FF, '-y', '-loglevel', 'error', '-ss', '0.4', '-i', v, '-frames:v', '1', p], check=True)
    im = np.asarray(Image.open(p).convert('RGB')).astype(int)
    h, w, _ = im.shape
    r, g, b = im[:, :, 0], im[:, :, 1], im[:, :, 2]
    greenness = g - np.maximum(r, b)
    lum = (r + g + b) / 3
    bgm = greenness > 20
    bg_lum = lum[bgm].mean(); bg_g = greenness[bgm].mean()
    # 白字叠加在绿幕上：greenness 比背景低（白提升 r,b 压低 greenness），lum 比背景高
    wm = (greenness < bg_g - 8) & (lum > bg_lum + 25)
    ys, xs = np.where(wm)
    if len(ys):
        print(f'{name}: 水印疑似像素={len(ys)}  x=[{xs.min()},{xs.max()}]  y=[{ys.min()},{ys.max()}]  宽={xs.max()-xs.min()} 高={ys.max()-ys.min()}')
        print('   样例RGB:', [(int(r[y, x]), int(g[y, x]), int(b[y, x])) for y, x in zip(ys[:5], xs[:5])])
    else:
        print(f'{name}: 整帧无水印疑似像素')
