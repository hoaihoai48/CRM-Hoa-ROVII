---
trigger: glob
globs: "**/*.ts, **/*.tsx, **/*.js, **/*.jsx"
description: Apply TypeScript/JavaScript security guidance to source code, especially validation, authentication, authorization, and error handling.
---
# TypeScript/JavaScript Security

> This file extends [common security](common-security.md) with TypeScript/JavaScript specific content.

## Secret Management

```typescript
// NEVER: Hardcoded secrets
const apiKey = "sk-proj-xxxxx"

// ALWAYS: Environment variables
const apiKey = process.env.API_KEY

if (!apiKey) {
  throw new Error('API_KEY not configured')
}
```

## Agent Support

- Use **security-reviewer** skill for comprehensive security audits
