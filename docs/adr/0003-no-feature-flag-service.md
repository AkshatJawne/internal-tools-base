# 0003 — Do not build a feature-flag service
**Status:** accepted

**Context.** The third Power App is a feature-flag admin panel. Flags need SDKs in every service, targeting, kill switches and streaming propagation.

**Decision.** The `flags` app in this repo is a thin admin over a flag vendor's API and exists to demonstrate the engine. The real product reads from LaunchDarkly / Unleash / Flagsmith. We will not build evaluation, SDKs or streaming.

**Alternatives rejected.** Rebuilding flags in the kit (undifferentiated, high blast radius, every debate perspective agreed).

**Consequences.** Production flag changes still get maker-checker and audit here, because the approval is the part the vendor does not give us.
