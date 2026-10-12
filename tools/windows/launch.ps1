param([string]$Link)

$mpc    = 'C:\Program Files\MPC-HC\mpc-hc64.exe'
$prefix = 'ytplayer://open?url='

# Expect: ytplayer://open?url=<URL-encoded http(s) URL>
if (-not $Link.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { exit 1 }

$target = [uri]::UnescapeDataString($Link.Substring($prefix.Length))

# Any website can trigger this scheme, so accept only a plain http(s) URL:
# no whitespace, quotes or control characters, and a sane length.
if ($target.Length -gt 2048) { exit 1 }
if ($target -notmatch '^https?://[^\s"''<>`\x00-\x1f]+$') { exit 1 }

Start-Process -FilePath $mpc -ArgumentList $target
