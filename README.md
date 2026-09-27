# UpgradeGuard

> **Rehearse dependency changes before they break your code.**

UpgradeGuard is an AI-assisted dependency upgrade safety and migration system built for the **IBM Bob 2.0 Hackathon**.

Instead of blindly upgrading dependencies and discovering breaking changes after the application is already broken, UpgradeGuard first **scans, rehearses, investigates, repairs, and verifies** dependency upgrades in an isolated environment.

The core workflow is:

```text
        ┌─────────────┐
        │   DETECT    │
        │             │
        │ Find outdated│
        │ dependencies│
        └──────┬──────┘
               │
               ▼
        ┌─────────────┐
        │  REHEARSE   │
        │             │
        │ Test actual │
        │ upgrade in  │
        │ isolation   │
        └──────┬──────┘
               │
          ┌────┴────┐
          │         │
          ▼         ▼
       ┌──────┐  ┌────────┐
       │ SAFE │  │ RISKY  │
       └──┬───┘  └───┬────┘
          │          │
          │          ▼
          │    ┌──────────────┐
          │    │ IBM Bob 2.0  │
          │    │ Investigation│
          │    └──────┬───────┘
          │           │
          │      ┌────┴─────┐
          │      │          │
          │      ▼          ▼
          │   Analyze     Repair
          │      │          │
          │      └────┬─────┘
          │           │
          └─────┬─────┘
                ▼
        ┌─────────────┐
        │   VERIFY    │
        │             │
        │ Run tests   │
        │ and produce │
        │ evidence    │
        └──────┬──────┘
               │
               ▼
        ┌─────────────┐
        │ FINAL REPORT│
        │ + DASHBOARD │
        └─────────────┘