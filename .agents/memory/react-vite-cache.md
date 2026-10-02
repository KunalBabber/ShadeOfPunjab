---
name: React/Vite cache mismatch
description: How to handle stale optimized React dependencies after changing workspace React versions.
---

If the browser reports mismatched React and React DOM versions but package resolution confirms they match, clear the affected artifact's local Vite dependency cache and restart its workflow before changing dependency versions again.

**Why:** after the workspace React versions were aligned, Vite still served stale optimized dependency output until its cache was cleared.

**How to apply:** check the installed versions first; if they agree, invalidate that artifact's `.vite` cache and restart the relevant workflow.