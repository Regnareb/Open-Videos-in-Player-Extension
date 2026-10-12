# yt-dlp Link Launcher

Clicking a link to a video on any site yt-dlp supports opens it in your local program
via a custom URL scheme (default: `ytplayer://open?url=<encoded URL>`).

## Install
1. chrome://extensions > enable Developer mode > Load unpacked > select this folder.
2. Open the extension's options to set the URL template, sites to ignore, and whether
   playlists/channels/profiles should be caught too.

## How matching works
`patterns.js` holds URL patterns taken from yt-dlp's extractors (generated from yt-dlp 2026.08.19).
Links are matched against them on click. Alt+click opens a link normally.

To refresh the list after updating yt-dlp:

    pip install -U yt-dlp
    python3 tools/generate_patterns.py

Patterns that can't be translated to JavaScript, or that are so broad they match ordinary
sites, are dropped. YouTube and Vimeo use hand-written patterns for the same reason.

## Windows
See ytplayer.reg and launch.ps1 (copy launch.ps1 to C:\ytplayer\).
