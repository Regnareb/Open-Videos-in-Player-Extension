(() => {
  const DEFAULTS = {
    enabled: true,
    // Placeholders: {url} = encoded canonical URL, {id} = video ID, {rawurl} = unencoded URL
    template: "ytplayer://open?url={url}"
  };

  let settings = { ...DEFAULTS };

  chrome.storage.sync.get(DEFAULTS, (s) => { settings = { ...DEFAULTS, ...s }; });
  chrome.storage.onChanged.addListener((changes) => {
    for (const [key, { newValue }] of Object.entries(changes)) settings[key] = newValue;
  });

  // Returns a video ID if the URL points to a YouTube video, otherwise null.
  function getVideoId(href) {
    let u;
    try { u = new URL(href, location.href); } catch { return null; }
    const host = u.hostname.replace(/^(www\.|m\.|music\.)/, "");
    const idPattern = /^[\w-]{11}$/;

    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      return idPattern.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") {
        const id = u.searchParams.get("v");
        return id && idPattern.test(id) ? id : null;
      }
      const m = u.pathname.match(/^\/(shorts|live|embed)\/([\w-]{11})/);
      if (m) return m[2];
    }
    return null;
  }

  function buildLauncherUrl(id) {
    const canonical = `https://www.youtube.com/watch?v=${id}`;
    return settings.template
      .replaceAll("{id}", id)
      .replaceAll("{rawurl}", canonical)
      .replaceAll("{url}", encodeURIComponent(canonical));
  }

  function findAnchor(event) {
    for (const node of event.composedPath()) {
      if (node instanceof HTMLAnchorElement && node.href) return node;
    }
    return null;
  }

  function handleClick(event) {
    if (!settings.enabled) return;
    if (event.altKey) return; // Alt+click = open the link normally
    if (event.type === "auxclick" && event.button !== 1) return;
    if (event.type === "click" && event.button !== 0) return;

    const anchor = findAnchor(event);
    if (!anchor) return;

    const id = getVideoId(anchor.href);
    if (!id) return;

    // Stop the page (including YouTube's SPA router) from handling the click.
    event.preventDefault();
    event.stopImmediatePropagation();

    // Navigating to a custom scheme triggers the OS/browser protocol handler.
    window.location.href = buildLauncherUrl(id);
  }

  // Capture phase so we run before the page's own handlers.
  document.addEventListener("click", handleClick, true);
  document.addEventListener("auxclick", handleClick, true);
})();
