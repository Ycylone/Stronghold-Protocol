# 项目进度（唯一权威状态文件）

> **这是整个项目的"存档点"。每完成一个阶段就更新它。**
> 新对话的第一件事就是读这个文件——读完就知道该干什么了。

**最后更新**：2026-10-04
**当前阶段**：P0 已完成 → 下一步 **P1**
**仓库**：<https://github.com/Ycylone/Stronghold-Protocol>（分支 `modkit`）
**本地路径**：`E:\new\Stronghold-Protocol - 副本`
**上游基线**：`8b10625`（作者的 `master`）

---

## 🚀 新对话从这里开始（复制这段给 AI）

```
这是一个 MOD 系统开发项目，是 Stronghold-Protocol 的 fork（明日方舟同人游戏网页版）。

我的情况：我不太会写代码，全程依靠你来开发。上一次对话的上下文满了，所以新开
了这个窗口。项目状态都记录在仓库文件里，请先读文件再说话。

请按顺序读这四个文件：
1. 交接/PROGRESS.md    ← 当前进度（唯一权威状态）
2. 交接/DECISIONS.md   ← 已定的设计决策 + 技术陷阱（不要推翻）
3. docs/MODS.md        ← MOD 系统架构契约
4. GIT-手册.md         ← 我的 git 使用备忘（了解我和 git 的关系）

仓库位置：E:\new\Stronghold-Protocol - 副本

读完先告诉我这三件事，然后等我确认，不要直接开始写代码：
① 现在在哪个阶段
② 下一步具体该做什么
③ 有哪些必须遵守的规矩和不能碰的坑
```

> 这段提示词与 `交接/SESSION-PROMPT.md` 的「一、开新对话时说什么」**必须保持一致**。
> `test/modkit-compat.test.js` 会检查这一点。

---

## 一、这个项目在做什么

给《卫戍协议：盟约》网页复刻版（明日方舟同人游戏）加一套**社区 MOD 加载系统**，让玩家能通过独立目录添加自己的内容（新模式、新干员、新敌人、新盟约等），而不需要修改项目源码。

**为什么这么做**：原作者的项目是单作者快速迭代的，社区已经有 69 个 fork，还有人做了 "Stronghold-Protocol-Modded"。大家都走"复制整个项目改造"的路，导致每个 MOD 都变成一个独立游戏版本、无法共存、无法跟随上游更新。我们要提供第三条路。

---

## 二、压倒一切的设计原则

> ### 用「新增文件」换取「不改原文件」

这不是风格偏好，是**项目能否活下去**的决定性因素。上游更新频繁，核心改动越多，合并成本越高。

**当前实证：对上游文件的改动 = 1 个文件、+11 行。**

---

## 三、进度总览

| 阶段 | 内容 | 状态 |
|---|---|---|
| **P0** | git 骨架、核心改动清单、兼容性守卫、文档 | ✅ **完成**（2026-10-04） |
| **P1** | MOD 加载器：目录扫描 + 数据合并 + 游戏内可见 | ⬜ **下一步** |
| **P2** | 第一块垂直切片：模式数据包（改回合数/波次） | ⬜ |
| **P3** | 内容注册：新干员 / 新敌人 / 新盟约 | ⬜ 等上游趋稳 |
| **P4** | 创作者配套：开发文档、示例 MOD、校验工具 | ⬜ |
| **P5** | 逃生舱（L3 任意代码） | ⬜ |

---

## 四、P0 已完成的内容（详细）

### 4.1 环境与仓库

- 仓库根目录：`E:\new\Stronghold-Protocol - 副本`（**这个文件夹本身就是开发目录**，没有嵌套）
- 两个远端：`origin` = 用户的 fork，`upstream` = 原作者
- 两条分支：`master`（上游镜子，**永不修改**）、`modkit`（工作分支）
- git 身份：`Ycylone` / `91735553+Ycylone@users.noreply.github.com`
- 已配置 `push.default=current`、`push.autoSetupRemote=true`，所以 `git push` 不带参数即可
- 素材 `public/assets`（5460 文件）与依赖 `node_modules`（5861 文件）已就位
- **注意**：`E:\new\Stronghold-Protocol`（无"副本"后缀）是用户**打包 APK** 用的另一个目录，**绝对不能碰**

### 4.2 新增文件

