// BCPS Logbook Bulk Approver — content script
// Runs only on https://eportal.bcps.edu.bd/supervisor/logbook*

(() => {
  let running = false;
  let approvedCount = 0;
  let lastMessage = 'Idle';

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    // The site adds "show" to the modal only while it's open
    return document.querySelector('.modal.show');
  }

  function describeRow(row) {
    const cells = row.querySelectorAll('[role="cell"]');
    // cell order per the observed table: Sl, Photo, Program, Slot, Date, Form, Trainee, BMDC...
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

  function report(extra) {
    lastMessage = extra.status;
    try {
      chrome.runtime.sendMessage({
        type: 'progress',
        running,
        count: approvedCount,
        last: extra.status,
        label: extra.label || '',
      });
    } catch (e) {
      // popup may not be open — ignore
    }
    updateOverlay();
  }

  async function mainLoop(delayMs) {
    while (running) {
      const result = await processOneEntry();
      report(result);

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
        report({ status: 'done-no-more-pending' });
        break;
      }

      // Any other error: stop instead of hammering the server/looping forever
      running = false;
      report({ status: `stopped-error:${result.status}` });
      break;
    }
  }

  // ---- Tiny on-page status overlay so you can watch progress without the popup open ----
  let overlayEl = null;
  function ensureOverlay() {
    if (overlayEl) return overlayEl;
    overlayEl = document.createElement('div');
    overlayEl.style.cssText = `
      position: fixed; bottom: 16px; right: 16px; z-index: 999999;
      background: #1f2937; color: #fff; font: 13px/1.4 sans-serif;
      padding: 10px 14px; border-radius: 8px; box-shadow: 0 4px 14px rgba(0,0,0,.3);
      max-width: 280px;
    `;
    document.body.appendChild(overlayEl);
    return overlayEl;
  }
  function updateOverlay() {
    if (!running && !overlayEl) return;
    const el = ensureOverlay();
    el.style.display = running || approvedCount > 0 ? 'block' : 'none';
    el.innerHTML = `
      <div style="font-weight:600; margin-bottom:4px;">
        BCPS Bulk Approver ${running ? '▶ running' : '⏹ stopped'}
      </div>
      <div>Approved so far: <b>${approvedCount}</b></div>
      <div style="opacity:.75; word-break:break-word;">Last: ${lastMessage}</div>
    `;
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'start') {
      if (!running) {
        running = true;
        mainLoop(msg.delayMs || 1200);
      }
      sendResponse({ ok: true, running, count: approvedCount });
      updateOverlay();
    } else if (msg.type === 'stop') {
      running = false;
      sendResponse({ ok: true, running, count: approvedCount });
      updateOverlay();
    } else if (msg.type === 'status') {
      sendResponse({ ok: true, running, count: approvedCount, last: lastMessage });
    }
    return true;
  });
})();
