// BCPS Logbook Bulk Approver — content script
// Injects an on-page floating panel (auto-shown) that can be minimized
// into a small round button, and drives the View → Approve → Update loop.

(() => {
  const LOGO_URL = chrome.runtime.getURL('logo-popup.png');

  let running = false;
  let approvedCount = 0;
  let lastMessage = 'Idle';
  let expanded = true; // panel starts open when you land on the page

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------
  const style = document.createElement('style');
  style.textContent = `
    #bcps-approver-root, #bcps-approver-root * { box-sizing: border-box; }
    #bcps-approver-root {
      position: fixed; bottom: 18px; right: 18px; z-index: 2147483647;
      font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    }
    #bcps-approver-panel {
      width: 270px; background: #fff; border-radius: 14px;
      box-shadow: 0 10px 30px rgba(0,0,0,.22);
      overflow: hidden; border: 1px solid #e5e7eb;
      animation: bcps-pop-in .15s ease-out;
    }
    @keyframes bcps-pop-in { from { opacity:0; transform: translateY(8px) scale(.97);} to { opacity:1; transform: translateY(0) scale(1);} }
    #bcps-approver-panel.bcps-hidden { display: none; }
    .bcps-header {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 10px 10px 12px; background: #0b3d91; color: #fff;
    }
    .bcps-header img { width: 26px; height: 26px; border-radius: 50%; background:#fff; }
    .bcps-header .bcps-title { font-size: 12.5px; font-weight: 700; flex: 1; line-height: 1.25; }
    .bcps-min-btn {
      background: rgba(255,255,255,.15); border: none; color: #fff;
      width: 22px; height: 22px; border-radius: 6px; cursor: pointer; font-size: 14px; line-height: 1;
    }
    .bcps-min-btn:hover { background: rgba(255,255,255,.3); }
    .bcps-body { padding: 12px; font-size: 12.5px; color: #111827; }
    .bcps-body label { display:block; font-weight:600; margin-bottom:4px; }
    .bcps-body input[type="number"] {
      width: 100%; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 7px; font-size: 12.5px;
    }
    .bcps-row { display:flex; gap:8px; margin-top:10px; }
    .bcps-row button {
      flex:1; padding:8px; border:none; border-radius:8px; cursor:pointer; font-weight:700; font-size:12.5px;
    }
    #bcps-start { background:#16a34a; color:#fff; }
    #bcps-start:hover { background:#15803d; }
    #bcps-stop { background:#dc2626; color:#fff; }
    #bcps-stop:hover { background:#b91c1c; }
    button:disabled { opacity:.5; cursor:not-allowed; }
    .bcps-status { margin-top:10px; padding:8px 10px; background:#f3f4f6; border-radius:8px; line-height:1.5; }
    .bcps-status b { color:#0b3d91; }
    .bcps-note { margin-top:8px; font-size:10.5px; color:#6b7280; line-height:1.4; }
    .bcps-footer {
      margin-top:10px; padding-top:8px; border-top:1px solid #e5e7eb;
      text-align:center; font-size:10.5px; color:#6b7280;
    }
    .bcps-footer a { color:#2563eb; text-decoration:none; }
    .bcps-footer a:hover { text-decoration:underline; }

    #bcps-approver-fab {
      display: none; width: 56px; height: 56px; border-radius: 50%;
      background: #0b3d91; border: 3px solid #fff; cursor: pointer;
      box-shadow: 0 6px 18px rgba(0,0,0,.3); position: relative; padding: 0;
    }
    #bcps-approver-fab img { width: 100%; height: 100%; border-radius: 50%; display:block; }
    #bcps-approver-fab .bcps-badge {
      position:absolute; top:-4px; right:-4px; min-width:18px; height:18px; padding: 0 4px;
      background:#16a34a; color:#fff; border-radius:999px; font-size:10px; font-weight:800;
      display:flex; align-items:center; justify-content:center; border:2px solid #fff;
    }
    #bcps-approver-fab.bcps-running { animation: bcps-pulse 1.4s infinite; }
    @keyframes bcps-pulse {
      0% { box-shadow: 0 6px 18px rgba(0,0,0,.3), 0 0 0 0 rgba(22,163,74,.55); }
      70% { box-shadow: 0 6px 18px rgba(0,0,0,.3), 0 0 0 10px rgba(22,163,74,0); }
      100% { box-shadow: 0 6px 18px rgba(0,0,0,.3), 0 0 0 0 rgba(22,163,74,0); }
    }
  `;
  document.documentElement.appendChild(style);

  const root = document.createElement('div');
  root.id = 'bcps-approver-root';
  root.innerHTML = `
    <div id="bcps-approver-panel">
      <div class="bcps-header">
        <img src="${LOGO_URL}" alt="BCPS">
        <div class="bcps-title">BCPS Logbook<br>Bulk Approver</div>
        <button class="bcps-min-btn" id="bcps-min" title="Minimize">–</button>
      </div>
      <div class="bcps-body">
        <label for="bcps-delay">Delay between approvals (ms)</label>
        <input type="number" id="bcps-delay" value="1200" min="300" step="100">
        <div class="bcps-row">
          <button id="bcps-start">Start</button>
          <button id="bcps-stop">Stop</button>
        </div>
        <div class="bcps-status" id="bcps-status">Idle. Click Start to begin.</div>
        <div class="bcps-note">Runs through Pending entries, page by page, until stopped or none remain. The site's own "X of N" total only updates when the page list reloads (e.g. on Next Page), so it may look stuck for a few approvals at a time — that's normal.</div>
        <div class="bcps-footer">
          Developed by
          <a href="https://www.facebook.com/AAbdullahAlMaruf/" target="_blank" rel="noopener noreferrer">Maruf - 01770578663</a>
        </div>
      </div>
    </div>
    <button id="bcps-approver-fab" title="Open BCPS Bulk Approver">
      <img src="${LOGO_URL}" alt="BCPS">
      <span class="bcps-badge" id="bcps-fab-badge">0</span>
    </button>
  `;
  document.body.appendChild(root);

  const panelEl = root.querySelector('#bcps-approver-panel');
  const fabEl = root.querySelector('#bcps-approver-fab');
  const fabBadge = root.querySelector('#bcps-fab-badge');
  const statusEl = root.querySelector('#bcps-status');
  const delayInput = root.querySelector('#bcps-delay');
  const startBtn = root.querySelector('#bcps-start');
  const stopBtn = root.querySelector('#bcps-stop');
  const minBtn = root.querySelector('#bcps-min');

  function renderUI() {
    panelEl.classList.toggle('bcps-hidden', !expanded);
    fabEl.style.display = expanded ? 'none' : 'block';
    fabEl.classList.toggle('bcps-running', running);
    fabBadge.textContent = approvedCount;
    startBtn.disabled = running;
    stopBtn.disabled = !running;
    statusEl.innerHTML = `<b>${running ? 'Running…' : 'Stopped'}</b> — Approved: <b>${approvedCount}</b>` +
      (lastMessage ? `<br><span style="opacity:.75">${lastMessage}</span>` : '') +
      `<br><span style="opacity:.6; font-size:10.5px;">Note: the page's own total count only refreshes on page change — trust the "Approved" number above, not the site's total.</span>`;
  }

  function collapse() { expanded = false; renderUI(); }
  function expand() { expanded = true; renderUI(); }

  minBtn.addEventListener('click', collapse);
  fabEl.addEventListener('click', expand);

  startBtn.addEventListener('click', () => {
    const delayMs = Math.max(parseInt(delayInput.value, 10) || 1200, 300);
    startAutomation(delayMs);
    collapse(); // auto-minimize into the round button once running
  });

  stopBtn.addEventListener('click', () => {
    running = false;
    lastMessage = 'Stopped by user';
    renderUI();
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'toggle-panel') {
      expanded ? collapse() : expand();
    }
  });

  // ---------------------------------------------------------------------
  // Automation logic
  // ---------------------------------------------------------------------
  async function waitFor(getEl, timeout = 8000, interval = 150) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const el = getEl();
      if (el) return el;
      await sleep(interval);
    }
    return null;
  }

  function findFirstPendingRow() {
    const rows = document.querySelectorAll('.rdt_TableRow');
    for (const row of rows) {
      const badge = row.querySelector('.badge');
      if (badge && badge.textContent.trim() === 'Pending') return row;
    }
    return null;
  }

  function getViewButton(row) {
    const buttons = row.querySelectorAll('button');
    for (const b of buttons) {
      if (b.textContent.trim().includes('View')) return b;
    }
    return null;
  }

  function getOpenModal() {
    return document.querySelector('.modal.show');
  }

  function describeRow(row) {
    const cells = row.querySelectorAll('[role="cell"]');
    const date = cells[4] ? cells[4].textContent.trim() : '';
    const form = cells[5] ? cells[5].textContent.trim() : '';
    const trainee = cells[6] ? cells[6].textContent.trim() : '';
    return `${trainee} — ${form} — ${date}`;
  }

  async function waitForModalGone(modal, timeout = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (!document.body.contains(modal) && !document.querySelector('.modal.show')) return true;
      await sleep(150);
    }
    return false;
  }

  function closeModalIfOpen() {
    const modal = getOpenModal();
    if (modal) {
      const closeBtn = modal.querySelector('.btn-close');
      if (closeBtn) closeBtn.click();
    }
  }

  function clickNextPage() {
    const btn = document.querySelector('#pagination-next-page');
    if (btn && btn.getAttribute('aria-disabled') !== 'true' && !btn.disabled) {
      btn.click();
      return true;
    }
    return false;
  }

  async function processOneEntry() {
    const row = findFirstPendingRow();
    if (!row) return { status: 'no-pending' };

    const label = describeRow(row);
    const viewBtn = getViewButton(row);
    if (!viewBtn) return { status: 'no-view-button', label };

    viewBtn.click();

    const modal = await waitFor(getOpenModal, 8000);
    if (!modal) return { status: 'modal-timeout', label };

    const approveRadio = await waitFor(() => modal.querySelector('#approve'), 5000);
    if (!approveRadio) {
      closeModalIfOpen();
      return { status: 'no-approve-radio', label };
    }

    approveRadio.click();
    approveRadio.dispatchEvent(new Event('change', { bubbles: true }));
    await sleep(250);

    const updateBtn = modal.querySelector('button[type="submit"]');
    if (!updateBtn) {
      closeModalIfOpen();
      return { status: 'no-update-button', label };
    }

    updateBtn.click();

    const closed = await waitForModalGone(modal, 15000);
    if (!closed) return { status: 'modal-close-timeout', label };

    approvedCount++;
    return { status: 'ok', label };
  }

  function reportProgress(result) {
    lastMessage = result.label ? `${result.status} — ${result.label}` : result.status;
    renderUI();
  }

  async function mainLoop(delayMs) {
    while (running) {
      const result = await processOneEntry();
      reportProgress(result);

      if (result.status === 'ok') {
        await sleep(delayMs);
        continue;
      }

      if (result.status === 'no-pending') {
        const moved = clickNextPage();
        if (moved) {
          await sleep(1500);
          continue;
        }
        running = false;
        lastMessage = 'Done — no more Pending entries';
        expand(); // surface the panel so the user sees it finished
        break;
      }

      // Any other unexpected outcome: stop rather than loop forever
      running = false;
      lastMessage = `Stopped — ${result.status}`;
      expand();
      break;
    }
    renderUI();
  }

  function startAutomation(delayMs) {
    if (running) return;
    running = true;
    lastMessage = 'Starting…';
    renderUI();
    mainLoop(delayMs);
  }

  renderUI();
})();
