# 亮灯 · dsh-liangdeng

Two small things for the DeepSeek Harness Web UI:

1. **A call popup** — an agent calls the `call_user` tool, and a card appears in the centre of the screen with **确认** (dismiss) and **跳转** (switch to that session).
2. **A lantern dock** — a draggable column of 32×32 session chips. Click one to switch to that session; a chip fills with its colour when the session has an unread completion or is waiting for you.

中文说明见文末。

## Install

```sh
dsh plugin --profile <your-profile> add dsh-liangdeng
```

Or, in the app: **Plugins → Add plugin**, pick this folder. Then reload the page with `Ctrl + Shift + R`.

The plugin declares `dsh.bundle`, so it installs from source with no build step and no dependencies.

## Usage

```txt
call_user(
  from    = "producer",              // who is calling
  title   = "The cut is ready",      // one line, plain language
  body    = "Stills are on disk",    // optional second line
  session = "<session id>"           // optional; adds the 跳转 button
)
```

- **确认** dismisses the card.
- **跳转** switches to the calling session (only when `session` is given).
- `Esc` or a click on the backdrop also dismisses it.

### The dock

- Lists the top-level sessions of the current workspace (sub-agents are skipped).
- Each chip shows the first character of the session title; hovering shows the full title.
- Click a chip to switch to that session.
- Drag a chip anywhere; drag it into the dashed box to line chips up 4 × 2, drag it out to move it freely.
- A chip fills with its colour when that session has an unread completion or is waiting for input.

## Limits

- The page has to be open. If DSH is closed there is no popup — this is not a system notification.
- Chips are letters, not images. There is no avatar upload.
- Chip positions and the dock layout live in the browser's `localStorage`; pending calls live in the host's memory and are cleared when DSH restarts.
- The 留言本 shortcut only lights up when the workspace contains `留言本/留言本.md`.

## Requirements

DeepSeek Harness 0.2.x (developed against `0.2.2-rc.5`).

## License

MIT.

---

# 中文

给 DeepSeek Harness 的网页界面加两样东西：

1. **呼叫弹窗**：agent 调 `call_user`，屏幕中间弹出一张卡片，带【确认】【跳转】。
2. **灯牌**：一排 32×32 的会话小方块，可以拖。点一下切到那个会话；那个会话有未读、或者在等你操作时，方块会填上颜色。

## 安装

```sh
dsh plugin --profile <你的 profile> add dsh-liangdeng
```

或者：**插件 → 添加插件**，选这个文件夹；然后 `Ctrl + Shift + R` 刷新页面。

## 用法

```txt
call_user(
  from    = "打样",
  title   = "女05 对照好啦",
  body    = "448 norm 宽度零差异",   // 可省略
  session = "<会话 id>"              // 可省略；填了才有【跳转】
)
```

## 限制

- **页面得开着**；DSH 关掉就不会弹，这不是系统通知。
- 方块是**首字 + 颜色**，没有图片头像。
- 布局存在浏览器 `localStorage`，待确认的呼叫存在宿主内存里，重启清空。
- 「留言本」入口只有在工作区里有 `留言本/留言本.md` 时才亮。

## 许可

MIT。
