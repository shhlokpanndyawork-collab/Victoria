---
name: Monorepo Expo package install
description: The package-management callback targets the workspace root, while Expo dependencies belong to the individual mobile artifact.
---

Install Expo modules against the specific mobile artifact package rather than the workspace root.

**Why:** The workspace uses pnpm's root-package guard, so a generic package install can fail before changing anything even when the dependency is valid for the app.

**How to apply:** Use the artifact's workspace filter for the install, then run that artifact's typecheck before restarting its managed Expo workflow.