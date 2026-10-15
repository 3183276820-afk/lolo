#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 Mac-源码运行指引.md 转成排版漂亮的独立 HTML（自包含，无外部依赖）。"""
import re, html, sys

SRC = r"C:\Users\hxw\Desktop\lolo\docs\Mac-源码运行指引.md"
OUT = r"C:\Users\hxw\Desktop\lolo\docs\Mac-源码运行指引.html"

def inline(text: str) -> str:
    # 行内代码 `code`
    text = re.sub(r'`([^`]+?)`',
                  lambda m: '<code>%s</code>' % html.escape(m.group(1), quote=True),
                  text)
    # 加粗 **x**
    text = re.sub(r'\*\*([^*]+?)\*\*', r'<strong>\1</strong>', text)
    # 链接 [text](url)
    text = re.sub(r'\[([^\]]+?)\]\((https?://[^)\s]+)\)',
                  lambda m: '<a href="%s" target="_blank" rel="noopener">%s</a>' % (m.group(2), m.group(1)),
                  text)
    return text

def split_table(rows):
    """rows: list[str] 去掉首尾 | 后按 | 切分。"""
    out = []
    for r in rows:
        r = r.strip()
        if r.startswith('|'): r = r[1:]
        if r.endswith('|'): r = r[:-1]
        out.append([c.strip() for c in r.split('|')])
    return out

def render_table(rows):
    data = split_table(rows)
    if len(data) < 1: return ''
    head = data[0]
    body = data[2:] if len(data) > 2 else []
    h = '<table><thead><tr>' + ''.join('<th>%s</th>' % inline(c) for c in head) + '</tr></thead><tbody>'
    for row in body:
        h += '<tr>' + ''.join('<td>%s</td>' % inline(c) for c in row) + '</tr>'
    h += '</tbody></table>'
    return h

def convert(md: str) -> str:
    lines = md.split('\n')
    out = []
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]

        # 代码块
        if line.strip().startswith('```'):
            i += 1
            buf = []
            while i < n and not lines[i].strip().startswith('```'):
                buf.append(lines[i]); i += 1
            i += 1  # 跳过结束 ```
            code = html.escape('\n'.join(buf), quote=True)
            out.append('<pre class="code"><code>%s</code></pre>' % code)
            continue

        # 分隔线
        if re.match(r'^-{3,}$', line.strip()):
            out.append('<hr/>'); i += 1; continue

        # 标题
        m = re.match(r'^(#{1,4})\s+(.*)$', line)
        if m:
            lvl = len(m.group(1))
            out.append('<h%d>%s</h%d>' % (lvl, inline(m.group(2).strip()), lvl))
            i += 1; continue

        # 引用块
        if line.lstrip().startswith('>'):
            buf = []
            while i < n and lines[i].lstrip().startswith('>'):
                buf.append(re.sub(r'^\s*>\s?', '', lines[i])); i += 1
            # 引用块内部：检测有序列表
            quote_html = []
            ol = []
            for bl in buf:
                if re.match(r'^\d+\.\s', bl):
                    ol.append('<li>%s</li>' % inline(re.sub(r'^\d+\.\s', '', bl)))
                else:
                    if ol:
                        quote_html.append('<ol>%s</ol>' % ''.join(ol)); ol = []
                    if bl.strip() == '':
                        continue
                    quote_html.append('<p>%s</p>' % inline(bl))
            if ol:
                quote_html.append('<ol>%s</ol>' % ''.join(ol))
            out.append('<blockquote>%s</blockquote>' % ''.join(quote_html))
            continue

        # 表格
        if line.strip().startswith('|') and i + 1 < n and re.match(r'^\s*\|?[\s:|-]+\|?\s*$', lines[i+1]):
            buf = [line]
            i += 1
            while i < n and lines[i].strip().startswith('|'):
                buf.append(lines[i]); i += 1
            out.append(render_table(buf)); continue

        # 无序列表
        if re.match(r'^[-*]\s+', line):
            buf = []
            while i < n and re.match(r'^[-*]\s+', lines[i]):
                buf.append('<li>%s</li>' % inline(re.sub(r'^[-*]\s+', '', lines[i]))); i += 1
            out.append('<ul>%s</ul>' % ''.join(buf)); continue

        # 有序列表（顶层）
        if re.match(r'^\d+\.\s', line):
            buf = []
            while i < n and re.match(r'^\d+\.\s', lines[i]):
                buf.append('<li>%s</li>' % inline(re.sub(r'^\d+\.\s', '', lines[i]))); i += 1
            out.append('<ol>%s</ol>' % ''.join(buf)); continue

        # 空行
        if line.strip() == '':
            i += 1; continue

        # 普通段落（合并连续非空行）
        buf = [line]
        i += 1
        while i < n and lines[i].strip() != '' and not lines[i].lstrip().startswith('>') \
              and not lines[i].strip().startswith('```') and not re.match(r'^(#{1,4})\s', lines[i]) \
              and not re.match(r'^[-*]\s+', lines[i]) and not re.match(r'^\d+\.\s', lines[i]) \
              and not lines[i].strip().startswith('|'):
            buf.append(lines[i]); i += 1
        out.append('<p>%s</p>' % inline(' '.join(s.strip() for s in buf)))
        continue

    return '\n'.join(out)

