/* ── Shared utilities ── */

const NEIGHBORS = {
  a:['q','w','s','z'], b:['v','g','h','n'], c:['x','d','f','v'],
  d:['s','e','r','f','c','x'], e:['w','r','d','s'], f:['d','r','t','g','v','c'],
  g:['f','t','y','h','b','v'], h:['g','y','u','j','n','b'], i:['u','o','k','j'],
  j:['h','u','i','k','n','m'], k:['j','i','o','l','m'], l:['k','o','p'],
  m:['n','j','k'], n:['b','h','j','m'], o:['i','p','l','k'],
  p:['o','l'], q:['w','a'], r:['e','t','f','d'], s:['a','w','e','d','x','z'],
  t:['r','y','g','f'], u:['y','i','j','h'], v:['c','f','g','b'],
  w:['q','e','s','a'], x:['z','s','d','c'], y:['t','u','h','g'],
  z:['a','s','x'], ' ':['v','b','n','m','c'],
  '0':['9','p','-'], '1':['2','q'], '2':['1','3','w','q'],
  '3':['2','4','e','w'], '4':['3','5','r','e'], '5':['4','6','t','r'],
  '6':['5','7','y','t'], '7':['6','8','u','y'], '8':['7','9','i','u'],
  '9':['8','0','o','i'],
};

function nearbyKey(ch) {
  const lower = ch.toLowerCase();
  const pool = NEIGHBORS[lower];
  if (!pool) return ch;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return ch !== lower ? pick.toUpperCase() : pick;
}

// speed 1 → ~300ms, speed 10 → ~30ms, with jitter
function baseDelay(speed) {
  const ms = Math.round(330 - speed * 30);
  return ms + (Math.random() - 0.5) * ms * 0.6;
}

function buildTypeSequence(text, speed, mistakeRate) {
  // Returns an array of { action: 'type'|'delete', char?, delay }
  const ops = [];
  let t = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const mChance = (ch === ' ' || ch === '\n') ? mistakeRate * 0.15 : mistakeRate;

    if (Math.random() < mChance) {
      const wrongCount = 1 + Math.floor(Math.random() * 2);
      let lt = 0;

      for (let w = 0; w < wrongCount; w++) {
        const wd = baseDelay(speed);
        ops.push({ action: 'type', char: nearbyKey(ch), at: t + lt + wd });
        lt += wd;
        if (Math.random() < 0.4) lt += 150 + Math.random() * 350;
      }

      for (let b = 0; b < wrongCount; b++) {
        const bd = baseDelay(speed) * 0.65;
        ops.push({ action: 'delete', at: t + lt + bd });
        lt += bd;
      }

      lt += 80 + Math.random() * 200;

      const cd = baseDelay(speed);
      ops.push({ action: 'type', char: ch, at: t + lt + cd });
      t += lt + cd;
    } else {
      const d = baseDelay(speed);
      let extra = 0;
      if (ch === ' ' && Math.random() < 0.08) extra = 250 + Math.random() * 500;
      if ('?.!'.includes(ch) && Math.random() < 0.25) extra = 400 + Math.random() * 700;
      ops.push({ action: 'type', char: ch, at: t + d + extra });
      t += d + extra;
    }
  }
  return ops;
}

/* ── Determine which frame context this script is in ── */

const isEditorFrame =
  window !== window.top &&
  document.body != null &&
  document.body.contentEditable === 'true';

const isTopFrame = window === window.top;

/* ════════════════════════════════════════════
   EDITOR IFRAME  –  does the actual typing
   ════════════════════════════════════════════ */
if (isEditorFrame) {
  let tids = [];
  let running = false;

  function typeChar(ch) {
    if (ch === '\n') {
      document.execCommand('insertParagraph');
    } else {
      document.execCommand('insertText', false, ch);
    }
  }

  function deleteChar() {
    document.execCommand('delete');
  }

  function stopAll(reason) {
    running = false;
    tids.forEach(clearTimeout);
    tids = [];
    window.parent.postMessage({ src: 'typing-sim', event: reason || 'stopped' }, '*');
  }

  function startTyping(text, speed, mistakeRate) {
    stopAll();
    running = true;

    const ops = buildTypeSequence(text, speed, mistakeRate);
    const lastAt = ops.length ? ops[ops.length - 1].at : 0;

    ops.forEach(op => {
      const id = setTimeout(() => {
        if (!running) return;
        if (op.action === 'type')   typeChar(op.char);
        if (op.action === 'delete') deleteChar();
      }, op.at);
      tids.push(id);
    });

    // Fire "done" after last op
    const doneId = setTimeout(() => {
      if (running) stopAll('done');
    }, lastAt + 200);
    tids.push(doneId);
  }

  window.addEventListener('message', ({ data }) => {
    if (!data || data.src !== 'typing-sim') return;
    if (data.cmd === 'start') startTyping(data.text, data.speed, data.mistakeRate);
    if (data.cmd === 'stop')  stopAll('stopped');
  });
}

