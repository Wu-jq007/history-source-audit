# History-Source-Audit：用 AI 践行「史料批判」方法论

> **本工具不提供历史真伪的最终答案，它只提供带有硬规则约束的史学批判思考框架。**

`digital-humanities` · `historiography` · `source-criticism` · `llm-tools` · `deepseek-plugin` · `historical-research`

[![Tests](https://github.com/OWNER/REPO/actions/workflows/test.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/test.yml)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

<!-- 发布前把上面的 OWNER/REPO 替换为你的 GitHub 路径。 -->

---

## ⚠️ 注意事项（务必阅读）

> **本工具的豁免机制请谨慎使用，任何豁免后行为由使用者自行承担，开发者对此不持有任何责任，使用者立场不代表本人立场。**
>
> **请不要在豁免时使用草率的理由，这很有可能将结论导向其他方向，本工具的效用主要依赖于使用者的史学素养和诚实。**
>
> **这只是一个工具，开发者仍希望人类史学家自行甄别。**

补充说明：

- 豁免理由由调用者填写，工具只做非空校验，**不核验其真实性**。
- 豁免后，报告仍会保留「调用者声明，未核验」的标注，但不会替你判断对错。
- 如果你不能为一次豁免写出可复核的依据，请不要使用豁免。
- 本工具的分值、等级与建议都不构成学术结论，也不能替代原典、版本校勘、考古发掘与同行评议。

---

史料批判（source criticism）在历史学里并不新鲜：判断一条记载能不能用，要看它是不是官修、有没有旁证、有没有实物、作者站在哪边、隔了多少层转述、有没有文学加工、是不是胜利者书写。难的是把这些判断**显式化、可复现、可讨论**。

这个插件把上述方法固化成十三项准则，并交给 DeepSeek Harness 的模型调用：

- 十二项计分 + 第十三项态度规则；
- **孤证不立**、**反证优先**、敌对立场、时空距离、多层转述、胜者/幸存者书写、逻辑矛盾等硬规则；
- 允许**写明理由**后豁免硬规则，但工具不核验理由；
- 联网只做「查漏」警示，**不计分**；
- 分值只是启发式汇总，不是真值。

## 演示

> 10 秒 GIF 的录制脚本见 [docs/DEMO.md](docs/DEMO.md)。录制后把文件放到 `docs/demo.gif`，并取消下面的注释。

<!-- ![DSH demo](docs/demo.gif) -->

先看现成的完整报告：[先秦出土文献示例](examples/excavated-bamboo.report.md) · [营销号伪史示例](examples/pseudo-history.report.md)。

## 经典翻车案例

| 案例 | 一句话 | 结果 |
|---|---|---|
| [营销号伪史](examples/pseudo-history.report.md) | 「秦始皇接见外星使者」式网文：匿名野史、孤证、无实物、晚出转述、循环论证 | **0/100，低** |
| [先秦出土文献](examples/excavated-bamboo.report.md) | 清华简《系年》一段：多源佐证仍缺，但以出土载体与整理报告豁免「孤证」 | **80/100，高** |

输入都是可复现的 JSON：[pseudo-history.json](examples/pseudo-history.json)、[excavated-bamboo.json](examples/excavated-bamboo.json)。运行 `pnpm demo` 重新生成报告。

## 它不做什么

- **不判定真伪。** 分值不是「真/假」判决，只是「当前证据下能否作为证据使用」的启发式汇总。
- **不代替考据。** 原典、版本校勘、考古发掘、同行评议仍是必需的。
- **不因政权或官方背书加分。** 无论古今政权是否「认可」，都不参与评分。
- **不把网页检索当史料源。** 搜到一句话只证明「网上有这句话」，不证明它可靠。
- **不核验豁免理由。** 工具只强制你写，不判断「出土原件」是否属实。
- **不代表开发者立场。** 使用者通过豁免、判分与引用得出的任何结论，均与开发者无关。

## 它能做什么

- 按固定十三项准则给出分项判断、权重、得分与备注；
- 施加「孤证不立」「反证优先」等硬规则，并标明是哪一条改变了等级；
- 支持 `override` 豁免硬规则，**理由必填**；
- 按 `era_type` 调整权重（先秦提升实物史料、降低传世文献公信力）；
- 按 `edition` 只给权威学术整理版 +2；
- `context_review: "llm"` 让当前模型复核扫描误报（Few-Shot + 宽容 JSON 解析）；
- `lookup: "auto"` 联网检测片段是否漏掉「太史公曰」等前导语，只作警示；
- `debug: true` 输出诊断信息与计时，方便排查网络/LLM 问题。

## 快速开始

```bash
# 在插件目录
pnpm install
pnpm test      # Vitest：20 个用例
pnpm demo      # 重新生成两份示例报告
```

作为 DeepSeek Harness 插件安装：把本目录加入 **Plugins → Add plugin**，或在具备权限时用 `plugin_manager` 的 `install_bundle`。安装后新会话可看到 `history_source_audit` 工具。

## 十三条准则

计分准则（第 1–12 项，基准权重合计 100）：

| # | 准则 | 基准权重 | 支持（提高可信度） | 削弱（降低可信度） |
|---|---|---|---|---|
| 1 | 史料性质与公信力 | 8 | 官修，或私修但获后世公认（如《史记》） | 匿名、私修且无公认、明显服务于特定政治目的 |
| 2 | 多源佐证 | 18 | 独立来源、民间歌谣/谚语等强佐证 | 孤证，或旁证只是同源转抄 |
| 3 | 实物史料 | 9 | 有出土/传世实物可对应 | 实物与记载矛盾 |
| 4 | 书写者立场 | 10 | 无利害关系或中立 | 政敌、敌对、竞争、恩仇 |
| 5 | 时空距离 | 12 | 同时代、近距离记录 | 相隔久远且空间遥远 |
| 6 | 文体格式 | 5 | 称谓、纪年、格式与同期一致 | 晚出词汇、体例或后世改笔 |
| 7 | 史料层数 | 10 | 作者亲历 | 多层转述，层数越多越降 |
| 8 | 逻辑完整性 | 7 | 前后一致 | 自相矛盾或与其他篇章冲突 |
| 9 | 事实与评价 | 5 | 以可核事实为主 | 论赞、「太史公曰」被当事实 |
| 10 | 文学性修饰 | 5 | 行文平实 | 拟作对话、夸张、排比改变事实 |
| 11 | 胜利者/幸存者/统计口径 | 8 | 已识别并校正偏差，未用现代观念倒推 | 胜利者/幸存者书写、统计口径变化 |
| 12 | 反证检索 | 3 | 已检索反证且反证弱 | 存在反证，或未检索 |

第 13 项是**态度规则**，不赋分，但每一份报告都会执行：怀疑但不否认、不自动认可权威、反证优先、孤证慎用、多源印证。

## 计分与硬规则

- 等级区间：高 ≥80；较高 65–79；中等 50–64；较低 35–49；低 <35。
- **孤证不立**：`corroboration` 为 `weaken`/`neutral`/`unknown` 时，等级不高于「较低」；为 `partial` 时不高于「中等」。
- **反证优先**：`counter_evidence` 为 `weaken` 时，等级不高于「较低」。
- 敌对立场、时空远离、多层转述、胜利者/幸存者书写或统计口径变化、逻辑矛盾：各降一级。
- 有实物史料、官修或获后世公认的私修：各升一级。
- 每项硬规则都可以被对应条目的 `override` 豁免，但必须写明理由。

## 覆盖/豁免

> **再次提醒：** 豁免是给人用的，不是给结论「开绿灯」的。写不出可复核依据时，请不要豁免。

```json
{
  "criterion": "corroboration",
  "verdict": "weaken",
  "note": "传世文献中仅此一处",
  "override": {
    "rule": "corroboration_cap",
    "reason": "此为出土汉简原件，物理载体已证其真"
  }
}
```

- 可用 `rule`：`corroboration_cap`、`counter_evidence_cap`、`author_stance`、`time_space_distance`、`provenance_layers`、`bias_presentism`、`logical_coherence`、`source_nature`。
- 必须挂在对应准则上；最多 3 项。
- 理由必填；工具不核验理由是否成立，报告会标注「调用者声明，未核验」。
- **草率的豁免理由会把结论导向其他方向，由此产生的后果由使用者承担。**

## 时代权重（era_type）

`pre_qin`（先秦）、`medieval`（中古）、`early_modern`（近代）、`contemporary`（当代）、`unknown`（不明）。权重按时代系数调整后重新归一化到 100。

- 先秦：`material_evidence` ×1.8、`source_nature` ×0.7、`style_format` ×1.2、`corroboration` ×1.1。
- 中古：`material_evidence` ×1.2、`source_nature` ×0.9。
- 近代：`source_nature` ×1.2、`material_evidence` ×1.1。
- 当代：`source_nature` ×1.1、`bias_presentism` ×1.4、`corroboration` ×1.1。

## 整理本（edition）

| 值 | 含义 | 分值 |
|---|---|---|
| `peer-reviewed` | 权威学术整理版（点校/校注/同行评议） | +2 |
| `none` | 无学术整理 | 0 |
| `unknown` | 不明 | 0 |

政权或官方背书不是评分项。

## 语境复核与联网校验

- `context_review: "llm"`：当前模型判断扫描词是否语境误报。提示词内置 Few-Shot，解析器支持代码块、前后废话、对象或数组。复核可能出错，报告会说明。
- `lookup: "auto"`：检索原文、查找短语、检查前导语。**只作警示，不计分**；检索不到也不判伪。

## API

| 参数 | 必填 | 说明 |
|---|---|---|
| `source` | 是 | 史料名称 |
| `excerpt` | 否 | 要审查的原文；供扫描与联网校验 |
| `era_type` | 否 | `pre_qin` / `medieval` / `early_modern` / `contemporary` / `unknown` |
| `edition` | 否 | `peer-reviewed` / `none` / `unknown` |
| `context_review` | 否 | `off`（默认）/ `llm` |
| `lookup` | 否 | `off`（默认）/ `auto` |
| `debug` | 否 | `true` 时附加 `diagnostics` 并写 Host stderr 日志 |
| `lang` | 否 | 校验错误语言：`zh`（默认）/ `en`。报告正文目前仍为中文 |
| `criteria` | 否 | 逐条判断，每项含 `criterion`、`verdict`、`note`、可选 `override` |

`verdict`：`support`（1.0）、`partial`（0.6）、`neutral`（0.5）、`weaken`（0）、`unknown`（0.5，并计入不确定性）。

## 日志与诊断

`debug: true` 时：

- 结果新增 `diagnostics` 字段（计时、扫描命中数、LLM/网络状态、错误摘要）；
- 同一内容写到 Host 的 stderr：`[history-source-audit] ...`；
- 报告末尾出现「调试信息」小节。

## 测试

```bash
pnpm test
```

20 个 Vitest 用例，覆盖：

- 五档时代权重合计 100、先秦权重方向；
- 精确分值（全 support = 100；混合 = 45）；
- `peer-reviewed` +2、`none` 0；
- override 缺理由/未知规则/挂错准则都会抛错；英文错误消息；
- lookup 对分值零影响；
- 扫描排除词（神宗、神农、龙且、吉祥、鬼方、异姓）；
- LLM 复核解析代码块与顶层数组；
- 联网漏掉「太史公曰」的警示；
- 调试信息进入报告。

## i18n 现状

- 插件标题/说明：`locale/zh.json`、`locale/en.json`。
- 校验错误：`src/messages.js` 的 `zh`/`en` 表，通过 `lang` 选择。
- **报告正文仍为中文**；完整 i18n 列入 [Roadmap](docs/ROADMAP.md)。

## Roadmap

见 [docs/ROADMAP.md](docs/ROADMAP.md)：完整 i18n、繁简转换、反证自动检索（RAG）、LLM 结构化输出、联网校验稳健性、CI 覆盖率。

## 开源发布

- 许可证：[MIT](LICENSE)
- 发布清单：[docs/RELEASE.md](docs/RELEASE.md)
- GitHub 发布步骤：[docs/PUBLISH.md](docs/PUBLISH.md)
- GIF 录制脚本：[docs/DEMO.md](docs/DEMO.md)
- 版本记录：[CHANGELOG.md](CHANGELOG.md)

## License

[MIT](LICENSE) © 2026 History-Source-Audit contributors

## 免责声明

本工具**不能代替考据**。考据仍需结合原典、版本校勘、考古发掘与同行评议。任何分值都不构成对史料真伪的证明；引用前请回到原典。

**豁免机制请谨慎使用。任何豁免后的行为由使用者自行承担，开发者对此不持有任何责任，使用者立场不代表本人立场。请不要在豁免时使用草率的理由；本工具的效用主要依赖于使用者的史学素养和诚实。这只是一个工具，开发者仍希望人类史学家自行甄别。**

豁免理由由调用者提供，工具不核验；联网校验只证明某网页有某表述，不证明网页权威或文本无误。使用本工具产生的任何学术判断，责任在使用者。
