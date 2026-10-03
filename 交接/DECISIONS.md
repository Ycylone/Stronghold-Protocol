# 设计决策与技术陷阱

> **新对话必读。** 这份文件记录"已经定下来的事"和"已经踩过的坑"。
> **不要推翻这里的决定**——每一条背后都有原因，写在这里就是为了避免重复讨论。
> 如果确实需要改变某个决定，先说明理由，并把本文件一起更新。

**最后更新**：2026-10-04

---

# 第一部分：已定的设计决策

## D1. 用「新增文件」换取「不改原文件」

**决定**：任何功能优先用"新增文件 + 已有扩展点"实现；能不改上游文件就不改。

**原因**：上游是单作者快速迭代项目。核心改动越多，`git merge` 时冲突越多，项目越快失控。

**约束**：
- 核心改动**总数上限 5 处**（`mods/tools/mod-core-changes.json` 的 `invariants.maxCoreChanges`，已用 1）
- 每处改动都必须登记：为什么改、上游若变了怎么重做
- 超限时的正确反应是**重新设计方案**，不是调高上限

---

## D2. 三个能力层级（L1 / L2 / L3）

**决定**：MOD 能力分三层，逐层实现。

| 层级 | 能做什么 | 写代码吗 | 兼容性 |
|---|---|---|---|
| **L1** 数据包 | 改模式参数、回合数、经济数值、波次、关卡、敌人数值 | ❌ 只写 JSON | ✅ 保证 |
| **L2** 声明式 | 加干员/敌人/盟约/装备/策略/机变卡；挂事件钩子 | ✅ 调用 SDK | ✅ 保证 |
| **L3** 逃生舱 | 任何事（覆盖引擎行为、改内部状态） | ✅ 任意 | ⚠️ 不保证 |

**原因**：L1 只依赖数据文件和已有加载机制，**不依赖任何引擎内部实现**——上游重写 `Battle.js` 也影响不到它。这是唯一"今天做完、明天上游大改也不白干"的部分，所以先做。

---

## D3. 第一版不做"新模式"，做"模式数据包"

**决定**：P1/P2 不新增第 5 个游戏模式，而是让 MOD 覆盖**已有 4 个难度槽位**的数据。

**原因**（这是读代码得出的硬约束）：游戏里"模式"和"难度"是**绑死的**——

```js
// shared/constants.js
export const DIFFICULTIES = ['FUNNY', 'NORMAL', 'HARD', 'ABYSS'];
export const modeIdFor = (roomMode, difficulty) =>
  `mode_${roomMode === 'solo' ? 'single' : 'multi'}_${difficulty.toLowerCase()}`;
```

- 服务端模式 id 是**算出来的**，不是查出来的
- 客户端的房间界面（`public/js/screens/room.js`）**硬编码遍历这 4 个难度**画卡片

所以"加第 5 个模式"要改 `shared/constants.js` + 房间 UI + 客户端校验 + 配置结构，**必然与上游频繁冲突**。而"改已有难度的数据"只改 `config.json` 里那一条，**核心引擎零改动**。

---

## D4. MOD 安装永远是手动放文件夹

**决定**：**不做**"从网上一键下载安装 MOD"的功能。

**原因**：
1. 法律责任与信任责任天然落在安装者身上
2. 以后不需要拆掉任何东西（如果现在做了下载器，将来要安全审查时就得推倒重来）
3. 这个游戏没有账号系统，知道地址的人都能连进来

---

## D5. 不做沙箱，明确信任模型

**决定**：不试图沙箱隔离 MOD 代码。MOD 就是可执行代码，**装了 = 信任作者**。

**原因**：不可靠的沙箱比没有沙箱更危险（给人虚假的安全感）。业界通行做法（Minecraft、tModLoader）也是这个模型。

**配套要求**（成本几乎为零，但从第一天就要有）：
- 游戏内显示"本局启用了哪些 MOD"
- MOD 的开关必须明确可见

---

## D6. `master` 分支永远是上游的镜子

**决定**：`master` 一个字都不改，所有开发在 `modkit` 分支。

