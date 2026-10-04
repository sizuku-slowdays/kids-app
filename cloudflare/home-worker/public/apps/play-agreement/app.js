const storageKey = "play-agreement-admin-token";
const adminBase = "https://asobu.cetus.fun/admin/";
const valid = (value) => /^[a-f0-9]{64}$/.test(value || "");

function openAdmin(token) {
  location.replace(adminBase + encodeURIComponent(token));
}

const setupToken = new URLSearchParams(location.hash.slice(1)).get("setup");
if (valid(setupToken)) {
  localStorage.setItem(storageKey, setupToken);
  history.replaceState(null, "", location.pathname);
  openAdmin(setupToken);
} else {
  const saved = localStorage.getItem(storageKey);
  if (valid(saved)) {
    openAdmin(saved);
  } else {
    localStorage.removeItem(storageKey);
    document.querySelector("#status").hidden = true;
    const form = document.querySelector("#setup");
    const input = document.querySelector("#token");
    const error = document.querySelector("#error");
    form.hidden = false;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const token = input.value.trim().toLowerCase();
      if (!valid(token)) {
        error.textContent = "接続キーを確認してください。";
        return;
      }
      localStorage.setItem(storageKey, token);
      openAdmin(token);
    });
  }
}