| 文件 | 作用 |
|---|---|
| `docs/MODS.md` | MOD 系统架构契约（三个能力层级、上游扩展点清单、更新流程） |
| `mods/README.md` | MOD 作者速查 |
| `mods/.gitignore` | 忽略生成的索引 |
| `mods/tools/build-mods.mjs` | MOD 扫描/校验/索引（含清单 schema、依赖拓扑排序） |
| `mods/tools/mod-core-changes.json` | **核心改动清单**（权威，由测试强制约束数量上限） |
| `test/modkit-compat.test.js` | **兼容性守卫**（10 项检查） |
| `GIT-手册.md` | 用户的 git 入门备忘 |
| `交接/`（本目录） | 跨对话交接机制 |

### 4.3 对上游的唯一改动

`shared/constants.js` 文件末尾新增（+11 行）：

```js
// ---- modkit fork ----
export const MODKIT_FORK = true;
```

已登记在 `mods/tools/mod-core-changes.json`。

### 4.4 验收结果

| 检查 | 结果 |
|---|---|
| 完整测试套件 | ✅ 3353 项，fail 0（9 项因缺浏览器/素材跳过） |
| 兼容性守卫 | ✅ 10/10 |
| MOD 工具 `--check` | ✅ 通过 |
| 服务器冒烟测试 | ✅ `/healthz` 正常，首页 200 |
| git 工作区 | ✅ 干净（无幽灵改动） |
| 本地 ↔ GitHub | ✅ 同步 |

---

## 五、P1 要做什么（下一步）

**目标**：一个能跑通的最小 MOD 加载器——扫描 `mods/` 目录、校验清单、把 MOD 的数据合并进游戏、并在游戏里显示"本局启用了哪些 MOD"。

### 5.1 预计改动（已登记在 mod-core-changes.json 的 plannedChanges）

| # | 上游文件 | 改动 | 说明 |
|---|---|---|---|
| 2 | `server/index.js` | 启动时调用一次 MOD 加载 | 优先新建 `server/modkit/` 模块，这里只加调用 |
| 3 | `server/match/effectsMeta.js` | `registerAllMeta(reg)` 之后加一行 `registerModMeta(reg)` | 让 MOD 能注册休整期效果 |
| 4 | `server/match/Match.js` | 构造 Battle 时传已有的 `extraContent` / `kits` 参数 | **引擎侧零改动**，这两个参数引擎已实现 |

**上限 5 处**（`mod-core-changes.json` 的 `invariants.maxCoreChanges`），超了说明方案该重新设计。

### 5.2 开工前必须先解决的 4 个问题（⚠️ 重要）

P1 的目标里有一句"**并在游戏里显示本局启用了哪些 MOD**"，但上面那 3 处改动**没有一处负责显示**。
同时 `DECISIONS.md` D9 禁止往 `public/js/` 加手写文件（会被上游 `test/client-static.test.js` 遍历校验）。

**这个矛盾必须在写代码前解决**，否则 P1 会卡在最后一步。已识别的待决问题：

| # | 问题 | 备注 |
|---|---|---|
| **Q1** | MOD 列表怎么送到客户端并显示？ | 候选方案：① 新增 `public/modkit/` 目录（不在 `public/js/` 下，绕开 D9），`index.html` 加一行加载；② 塞进已有的 `m.public` 消息，用已有的界面位置显示；③ 先在服务端日志/控制台显示，游戏内显示推到 P2 |
| **Q2** | `Match.js` 的注入点到底好不好插？ | 文档原写"传两个已有参数，一处而已"。实测：`bopts` 是 `Match.js` **第 2850–2867 行的一个内联多行对象字面量**，而 `Match.js` 有 3000+ 行、是上游最活跃的文件之一。**这是高冲突位置**，与"低冲突"目标相悖，需要重新权衡 |
| **Q3** | "数据合并"会不会逼我们改 `server/data.js`？ | `deepFreeze` 在 `loadData()` **内部**执行。好消息：`loadData(dir = DATA_DIR, ...)` **接收目录参数**，所以可以不动它——让 MOD 层先准备一份"官方数据 + MOD 覆盖"的合并结果，再从该结果加载。**但 `server/data.js` 目前没登记在 `plannedChanges` 里**，真去改它就成了未登记的第 5 处改动 |
| **Q4** | 核心改动名额够不够？ | 已用 1 + 计划 3 = 4，**只剩 1 个余量**，而 Q1/Q3 都可能额外消耗名额。动手前先算清楚 |

