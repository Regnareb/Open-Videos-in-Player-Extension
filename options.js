const DEFAULTS = { enabled: true, template: "ytplayer://open?url={url}", includeLists: false, excludedHosts: [] };
const $ = (id) => document.getElementById(id);

chrome.storage.sync.get(DEFAULTS, (s) => {
  $("enabled").checked = s.enabled;
  $("includeLists").checked = s.includeLists;
  $("template").value = s.template;
  $("excluded").value = (s.excludedHosts || []).join("\n");
});

$("save").addEventListener("click", () => {
  const excludedHosts = $("excluded").value
    .split("\n")
    .map((h) => h.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
    .filter(Boolean);
  chrome.storage.sync.set({
    enabled: $("enabled").checked,
    includeLists: $("includeLists").checked,
    template: $("template").value.trim() || DEFAULTS.template,
    excludedHosts
  }, () => {
    $("status").textContent = "Saved";
    setTimeout(() => ($("status").textContent = ""), 1500);
  });
});
