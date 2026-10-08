# Glossary

| Term                  | Meaning here                                                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Exposure**          | A weakness an attacker could reach: a vulnerability on an asset, in context                                                               |
| **CTEM**              | Continuous Threat Exposure Management — scope → discover → prioritise → validate → mobilise. This demo covers _prioritise_ and _mobilise_ |
| **CVE**               | Public vulnerability identifier. This demo uses synthetic `DEMO-2026-#####` ids instead                                                   |
| **CVSS**              | 0–10 technical severity, without environment context                                                                                      |
| **EPSS**              | Probability (0–1) of exploitation in the wild within 30 days                                                                              |
| **KEV**               | “Known exploited vulnerability” — listed in a catalog of vulnerabilities exploited in the wild                                            |
| **CWE**               | Weakness class (e.g. CWE-79 XSS, CWE-502 deserialisation)                                                                                 |
| **Exploit validated** | A safe attack simulation proved the weakness exploitable on this asset                                                                    |
| **Asset criticality** | 1–4, business importance of the asset                                                                                                     |

## Risk score

One function, `src/shared/risk.ts`, used by the queue sort, the drawer, the mock analyst and the live
prompt:

```
score = 0.35·(CVSS/10) + 0.25·EPSS + 0.15·KEV + 0.15·validated + 0.10·(criticality/4)
P1 ≥ 0.75 · P2 ≥ 0.55 · P3 ≥ 0.35 · else P4
```

KEV and validation are weighted so that a medium-severity bug that is actively exploited outranks an
unexploited critical — the core idea of exposure-based prioritisation. A person can override the
computed priority (with a reason) via an approved `set_priority` action.