**建议**：P1 开工时第一件事是把这 4 个问题逐个确认并更新本节，而不是直接写代码。

### 5.3 关键技术约束（重要，别踩）

1. **数据必须"就地合并且不能违反冻结时机"**
   `server/data.js` 的 `loadData()` 读取整个目录的 `*.json`，然后 `deepFreeze`。所以 MOD 数据合并**必须发生在冻结之前**。参考 `server/match/gamedata.js` 里 `tuning.json` 的覆盖先例（目前只覆盖 titles），把它一般化。

2. **战斗代码必须环境无关**
   战斗在玩家浏览器里跑，服务器也跑同一份代码（`docs/DESIGN.md` §14）。所以 `server/sim/` 下的代码（以及 MOD 的战斗代码）**不能 import `node:` 内置模块**。唯一的例外是 `nodeData.js`，它在 `server/index.js` 的 `SIM_PRIVATE` 列表里、永不发给浏览器。兼容性测试会检查这一点。

3. **MOD 代码要同时能被两处加载**
   服务器把 `server/sim/` 当静态文件发给浏览器（`/sim/` 路径）。如果 MOD 带代码，得考虑怎么下发（P1 可能只做数据，代码下发放 P2/P3）。

4. **`MetaRegistry` 的 key 前缀是固定的 7 个**
   `garrison|band|bond|item|choice|effect|global`。MOD **不能**用 `mod:` 前缀（会被 `register()` 抛 `TypeError`）。正确做法：固定前缀 + modId 后缀，如 `global:<modId>_<name>`。

### 5.3 已有可复用的东西

- `mods/tools/build-mods.mjs` 已经导出 `scanMods()`、`loadOrder()`、`buildIndex()`，运行时加载器应该 **import 它**，让校验规则只有一处。
- `installContent(battle, { extra })` 的 `extra` 参数是引擎已有的注入点（`server/sim/content/index.js`）。
- `battle.opts.kits` 优先于官方技能表（同上文件）。
- `Battle.on(name, fn)` 钩子总线，20 个事件（`docs/DESIGN.md` §5.4）。

---

## 六、P2 之后（粗略方向）

- **P2**：用 P1 的机制做一个"模式数据包"MOD（比如把某个难度的回合数改成 20），验证整条链路。**这一步能证明整套架构成立。**
- **P3**：加新干员/敌人/盟约。价值最高但依赖上游稳定，建议等上游进入"修 bug 为主"的阶段。
- **P4**：给 MOD 作者写开发文档、做 2–3 个带注释的示例 MOD、加一个"校验我的 MOD"工具。
- **P5**：L3 逃生舱（任意代码、挂任意钩子），明确标记为不保证兼容。

---

## 七、每完成一个阶段要做什么（清单）

1. 更新本文件（`交接/PROGRESS.md`）：阶段状态、新增文件、验收结果、下一阶段要点
2. 如果有新的设计决策，追加到 `交接/DECISIONS.md`
3. 如果改了上游文件，更新 `mods/tools/mod-core-changes.json`
4. 跑 `node --test` 确认全绿（3353 项，约 3 分钟）
5. **跑 `node mods/tools/check-upstream-diff.mjs`** —— 它用 git 实测"我们到底改了几个上游文件"，
   与 `mod-core-changes.json` 对账。**这是唯一能真正验证"改动很小"这个承诺的检查**，
   因为 `test/modkit-compat.test.js` 是刻意不依赖 git 的（它要在没有 git 历史的发布包里也能跑）
6. 提交：`git add -A && git commit -m "..." && git push`
7. 如果上游有新提交，先合并再继续（见 `GIT-手册.md` 第四节）

### 7.1 特别注意：文档里不许出现"声称但未实测"的数字

已经犯过两次同类错误，都是**断言没有实测**：

- ❌ 曾写"`MetaRegistry` 的 key 正则允许任意前缀" → 实测只允许 7 个固定前缀（见 `DECISIONS.md` D8）
- ❌ 曾写"`shared/constants.js` 改动 +6 行" → 实测是 +11 行

**规矩：任何关于接口、行数、文件数的断言，写进文档前必须先跑命令验证。**
`check-upstream-diff.mjs` 就是为了让这类数字有权威来源。
