const speedSlider   = document.getElementById('speed');
const mistakeSlider = document.getElementById('mistakes');
const speedVal      = document.getElementById('speedVal');
const mistakeVal    = document.getElementById('mistakeVal');
const startBtn      = document.getElementById('startBtn');
const statusEl      = document.getElementById('status');

speedSlider.addEventListener('input',   () => speedVal.textContent   = speedSlider.value);
mistakeSlider.addEventListener('input', () => mistakeVal.textContent = mistakeSlider.value);

startBtn.addEventListener('click', async () => {
  const text = document.getElementById('inputText').value;
  if (!text.trim()) {
    statusEl.textContent = 'Paste some text first.';
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url?.startsWith('https://docs.google.com/')) {
    statusEl.textContent = 'Open a Google Doc first!';
    return;
  }

  startBtn.disabled = true;
  statusEl.textContent = '';

  try {
    await chrome.tabs.sendMessage(tab.id, {
      action: 'startTyping',
      text,
      speed:       parseInt(speedSlider.value),
      mistakeRate: parseInt(mistakeSlider.value) / 100
    });
    window.close();
  } catch (e) {
    startBtn.disabled = false;
    statusEl.textContent = 'Could not connect. Reload the Google Doc and try again.';
  }
});
