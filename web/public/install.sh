#!/usr/bin/env bash
# Deno one-line installer for macOS and Linux.
#
#   curl -fsSL https://deno-web-eight.vercel.app/install.sh | bash
#
# What it does, in order (safe to run again; each step skips what is already done):
#   1. Checks for Claude Code. If it is missing, offers to install it with Anthropic's official installer.
#   2. Adds the Deno plugin to Claude Code (MCP connection, video skills, the local "studio" renderer).
#   3. Puts a "studio" command in ~/.local/bin so it works in any terminal, not only inside Claude Code.
#   4. Installs what the renderer needs into ~/.deno-studio (Chromium, plus ffmpeg if you have none). Nothing system-wide.
#   5. Opens your browser once so you can sign in to Deno. No password or API key is ever typed here.
#
# Options (pass them after "bash -s --"):
#   --posts-only   only connect Deno to Claude Code for posts and validation (no video tools)
#   --no-login     skip the browser sign-in (you can run "studio login" later)
#   --no-deps      skip the renderer download (about 150 MB)
#   --yes          answer yes to every question (for scripts)
#
# Example: curl -fsSL https://deno-web-eight.vercel.app/install.sh | bash -s -- --posts-only
#
# Read before you run: https://deno-web-eight.vercel.app/install.sh

