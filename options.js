const DEFAULTS = { enabled: true, template: "ytplayer://open?url={url}" };
const $ = (id) => document.getElementById(id);

chrome.storage.sync.get(DEFAULTS, (s) => {
  $("enabled").checked = s.enabled;
  $("template").value = s.template;
});

$("save").addEventListener("click", () => {
  const template = $("template").value.trim() || DEFAULTS.template;
  chrome.storage.sync.set({ enabled: $("enabled").checked, template }, () => {
    $("status").textContent = "Saved";
    setTimeout(() => ($("status").textContent = ""), 1500);
  });
});