**原因**：GitHub 网页上的 **"Sync fork" 按钮只有在 `master` 未被修改时才能一键同步**。改了 `master`，这个按钮就废了，每次同步都要手动解决冲突。

---

## D7. 不改 `APP_VERSION`

**决定**：`shared/constants.js` 的 `APP_VERSION` 保持等于 `package.json`，跟随上游的发布版本。

**原因**：fork 不是 release。项目自己的身份用 `MODKIT_FORK` 标识（这是唯一的核心改动）。

---

## D8. MOD 在 `MetaRegistry` 里的命名方案

**决定**：MOD 用**固定前缀 + modId 后缀**注册，例如 `global:<modId>_<name>`、`bond:<modId>_<bondId>`。

**原因**：`server/match/effectsMeta.js` 的 key 校验正则是

```js
const KEY_RE = /^(garrison|band|bond|item|choice|effect|global):[A-Za-z0-9_\-.:#]+$/;
```

**前缀是固定的 7 个**，不是任意的。`mod:xxx` 会被 `register()` 直接抛 `TypeError`。

> ⚠️ **这条曾经写错过**：早期文档里写了"可以用 `mod:` 前缀"，实测发现不成立，已修正。
> 教训：关于接口的断言必须实测，不能靠读代码猜。

---

## D9. 不往 `public/js/` 加手写文件

**决定**：MOD 相关的客户端文件不放 `public/js/`。

**原因**：`test/client-static.test.js`（55KB）会**遍历校验** `public/js/` 下所有 `.js` 文件。往里加文件有被上游测试卡住的风险。

**例外**：`public/assets`、`public/vendor`、`public/fonts` 是 gitignore 的资源目录，随便放。

---

## D10. 战斗相关代码必须环境无关

**决定**：`server/sim/` 下的代码（以及 MOD 的战斗代码）**不能 import `node:` 内置模块**，不能用 `document`/`window`。

**原因**：这个项目的战斗是**在每个玩家的浏览器里模拟**的。服务器把 `server/sim/` 当静态文件发给浏览器（`/sim/` 路径，见 `server/index.js` 的 `SIM_PRIVATE` 和 `test/match/simServe.test.js`）。

**唯一例外**：`nodeData.js`，它在 `SIM_PRIVATE` 列表里，永不发给浏览器。

**守卫**：`test/modkit-compat.test.js` 会遍历 `server/sim/` 检查这一点。

---

## D11. 新增测试放 `test/`，新增文档放 `docs/` 或新建目录

**决定**：可以往 `test/` 加测试文件，可以往 `docs/` 加文档。

**原因**（已实测确认）：
- `node --test` 会递归自动发现 `test/**/*.test.js`
- `test/docs-consistency.test.js` **只读取点名的那几个文件**（DESIGN.md / META.md / DATA.md / SIM.md / README.md / DEPLOY.md / PLAYING.md），**不遍历目录**。所以新增 `docs/MODS.md` 不会触发它。
- 但 `test/client-static.test.js` **会遍历** `public/js/`，所以那条要避开（见 D9）

---

## D12. 上游更新后必须跑测试

**决定**：每次合并上游更新后，第一件事是 `node --test`。

**原因**：3353 个测试是免费的体检。`test/modkit-compat.test.js` 会检查上游那些扩展点是否还在（导出名、`extraContent`、钩子事件表、`MetaRegistry` 的 key 正则……）。

**测试红了怎么办**：不要为了让测试变绿而放宽断言。红的意思是"MOD 层需要跟着改"。

---

# 第二部分：技术陷阱（都已实际踩过）

## T1. PowerShell 把 git 的 stderr 当成致命错误

**现象**：`$ErrorActionPreference='Stop'` 时，`git clone` / `git fetch` / `git push` 会被中断，因为 git 把进度信息写进 stderr。

**症状**：脚本跑到一半停住，看起来像 git 失败了，其实命令已经成功。

**对策**：
```powershell
$ErrorActionPreference = 'Continue'   # 不要用 Stop
# 判断成功与否看 $LASTEXITCODE，不要靠异常
git clone ... 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { ... }
```

---

