#!/usr/bin/env python3
"""
Generates ../patterns.js from yt-dlp's extractor URL patterns (_VALID_URL).

Usage:
    pip install -U yt-dlp
    python3 tools/generate_patterns.py

Python regexes are converted to JavaScript regexes (named groups -> numbered,
verbose mode stripped, inline flags -> JS flags). Patterns that can't be
converted, or that are so broad they match ordinary pages (example.com,
github.com, wikipedia...), are dropped.
"""
import json, re, sys, os
import yt_dlp
from yt_dlp.extractor import gen_extractor_classes

# Ordinary URLs that must NOT match, to weed out over-broad extractor patterns.
BENIGN = [
    "https://example.com/", "https://example.org/some/page",
    "https://github.com/user/repo", "https://en.wikipedia.org/wiki/Cat",
    "https://stackoverflow.com/questions/1/title", "https://news.ycombinator.com/item?id=1",
    "https://www.google.com/search?q=test", "https://www.bing.com/search?q=test",
    "https://docs.python.org/3/library/re.html", "https://www.nytimes.com/2024/01/01/world/x.html",
    "https://medium.com/@user/story-123", "https://www.amazon.com/dp/B000000000",
]

# Extractors for playlists/channels/etc. -- off by default in the extension.
LISTY_WORDS = {"playlist", "playlists", "channel", "channels", "user", "users", "tab", "feed",
               "search", "list", "lists", "series", "season", "seasons", "show", "shows", "album",
               "albums", "category", "categories", "tag", "tags", "genre", "topic", "collection",
               "collections", "profile", "artist", "account", "history", "subscriptions",
               "recommended", "watchlater", "favorites", "mylist", "archive", "index", "program",
               "programme", "brand", "section", "hub", "page", "pages", "directory", "browse"}


def is_listy(*names):
    for nm in names:
        nm = re.sub(r"([a-z])([A-Z])", r"\1 \2", nm)
        if LISTY_WORDS & {t.lower() for t in re.split(r"[^A-Za-z]+", nm) if t}:
            return True
    return False

# YouTube sub-extractors that are real video pages.
YT_VIDEO_NAMES = {"youtube", "youtube:clip", "youtube:ytbe", "youtube:shorts"}


def convert(py: str):
    """Convert a Python regex string to (js_source, flags) or None."""
    flags = set()
    # Leading global inline flags, e.g. (?x) (?i) (?xi)
    while True:
        m = re.match(r"\(\?([aiLmsux]+)\)", py)
        if not m:
            break
        flags.update(m.group(1))
        py = py[m.end():]
    if "a" in flags or "L" in flags:
        return None
    verbose = "x" in flags

    out, names, ngroups = [], {}, 0
    i, n, in_class = 0, len(py), False
    while i < n:
        c = py[i]
        if c == "\\":
            if i + 1 >= n:
                return None
            nxt = py[i + 1]
            if nxt == "Z":
                out.append("$")
            elif nxt == "A":
                out.append("^")
            elif nxt in "dDsSwWbBnrtfv.[](){}|*+?^$\\/-" or nxt.isdigit() or nxt in "xuU":
                out.append(py[i:i + 2])
            elif nxt.isalpha():
                return None  # unknown alpha escape differs between engines
            else:
                out.append(py[i:i + 2])  # escaped punctuation/space
            i += 2
            continue
        if in_class:
            if c == "]":
                in_class = False
            out.append(c)
            i += 1
            continue
        if c == "[":
            in_class = True
            out.append(c)
            i += 1
            if i < n and py[i] == "^":
                out.append("^"); i += 1
            if i < n and py[i] == "]":
                out.append("\\]"); i += 1
            continue
        if verbose:
            if c.isspace():
                i += 1
                continue
            if c == "#":
                while i < n and py[i] != "\n":
                    i += 1
                continue
        if c == "(":
            if py.startswith("(?", i):
                if py.startswith("(?P<", i):
                    j = py.index(">", i)
                    ngroups += 1
                    names[py[i + 4:j]] = ngroups
                    out.append("(")
                    i = j + 1
                    continue
                if py.startswith("(?P=", i):
                    j = py.index(")", i)
                    name = py[i + 4:j]
                    if name not in names:
                        return None
                    out.append("\\%d" % names[name])
                    i = j + 1
                    continue
                if py.startswith("(?#", i):
                    j = py.index(")", i)
                    i = j + 1
                    continue
                if py.startswith(("(?:", "(?=", "(?!", "(?<=", "(?<!"), i):
                    k = 3 if not py.startswith(("(?<=", "(?<!"), i) else 4
                    out.append(py[i:i + k])
                    i += k
                    continue
                return None  # conditionals, scoped flags, etc.
            ngroups += 1
        out.append(c)
        i += 1

    js = "".join(out)
    if re.search(r"\(\?<[A-Za-z]", js):
        return None
    jsflags = "".join(sorted(f for f in flags if f in "ims"))
    if flags - set("ixims"):
        return None
    try:
        re.compile(py, re.X if verbose else 0)
    except re.error:
        return None
    return js, jsflags


