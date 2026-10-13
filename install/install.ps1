param(
  [string]$Key = "",
  [string]$Repo = "Voloire/voloirex-skills",
  [string]$Ref = "main"
)
$ErrorActionPreference = "Stop"
$home = $env:USERPROFILE
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("voloirex-skills-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
try {
  $arch = Join-Path $tmp "repo.tar.gz"
  $url = "https://codeload.github.com/$Repo/archive/refs/heads/$Ref.tar.gz"
  Invoke-WebRequest -Uri $url -OutFile $arch
  tar -xzf $arch -C $tmp
  $dir = (Get-ChildItem -Directory $tmp | Select-Object -First 1).FullName

  $dest = Join-Path $home ".voloirex"
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  Copy-Item -Force -Path (Join-Path $dir "cli\voloirex.mjs") -Destination (Join-Path $dest "voloirex.mjs")

  if ($Key) {
    $json = @{ api_key = $Key } | ConvertTo-Json
    [System.IO.File]::WriteAllText((Join-Path $dest "config.json"), $json, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "voloirex CLI installed. Key saved to $dest\config.json"
  } else {
    Write-Host "voloirex CLI installed. No key saved - re-run with -Key <token>."
  }
} finally {
  Remove-Item -Recurse -Force -Path $tmp -ErrorAction SilentlyContinue
}