# Git 手册（Ycylone 专用）

这份手册只讲**我们实际会用到**的东西。你不用背，用到的时候翻一下。

---

## 一、目录结构：你只有一个地方要记

```
E:\new\Stronghold-Protocol - 副本\        ← 总文件夹（名字别改）
  ├── 原有的整合包\                        ← 从 Release 解压的原始整合包（只读参考，不要在这改代码）
  └── 开发目录\                            ← ★ 你的 git 仓库，以后所有工作都在这里
        ├── .git\                          ← git 的大脑，别手动碰
        ├── server\ shared\ public\ ...    ← 项目源码（git 管理）
        ├── public\assets\                 ← 游戏素材 313MB（.gitignore 排除，不提交）
        ├── node_modules\                  ← 依赖（.gitignore 排除，不提交）
        └── GIT-手册.md                     ← 本文件
```

**记住一句话：以后干活去 `开发目录`。**

用命令行时先进去：

```powershell
cd "E:\new\Stronghold-Protocol - 副本\开发目录"
```

---

## 二、心智模型：两个"远端"和两条"分支"

### 2.1 两个远端（remote）

"远端"就是**一个 GitHub 地址的昵称**。你的仓库连着两个：

```
                         ┌── origin    →  https://github.com/Ycylone/Stronghold-Protocol
你的开发目录（本地）───┤                （你自己的 fork，用来存放和备份你的成果）
                         └── upstream  →  https://github.com/sganggs/Stronghold-Protocol
                                          （原作者的仓库，用来接收官方更新）
```

| 昵称 | 指向谁 | 什么时候用 |
|---|---|---|
| `origin` | **你的** fork | 你想把自己的改动**送上去**（备份/分享）时 |
| `upstream` | **原作者的**仓库 | 官方更新了，你想把更新**收下来**时 |

> `origin` / `upstream` **不是关键字**，只是两个自己起的名字。换成 `mine` / `official` 也能用，只是大家习惯这么叫。

查看当前配置：

```powershell
git remote -v
```

### 2.2 两条分支（branch）

| 分支 | 作用 | 规矩 |
|---|---|---|
| `master` | **上游的镜子** | 🔒 一个字都不改。它就等于官方代码 |
| `modkit` | **我们的工作台** | ✅ 所有 MOD 代码写在这里 |

**为什么必须这样分？** 因为 GitHub 网页上有个 **"Sync fork"（同步分叉）按钮**，点了就能把官方更新拉进 `master`。但**这个按钮只有在你没改过 `master` 的时候才能一键成功**。一旦你往 `master` 上写了东西，按钮就会变成"需要手动解决冲突"，就废了。

所以这条规矩的本质是：**用一个干净的分支换一个网页上的一键按钮。**

查看分支：

```powershell
git branch          # 本地分支（前面带 * 的是当前所在）
git branch -a       # 连远端分支一起看
```

切换分支：

```powershell
git switch modkit   # 切到 modkit
git switch master   # 切回 master
```

> `git switch` 和 `git checkout` 功能类似。`switch` 是新的、更安全的写法，专门用来切分支。看到 `checkout` 也不用慌，是老写法。

---

## 三、日常操作：三个命令走天下

### 3.1 看现在什么情况（最常用，随时可敲）

```powershell
git status
```

它告诉你：
- 现在在哪条分支
- 有哪些文件被你改了
- 哪些改动还没"存档"

### 3.2 存档（提交）

改完一段代码，想存个档：

```powershell
git add -A                        # 把所有改动放进"待提交区"
git commit -m "说明这次改了什么"    # 生成一个存档点
```

**`-m` 后面的话是给你自己看的**，将来出问题要靠它回忆。写人话，比如：

```powershell
git commit -m "新增 MOD 加载器：扫描 mods 目录并合并数据"
```

### 3.3 备份到 GitHub（推送）

```powershell
git push
```

就这一个词。因为 `modkit` 已经和 `origin/modkit` 建立了跟踪关系，git 知道该推到哪。

**第一次推送时**会弹出浏览器让你登录 GitHub——这是 Git Credential Manager 在干活，点一下授权就好，以后不用再登。

看到 `new branch` 之类的提示是正常的。

> 如果 `git push` 报错说不知道该推哪里（比如你新建了别的分支），用完整写法：
> ```powershell
> git push -u origin 分支名
> ```
> `-u` 是"记住这个对应关系"，加一次以后就能只写 `git push` 了。

---

## 四、接收官方更新（最重要的操作）

原作者更新了，你想把更新收进来。**顺序很重要**：

```powershell
# 第 1 步：切到 master（镜子分支）
git switch master

# 第 2 步：把官方更新拉下来
git pull upstream master

# 第 3 步：把更新推到你自己的 fork，让网页上的 Sync 按钮保持一致
git push origin master

# 第 4 步：切回工作分支
git switch modkit

# 第 5 步：把 master 的更新合并进 modkit
git merge master

# 第 6 步：跑测试，确认没被改坏
node --test
```

如果第 5 步**没报错**，说明合并干净，继续干活就行。

如果第 5 步报**冲突（conflict）**，说明官方改了你也改过的同一处代码。这时候**不要慌，也不要乱按**——把报错内容发给我，我来处理。

> **另一条更省事的路**：直接去 GitHub 网页上你的仓库页面，点 **"Sync fork"** 按钮，官方更新就进 `master` 了。然后再回到本地做第 4~6 步。两条路等价，看你喜欢。

---

## 五、几条保命规矩

1. **永远不在 `master` 上写代码。** 只在 `modkit` 上写。
2. **每次合并官方更新后，跑一次 `node --test`。** 这个项目有 3000 多个测试，是免费的"体检"。
3. **提交前先 `git status` 看一眼。** 如果看到一堆你没碰过的文件变成"已修改"，先停下来问问，别直接提交。
4. **不要在 `开发目录` 里删 `.git` 文件夹。** 那是 git 的全部记忆。
5. **`原有的整合包` 是只读参考。** 想在那边试东西可以，但别指望它有版本管理。

---

## 六、出问题了怎么办

| 症状 | 原因 | 怎么办 |
|---|---|---|
| `git push` 弹浏览器要登录 | 正常，第一次而已 | 点授权 |
| `git status` 显示一堆没碰过的文件被改了 | 换行符（CRLF/LF）问题 | 确认 `git config core.autocrlf` 是 `true`，然后告诉我 |
| `merge` 报 conflict | 官方和你的改动撞车了 | **停下来，把内容发给我** |
| 提示 `detached HEAD` | 不小心切到了某个提交上 | `git switch modkit` 回去 |
| 想撤销还没提交的改动 | 改乱了想重来 | `git restore .`（**会丢弃所有未提交改动，慎用**） |

---

## 七、命令速查表

| 我想…… | 命令 |
|---|---|
| 看现在什么状态 | `git status` |
| 看改了哪些内容 | `git diff` |
| 存档 | `git add -A` 然后 `git commit -m "说明"` |
| 备份到 GitHub | `git push origin modkit` |
| 看历史记录 | `git log --oneline -10` |
| 看有哪些分支 | `git branch -a` |
| 切到工作分支 | `git switch modkit` |
| 接收官方更新 | 见上面的"第四节" |

---

*本手册随项目进展更新。遇到手册里没有的情况，随时问我。*
