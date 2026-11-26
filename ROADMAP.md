# Roadmap

这份清单记录 4.0 之前值得做的方向。欢迎认领；提交前请先看 [README](../README.md) 的测试与免责声明。

## 1. 完整 i18n

现状：`src/messages.js` 已覆盖校验错误（`zh`/`en`），`locale/en.json` 与 `locale/zh.json` 覆盖插件标题与说明；**报告正文仍为中文**。

建议做法：

- 把 `src/assess.js` 里的报告模板抽成 `src/render.zh.js` / `src/render.en.js`，通过 `lang` 选择。
- 把 `criteria` 的 label、`verdict` 的标签、硬规则原因、疑问句都移入消息表。
- 用 `Intl` 或简单的插值函数，避免模板字符串散落。
- 增加 `test/i18n.test.js`：断言同一输入在 `zh`/`en` 下都能渲染，且关键段落存在。

## 2. 繁简转换

古籍多为繁体，目前扫描词表只覆盖了一部分繁体写法（如 `論曰`、`贊曰`）。

建议做法：

- 引入一个轻量的繁→简映射（OpenCC 的 `t2s` 词表是常见选择），只用于**扫描与匹配**，不改写原文。
- 在 `scan.js` 与 `enrich.js` 的 `normalizeForMatch` 前先做转换。
- 增加测试：同一段繁体文本与简体文本得到相同的 marker 命中。
- 注意：转换只用于匹配，报告引用仍保留原文。

## 3. 反证自动检索（RAG）

目标：给定一段记载，自动去知网、古籍库、方志库等检索可能的反证，而不是只依赖调用者手填 `counter_evidence`。

建议做法：

- 先做**查询生成**：从 `excerpt` 抽取人物、事件、年代、地名，生成 3–5 条检索式。
- 复用 `ctx.web.search` / `ctx.web.fetch`，或接入专门的学术 API（需用户自备凭据）。
- 结果只作为「候选反证」进入报告，**仍不计分**；由调用者判断是否采纳。
- 必须记录来源 URL、检索时间、命中片段；对无法访问的库明确标注「未检索」。
- 这是高风险功能：不要让 RAG 结果直接改变等级，也不要伪造「已检索」。

## 4. LLM 结构化输出

现状：`context_review` 用 Few-Shot + 宽容 JSON 解析。Harness 的 `GenerateOptions` 目前没有 `response_format`。

建议做法：

- 若 LLM seam 增加结构化输出参数，改用 JSON Schema 约束。
- 或改用 tool-call：定义一个 `report_scan_review` 工具，让模型必须调用它返回结构化结果。
- 保留现有解析作为降级路径。

## 5. 联网校验的稳健性

- 站点白名单/黑名单（内容农场、反爬站点）。
- 结果缓存（同一短语 24h 内不重复抓取）。
- 更清晰的失败分类：超时、403、DNS、解析失败。
- 可选 `lookup_timeout_ms` 参数。

## 6. 测试与 CI

- 覆盖率目标：`src/` 行覆盖 ≥ 80%。
- 增加 `test/execute.test.js`：用 mock `ctx.tools.register` 验证 `debug` 诊断与错误路径。
- GitHub Actions：Node 24 + `pnpm test`。
