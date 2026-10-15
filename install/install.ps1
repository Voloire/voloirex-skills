param(
  [string]$Key = "",
  [string]$Repo = "Voloire/voloirex-skills",
  [string]$Ref = "main",
  [string]$InstallHome = $env:USERPROFILE,
  [string]$SourceDirectory = ""
)
$ErrorActionPreference = "Stop"
$nodeVersion = & node --version
if ($LASTEXITCODE -ne 0 -or [int]($nodeVersion.TrimStart('v').Split('.')[0]) -lt 22) {
  throw "Node.js 22+ is required. Install it with winget install OpenJS.NodeJS.LTS."
}
if ($Key -and $Key -notmatch '^vx_[a-z2-7]{16}_[a-z2-7]{52}$') {
  throw "Invalid marketplace key format."
}
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("voloirex-skills-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
try {
  if ($SourceDirectory) {
    $dir = (Resolve-Path -LiteralPath $SourceDirectory).Path
  } else {
    $arch = Join-Path $tmp "repo.tar.gz"
    $url = "https://codeload.github.com/$Repo/tar.gz/refs/heads/$Ref"
    Invoke-WebRequest -Uri $url -OutFile $arch
    tar -xzf $arch -C $tmp
    if ($LASTEXITCODE -ne 0) { throw "Archive extraction failed." }
    $directories = @(Get-ChildItem -Directory $tmp)
    if ($directories.Count -ne 1) { throw "Unexpected repository archive layout." }
    $dir = $directories[0].FullName
  }
  if (-not (Test-Path -LiteralPath (Join-Path $dir "cli\voloirex.mjs"))) {
    throw "The archive does not contain the marketplace client."
  }

  $dest = Join-Path $InstallHome ".voloirex"
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  Copy-Item -Force -Path (Join-Path $dir "cli\voloirex.mjs") -Destination (Join-Path $dest "voloirex.mjs")
  Copy-Item -Force -Path (Join-Path $dir "cli\client.mjs") -Destination (Join-Path $dest "client.mjs")
  $launcher = "@echo off`r`nnode `"%~dp0voloirex.mjs`" %*`r`nexit /b %errorlevel%`r`n"
  [System.IO.File]::WriteAllText((Join-Path $dest "voloirex.cmd"), $launcher, (New-Object System.Text.UTF8Encoding($false)))
  # Isolated installs must not change the real user's PATH.
  if ([System.IO.Path]::GetFullPath($InstallHome).TrimEnd('\') -ieq [System.IO.Path]::GetFullPath($env:USERPROFILE).TrimEnd('\')) {
    $userPath = [string][Environment]::GetEnvironmentVariable("Path", "User")
    if ($dest -notin ($userPath -split ';')) {
      [Environment]::SetEnvironmentVariable("Path", ($userPath.TrimEnd(';') + ";" + $dest).TrimStart(';'), "User")
    }
    if ($dest -notin ($env:Path -split ';')) { $env:Path += ";$dest" }
    Write-Host "Command ready: voloirex run asimoz (open a new terminal if needed)."
  } else {
    Write-Host "Launcher installed at $dest\voloirex.cmd; user PATH unchanged."
  }
  foreach ($skill in @(Get-ChildItem -Directory (Join-Path $dir "skills"))) {
    foreach ($client in @(".claude", ".codex")) {
      $skillDest = Join-Path $InstallHome "$client\skills\$($skill.Name)"
      New-Item -ItemType Directory -Force -Path (Join-Path $skillDest "scripts") | Out-Null
      Copy-Item -Force -LiteralPath (Join-Path $skill.FullName "SKILL.md") -Destination $skillDest
      Copy-Item -Force -LiteralPath (Join-Path $dest "voloirex.mjs") -Destination (Join-Path $skillDest "scripts\voloirex.mjs")
      Copy-Item -Force -LiteralPath (Join-Path $dest "client.mjs") -Destination (Join-Path $skillDest "scripts\client.mjs")
    }
  }

  if ($Key) {
    $json = @{ api_key = $Key } | ConvertTo-Json
    [System.IO.File]::WriteAllText((Join-Path $dest "config.json"), $json, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "voloirex CLI installed. Key saved to $dest\config.json"
  } else {
    Write-Host "voloirex CLI installed. No key written; existing config and environment keys remain available."
  }
} finally {
  Remove-Item -Recurse -Force -Path $tmp -ErrorAction SilentlyContinue
}
