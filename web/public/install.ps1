# Deno one-line installer for Windows (PowerShell).
#
#   irm https://deno-web-eight.vercel.app/install.ps1 | iex
#
# Same steps as install.sh: Claude Code check, Deno plugin, a "studio" command on your PATH,
# the renderer (Chromium and ffmpeg, into %USERPROFILE%\.deno-studio), then a browser sign-in.
# Safe to run again. Posts only: set $env:DENO_POSTS_ONLY = "1" before running. No questions: $env:DENO_YES = "1".

& {
  $ErrorActionPreference = 'Stop'
  $McpUrl = 'https://deno-api-swart.vercel.app/mcp'
  $SiteUrl = 'https://deno-web-eight.vercel.app'
  $Repo = 'Atul-Chahar/DENO'
  $Plugin = 'deno-studio@deno'
  $BinDir = Join-Path $env:USERPROFILE '.local\bin'

  function Step($m) { Write-Host ''; Write-Host $m -ForegroundColor White }
  function Ok($m) { Write-Host "  + $m" -ForegroundColor Green }
  function Warn($m) { Write-Host "  ! $m" -ForegroundColor Yellow }
  function Note($m) { Write-Host "  $m" -ForegroundColor DarkGray }
  function Has($c) { [bool](Get-Command $c -ErrorAction SilentlyContinue) }
  function Ask($q) {
    if ($env:DENO_YES -eq '1') { return $true }
    $r = Read-Host "  $q [Y/n]"; return ($r -eq '' -or $r -match '^(y|yes)$')
  }

  Write-Host "Deno installer  $SiteUrl"

  Step '1. Claude Code'
  $env:Path = "$BinDir;$env:Path"
  if (Has 'claude') {
    Ok ("found " + (claude --version | Select-Object -First 1))
  } else {
    Warn 'Claude Code is not installed.'
    Note "Anthropic's official installer is: irm https://claude.ai/install.ps1 | iex"
    if (Ask 'Install Claude Code now?') {
      Invoke-RestMethod https://claude.ai/install.ps1 | Invoke-Expression
      if (-not (Has 'claude')) { Warn 'Installed, but this window cannot see it yet. Open a new PowerShell window and run this again.'; return }
    } else {
      Warn "Install Claude Code first, then run this again. Using another AI app? See $SiteUrl/docs/quickstart"
      return
    }
  }

  if ($env:DENO_POSTS_ONLY -eq '1') {
    Step '2. Connect Deno (posts and validation)'
    claude mcp get deno *> $null
    if ($LASTEXITCODE -eq 0) { Ok 'Deno is already connected' }
    else { claude mcp add --transport http --scope user deno $McpUrl | Out-Null; Ok 'added the Deno connection' }
    Write-Host ''
    Write-Host 'Done. Open Claude Code, type /mcp, pick deno and choose Authenticate.'
    return
  }

  Step '2. Deno plugin for Claude Code'
  $markets = (claude plugin marketplace list 2>$null) -join "`n"
  if ($markets -match '\bdeno\b') { claude plugin marketplace update deno *> $null; Ok 'updated the Deno marketplace' }
  else { claude plugin marketplace add $Repo | Out-Null; Ok "added the Deno marketplace ($Repo)" }
  claude plugin install $Plugin *> $null
  if ($LASTEXITCODE -ne 0) { Warn "couldn't install the plugin. Inside Claude Code, type: /plugin install $Plugin"; return }
  Ok "installed $Plugin"

  Step '3. Node.js (the video renderer runs on it)'
  $nodeOk = $false
  if (Has 'node') {
    $major = [int](node -p "process.versions.node.split('.')[0]")
    if ($major -ge 22) { Ok ("Node " + (node --version)); $nodeOk = $true }
    else { Warn ("Node " + (node --version) + " is too old. Video needs Node 22 or newer.") }
  } else { Warn 'Node.js is not installed. Video needs Node 22 or newer.' }
  if (-not $nodeOk) {
    Note 'Install it with: winget install OpenJS.NodeJS.LTS   (or from https://nodejs.org)'
    Note 'Then open a new PowerShell window and run this installer again. Posts and validation already work.'
    return
  }

  Step '4. The studio command'
  New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
  $js = Join-Path $BinDir 'studio-wrapper.js'
  @'
// deno-studio-wrapper: written by the Deno installer. Runs the studio kit from the installed deno-studio plugin.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const home = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
let kit = null;
try {
  const data = JSON.parse(fs.readFileSync(path.join(home, 'plugins', 'installed_plugins.json'), 'utf8'));
  for (const e of (data.plugins && data.plugins['deno-studio@deno']) || []) {
    const cli = e && e.installPath && path.join(e.installPath, 'kit', 'cli.mjs');
    if (cli && fs.existsSync(cli)) { kit = cli; break; }
  }
} catch {}
if (!kit) { process.stderr.write('studio: the Deno plugin is not installed. Run: irm https://deno-web-eight.vercel.app/install.ps1 | iex\n'); process.exit(1); }
import(pathToFileURL(kit).href).catch((err) => { process.stderr.write(`studio: ${err.message}\n`); process.exit(1); });
'@ | Set-Content -Encoding UTF8 -Path $js
  "@node `"%~dp0studio-wrapper.js`" %*" | Set-Content -Encoding ASCII -Path (Join-Path $BinDir 'studio.cmd')
  Ok "linked $BinDir\studio.cmd"
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  if (-not ($userPath -split ';' | Where-Object { $_ -eq $BinDir })) {
    [Environment]::SetEnvironmentVariable('Path', "$BinDir;$userPath", 'User')
    Ok "added $BinDir to your PATH (new windows will see it)"
  }

  Step '5. Renderer (Chromium and ffmpeg, about 150 MB, into your user folder)'
  node $js doctor --install
  if ($LASTEXITCODE -eq 0) { Ok 'renderer ready' } else { Warn "some checks failed; run 'studio doctor --install' again later" }

  Step '6. Sign in to Deno'
  $signed = $false
  if (Ask 'Open your browser to sign in now?') { node $js login; $signed = ($LASTEXITCODE -eq 0) }

  Write-Host ''
  Write-Host 'Done. Deno is installed in Claude Code.'
  Write-Host '  1. Open Claude Code in your project folder:  claude'
  Write-Host '  2. Type /mcp, pick deno and choose Authenticate. Sign in and press Allow.'
  if (-not $signed) { Write-Host '  3. Sign the renderer in too:  studio login' }
  Write-Host '  Then try: "Make a 20 second launch video for my idea."'
  Write-Host "  Help: $SiteUrl/docs/quickstart"
}
