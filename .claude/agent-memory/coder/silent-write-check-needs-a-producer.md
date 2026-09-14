---
name: silent-write-check-needs-a-producer
description: "A 'read the column after a write' check proves nothing if nothing populates the value; and a wrong-package mutant that fails to build is a `go mod tidy` away from compiling silently"
metadata:
  type: feedback
---

A verification step of the form "POST a row, then `select created_by`" is
**vacuous unless something actually sets the value**. Prove the producer exists
before trusting the check.

**Why:** a plan's step to prove a `kuery/ctx` → `kuery/ctxv3` swap (the two
declare separate `ContextKey` types, so a value stored under one is invisible to
the other) said to POST and read `created_by`. The scaffolded service ships **no
auth middleware**, so nothing ever calls `SetUserIDToFiberCtx` — the column was
NULL under the correct package *and* the wrong one. The check would have passed
identically on a broken build. Adding a probe middleware that sets a user id
made it real: correct package → `'probe-user'`, wrong package → NULL.

**Companion trap, same session:** the first negative control (flip the import to
the v2 package) **failed to compile** — `missing go.sum entry for fiber/v2` —
because module-graph pruning had kept fiber v2 out of a v3-only `go.mod`. That
looks like "the compiler protects us", and it is a false comfort: one
`go mod tidy` — which is exactly what a developer runs when the build complains —
adds the dependency, after which the wrong code builds, vets and tests fully
green while writing NULL forever. Per [[feedback-prove-regression-tests]] and
[[mutate-the-producer-not-just-the-logic]], a mutant that does not compile proves
nothing; re-cut it along the path a real developer would take.

Useful side effect worth reusing: when a module line is absent *because* of
pruning, its sudden appearance as `// indirect` is a **tripwire** for the wrong
import. Say so in the `go.mod` comment rather than leaving it to look like noise.

**How to apply:** before running any "check the stored value" verification, ask
what writes that value on this code path. If the answer is "nothing, in the
shipped configuration", the check is decorative — inject the producer, and run
the negative control to watch it go NULL.
