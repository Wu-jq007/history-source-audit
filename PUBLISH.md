# 在 GitHub 上发布

这份指南假设你要发布的是 `history-source-audit/` 这个目录本身，而不是整个 `备份` 文件夹。

## 0. 前置

- 安装 [Git for Windows](https://git-scm.com/download/win)（或使用 GitHub Desktop）。
- 本机当前没有 `git` 命令；装好后重开终端。
- 确认 `pnpm test` 在本地全绿。

## 1. 创建 GitHub 仓库

在 GitHub 上新建仓库：

- 名称：`history-source-audit`
- 可见性：Public
- **不要**勾选 “Add a README / .gitignore / license”；这些文件已经在本目录里。

## 2. 本地初始化并推送

```bash
cd "D:\GAMES\备份\history-source-audit"

git init
git add .
git commit -m "feat: history-source-audit 3.1.0"
git branch -M main
git remote add origin https://github.com/<OWNER>/<REPO>.git
git push -u origin main
```

`node_modules/` 已被 `.gitignore` 排除；如果 `git status` 里仍看到它，先执行：

```bash
git rm -r --cached node_modules
```

## 3. 替换占位符

推送后改两处：

1. `README.md` 顶部徽章：

   ```md
   [![Tests](https://github.com/OWNER/REPO/actions/workflows/test.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/test.yml)
   ```

   把 `OWNER/REPO` 换成你的实际路径，例如 `alice/history-source-audit`。

2. `LICENSE` 里的版权人：

   ```text
   Copyright (c) 2026 History-Source-Audit contributors
   ```

   改成你的名字或组织名。

改完再提交：

```bash
git add README.md LICENSE
git commit -m "docs: set repository badge and copyright holder"
git push
```

## 4. 确认 CI 变绿

- 打开仓库的 **Actions** 标签。
- 应看到 **Tests** workflow 正在运行。
- 通过后，README 顶部的徽章会显示绿色。

如果失败，最常见原因是：

- `pnpm-lock.yaml` 与 `package.json` 不一致：本地跑 `pnpm install` 后提交新的 lockfile。
- Node 版本：workflow 用 Node 24；本地也应一致。
- `pnpm test` 本地不过：先修本地。

## 5. 加 Topics

仓库首页 → 右上 **⚙** → Topics，填入：

```text
digital-humanities
historiography
source-criticism
llm-tools
deepseek-plugin
historical-research
```

## 6. 打 Tag / Release

```bash
git tag -a v3.1.0 -m "history-source-audit 3.1.0"
git push origin v3.1.0
```

然后在 GitHub **Releases → Draft a new release**：

- Tag：`v3.1.0`
- Title：`history-source-audit 3.1.0`
- 内容可从 `CHANGELOG.md` 复制 3.1.0 段落。
- 附件：可选，把 `examples/*.report.md` 打包。

## 7. 录制并加入 GIF

按 [DEMO.md](DEMO.md) 录制 `docs/demo.gif`，取消 README 里的占位注释，提交：

```bash
git add docs/demo.gif README.md
git commit -m "docs: add 10s DSH demo gif"
git push
```

## 8. 可选：发布到 npm

当前 `package.json` 是：

- `"private": true`
- 包名 `@local/history-source-audit`

如果要发 npm：

1. 去掉 `"private": true`。
2. 把包名改成公开名，例如 `history-source-audit` 或 `@your-scope/history-source-audit`。
3. 补 `repository`、`homepage`、`author`。
4. 登录并发布：

   ```bash
   npm login
   npm publish --access public
   ```

> 如果不打算发 npm，保持 `private: true` 即可；这不会影响作为 DSH 本地插件使用。

## 9. 发布检查清单

完整清单见 [RELEASE.md](RELEASE.md)。最少确认：

- [ ] `pnpm test` 全绿
- [ ] Actions 绿色
- [ ] README 徽章路径已替换
- [ ] LICENSE 版权人已替换
- [ ] `docs/demo.gif` 已加入（或明确暂缺）
- [ ] Topics 已设置
- [ ] 免责声明在 README 中可见

## 10. 常见问题

**Q：推送后 Actions 报 `pnpm: command not found`？**
A：确认 workflow 里先 `pnpm/action-setup@v4`，再 `setup-node`。

**Q：GIF 太大？**
A：见 [DEMO.md](DEMO.md) 的压缩建议；或改用 `docs/demo.mp4` + GitHub 视频。

**Q：只想本地给 DSH 用，不想发 GitHub？**
A：不需要这些步骤；插件目录已经能被 DSH 加载，`LICENSE`/CI 只是为开源准备。
