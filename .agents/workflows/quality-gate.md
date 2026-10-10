---
description: Legacy alias for the CRM Hoa full verification skill. Prefer /crm-quality-gate.
---
# Quality Gate (Legacy Alias)

This workflow is retained temporarily for compatibility. The original ECC formatter-hook entrypoint referenced `scripts/hooks/quality-gate.js`, but that script is not present in this repository.

For the real CRM final verification, invoke `/crm-quality-gate`. It runs the repository's actual four gates:
- `npm run test:emulator`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

Do not report PASS unless each command has been executed against the exact HEAD and its exit code was observed. This legacy workflow should be retired after the workflow-to-skills migration.
