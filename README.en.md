# Bot Notch for Claude Code

[中文](README.md) · [English](README.en.md)

Bot Notch puts Claude Code CLI and Desktop sessions at the edge of your Mac screen: running sessions, permission prompts, AskUserQuestion questions and unread results. You can allow, reject or answer from the notch, and clicking a session brings its terminal or app to the front.

```
Claude Code hooks ──► scripts/hook.mjs ──► scripts/bridge.mjs (127.0.0.1 + token) ◄── native notch helper
```

The plugin's hooks post session events to a small local bridge. The native helper (the macOS app that draws the notch) reads the bridge over the `/dsh-notch/*` HTTP contract and finds it through `DSH_NOTCH_RUNTIME_FILE`.

## Installation

Requirements: macOS 14+ on Apple Silicon, Node.js 18+ on `PATH`, and a recent Claude Code.

1. **Native helper.** For now it is the prebuilt helper from [dsh-notch releases](https://github.com/aa2246740/dsh-notch/releases) (`dsh-notch-<version>-macos-arm64.tar.gz`). Extract it and keep the executable and `DshNotch_DshNotch.bundle` in the same folder.
2. **Plugin.** In Claude Code:

   ```
   /plugin marketplace add aa2246740/claude-bot-notch
   /plugin install bot-notch@claude-bot-notch
   /plugin configure bot-notch@claude-bot-notch
   ```

   Set **Notch helper executable** to the absolute path of the extracted executable. The plugin then starts and supervises it.

Claude Desktop's Code tab runs the same Claude Code with the same user plugins, so it works there too after installation.

To start the helper yourself instead, leave `helper_path` empty and run:

```sh
DSH_NOTCH_RUNTIME_FILE="$HOME/.claude/bot-notch/runtime.json" ./dsh-notch
```

For development, load the checkout for one session with `claude --plugin-dir /path/to/claude-bot-notch`.

## Behavior

| Claude Code event | Notch |
| --- | --- |
| `UserPromptSubmit` | Blue: running. Sending a message also marks the previous result as read |
| `PermissionRequest` (Bash / Edit / MCP …) | Yellow: approval card with the tool and command; Allow or Reject |
| `PermissionRequest` (AskUserQuestion) | Yellow: the questions and options, answered in the panel (multi-select and free text) |
| `PermissionRequest` (ExitPlanMode) | Yellow: "Approve plan: <title>" |
| `Stop` | Green: unread result. A running background subagent or workflow keeps it blue |
| `StopFailure` (rate_limit, server_error …) | Red: failed result |
| `SessionEnd`, or the Claude Code process exits | Removed |

- **Answering:** a notch card stays answerable for `approval_wait_seconds` (default 300). With no answer by then, Claude Code's own dialog decides. `0` means status only. Answering in the terminal first is designed to withdraw the card, but whether Claude Code shows its dialog while this hook is still waiting has not been verified interactively yet.
- **Opening a session** brings the hosting app forward (Terminal, iTerm2, VS Code, Ghostty, Claude Desktop …, detected from `__CFBundleIdentifier` / `TERM_PROGRAM`). It cannot select a specific tab.
- **Subagents** belong to their owning conversation. Their prompts show on the owner's yellow light.
- **Lifecycle:** one bridge per user. It exits about a minute after the last Claude Code process it tracks, and the helper exits with it.

## Files

`~/.claude/bot-notch/` (follows `CLAUDE_CONFIG_DIR`; override with `BOT_NOTCH_HOME`):

| File | Purpose |
| --- | --- |
| `runtime.json` | Bridge address, token and pid (mode 0600; do not share) |
| `seen.json` | Read timestamps, kept 30 days |
| `bridge.log` / `helper.log` | Logs |

The bridge listens only on 127.0.0.1 and every request needs the token.

## Alongside DSH Notch

Files, ports and settings are separate (`~/.dsh/dsh-notch/` vs `~/.claude/bot-notch/`). If DSH and Claude Code run at the same time, though, each starts its own copy of the helper. The two windows sit at the same spot on the right edge and overlap, and they share the edge-hidden state.

## Known limitations

- Network-access prompts from sandboxed commands do not trigger `PermissionRequest`. Answer those in Claude Code.
- A new `helper_path` takes effect once every Claude Code session has exited and the bridge restarts.
- Verified so far: unit and end-to-end tests, and real `claude -p` runs where Notch Allow/Reject decided a Bash call. Not yet verified: the interactive terminal, Claude Desktop, and the helper window on a Mac.

## Development

```sh
npm test
claude plugin validate .
```

`scripts/lib/notch-lifecycle.mjs` is copied verbatim from dsh-notch's `desktop/notch-lifecycle.mjs`.

## License

[MIT](LICENSE).
