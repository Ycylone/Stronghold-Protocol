# MOD 系统（modkit 分支）· 架构与契约

本文件是 modkit 分支的**设计契约**，地位等同于上游的 `docs/DESIGN.md`：写代码前先读它，方案变了就先改它。

- 上游项目：<https://github.com/sganggs/Stronghold-Protocol>（GPL-3.0-or-later）
- 本分支：`Ycylone/Stronghold-Protocol` 的 `modkit` 分支
- 上游基线：`8b10625`（`master`，2026-10-04 记录）
- MOD API 版本：`1`

> **许可提醒**：MOD 加载层是本分支自己写的代码，随项目以 GPL-3.0-or-later 发布。
> 但《明日方舟》的美术、音频、文本**不在 GPL 范围内**——MOD 若包含这类素材，其分发限制与上游声明一致（非商业、仅供学习交流）。

---

## 1. 这个分支要解决什么问题

上游是一个**单作者、快速迭代**的项目。社区想做 MOD，目前只有两条路，都有问题：

| 做法 | 问题 |
|---|---|
| 直接改上游源码 | 一个 MOD 就变成"一个游戏新版本"，无法与别的 MOD 共存，也无法跟随上游更新 |
| 复制整个项目另起炉灶 | 上游每次修 bug 都要手动合并，很快失控 |

本分支要提供**第三条路**：MOD 放在独立目录里，通过**稳定接口**接入游戏，不需要改项目代码，多个 MOD 可以共存，并且能跟随上游更新。

**一句话目标**：让 MOD 作者只写自己的东西，让上游的更新可以持续收进来。

---

## 2. 压倒一切的设计原则

> ### 用"新增文件"换取"不改原文件"。

这不是风格偏好，是这个分支**能否活下去**的决定性因素。原因见 `docs/MODS.md` 的姊妹文件 `mods/tools/mod-core-changes.json`：那一份清单记录了我们对上游文件的**每一处**改动，并由测试强制约束数量上限。

判断一个方案好不好，先问：**它需要改几个上游文件？** 能改成 0 就改成 0。

推论（都是硬规矩）：

1. **能不碰上游文件就不碰。** 能用"新增模块 + 已有扩展点"实现的，不许改引擎。
2. **改动必须登记。** 每一处改动都要在 `mods/tools/mod-core-changes.json` 里写清：为什么改、上游若变了怎么重做。
3. **核心改动数量有硬上限**（当前 `maxCoreChanges: 5`，已用 1）。超了就说明方案该重新设计，而不是把上限调高。
4. **MOD 的代码必须环境无关。** 战斗在玩家浏览器里跑，服务器也跑同一份代码（`docs/DESIGN.md` §14）。所以 MOD 代码**不能 import `node:` 内置模块，也不能用 `document`/`window`**。只能用引擎给的接口。

---

## 3. 目录结构

```
E:\new\Stronghold-Protocol - 副本\   ← git 仓库根（这个文件夹本身就是开发目录）
├── mods/                          ← ★ MOD 层（本分支新增，上游没有这个目录）
│   ├── README.md                  ← MOD 作者速查
│   ├── tools/
│   │   ├── build-mods.mjs         ← MOD 校验 / 清单生成工具
│   │   └── mod-core-changes.json  ← 核心改动清单（权威）
│   └── <modId>/                   ← 一个 MOD 一个目录（P1 起）
│       ├── mod.json               ← 清单
│       └── ...                    ← 该 MOD 的数据与代码
├── docs/MODS.md                   ← 本文件
├── test/modkit-compat.test.js     ← 兼容性守卫（上游接口漂移会在此报错）
└── （其余为上游原样代码）
```

**注意**：`mods/` 是**新增目录**，所以它永远不会和上游冲突。这是本方案最值钱的性质。

---

## 4. 三个能力层级

MOD 按"对游戏内部的侵入程度"分三层。**先做低层，高层等上游稳定后再做。**

| 层级 | 名字 | 能做什么 | 需要写代码吗 | 兼容性 |
|---|---|---|---|---|
| **L1** | 数据包 | 改模式参数、回合数、经济数值、波次、关卡、敌人数值 | ❌ 只写 JSON | ✅ 保证 |
| **L2** | 声明式 | 加新干员、新敌人、新盟约、新装备、新策略、机变卡；挂事件钩子 | ✅ 调用 SDK | ✅ 保证 |
| **L3** | 逃生舱 | 任何事（覆盖引擎行为、改内部状态） | ✅ 任意 | ⚠️ 不保证 |

**L1 与 L2 是"官方支持"的部分**；L3 明确标记为不稳定，只有在你清楚风险时才用。

### 4.1 为什么第一版做 L1

因为 L1 **只依赖数据文件和已有的数据加载机制**，不依赖任何引擎内部实现。也就是说：

> 上游明天把 `Battle.js` 整个重写，L1 的 MOD 照样能用。

这是唯一"今天做完，明天上游大改也不白干"的部分，所以从它开始。

---

## 5. 上游扩展点清单（我们赖以生存的接口）

这些是**上游自己就在用**的接口，因此比引擎内部稳定得多。`test/modkit-compat.test.js` 会持续验证它们还在。

| 扩展点 | 位置 | 用途 | 稳定性理由 |
|---|---|---|---|
| **钩子总线** | `server/sim/Battle.js` 的 `battle.on/off` | 战斗事件（20 个事件） | `DESIGN.md` §5.4 明写这是"内容接入的唯一方式"，官方内容全走它 |
| **`extraContent`** | `Battle.js` 第 172 行 `extra: opts.extraContent` | 往每场战斗注入内容模块 | 引擎已实现的参数，**零改动可用** |
| **`opts.kits`** | `server/sim/content/index.js` | 覆盖/新增干员技能表 | 代码里已写成"优先于官方技能表" |
| **`MetaRegistry`** | `server/match/effectsMeta.js` | 休整期效果（盟约/装备/策略/机变） | `docs/META.md` 有完整文档；key 正则允许任意前缀 |
| **`loadData()`** | `server/data.js` | 读取目录下所有 JSON | 天生按扩展名扫描 |

