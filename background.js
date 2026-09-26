chrome.action.onClicked.addListener((tab) => {
  if (!tab || !tab.id) return;
  chrome.tabs.sendMessage(tab.id, { type: 'toggle-panel' }).catch(() => {
    // content script isn't on this tab (wrong page) — nothing to do
  });
});
