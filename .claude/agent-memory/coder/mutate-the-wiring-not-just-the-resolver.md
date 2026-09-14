---
name: mutate-the-wiring-not-just-the-resolver
description: A test suite that always sets a config value explicitly cannot catch the mounted code bypassing the resolver — only an UNSET config distinguishes them
metadata:
  type: feedback
---

When a "safe default" resolver (`rateLimitMax(cfg)`, `corsAllowOrigins(cfg)`) sits
between config and a framework, test the **mounted** path with an **unset** config,
not just the resolver in isolation.

**Why:** measured on tomatime PR #22. The mutation "hand fiber `s.cfg.RateLimit.Max`
instead of `rateLimitMax(s.cfg)`" **passed the entire test suite**. Every limiter
integration test set `Max` explicitly, so raw and resolved were identical in all of
them; the unit test on `rateLimitMax` tested the function, not the wiring. Only an
unset config separates the two — and on unset, fiber silently substitutes its own
`Max` of 5, which looks exactly like a working limiter. Adding one test that drives
the mounted limiter with `new(config.Config)` made the mutation red.

**How to apply:** two habits, both cheap.

- For every resolver, write a pair: a unit test on the function, and an integration
  test through the mounted handler **with the config left empty**. Assert the
  framework's own default is not what you observe (`got == 5` → fail with "that is
  fiber's default leaking through, not a decision"), not merely that *something*
  happened.
- Extract the mounting into a named method (`apiGroup`, `corsMiddleware`,
  `fiberConfig`) so a test can exercise what the server actually mounts. A test that
  constructs the middleware itself stays green when `Start()` stops applying it —
  which is usually the finding, not a detail.

The general shape: **a mutation that survives is a hole in the tests, not a pass.**
Chase it until it goes red, then say in the report that the test was added because
the mutation escaped. Same lesson one layer up from
[[mutate-the-producer-not-just-the-logic]].

Related: [[feedback-prove-regression-tests]], [[fiber-ip-and-buffer-gotchas]]
(the ProxyHeader/EnableIPValidation pair needs two separate mutations for the same
reason — neither test fails if you only write the other).
