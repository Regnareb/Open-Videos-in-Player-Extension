# YouTube Link Launcher

## Install
1. Go to chrome://extensions and enable Developer mode.
2. Click "Load unpacked" and select this folder.
3. Open the extension's Details > Extension options to set your URL scheme template
   (default: `ytplayer://open?url={url}`).

## Register your custom scheme (example: Windows)
Save as `ytplayer.reg` (edit the path to your program) and double-click it:

    Windows Registry Editor Version 5.00
    [HKEY_CURRENT_USER\Software\Classes\ytplayer]
    @="URL:ytplayer Protocol"
    "URL Protocol"=""
    [HKEY_CURRENT_USER\Software\Classes\ytplayer\shell\open\command]
    @="\"C:\\Path\\To\\YourProgram.exe\" \"%1\""

Your program receives e.g. `ytplayer://open?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DXXXXXXXXXXX`.

macOS: declare the scheme in your app's Info.plist (CFBundleURLTypes).
Linux: add `MimeType=x-scheme-handler/ytplayer;` to a .desktop file, then run
`xdg-mime default yourapp.desktop x-scheme-handler/ytplayer`.

Chrome will ask once for permission to open the external app; tick "Always allow".
Alt+click opens a link normally.