/* ════════════════════════════════════════════
   TOP FRAME  –  overlay UI + routing messages
   ════════════════════════════════════════════ */
if (isTopFrame) {
  let overlayEl = null;
  let pendingMsg = null;

  function getEditorIframe() {
    return document.querySelector('.docs-texteventtarget-iframe');
  }

  function sendToEditor(msg) {
    const iframe = getEditorIframe();
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(msg, '*');
    }
  }

  function focusEditor() {
    const iframe = getEditorIframe();
    if (!iframe) return;
    iframe.focus();
    try {
      iframe.contentDocument.body.focus();
      iframe.contentDocument.body.click();
    } catch (_) {}
  }

  /* ── Overlay ── */
  const OVERLAY_STYLE = `
    position: fixed; top: 20px; right: 20px; z-index: 2147483647;
    background: #1a1a2e; border: 1px solid #a78bfa;
    border-radius: 12px; padding: 16px 20px;
    font-family: 'Segoe UI', sans-serif; color: #e0e0e0;
    font-size: 14px; box-shadow: 0 4px 28px rgba(0,0,0,0.6);
    text-align: center; min-width: 190px; user-select: none;
  `;

  function ensureOverlay() {
    if (!overlayEl || !document.body.contains(overlayEl)) {
      overlayEl = document.createElement('div');
      overlayEl.id = '__typing-sim-overlay__';
      overlayEl.style.cssText = OVERLAY_STYLE;
      document.body.appendChild(overlayEl);
    }
    return overlayEl;
  }

  function removeOverlay(finalMsg) {
    if (!overlayEl) return;
    if (finalMsg) {
      overlayEl.innerHTML = `<span style="color:#60a5fa">${finalMsg}</span>`;
      setTimeout(() => { overlayEl?.remove(); overlayEl = null; }, 1800);
    } else {
      overlayEl.remove();
      overlayEl = null;
    }
  }

  function showCountdown(seconds, onDone) {
    ensureOverlay();
    let count = seconds;

    function tick() {
      if (!overlayEl) return;
      overlayEl.innerHTML = `
        <div style="color:#a78bfa;font-size:11px;letter-spacing:1px;margin-bottom:6px">TYPING SIMULATOR</div>
        <div style="font-size:13px;margin-bottom:4px">Click into your doc&hellip;</div>
        <div style="font-size:36px;font-weight:700;color:#a78bfa;line-height:1">${count}</div>
      `;
      if (count === 0) { onDone(); return; }
      count--;
      setTimeout(tick, 1000);
    }
    tick();
  }

  function showTypingStatus() {
    ensureOverlay();
    overlayEl.innerHTML = `
      <div style="color:#a78bfa;font-size:11px;letter-spacing:1px;margin-bottom:8px">TYPING SIMULATOR</div>
      <div style="color:#86efac;margin-bottom:12px;font-size:13px">&#9679; Typing&hellip;</div>
      <button id="__typing-sim-stop__" style="
        background:#f87171;color:#0f0f1a;border:none;border-radius:6px;
        padding:7px 20px;font-weight:700;cursor:pointer;font-size:13px;
        font-family:inherit;
      ">Stop</button>
    `;
    document.getElementById('__typing-sim-stop__').addEventListener('click', () => {
      sendToEditor({ src: 'typing-sim', cmd: 'stop' });
      removeOverlay('Stopped.');
    });
  }

  function beginSequence(msg) {
    showCountdown(2, () => {
      focusEditor();
      sendToEditor({ src: 'typing-sim', cmd: 'start', ...msg });
      showTypingStatus();
    });
  }

  /* ── Listen for messages from popup ── */
  chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
    if (msg.action === 'startTyping') {
      beginSequence({ text: msg.text, speed: msg.speed, mistakeRate: msg.mistakeRate });
      respond({ ok: true });
    } else if (msg.action === 'stop') {
      sendToEditor({ src: 'typing-sim', cmd: 'stop' });
      removeOverlay('Stopped.');
      respond({ ok: true });
    }
    return true;
  });

  /* ── Listen for events from editor frame ── */
  window.addEventListener('message', ({ data }) => {
    if (!data || data.src !== 'typing-sim') return;
    if (data.event === 'done')    removeOverlay('Done!');
    if (data.event === 'stopped') removeOverlay();
  });
}