CSS = """
:root{--orange:#e8751f;--orange-soft:#fff3e8;--ink:#2b2622;--muted:#7a7068;--line:#f0e3d6;}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei","Segoe UI",sans-serif;
background:#fffaf5;color:var(--ink);line-height:1.75;font-size:16px;padding:0 16px 64px}
.wrap{max-width:760px;margin:0 auto}
header{padding:40px 0 24px;text-align:center}
header .badge{display:inline-block;font-size:13px;color:var(--orange);background:var(--orange-soft);
border:1px solid var(--line);padding:4px 14px;border-radius:99px;margin-bottom:14px}
header h1{font-size:26px;font-weight:800;letter-spacing:.5px}
header p{color:var(--muted);font-size:14px;margin-top:10px}
.card{background:#fff;border:1px solid var(--line);border-radius:18px;padding:28px 26px;margin:22px 0;
box-shadow:0 6px 22px rgba(232,117,31,.07)}
h2{font-size:20px;margin:30px 0 14px;padding-left:12px;border-left:4px solid var(--orange)}
h3{font-size:17px;margin:22px 0 10px;color:#b65f15}
h4{font-size:15px;margin:16px 0 8px;color:var(--muted)}
p{margin:12px 0}
ul,ol{margin:12px 0;padding-left:24px}
li{margin:6px 0}
code{background:#f6efe7;color:#c4541a;padding:2px 7px;border-radius:6px;font-size:14px;
font-family:"SF Mono",Menlo,Consolas,monospace}
pre.code{background:#2b2622;color:#f3e9df;padding:16px 18px;border-radius:12px;overflow-x:auto;
margin:14px 0;font-size:13.5px;line-height:1.6}
pre.code code{background:none;color:inherit;padding:0}
blockquote{background:var(--orange-soft);border-left:4px solid var(--orange);border-radius:0 12px 12px 0;
padding:16px 18px;margin:16px 0;color:#5c4231}
blockquote p{margin:6px 0}
blockquote ol,blockquote ul{margin:8px 0}
table{width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;background:#fff;
border:1px solid var(--line);border-radius:12px;overflow:hidden}
th,td{border:1px solid var(--line);padding:10px 12px;text-align:left;vertical-align:top}
th{background:var(--orange-soft);color:#9a4f12;font-weight:700}
hr{border:none;border-top:1px dashed var(--line);margin:28px 0}
a{color:var(--orange);text-decoration:none;border-bottom:1px solid rgba(232,117,31,.35)}
a:hover{border-bottom-color:var(--orange)}
.tip{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 18px;margin:14px 0;
font-size:14.5px;color:#5c4231}
.footer{text-align:center;color:var(--muted);font-size:13px;margin-top:36px}
"""

def main():
    md = open(SRC, encoding='utf-8').read()
    body = convert(md)
    doc = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>lolo（Mac 版）源码运行指引</title>
<style>%s</style>
</head>
<body>
<div class="wrap">
<header>
  <div class="badge">🍎 Mac 用户专属</div>
  <h1>lolo 桌宠 · 源码运行指引</h1>
  <p>装不了安装包？一行命令自动搞定，或照着下面一步步来</p>
</header>
<div class="card">
%s
</div>
<div class="footer">lolo 桌宠 · bobobizzz · 图文教程</div>
</div>
</body>
</html>""" % (CSS, body)
    open(OUT, 'w', encoding='utf-8', newline='\n').write(doc)
    print("✔ 已生成", OUT, "bytes:", len(doc.encode('utf-8')))

if __name__ == '__main__':
    main()
