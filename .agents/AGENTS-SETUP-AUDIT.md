# .agents Setup Audit — CRM Hoa ROVII

Audit date: 2026-10-10  
Audited commit before these configuration fixes: `c3a93a837c67006059a8ee7baed09f6af8248034`  
Configuration fix commits: `b8e3c13ea9d5623f5c838298a74f9897e598a6c7`, `ee2042a341b43b92771193c5fcb85c533dd61200`

## Verdict

The repository contains useful agent/skill material, but it was a mixed-format ECC bundle and was not fully compatible with Antigravity's documented discovery conventions. Some high-value instructions were silently ignored, some generic requirements did not fit this project's scripts, and a workflow pointed to a nonexistent hook script.

## Findings and remediation

### 1. Rules frontmatter — fixed for the CRM-critical subset

Antigravity requires every `.agents/rules/*.md` rule to declare a valid `trigger` (`always_on`, `model_decision`, `glob`, or `manual`). Files using only `paths:` or no frontmatter are not valid Antigravity rule definitions and may be silently discarded.

Updated these rules with supported triggers and relevant descriptions/globs:
- `.agents/rules/common-security.md`
- `.agents/rules/common-testing.md`
- `.agents/rules/common-development-workflow.md`
- `.agents/rules/react-coding-style.md`
- `.agents/rules/react-hooks.md`
- `.agents/rules/react-testing.md`
- `.agents/rules/typescript-coding-style.md`
- `.agents/rules/typescript-security.md`

The revised testing guidance no longer imposes a blanket 80% coverage target or assumes Jest/Vitest/E2E tooling. It points to the actual CRM commands and requires results to be tied to the exact commit. Security guidance is scoped to the Firebase/CRM surfaces rather than irrelevant SQL/CSRF boilerplate.

**Remaining:** the rest of the imported rule catalog has not been fully normalized. Only the CRM-critical subset above was corrected; do not assume all 122 rule files are active or Antigravity-compatible.

### 2. Agent definitions — native discovery paths added for priority agents

Antigravity documents workspace custom agents as `.agents/agents/<agent-name>/agent.md`. The original bundle stored definitions flat as `.agents/agents/<agent-name>.md`.

Added native-layout copies for:
- `react-reviewer`
- `typescript-reviewer`
- `security-reviewer`
- `silent-failure-hunter`
- `e2e-runner`

The flat originals are retained to avoid disrupting tools that consume the ECC-style layout. The remaining flat-only agent definitions have not been migrated; use the five native-layout agents as the verified priority set for this CRM.

### 3. Skills — compatible layout; project-specific quality gate added

The existing skills use the expected `.agents/skills/<skill-name>/SKILL.md` layout. Relevant existing skills include Firebase Firestore, Firebase security rules audit, production audit, browser QA, and E2E testing.

Added `.agents/skills/crm-quality-gate/SKILL.md`, which documents the four actual CRM verification commands:
- `npm run test:emulator`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

The skill explicitly disallows assuming generic scripts or copying historical PASS results onto a newer HEAD.

### 4. Workflows — migration required before October 19, 2026

The repository has 94 legacy workflow Markdown files. Google's current Antigravity documentation says existing IDE workflows stop working on October 19, 2026, with migration to skills recommended.

The existing `.agents/workflows/quality-gate.md` referenced `scripts/hooks/quality-gate.js`, but that script does not exist in this repository. Replaced its instructions with a temporary legacy alias directing users to `/crm-quality-gate`.

**Remaining:** migrate only workflows relevant to actual CRM tasks, then archive/remove the legacy copies once each replacement is verified. Do not bulk-migrate all 94 blindly; many target unrelated languages and ecosystems.

### 5. Install-state file portability

`.agents/ecc-install-state.json` contains machine-specific absolute paths under `/Users/vu/` and an npm cache location. It is not a portable team instruction file. Before changing/removing it, confirm whether the installed ECC updater expects it locally; if it is only local installation metadata, keep it out of version control and document reproducible setup instead.

### 6. What this audit does not prove

- The Antigravity UI has not been opened here, so runtime discovery has not been observed directly.
- No app test/build command was run as part of this configuration-only audit.
- Native agent files and rule frontmatter were aligned to the published format, but they still need a quick in-Antigravity smoke test to confirm that the IDE lists the five agents and the `/crm-quality-gate` skill.

## Recommended ongoing policy

1. Keep `AGENTS.md` as the concise always-on project contract.
2. Use `.agents/rules/` for small, correctly triggered topic-specific constraints.
3. Use `.agents/skills/<name>/SKILL.md` for repeatable workflows and project procedures.
4. Keep only the relevant agents discoverable by default; use security, React/TypeScript, silent-failure, and E2E specialists according to the changed surface.
5. Treat tool names and commands inside imported agent prompts as unverified until they exist in the active Antigravity environment.
6. Require the four CRM quality gates for final verification and report PASS/FAIL/NOT RUN honestly.

## Primary documentation

- Antigravity Rules: https://www.antigravity.google/docs/rules/
- Antigravity Agent Skills: https://www.antigravity.google/docs/skills?tab=ide
- Antigravity Agents command: https://www.antigravity.google/docs/cli/commands/agents/
- Workflows-to-skills migration: https://antigravity.google/docs/migration/workflows-to-skills/
