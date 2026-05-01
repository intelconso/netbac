---
name: Use TDD approach for new logic
description: User wants test-driven development going forward — write the test first, then the implementation, on this NETBAC project.
type: feedback
originSessionId: d084c3ec-94ba-4073-91c4-19467e09f048
---
User has asked for a TDD approach going forward in NETBAC.

**Why:** They observed that I shipped fixes (notably the `switchStoreToUser` persistence-key bug, the duplicate-product-prevention in `handleBacSelect`, the deleted-zone-reappearing bug) without tests. They want regression coverage to grow as features land.

**How to apply:**
- Before adding non-trivial business logic (store mutations, persistence flow, validation, date math, sync logic), write the failing Jest test first under `__tests__/`, then implement until it passes.
- For pure UI tweaks (layout, copy, color, button placement, route paths), tests are still low-ROI — skip unless the user asks. State this explicitly so they can override.
- The repo has Jest 29 + AsyncStorage mock + `jest.setup.js` already wired. Use it; don't bolt on new test infra.
- Run `npx jest <file>` after writing to confirm it actually fails before the fix and passes after.
- When fixing a bug, write a regression test that would have caught it FIRST — that bug-then-test pairing is the strongest TDD signal.
