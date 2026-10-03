# mods/ —— 社区 MOD 目录

这里是 MOD 放的地方。**一个 MOD 一个文件夹。**

> 完整设计说明见 [`docs/MODS.md`](../docs/MODS.md)。这份 README 是速查。

---

## 快速开始

### 1. 建一个 MOD 文件夹

```
mods/
└── my_first_mod/
    ├── mod.json          ← 必须有的清单
    └── config.json       ← 你想覆盖的游戏数据（可选，P1 起生效）
```

文件夹名**必须**和 `mod.json` 里的 `id` 完全一致。

### 2. 写清单 `mod.json`

```json
{
  "id": "my_first_mod",
  "name": "我的第一个 MOD",
  "version": "1.0.0",
  "apiVersion": 1,
  "author": "你的名字",
  "description": "这个 MOD 做了什么"
}
```

| 字段 | 必须 | 说明 |
|---|---|---|
| `id` | ✅ | 只能用小写/大写字母、数字、`_`、`-`，最长 64；必须等于文件夹名 |
| `name` | ✅ | 游戏里显示的名字 |
| `version` | ✅ | 形如 `1.0.0` |
| `apiVersion` | ✅ | 你照着哪一代 MOD API 写的。当前是 `1` |
| `author` | | 作者名 |
| `description` | | 一句话说明 |
| `dependencies` | | 数组，必须先加载的其他 MOD 的 id |

### 3. 校验

在项目根目录（`开发目录`）运行：

```powershell
node mods/tools/build-mods.mjs            # 看看扫描到了什么
node mods/tools/build-mods.mjs --check    # 严格校验，有问题会返回失败
```

---

## 三条最重要的规矩

### 1. 不要改项目源码

你的 MOD 应该**只存在于自己的文件夹里**。需要什么能力，用 MOD 接口拿，不要直接改 `server/` 或 `public/` 下的文件。

理由很实在：改了源码，你的 MOD 就变成"一个游戏新版本"，没法跟别的 MOD 共存，上游一更新你就得手动合并。

### 2. 代码里不能用 Node 和浏览器的东西

战斗是在**每个玩家的浏览器**里跑的，同时服务器也跑同一份代码。所以 MOD 代码：

- ❌ 不能 `import fs from 'node:fs'`（浏览器没有）
- ❌ 不能用 `document` / `window`（服务器没有）
- ✅ 只能用引擎提供的接口（钩子、伤害/治疗/生成单位等函数）

### 3. 装上 MOD = 信任它的作者

MOD 就是**可执行的代码**。这个游戏没有账号系统，知道地址的人都能连进来。所以：

- 只装你信得过的 MOD
- 分享房间给朋友时，他们等于也在跑你装的 MOD
- 本项目**永远不会**提供"从网上一键下载安装 MOD"的功能——安装永远是你自己手动放文件夹

---

## 提交 MOD 给别人用

把你的 MOD 文件夹打包，或者做成一个独立的 GitHub 仓库。别人拿到后：

1. 解压/克隆到 `mods/` 下（文件夹名要等于 `id`）
2. 跑一次 `node mods/tools/build-mods.mjs --check` 确认没问题
3. 启动服务器

---

## 一些背景

- `mods/tools/` 是本项目自己的工具目录，**不是 MOD**，别把 MOD 放进去。
- `mods/tools/mod-core-changes.json` 记录了本项目为了支持 MOD 而改动的游戏原文件——这是给项目维护者用的，你不用管。
- 游戏数据在 `data/*.json`。想覆盖哪一项，就在自己的 MOD 里放一个同名的 JSON（P1 起生效）。**不要直接改 `data/` 里的文件**，那些是构建生成的。