# Extractors whose Python patterns use conditionals ((?(1)...)) that JS can't express.
MANUAL = [
    # YouTube video pages (watch, shorts, live, embed, youtu.be)
    [r"https?://(?:(?:www|m|music)\.)?youtube(?:-nocookie)?\.com/(?:watch\?(?:[^#]*&)?v=|shorts/|live/|embed/)[\w-]{11}", "", "v"],
    [r"https?://youtu\.be/[\w-]{11}", "", "v"],
    # Vimeo video pages (incl. unlisted hashes, player.vimeo.com)
    [r"https?://(?:www\.)?vimeo\.com/(?:channels/[^/?#]+/|groups/[^/?#]+/videos/|album/\d+/video/|ondemand/[^/?#]+/|showcase/\d+/video/)?\d{6,}(?:/[\da-f]{10})?(?:[/?#]|$)", "", "v"],
    [r"https?://player\.vimeo\.com/video/\d+", "", "v"],
]


def main():
    entries, seen = [], set()
    for js, jsf, kind in MANUAL:
        entries.append([js, jsf, kind]); seen.add((js, jsf, kind))
    stats = dict(total=0, no_pattern=0, convert_fail=0, too_broad=0, kept=0)
    for ie in gen_extractor_classes():
        name = ie.IE_NAME
        if name == "generic":
            continue
        stats["total"] += 1
        pat = getattr(ie, "_VALID_URL", None)
        if not isinstance(pat, str) or not ("http" in pat or "//" in pat):
            stats["no_pattern"] += 1
            continue
        if name.startswith("youtube") and name not in YT_VIDEO_NAMES:
            kind = "l"
        else:
            kind = "l" if is_listy(name, ie.__name__) else "v"
        # Playlists etc. are only "list" if the extractor name says so; video
        # extractors named after a site stay "v".
        res = convert(pat)
        if not res:
            stats["convert_fail"] += 1
            continue
        js, jsf = res
        # Reject over-broad patterns using the original Python regex.
        flags = 0
        try:
            rx = re.compile(pat, flags)
        except re.error:
            stats["convert_fail"] += 1
            continue
        if any(rx.match(u) for u in BENIGN):
            stats["too_broad"] += 1
            continue
        key = (js, jsf, kind)
        if key in seen:
            continue
        seen.add(key)
        entries.append([js, jsf, kind])
        stats["kept"] += 1

    # Validate every pattern compiles in JS as well (done by test step in node).
    outpath = os.path.join(os.path.dirname(__file__), "..", "patterns.js")
    with open(outpath, "w", encoding="utf-8") as f:
        f.write("// Generated by tools/generate_patterns.py from yt-dlp %s. Do not edit.\n"
                % yt_dlp.version.__version__)
        f.write("// Entry: [regex source, flags, kind]  kind: v = video page, l = list/channel/other\n")
        f.write("globalThis.YTDLP_PATTERNS = ")
        json.dump(entries, f, separators=(",", ":"))
        f.write(";\n")
    print(stats, file=sys.stderr)


if __name__ == "__main__":
    main()
