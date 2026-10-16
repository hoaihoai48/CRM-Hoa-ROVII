# CRM Hoa ROVII — Dependency Audit

- Date: 2026-10-16
- Source: GitHub Actions run #18, Node 24.21.0 / npm 11.19.0, clean runner, after npm ci.
- Full machine-readable report: [npm-audit-report artifact](https://github.com/hoaihoai48/CRM-Hoa-ROVII/actions/runs/38832964990/artifacts/12018251881) (available for 7 days from the run).

## Summary

| Severity | Count |
|---|---:|
| Critical | 0 |
| High | 15 |
| Moderate | 5 |
| Low | 0 |
| Info | 0 |
| **Total** | **20** |

## Findings reported by npm audit

| Package | Severity | Dependency | Reported advisory/dependency path |
|---|---|---|---|
| @firebase/firestore | High | Transitive | @grpc/grpc-js |
| @firebase/firestore-compat | High | Transitive | @firebase/firestore |
| @grpc/grpc-js | High | Transitive | @grpc/grpc-js |
| @next/eslint-plugin-next | High | Transitive | fast-glob |
| basic-ftp | High | Transitive | basic-ftp |
| braces | High | Transitive | braces |
| chokidar | High | Transitive | braces |
| eslint-config-next | High | Direct | @next/eslint-plugin-next |
| fast-glob | High | Transitive | micromatch |
| firebase | High | Direct | @firebase/firestore, @firebase/firestore-compat |
| firebase-tools | High | Direct | @google-cloud/pubsub, chokidar, gaxios, proxy-agent |
| get-uri | High | Transitive | basic-ftp |
| micromatch | High | Transitive | braces |
| pac-proxy-agent | High | Transitive | get-uri |
| proxy-agent | High | Transitive | pac-proxy-agent |
| @google-cloud/pubsub | Moderate | Transitive | @opentelemetry/core |
| @opentelemetry/core | Moderate | Transitive | @opentelemetry/core |
| gaxios | Moderate | Transitive | uuid |
| re2 | Moderate | Transitive | re2 |
| uuid | Moderate | Transitive | uuid |

The table summarizes npm's reported dependency paths, not a claim that every package is reachable in the production browser bundle. The full JSON artifact contains npm's advisory metadata and fix availability information.

## Remediation approach

1. Review advisory metadata and affected version ranges in the artifact.
2. Separate production/runtime dependencies (firebase) from developer tooling (firebase-tools, ESLint/Next lint plugins).
3. Upgrade within compatible ranges first, regenerate package-lock.json using npm, then run lint, typecheck, Emulator integration tests and production build.
4. Review major upgrades separately and avoid npm audit fix --force without a planned compatibility change.
5. Re-run npm audit after each dependency batch and compare severity counts and affected paths.
6. Treat the audit count as a dependency hygiene issue; do not confuse it with the separate P0 Firestore authorization/write-integrity finding.
