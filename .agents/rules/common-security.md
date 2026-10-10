---
trigger: model_decision
description: Apply when changing authentication, authorization, customer/order data, Firebase access, or other security-sensitive CRM behavior.
---
# CRM Security Rules

- Never commit credentials, tokens, private keys, production exports, or real customer data.
- Validate untrusted values at the relevant service boundary; do not trust client-supplied roles, totals, ownership, or status transitions.
- For Firebase changes, review Firestore rules and service logic together. UI hiding is not authorization.
- Keep authorization fail-closed, but distinguish denied/missing membership from transient read or network errors.
- Check injection, unsafe HTML, unsafe redirects, sensitive error leakage, and abuse/rate-limit risks where the actual endpoint or flow warrants them. Do not add irrelevant SQL/CSRF/rate-limit boilerplate to unrelated changes.
- For security-sensitive changes, use the security-reviewer agent and the Firebase rules audit skill when rules are in scope. Verify both allowed and denied cases with the emulator.
- Fix confirmed critical/high-risk issues before claiming the work is complete. Report unresolved findings explicitly.