## T2. `robocopy` 不支持 `/H` 硬链接参数

**现象**：`robocopy src dst /E /H` 报 `ERROR : Invalid Parameter #4 : "/H"`，exit code 16。

**原因**：`/H` 是旧版 Windows 资源的选项，**不是**硬链接参数。这个版本没有硬链接模式。

**对策**：用 PowerShell 的 `New-Item -ItemType HardLink -Path <新> -Target <原>`，递归自己写（见 `交接/` 中记录的函数；本仓库历史上用过，约 1 万文件 / 8 秒）。

---

## T3. 危险操作的真正风险不是"命令写错"，而是"作用在错的目录上"

**实际发生的三次事故**：
1. 把目录重组做到了 `E:\new\Stronghold-Protocol`（APK 打包目录），而应该做在 `- 副本` 里
2. 在同一步里创建文件夹又试图把它移进自己（`Move-Item` 报 "Destination path cannot be a subdirectory of the source"）
3. 硬链接脚本的计数器写错，报告了大量虚假的"失败"，实际文件都建好了

**共同根因**：脚本假设"路径会像我以为的那样"，没有在动手前把假设打印出来核对。

**对策（强制）**：
1. **动手前打印操作预告**：要说清"把 X 里的 N 项移到 Y"，列出来
2. **排除项要包含本次新建的目标目录**（这是 T3-2 的根因）
3. **执行后再验证**：数文件数、比对哈希或 FileID
4. **路径冲突时停下来报错**，不要"跳过然后继续执行"（这是 T3-1 的根因——原脚本检测到目标目录已存在时选择了跳过而非中止）

---

## T4. Windows 路径长度上限 260

**现状**：本仓库最深路径 144 字符，**安全**。

**注意**：如果以后把仓库往更深的目录挪，要重新检查。`node_modules\@pixi\compressed-textures\lib\loaders\` 那一带最深。

---

## T5. 中文路径在 `node -e` 里会出错

**现象**：`node -e "...String.raw\`E:\new\副本\...\`..."` 报 `Expected unicode escape`。

**对策**：写临时 `.mjs` 文件来跑，不要用 `node -e` 拼接含中文的路径。或者用 `process.argv` 传路径。

---

## T6. `git status` 里出现"没碰过的文件被改了"

**现象**：换行符（CRLF/LF）差异导致大量文件显示为已修改。

**对策**：确认 `git config core.autocrlf` 是 `true`（本仓库已设）。项目自带 `.gitattributes` 会配合处理。

---

## T7. 改动被记录成 `origin/refs/heads/modkit` 这种怪路径

**现象**：用 `git fetch origin '+refs/heads/*:refs/remotes/origin/*'` 手工指定 refspec 后，跟踪配置写歪了，`git branch --set-upstream-to` 报 "not a branch"。

**对策**：直接手写配置，不依赖自动推断：
```powershell
git config branch.modkit.remote origin
git config branch.modkit.merge refs/heads/modkit
```

---

## T8. `fullmatch-coop3.test.js` 在完整套件里偶发失败

**现象**：跑 `node --test` 时它有时失败（耗时 100+ 秒），单独跑就通过。

**原因**：它跑 20 局完整三人对战模拟，**CPU 密集**，并行跑时资源竞争。**不是代码问题。**

**对策**：重跑一次即可。如果单独跑也失败，那才是真问题。

---

# 第三部分：用户的情况（给 AI 的背景）

- 用户是**有一定计算机基础的专业学生**，但毕业后数年没做开发，实际开发不熟练
- **全程依靠 Vibe Coding 工具**（就是当前的 DSH 对话），本人不手写代码
- **一次对话的上下文会溢出**，所以必须靠 `交接/` 目录跨对话传递状态
- 主业不是开发，这是业余创作
- **需要手把手教学**：命令要解释在干什么，不要假设他懂 git 或 Node
- 用户明确说过：**不理解的地方要解释清楚**，不要堆术语

**沟通偏好**：
- 中文回答
- 说清楚"为什么"，不只是"怎么做"
- 犯错要主动承认并说明原因
- 涉及删除/移动文件的操作用户很在意，必须先确认
