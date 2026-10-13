// 气泡窗口渲染端：接收主进程下发的内容并渲染。
// 窗口为固定尺寸（主进程绝不 resize，避免 Windows 透明窗口重绘“缺一块”），
// 内容在窗口内居中、贴底（头顶）或贴顶（脚下），尾巴朝向随 below 标记翻转。
// 点击气泡时通知主进程（提醒气泡由桌宠端结束提醒状态）。
(function () {
  const api = window.loloAPI;
  if (!api) return;
  const CH = api.channels;
  const wrap = document.getElementById('wrap');
  const panel = document.getElementById('panel');
  const content = document.getElementById('content');

  let lastPayload = null;
  function render(p) {
    lastPayload = p || {};
    wrap.classList.toggle('below', !!lastPayload.below);
    const kind = lastPayload.kind || 'say';
    // 'update'（自动更新气泡）复用提醒样式，但提示语由调用方自定义
    const asReminder = (kind === 'reminder' || kind === 'update');
    panel.className = asReminder ? 'reminder' : 'bubble';
    panel.style.fontSize = (lastPayload.fontSize ? lastPayload.fontSize : 14) + 'px';
    if (asReminder) {
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = lastPayload.title || '提醒';
      const text = document.createElement('div');
      text.textContent = lastPayload.text || '';
      const hint = document.createElement('div');
      hint.className = 'hint';
      hint.textContent = lastPayload.hint || '点击关闭';
      content.innerHTML = '';
      content.appendChild(title);
      content.appendChild(text);
      content.appendChild(hint);
    } else {
      content.textContent = lastPayload.text || '';
    }
  }

  panel.addEventListener('click', () => {
    api.send(CH.BUBBLE_DISMISSED, { kind: lastPayload ? lastPayload.kind : 'say' });
  });

  // 强制回流 + 双 rAF 重绘，消除 Windows 透明窗口首帧文字/区域“缺一块”的残留空洞
  function repaint() {
    void content.offsetHeight; // 同步强制回流
    requestAnimationFrame(() => requestAnimationFrame(() => {
      void document.body.offsetHeight;
    }));
  }

  api.onBubbleContent && api.onBubbleContent((p) => { render(p); repaint(); });
})();
