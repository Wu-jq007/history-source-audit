# 开源发布清单

发布前逐项确认。这个文件是给维护者的，不进入 npm 包的运行时。

## 必备

- [x] **README**：标题、一句话定位、经典案例、安装、测试、免责声明。
- [x] **LICENSE**：MIT，见根目录 [LICENSE](../LICENSE)。
- [x] **CHANGELOG.md**：1.0 → 2.0 → 3.0 → 3.1。
- [x] **CI**：`.github/workflows/test.yml`，push/PR 自动跑 `pnpm test`。
- [ ] **README 徽章**：把 `OWNER/REPO` 换成实际 GitHub 路径。
- [ ] **package.json**：补 `repository`、`homepage`、`author`；`license`/`keywords` 已就位。
- [ ] **npm 发布**：若发布到 npm，去掉 `"private": true`，并把 `@local/history-source-audit` 改为公开包名。
- [x] **npm files**：包含运行时与文档（`index.js`、`src`、`locale`、`icon.svg`、`cordis.patch.yml`、`README.md`、`CHANGELOG.md`、`LICENSE`、`docs`、`examples`）。
- [x] **测试**：`pnpm test` 全绿（20 个用例）；CI 配置为 Node 24 + pnpm 10。
- [x] **示例**：`pnpm demo` 能重新生成 `examples/*.report.md`。
- [x] **免责声明**：明确「不能代替考据」「分值是启发式」「豁免理由不核验」。
- [ ] **GIF**：按 [DEMO.md](DEMO.md) 录制 `docs/demo.gif`，取消 README 占位注释。

## 建议的标签

`digital-humanities` · `historiography` · `source-criticism` · `llm-tools` · `deepseek-plugin` · `historical-research`

## 发布步骤

1. 更新 `package.json` 版本与 `CHANGELOG.md`。
2. `pnpm test`。
3. `pnpm demo`，确认示例报告没有意外变化。
4. `npm pack --dry-run` 检查打包内容。
5. 按 [PUBLISH.md](PUBLISH.md) 推送 GitHub、替换徽章路径、打 tag。
6. 发布 npm（如果公开）或在 DSH Plugins 中本地安装。

## DSH 安装

本目录是 DSH bundle。安装后重启或重新启用：

- 在 **Plugins** 中应看到「史料可靠性审查 3.1」。
- 工具名为 `history_source_audit`。

## 发布文案

> **History-Source-Audit：用 AI 践行「史料批判」方法论**
>
> 它不提供历史真伪的最终答案，只提供一套带有硬规则约束的史料批判思考框架：十三条准则、可复现的分级、写明理由的豁免、只作警示的联网查漏。
>
> 最适合：想要把「考据直觉」显式化、可讨论、可复现的研究者与数字人文开发者。
>
> 它不能代替考据。考据仍需原典、版本校勘、考古发掘与同行评议。
