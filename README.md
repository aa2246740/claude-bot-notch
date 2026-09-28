# Bot Notch for Claude Code

[中文](README.md) · [English](README.en.md)

Bot Notch 是一个 Claude Code 插件：把 Claude Code CLI 和 Desktop 的会话放到 Mac 屏幕右边缘的一个小岛上。运行中的会话、权限确认、AskUserQuestion 提问和未读结果都显示在这里，也可以直接在上面允许、拒绝或回答；空闲时显示一个小机器人。

## 安装

需要：macOS 14+、Apple Silicon，`PATH` 上有 Node.js 18+，较新版本的 Claude Code。

在 Claude Code 里执行：

```
/plugin marketplace add aa2246740/claude-bot-notch
```

```
/plugin install bot-notch@claude-bot-notch
```

然后开一个新会话。第一次使用时，插件会自动从本仓库的 Releases 下载原生 Notch 程序（几 MB），核对 SHA-256 后启动，之后不需要任何配置。Claude Desktop 的 Code 标签页读取同一套用户插件，装好后同样生效。

在 Windows、Linux 或 Intel Mac 上，插件能装上，但只在后台记录状态，不显示界面，也不会拦截任何确认。

## 行为

| Claude Code 事件 | Notch |
| --- | --- |
| 发送消息（`UserPromptSubmit`） | 蓝灯：运行中；发新消息同时把上一次结果标为已读 |
| 权限确认（Bash / Edit / MCP 等） | 黄灯：审批卡显示工具和命令，可允许或拒绝 |
| AskUserQuestion | 黄灯：在面板里回答问题（支持多选和自己填写） |
| 计划审批（ExitPlanMode） | 黄灯："Approve plan: <标题>" |
| 回合结束（`Stop`） | 绿灯：未读结果；后台子代理或 workflow 还在运行时保持蓝灯 |
| API 错误（`StopFailure`） | 红灯：失败结果 |
| 会话结束，或 Claude Code 进程退出 | 移除 |

- **回答**：只有屏幕上确实有 Notch 时，插件才接管确认。卡片在 `approval_wait_seconds`（默认 300 秒）内可以回答，超时就交回 Claude Code 自己的对话框；设为 `0` 表示只显示状态。按设计，在终端先回答会撤掉卡片；但插件等待期间 Claude Code 会不会同时弹出自己的对话框，还没在交互模式下验证过。
- **打开会话**：点击会话，把承载它的应用调到前台（Terminal、iTerm2、VS Code、Ghostty、Claude Desktop 等），跳不到具体标签页。
- **子代理**归属于它所在的对话，它的请求显示在所属对话的黄灯上。
- **生命周期**：最后一个 Claude Code 进程退出约一分钟后，后台服务和 Notch 一起退出；下次打开 Claude Code 自动恢复。

## 可选设置

一般不需要设置。确实要改时，用 `/plugin configure bot-notch@claude-bot-notch`：

| 设置 | 作用 |
| --- | --- |
| `approval_wait_seconds` | Notch 上的卡片可回答多久（默认 300，`0` 表示只显示状态） |
| `helper_path` | 改用你自己编译的 Notch 程序；留空表示使用自动下载的版本 |

## 工作原理

```
Claude Code hooks ──► scripts/hook.mjs ──► scripts/bridge.mjs（127.0.0.1 + token）◄── Notch 程序（helper/）
```

- `hooks/hooks.json`：把会话事件交给 `scripts/hook.mjs`。
- `scripts/bridge.mjs`：每个用户一个的本机服务，只监听 127.0.0.1，每个请求都要带 token。
- `helper/`：原生 Notch 程序（Swift / AppKit / SwiftUI），每 0.8 秒读取一次 `/bot-notch/status`。

文件都在 `~/.claude/bot-notch/`（可用 `BOT_NOTCH_HOME` 覆盖）：`runtime.json`（地址和 token，权限 0600，不要分享）、`seen.json`（已读记录）、`helper/<版本>/`（下载的 Notch 程序）和日志。

## 自己编译 Notch 程序

需要 Xcode 26 或更新版本：

```sh
swift build --package-path helper -c release
```

编译产物是 `bot-notch` 和 `BotNotch_BotNotch.bundle`，两者要放在同一个目录，再把 `helper_path` 设成这个 `bot-notch` 的路径。发布流程（在 Mac 上）：

```sh
v=$(node -p "require('./scripts/lib/helper-version.json').version")
bin=$(swift build --package-path helper -c release --show-bin-path)
mkdir -p dist && tar -czf dist/bot-notch-$v-macos-arm64.tar.gz -C "$bin" bot-notch BotNotch_BotNotch.bundle
(cd dist && shasum -a 256 bot-notch-$v-macos-arm64.tar.gz > SHA256SUMS)
gh release create helper-v$v dist/*
```

插件下载的就是 `helper-v<版本>` 这个 release 里的 tar 包，并用同一个 release 里的 `SHA256SUMS` 核对。

## 已知限制

- 沙箱命令的联网确认不会触发 `PermissionRequest`，需要在 Claude Code 里回答。
- 目前只有 Apple Silicon 的预编译版本。
- 已验证：单元测试和端到端测试；用真实的 `claude -p` 运行时，Notch 的允许/拒绝确实决定了一次 Bash 调用。尚未验证：交互式终端、Claude Desktop，以及 Notch 程序在 Mac 上的实际显示。

## 开发

```sh
npm test
claude --plugin-dir .
```

## 许可

[MIT](LICENSE)。Notch 程序源自 [dsh-notch](https://github.com/aa2246740/dsh-notch)（MIT）。机器人动作来自 [OpenBotMotion](https://github.com/aa2246740/open-bot-motion)，保留其 [MIT 声明](helper/LICENSE.open-bot-motion)。
