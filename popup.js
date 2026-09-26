const statusEl = document.getElementById('status');
const startBtn = document.getElementById('start');
const stopBtn = document.getElementById('stop');
const delayInput = document.getElementById('delay');

function renderStatus(res) {
  if (!res) {
    statusEl.textContent = 'Not connected to logbook page.';
    return;
  }
  statusEl.innerHTML = `
    <b>${res.running ? 'Running' : 'Stopped'}</b><br>
    Approved: ${res.count ?? 0}<br>
    ${res.last ? `Last: ${res.last}` : ''}
  `;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToContent(msg) {
  const tab = await getActiveTab();
  if (!tab) return null;
  try {
    return await chrome.tabs.sendMessage(tab.id, msg);
  } catch (e) {
    return null;
  }
}

async function refresh() {
  const res = await sendToContent({ type: 'status' });
  renderStatus(res);
}

startBtn.addEventListener('click', async () => {
  const delayMs = Math.max(parseInt(delayInput.value, 10) || 1200, 300);
  const res = await sendToContent({ type: 'start', delayMs });
  if (!res) {
    statusEl.textContent = 'Could not reach the page — make sure you are on the E-Logbook approval page and reload it once.';
    return;
  }
  renderStatus(res);
});

stopBtn.addEventListener('click', async () => {
  const res = await sendToContent({ type: 'stop' });
  renderStatus(res);
});

refresh();