### 5.1 关于 `MetaRegistry` 的 key 命名（**已修正**）

注册表的 key 正则是：

```
/^(garrison|band|bond|item|choice|effect|global):[A-Za-z0-9_\-.:#]+$/
```

前缀是**固定的 7 个**，不是任意的——`mod:xxx` 这样的 key 会被 `register()` 直接抛 `TypeError` 拒绝。

所以 MOD 的命名空间做法是：**用这 7 个前缀之一 + 自己带的 id 后缀**，例如：

```
global:<modId>_<name>      每个玩家每个钩子都跑（最通用）
bond:<modId>_<bondId>      新盟约
item:<modId>_<itemKey>     新装备
band:<modId>_<bandId>      新策略
choice:<modId>_<effectId>  新机变卡
effect:<modId>_<id>        持久效果
```

这和上游自己的做法一致（上游正是用 `bond:<bondId>`、`item:<itemKey>` 来区分内容的）。
把 MOD id 作为后缀的一部分，就能保证与官方 key 不冲突。

> `test/modkit-compat.test.js` 会验证这 7 个前缀仍然有效、以及 `HOOKS` 钩子名列表没有变动——
> 上游若调整这两者中的任何一个，测试会立刻报错。

### 5.2 关于 `Battle.js` 第 172 行的一个细节

```js
this._safe(() => installContent(this, { mode: this.contentMode, extra: opts.extraContent }), 'installContent');
```

注意 `_safe(...)`：**内容安装整个包在容错里**。配合 `installContent` 内部对每个模块的 `try/catch`，意味着
**一个坏掉的 MOD 只会被记录并跳过，不会让整场战斗崩溃**。这是社区内容质量参差场景下最重要的健壮性保证，也是我们选它作为接入点的原因之一。

---

## 6. 核心改动清单（权威版在 mods/tools/mod-core-changes.json）

当前**已应用 1 处**：

| # | 文件 | 改动 | 为什么 |
|---|---|---|---|
| 1 | `shared/constants.js` | 文件末尾 +6 行：`export const MODKIT_FORK = true;` | 分支身份标识 + 合并时的差异锚点 |

**已规划、尚未应用 3 处**（P1 阶段）：

| # | 文件 | 改动 | 为什么 |
|---|---|---|---|
| 2 | `server/index.js` | 启动时加载 `mods/` | 唯一入口 |
| 3 | `server/match/effectsMeta.js` | `registerAllMeta(reg)` 后加一行 `registerModMeta(reg)` | 让 MOD 能注册休整期效果 |
| 4 | `server/match/Match.js` | 构造 Battle 时传 `extraContent` 与 `kits` | 把 MOD 内容送进战斗（引擎侧零改动） |

**上限 5 处。** 这个数字是刻意的——核心改动越少，上游更新时的合并成本越低。

---

## 7. 上游更新后的标准流程

```powershell
cd "E:\new\Stronghold-Protocol - 副本"

git switch master
git pull upstream master        # 或去 GitHub 网页点 "Sync fork"
git push origin master
git switch modkit
git merge master
node --test                     # ★ 关键一步
```

`node --test` 里的 `test/modkit-compat.test.js` 会检查：

- 上游那些扩展点是否还在（导出名、`extraContent`、钩子事件表、`MetaRegistry` 的 key 正则……）
- 核心改动清单是否与实际文件一致
- 核心改动数量是否超限
- `server/sim/` 是否仍然对浏览器安全（没有静态 `node:` import）

**测试红了怎么办？** 不要为了让测试变绿而放宽断言。红的意思是"MOD 层需要跟着改"。
正确做法：改 MOD 层适配上游 → 同步更新 `mod-core-changes.json` 与本文档 → 一起提交。

---

## 8. 当前状态与路线图

| 阶段 | 内容 | 状态 |
|---|---|---|
| **P0** | git 骨架、核心改动清单、兼容性守卫、本文档 | ✅ 完成 |
| **P1** | `mods/` 目录 + 启动扫描 + 数据合并 + 游戏内可见 | ⬜ 下一步 |
| **P2** | 第一块垂直切片：L1 模式数据包（改回合数/波次） | ⬜ |
| **P3** | L2 内容注册：新干员 / 新敌人 / 新盟约 | ⬜ 等上游趋稳 |
| **P4** | 创作者配套：开发文档、示例 MOD、校验工具 | ⬜ |
| **P5** | L3 逃生舱 | ⬜ 最后 |

---

## 9. 明确不做的事

1. **不做"从网上下载安装 MOD"。** 安装永远是手动把文件夹放进 `mods/`。理由：法律与信任责任天然落在安装者身上，且以后不需要拆掉任何东西。
2. **不试图做沙箱。** MOD 就是代码，装了就等于信任作者。与其做一个不可靠的沙箱，不如把信任模型讲清楚。
3. **不改 `master` 分支。** 它必须永远是上游的镜子。
4. **不动 `APP_VERSION`。** 那是上游的发布版本号，fork 不是 release。本分支的身份用 `MODKIT_FORK` 标识。
5. **不往 `public/js/` 加手写文件。** `test/client-static.test.js` 会遍历校验那里所有 JS，新增文件有被上游测试卡住的风险。

---

*本文件随实现推进更新。方案变更时，先改这里，再改代码。*
