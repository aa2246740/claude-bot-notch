# Bot Notch for Claude Code

[中文](README.md) · [English](README.en.md)

Bot Notch is a Claude Code plugin that puts your Claude Code CLI and Desktop sessions on a small island at the right edge of your Mac screen. Running sessions, permission prompts, AskUserQuestion questions and unread results show up there, and you can allow, reject or answer right on it. When nothing is happening, a small robot idles there.

## Installation

Requirements: macOS 14+ on Apple Silicon, Node.js 18+ on `PATH`, and a recent Claude Code.

In Claude Code:

```
/plugin marketplace add aa2246740/claude-bot-notch
```

```
/plugin install bot-notch@claude-bot-notch
```

Then start a new session. On first use the plugin downloads the native notch app (a few MB) from this repository's Releases, verifies its SHA-256 and starts it. There is nothing to configure. Claude Desktop's Code tab reads the same user plugins, so it works there too.

On Windows, Linux or Intel Macs the plugin installs, but it only tracks state in the background: there is no UI and it never holds a prompt.

## Behavior

| Claude Code event | Notch |
| --- | --- |
| Prompt sent (`UserPromptSubmit`) | Blue: running. Sending a message also marks the previous result as read |
| Permission prompt (Bash / Edit / MCP …) | Yellow: approval card with the tool and command; Allow or Reject |
| AskUserQuestion | Yellow: the questions, answered in the panel (multi-select and free text) |
| Plan approval (ExitPlanMode) | Yellow: "Approve plan: <title>" |
| Turn finished (`Stop`) | Green: unread result. A running background subagent or workflow keeps it blue |
| API error (`StopFailure`) | Red: failed result |
| Session ends, or the Claude Code process exits | Removed |

- **Answering:** the plugin only takes over a prompt when a notch is actually on screen. The card stays answerable for `approval_wait_seconds` (default 300). With no answer by then, Claude Code's own dialog decides. `0` means status only. Answering in the terminal first is designed to withdraw the card, but whether Claude Code shows its dialog while the plugin is still waiting has not been verified interactively yet.
- **Opening a session** brings its hosting app forward (Terminal, iTerm2, VS Code, Ghostty, Claude Desktop …). It cannot select a specific tab.
- **Subagents** belong to their owning conversation. Their prompts show on the owner's yellow light.
- **Lifecycle:** about a minute after the last Claude Code process exits, the background service and the notch exit together. They come back with the next Claude Code session.

## Optional settings

Normally none are needed. To change them, run `/plugin configure bot-notch@claude-bot-notch`:

| Setting | Effect |
| --- | --- |
| `approval_wait_seconds` | How long a card stays answerable (default 300; `0` = status only) |
| `helper_path` | Run your own build of the notch app instead of the downloaded one |

## How it works

```
Claude Code hooks ──► scripts/hook.mjs ──► scripts/bridge.mjs (127.0.0.1 + token) ◄── notch app (helper/)
```

- `hooks/hooks.json` hands session events to `scripts/hook.mjs`.
- `scripts/bridge.mjs` is a per-user local service. It listens only on 127.0.0.1, and every request needs its token.
- `helper/` is the native notch app (Swift, AppKit, SwiftUI). It reads `/bot-notch/status` every 0.8 s.

Everything lives in `~/.claude/bot-notch/` (override with `BOT_NOTCH_HOME`): `runtime.json` (address and token, mode 0600; do not share), `seen.json` (read state), `helper/<version>/` (the downloaded notch app) and logs.

## Building the notch app

Requires Xcode 26 or newer:

```sh
swift build --package-path helper -c release
```

The build produces `bot-notch` and `BotNotch_BotNotch.bundle`. Keep them in the same folder and set `helper_path` to that `bot-notch`. To release (on a Mac):

```sh
v=$(node -p "require('./scripts/lib/helper-version.json').version")
bin=$(swift build --package-path helper -c release --show-bin-path)
mkdir -p dist && tar -czf dist/bot-notch-$v-macos-arm64.tar.gz -C "$bin" bot-notch BotNotch_BotNotch.bundle
(cd dist && shasum -a 256 bot-notch-$v-macos-arm64.tar.gz > SHA256SUMS)
gh release create helper-v$v dist/*
```

The plugin downloads that tarball from the `helper-v<version>` release and checks it against the `SHA256SUMS` in the same release.

## Known limitations

- Network-access prompts from sandboxed commands do not trigger `PermissionRequest`. Answer those in Claude Code.
- Prebuilt notch app for Apple Silicon only.
- Verified so far: unit and end-to-end tests, and real `claude -p` runs where Notch Allow/Reject decided a Bash call. Not yet verified: the interactive terminal, Claude Desktop, and the notch app on a Mac.

## Development

```sh
npm test
claude --plugin-dir .
```

## License

[MIT](LICENSE). The notch app is derived from [dsh-notch](https://github.com/aa2246740/dsh-notch) (MIT). Robot motions come from [OpenBotMotion](https://github.com/aa2246740/open-bot-motion); its [MIT notice](helper/LICENSE.open-bot-motion) is retained.
