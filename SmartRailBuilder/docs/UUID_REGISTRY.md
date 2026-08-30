# UUID Registry — Ryzen Rail Builder

Per Ryzen project convention: every UUID ever generated for this addon is logged here
the moment it's used, so it's never accidentally reused within this project. If you keep
a cross-project master registry for the other 14 Ryzen addons, copy these four rows into
it as well.

| UUID | Used For | File |
|---|---|---|
| `27195d03-43f3-479d-8548-9ff1c6464b88` | BP header | `BP/manifest.json` |
| `a3163b2c-46b4-4f88-8a3d-d6c4e2a5326b` | BP script module | `BP/manifest.json` |
| `fa25588d-d4e5-4b3f-acec-d3103b1799a9` | RP header (also referenced as BP's pack dependency) | `RP/manifest.json`, `BP/manifest.json` |
| `237e6561-9efc-4cf2-a14f-e37885e37835` | RP resources module | `RP/manifest.json` |

All four generated fresh this session (Python `uuid.uuid4()`), not reused from
RyzenVeinMiner, RyzenBackpacks, or RyzenMap+.
