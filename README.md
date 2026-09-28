# Bot Notch for Claude Code

[中文](README.md) · [English](README.en.md)

Bot Notch 把 Claude Code CLI 和 Desktop 的会话放到 Mac 屏幕边缘：运行中的会话、权限确认、AskUserQuestion 提问和未读结果。可以直接在 Notch 里允许、拒绝或回答；点击会话会把对应的终端或应用调到前台。

```
Claude Code hooks ──► scripts/hook.mjs ──► scripts/bridge.mjs（127.0.0.1 + token）◄── 原生 Notch helper
```

插件的 hooks 把会话事件发给本机的一个小服务（bridge）。原生 helper（画出 Notch 的 macOS 程序）通过 `/dsh-notch/*` HTTP 接口读取它，并通过 `DSH_NOTCH_RUNTIME_FILE` 找到它。

## 安装

需要：macOS 14+、Apple Silicon，`PATH` 上有 Node.js 18+，较新版本的 Claude Code。

1. **原生 helper**：目前使用 [dsh-notch releases](https://github.com/aa2246740/dsh-notch/releases) 里预编译的 helper（`dsh-notch-<版本>-macos-arm64.tar.gz`）。解压后可执行文件和 `DshNotch_DshNotch.bundle` 要放在同一个目录。
2. **插件**：在 Claude Code 里执行

   ```
   /plugin marketplace add aa2246740/claude-bot-notch
   /plugin install bot-notch@claude-bot-notch
   /plugin configure bot-notch@claude-bot-notch
   ```

   把 **Notch helper executable** 填成解压后可执行文件的绝对路径，插件会自动启动并守护它。

Claude Desktop 的 Code 标签页运行的是同一个 Claude Code，读取同一套用户插件，安装后同样生效。

如果想自己启动 helper，把 `helper_path` 留空，然后运行：

```sh
DSH_NOTCH_RUNTIME_FILE="$HOME/.claude/bot-notch/runtime.json" ./dsh-notch
```

开发时可以用 `claude --plugin-dir /path/to/claude-bot-notch` 只在本次会话里加载。

## 行为

| Claude Code 事件 | Notch |
| --- | --- |
| `UserPromptSubmit` | 蓝灯：运行中；发新消息同时把上一次结果标为已读 |
| `PermissionRequest`（Bash / Edit / MCP 等） | 黄灯：审批卡显示工具和命令，可允许或拒绝 |
| `PermissionRequest`（AskUserQuestion） | 黄灯：在面板里回答问题（支持多选和自己填写） |
| `PermissionRequest`（ExitPlanMode） | 黄灯："Approve plan: <标题>" |
| `Stop` | 绿灯：未读结果；后台子代理或 workflow 还在运行时保持蓝灯 |
| `StopFailure`（rate_limit、server_error 等） | 红灯：失败结果 |
| `SessionEnd`，或 Claude Code 进程退出 | 移除 |

- **回答**：Notch 卡片在 `approval_wait_seconds`（默认 300 秒）内可以回答；超时没答，就交回 Claude Code 自己的对话框。设为 `0` 表示只显示状态。按设计，在终端先回答会撤掉卡片；但 hook 还在等待时 Claude Code 会不会同时弹出自己的对话框，还没在交互模式下验证过。
- **打开会话**：把承载会话的应用调到前台（Terminal、iTerm2、VS Code、Ghostty、Claude Desktop 等，从 `__CFBundleIdentifier` / `TERM_PROGRAM` 识别），跳不到具体标签页。
- **子代理**归属于它所在的对话，它的请求显示在所属对话的黄灯上。
- **生命周期**：每个用户只有一个 bridge。它跟踪的最后一个 Claude Code 进程退出约一分钟后，bridge 自动退出，helper 也随之退出。

## 文件

`~/.claude/bot-notch/`（跟随 `CLAUDE_CONFIG_DIR`；可用 `BOT_NOTCH_HOME` 覆盖）：

| 文件 | 用途 |
| --- | --- |
| `runtime.json` | bridge 地址、token 和 pid（权限 0600，不要分享） |
| `seen.json` | 已读时间，保留 30 天 |
| `bridge.log` / `helper.log` | 日志 |

bridge 只监听 127.0.0.1，每个请求都要带 token。

## 与 DSH Notch 共存

两边的文件、端口和配置互相独立（`~/.dsh/dsh-notch/` 和 `~/.claude/bot-notch/`）。但 DSH 和 Claude Code 同时运行时，两边各自启动一个 helper，两个窗口会叠在屏幕右边同一个位置，"收进屏幕边缘"的状态也是共用的。

## 已知限制

- 沙箱命令的联网确认不会触发 `PermissionRequest`，需要在 Claude Code 里回答。
- 修改 `helper_path` 后，要等所有 Claude Code 会话退出、bridge 重启才生效。
- 已验证：单元测试和端到端测试；用真实的 `claude -p` 运行时，Notch 的允许/拒绝确实决定了一次 Bash 调用。尚未验证：交互式终端、Claude Desktop，以及 helper 窗口在 Mac 上的实际显示。

## 开发

```sh
npm test
claude plugin validate .
```

`scripts/lib/notch-lifecycle.mjs` 原样复制自 dsh-notch 的 `desktop/notch-lifecycle.mjs`。

## 许可

[MIT](LICENSE)。
