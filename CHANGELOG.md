# Changelog

## 3.1.0

- Add `test/` with 20 Vitest cases (scoring, exemptions, lookup warning-only, scan exclusions, LLM JSON parsing, diagnostics).
- Add `examples/` with two reproducible cases: a low-score pseudo-history and a high-score excavated text (override + critical edition).
- Add `debug: true` diagnostics (`diagnostics` field + stderr log + report section).
- Add `lang` for validation errors (`src/messages.js`, `zh`/`en`); report text remains Chinese.
- Add `docs/ROADMAP.md`, `docs/RELEASE.md`, `docs/DEMO.md`, `docs/PUBLISH.md`, `.gitignore`, and `pnpm demo`.
- Add MIT `LICENSE` and `.github/workflows/test.yml` CI.
- Add README badges, demo placeholder, classic failure cases, tags, disclaimer.

## 3.0.0

- Remove regime/institutional endorsement weighting. Replace `endorsement` with `edition` (`peer-reviewed` +2, `none` 0, `unknown` 0).
- Make `lookup` warning-only: no score adjustment, no domain-authority classification; keep omitted-lead-in detection.
- Stabilize LLM context review with a few-shot prompt and a tolerant JSON parser (code fences, chatter, arrays).
- Add bigram/trigram exclusions to the literal scan (`神宗`, `神农`, `龙且`, `吉祥`, `鬼方`, `异姓`, …).

## 2.0.0

- Add written-reason hard-rule exemptions (`criteria[].override`).
- Add `era_type` weight adjustment.
- Add optional LLM context review and optional web full-text lookup.

## 1.0.0

- Initial 13-point rubric tool: twelve scored criteria, stance rule, hard rules, report rendering.
