// options.js — settings page logic
(function () {
  const toggle    = document.getElementById("linker-toggle");
  const statusEl  = document.getElementById("status");
  let saveTimer   = null;

  // Load persisted state
  chrome.storage.local.get({ linkerEnabled: true }, result => {
    toggle.checked = !!result.linkerEnabled;
  });

  // Persist on change and show brief confirmation
  toggle.addEventListener("change", () => {
    const val = toggle.checked;
    chrome.storage.local.set({ linkerEnabled: val }, () => {
      clearTimeout(saveTimer);
      statusEl.textContent = "Saved.";
      statusEl.className = "status saved";
      saveTimer = setTimeout(() => {
        statusEl.textContent = "";
        statusEl.className = "status";
      }, 1800);
    });
  });
})();