# Everything sits inside main() so a half-downloaded script can never run part of itself.
main() {
  set -euo pipefail

  local MCP_URL="https://deno-api-swart.vercel.app/mcp"
  local SITE_URL="https://deno-web-eight.vercel.app"
  local REPO="Atul-Chahar/DENO"
  local PLUGIN="deno-studio@deno"
  local BIN_DIR="${DENO_INSTALL_BIN:-$HOME/.local/bin}"

  local posts_only=0 login=1 deps=1 assume_yes=0
  for arg in "$@"; do
    case "$arg" in
      --posts-only) posts_only=1 ;;
      --no-login) login=0 ;;
      --no-deps) deps=0 ;;
      --yes | -y) assume_yes=1 ;;
      -h | --help)
        printf '%s\n' 'Deno installer. Usage: curl -fsSL https://deno-web-eight.vercel.app/install.sh | bash -s -- [options]' \
          '  --posts-only   only connect Deno for posts and validation (no video tools)' \
          '  --no-login     skip the browser sign-in' \
          '  --no-deps      skip the renderer download (about 150 MB)' \
          '  --yes          answer yes to every question'
        return 0
        ;;
      *) printf 'Unknown option: %s (try --help)\n' "$arg" >&2; return 2 ;;
    esac
  done

  # Colours only when the output is a terminal.
  local B="" D="" G="" Y="" R="" N=""
  if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
    B=$'\033[1m' D=$'\033[2m' G=$'\033[32m' Y=$'\033[33m' R=$'\033[31m' N=$'\033[0m'
  fi
  step() { printf '\n%s%s%s\n' "$B" "$1" "$N"; }
  ok() { printf '  %s✓%s %s\n' "$G" "$N" "$1"; }
  warn() { printf '  %s!%s %s\n' "$Y" "$N" "$1"; }
  fail() { printf '  %s✗%s %s\n' "$R" "$N" "$1" >&2; }
  note() { printf '  %s%s%s\n' "$D" "$1" "$N"; }

  # Questions read from the keyboard even when this script arrives through a pipe.
  local tty=""
  if [ -r /dev/tty ] && (: </dev/tty) 2>/dev/null; then tty=/dev/tty; fi
  ask() {
    if [ "$assume_yes" = 1 ]; then return 0; fi
    if [ -z "$tty" ]; then return 1; fi
    local reply
    printf '  %s [Y/n] ' "$1" >"$tty"
    read -r reply <"$tty" || return 1
    case "$reply" in "" | y | Y | yes | Yes) return 0 ;; *) return 1 ;; esac
  }

  local os
  case "$(uname -s)" in
    Darwin) os=mac ;;
    Linux) os=linux ;;
    *) os=other ;;
  esac
  if grep -qi microsoft /proc/version 2>/dev/null; then os=wsl; fi

  printf '%sDeno installer%s  %s%s%s\n' "$B" "$N" "$D" "$SITE_URL" "$N"

  # 1. Claude Code ------------------------------------------------------------------------------------------------
  step "1. Claude Code"
  export PATH="$HOME/.local/bin:$HOME/.claude/local:$PATH"
  if command -v claude >/dev/null 2>&1; then
    ok "found $(claude --version 2>/dev/null | head -n1)"
  else
    warn "Claude Code is not installed."
    note "Deno runs inside Claude Code. Anthropic's official installer is: curl -fsSL https://claude.ai/install.sh | bash"
    if ask "Install Claude Code now?"; then
      curl -fsSL https://claude.ai/install.sh | bash
      hash -r
      if ! command -v claude >/dev/null 2>&1; then
        fail "Claude Code installed, but this terminal can't see it yet. Open a new terminal and run this installer again."
        return 1
      fi
      ok "installed $(claude --version 2>/dev/null | head -n1)"
    else
      fail "Install Claude Code first (https://claude.com/claude-code), then run this again."
      note "Using claude.ai, Claude Desktop, ChatGPT or Cursor instead? You don't need this script: $SITE_URL/docs/quickstart"
      return 1
    fi
  fi

  # Posts only: one MCP connection, nothing else. ----------------------------------------------------------------
  if [ "$posts_only" = 1 ]; then
    step "2. Connect Deno (posts and validation)"
    if claude mcp get deno >/dev/null 2>&1; then
      ok "Deno is already connected"
    else
      claude mcp add --transport http --scope user deno "$MCP_URL" >/dev/null
      ok "added the Deno connection for every project"
    fi
    finish_posts
    return 0
  fi

  # 2. Plugin ------------------------------------------------------------------------------------------------------
  step "2. Deno plugin for Claude Code"
  if claude plugin marketplace list 2>/dev/null | grep -q '\bdeno\b'; then
    claude plugin marketplace update deno >/dev/null 2>&1 && ok "updated the Deno marketplace" || warn "couldn't refresh the marketplace; using the copy you have"
  else
    claude plugin marketplace add "$REPO" >/dev/null
    ok "added the Deno marketplace ($REPO)"
  fi
  if claude plugin install "$PLUGIN" >/dev/null 2>&1; then
    ok "installed $PLUGIN"
  else
    fail "couldn't install the plugin. Inside Claude Code, type: /plugin install $PLUGIN"
    return 1
  fi

  # 3. Node ---------------------------------------------------------------------------------------------------------
  step "3. Node.js (the video renderer runs on it)"
  local node_ok=0
  if command -v node >/dev/null 2>&1; then
    local major
    major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
    if [ "$major" -ge 22 ] 2>/dev/null; then
      ok "Node $(node --version)"
      node_ok=1
    else
      warn "Node $(node --version) is too old. Video needs Node 22 or newer."
    fi
  else
    warn "Node.js is not installed. Video needs Node 22 or newer."
  fi
  if [ "$node_ok" = 0 ]; then
    case "$os" in
      mac) note "Install it with: brew install node   (or download it from https://nodejs.org)" ;;
      linux | wsl) note "Install it from https://nodejs.org, or with your package manager (for example: sudo apt install nodejs)." ;;
      *) note "Install it from https://nodejs.org" ;;
    esac
    note "Then run this installer again to finish the video setup. Posts and validation already work."
    finish_full 0
    return 0
  fi

  # 4. studio command ---------------------------------------------------------------------------------------------
  step "4. The studio command"
  mkdir -p "$BIN_DIR"
  local wrapper="$BIN_DIR/studio"
  if [ -e "$wrapper" ] && ! grep -q 'deno-studio-wrapper' "$wrapper" 2>/dev/null; then
    warn "$wrapper already exists and isn't Deno's; leaving it alone."
  else
    write_wrapper "$wrapper"
    ok "linked $wrapper"
  fi
  case ":$PATH:" in
    *":$BIN_DIR:"*) ;;
    *) export PATH="$BIN_DIR:$PATH" ;;
  esac
  if ! shell_has_dir "$BIN_DIR"; then
    warn "$BIN_DIR is not on your PATH in new terminals."
    note "Add this line to your shell profile (~/.zshrc or ~/.bashrc):  export PATH=\"$BIN_DIR:\$PATH\""
  fi

  # 5. Renderer dependencies ---------------------------------------------------------------------------------------
  if [ "$deps" = 1 ]; then
    step "5. Renderer (Chromium and ffmpeg, about 150 MB, into ~/.deno-studio)"
    if "$wrapper" doctor --install; then
      ok "renderer ready"
    else
      warn "some checks failed above; run 'studio doctor --install' again when you're ready"
    fi
  fi

  # 6. Sign in ------------------------------------------------------------------------------------------------------
  local signed_in=0
  if [ "$login" = 1 ]; then
    step "6. Sign in to Deno"
    if [ -z "$tty" ] && [ "$assume_yes" = 0 ]; then
      note "No keyboard attached; skipping. Run 'studio login' later."
    elif ask "Open your browser to sign in now?"; then
      if "$wrapper" login; then signed_in=1; ok "signed in"; else warn "sign-in didn't finish; run 'studio login' later"; fi
    else
      note "Skipped. Run 'studio login' when you're ready."
    fi
  fi

  finish_full "$signed_in"
}

