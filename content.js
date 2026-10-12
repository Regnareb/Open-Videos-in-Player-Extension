(() => {
  const DEFAULTS = {
    enabled: true,
    // Placeholders: {url} = URL-encoded link, {rawurl} = link as-is, {id} = YouTube video ID (empty elsewhere)
    template: "ytplayer://open?url={url}",
    includeLists: false,   // also catch playlists, channels, profiles and similar non-video pages
    excludedHosts: []      // hostnames where links are left alone
  };

  let settings = { ...DEFAULTS };
  chrome.storage.sync.get(DEFAULTS, (s) => { settings = { ...DEFAULTS, ...s }; });
  chrome.storage.onChanged.addListener((changes) => {
    for (const [key, { newValue }] of Object.entries(changes)) settings[key] = newValue;
  });

  // --- yt-dlp pattern matching (compiled lazily on first click) -------------
  let compiled = null;
  function compile() {
    compiled = [];
    for (const [source, flags, kind] of globalThis.YTDLP_PATTERNS || []) {
      try { compiled.push([new RegExp("^(?:" + source + ")", flags), kind]); } catch { /* skip */ }
    }
  }

  const cache = new Map();
  function matchesYtdlp(url, includeLists) {
    const key = (includeLists ? "L|" : "V|") + url;
    if (cache.has(key)) return cache.get(key);
    if (!compiled) compile();
    let result = false;
    for (const [re, kind] of compiled) {
      if (kind === "l" && !includeLists) continue;
      if (re.test(url)) { result = true; break; }
    }
    if (cache.size > 2000) cache.clear();
    cache.set(key, result);
    return result;
  }

  // Canonical YouTube ID (lets us strip playlist/timestamp junk and fill {id}).
  function youtubeId(u) {
    const host = u.hostname.replace(/^(www\.|m\.|music\.)/, "");
    const pat = /^[\w-]{11}$/;
    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      return pat.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") {
        const id = u.searchParams.get("v");
        return id && pat.test(id) ? id : null;
      }
      const m = u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{11})/);
      if (m) return m[1];
    }
    return null;
  }

  function resolveTarget(anchor) {
    let u;
    try { u = new URL(anchor.href, location.href); } catch { return null; }
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.pathname === "/" && !u.search) return null;            // never hijack site root links
    if (u.href === location.href.split("#")[0] + u.hash) return null; // same-page links
    const host = u.hostname.toLowerCase();
    if ((settings.excludedHosts || []).some((h) => host === h || host.endsWith("." + h))) return null;

    const ytId = youtubeId(u);
    if (ytId) return { url: `https://www.youtube.com/watch?v=${ytId}`, id: ytId };

    // Everything else: let yt-dlp's own URL patterns decide.
    if (matchesYtdlp(u.href, settings.includeLists)) return { url: u.href, id: "" };
    return null;
  }

  function buildLauncherUrl({ url, id }) {
    return settings.template
      .replaceAll("{id}", id)
      .replaceAll("{rawurl}", url)
      .replaceAll("{url}", encodeURIComponent(url));
  }

  function findAnchor(event) {
    for (const node of event.composedPath()) {
      if (node instanceof HTMLAnchorElement && node.href) return node;
    }
    return null;
  }

  function handleClick(event) {
    if (!settings.enabled) return;
    if (event.altKey) return; // Alt+click opens the link normally
    if (event.type === "auxclick" && event.button !== 1) return;
    if (event.type === "click" && event.button !== 0) return;

    const anchor = findAnchor(event);
    if (!anchor) return;

    const target = resolveTarget(anchor);
    if (!target) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.href = buildLauncherUrl(target);
  }

  document.addEventListener("click", handleClick, true);
  document.addEventListener("auxclick", handleClick, true);
})();
