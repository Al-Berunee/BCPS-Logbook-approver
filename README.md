<div align="center">

<img src="logo-popup.png" alt="BCPS Logo" width="90"/>

# BCPS Logbook Bulk Approver

**A Chrome extension that automates approving pending E-Logbook entries**
on the BCPS supervisor portal — one click instead of thousands.

![Platform](https://img.shields.io/badge/platform-Chrome%20Extension-4285F4?logo=googlechrome&logoColor=white)
![Manifest](https://img.shields.io/badge/manifest-v3-333333)
![Status](https://img.shields.io/badge/status-active-16a34a)

</div>

---

## ✨ What it does

On the **E-Logbook Entry List For Approval** page, this extension repeats the
following cycle automatically until you stop it:

```
Find next "Pending" row  →  click View  →  select "Approve"  →  click Update  →  repeat
```

When a page runs out of pending entries, it automatically clicks **Next Page**
and keeps going — so it can work through thousands of entries unattended.

<table>
<tr><td width="50%">

### ✅ Features
- **Auto‑appears** as a floating panel the moment you open the logbook page
- Clicking **Start** auto‑minimizes it into a small round button
- Click the round button anytime to reopen the panel
- Configurable delay between approvals
- Auto‑advances across pages
- Auto‑reopens itself when the run finishes or hits an error
- Toolbar icon also toggles the panel open/closed

</td><td width="50%">

### ⚠️ Good to know
- Approves **every** pending row it finds — no per‑entry content review
- Works only on `eportal.bcps.edu.bd/supervisor/logbook`
- Runs entirely in your own logged‑in browser session — no external server, no API calls

</td></tr>
</table>

---

## 📦 Installation

1. **Unzip** this folder somewhere permanent (don't delete it — Chrome loads the extension live from these files).
2. Open Chrome and go to:
   ```
   chrome://extensions
   ```
3. Turn on **Developer mode** (top‑right toggle).
4. Click **Load unpacked** → select the `bcps-bulk-approver` folder.
5. Pin the extension (puzzle‑piece icon → pin) for quick access.

> Updated the files later? Click the **reload icon (⟳)** on the extension card in `chrome://extensions` to apply changes.

---

## ▶️ Usage

1. Log in to `eportal.bcps.edu.bd` and open **Logbook Management → Logbook List**.
   The control panel appears automatically in the bottom‑right corner.
2. *(Optional, recommended)* Set the **Status** filter to `Pending` and **Rows per page** to `200` — fewer page changes, faster run.
3. Adjust the **delay** if you want (default `1200 ms` between approvals — keep it reasonable to avoid overloading the server).
4. Click **Start** — the panel automatically shrinks into a small round button so it stays out of your way.
5. Click the round button anytime to reopen the panel and check progress or click **Stop**.
6. The panel reopens by itself when the run finishes or if something needs your attention.
7. You can also click the extension's toolbar icon anytime to show/hide the panel.

---

## 🗂 File structure

```
bcps-bulk-approver/
├── manifest.json         # Extension config (MV3)
├── background.js         # Toolbar icon click → toggles the on-page panel
├── content.js            # Floating panel UI + the automation loop
├── logo-popup.png        # BCPS logo shown in the panel / round button
├── icon16/32/48/128.png  # Toolbar / extension icons
└── README.md             # You are here
```

---

## 🛡️ Safety notes

- The extension only has permission to run on `eportal.bcps.edu.bd`.
- It does not read, store, or transmit any data outside your browser.
- If a step doesn't behave as expected (e.g. a dialog doesn't open), the loop **stops itself** rather than retrying endlessly.

---

<div align="center">

Developed by **[Maruf](https://www.facebook.com/AAbdullahAlMaruf/) — 01770578663**

</div>