# Writes the studio command: a tiny Node script that finds the installed plugin each time it runs,
# so it keeps working after "claude plugin update".
write_wrapper() {
  cat >"$1" <<'WRAPPER'
#!/usr/bin/env node
// deno-studio-wrapper: written by the Deno installer. Runs the studio kit from the installed deno-studio plugin.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const home = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
let kit = null;
try {
  const data = JSON.parse(fs.readFileSync(path.join(home, 'plugins', 'installed_plugins.json'), 'utf8'));
  const entries = (data.plugins && data.plugins['deno-studio@deno']) || [];
  for (const e of entries) {
    const cli = e && e.installPath && path.join(e.installPath, 'kit', 'cli.mjs');
    if (cli && fs.existsSync(cli)) { kit = cli; break; }
  }
} catch {}
if (!kit) {
  process.stderr.write('studio: the Deno plugin is not installed. Run: curl -fsSL https://deno-web-eight.vercel.app/install.sh | bash\n');
  process.exit(1);
}
import(pathToFileURL(kit).href).catch((err) => {
  process.stderr.write(`studio: ${err.message}\n`);
  process.exit(1);
});
WRAPPER
  chmod +x "$1"
}

# True when a fresh login shell would find the directory on PATH.
shell_has_dir() {
  local sh="${SHELL:-/bin/bash}" p
  p="$(env -i HOME="$HOME" USER="${USER:-}" "$sh" -lc 'printf %s "$PATH"' 2>/dev/null || true)"
  case ":$p:" in *":$1:"*) return 0 ;; *) return 1 ;; esac
}

finish_posts() {
  printf '\n%sDone.%s Deno is connected to Claude Code.\n\n' "$B" "$N"
  printf '  Next:\n'
  printf '  1. Open Claude Code:  %sclaude%s\n' "$B" "$N"
  printf '  2. Type %s/mcp%s, pick %sdeno%s and choose Authenticate. Your browser opens; sign in and press Allow.\n' "$B" "$N" "$B" "$N"
  printf '  3. Try:  %s"Validate my idea: <one line about it>"%s\n\n' "$B" "$N"
}

finish_full() {
  printf '\n%sDone.%s Deno is installed in Claude Code.\n\n' "$B" "$N"
  printf '  Next:\n'
  printf '  1. Open Claude Code in your project folder:  %sclaude%s\n' "$B" "$N"
  printf '  2. Type %s/mcp%s, pick %sdeno%s and choose Authenticate. Your browser opens; sign in and press Allow.\n' "$B" "$N" "$B" "$N"
  if [ "$1" = 1 ]; then
    printf '  3. Try:  %s"Make a 20 second launch video for my idea."%s\n\n' "$B" "$N"
  else
    printf '  3. Sign the renderer in too:  %sstudio login%s\n' "$B" "$N"
    printf '  4. Try:  %s"Make a 20 second launch video for my idea."%s\n\n' "$B" "$N"
  fi
  printf '  %sHelp: %s/docs/quickstart%s\n' "$D" "https://deno-web-eight.vercel.app" "$N"
}

main "$@"
