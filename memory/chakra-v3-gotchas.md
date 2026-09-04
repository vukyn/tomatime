---
name: chakra-v3-gotchas
description: "Chakra UI v3 gotchas that fail silently: inline @keyframes dropped, off-scale tokens dropped, as=button rejects type, Dialog ghost restoreFocus, NativeSelect disabled must sit on Field.Root."
metadata:
  type: project
---

Several memories merged into one topic file to keep the index readable. Each section below is the original entry, unedited.

## chakra-v3-inline-keyframes-dropped

Chakra UI v3's style engine (NOT emotion) **silently drops `@keyframes` blocks nested inside the `css` prop**. So `css={{ animation: "foo 2s infinite", "@keyframes foo": {...} }}` registers NO keyframe → `animation` references an undefined name → element renders STATIC (no error, tsc/lint pass). Sibling of [[chakra-v3-gotchas]] (v3 silently drops things).

**Symptom:** an animation "shows but doesn't move/scroll/pulse." Bit rainy's marquee banner (showed static text, [[rainy-station-and-listener]]) + ListenEffectOverlay flash + DashboardRefresh spin/warnpulse — fixed rainy PR #181.

**Fix / convention:** define keyframes GLOBALLY in `ui/src/index.css` (where every WORKING rainy animation already lives — drift/modal-in/overlay-in/seek-flow/eq-bounce) and reference by name via `css={{ animation: "name ..." }}`. A real `<style>{`@keyframes ...`}</style>` DOM tag also works (WorkerStatusCard does this). Inline-in-css-prop does NOT.

**Spotting it:** `grep -rn '"@keyframes' ui/src/components ui/src/pages` — any hit is a likely-dead animation. Exclude `<style>` tags (those are fine).

## chakra-invalid-token-drop

Chakra UI v3's spacing/sizing scale only has these steps: 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96. Values like **13, 15, 4.5, 5.5, 6.5, 8.5, 12.5 are NOT tokens** — a prop like `w="13"`, `mb="5.5"`, `h="12.5"` resolves to nothing and is **silently dropped** (no error, no warning). The element then collapses to content size / loses its margin, and the layout drifts.

**Why this bit hard:** the isme SSO consent/login mocks were ported with `w="13"` tiles, `mb="5.5"` spacing, `h="12.5"` buttons. The code *looked* correct (values matched the mock px), but Chakra dropped them, so the medioa handshake tile collapsed to a ~24px circle (its 15px radius on a tiny box reads round), the isme `BrandMark` outer collapsed onto its 40px inner (conic ring → 0px → dark tile), and the scopes→button gap went to 0. Burned many review rounds blaming GPU/stale-build before finding it.

**How to apply:** for any non-scale value in Chakra v3 size/space props, use an **explicit px string** (`w="52px"`, `mb="22px"`, `h="50px"`) — not the bare number. Borders/radii written as `"15px"` already work because they carry a unit. When a ported screen "doesn't match the mock" and the numbers look right, suspect dropped tokens first. Quick audit: `grep -nE '"(13|15|4\.5|5\.5|6\.5|8\.5|12\.5)"' <file>`.

To verify React UI fidelity, render via headless Chrome and diff against the demo/ mock render (see [[isme-ui-serving]] for the embedded-build + restart gotcha and the Chrome screenshot command).

## chakra-as-button-type-prop

Chakra v3 polymorphic components (`<Center as="button">`, `<Box as="button">`) do NOT accept native DOM props — TS2322 "Property 'X' does not exist on type ...PolymorphicProps... Did you mean '_X'?". Hit on `type` (SSOConsent; RegisterAppServiceDialog + EditAppService, 4 spots) and on `disabled` (medioa2 BucketDetail perm-gated delete button — suggested `_disabled`).

**Why:** Coder ran `npx tsc --noEmit` and it PASSED, but `make build-web` (vite, runs `tsc -b` with project refs) FAILED on the same files. `tsc -b` is the source of truth for the embedded build — always run `make build-web` (or `tsc -b`) to validate UI, not just `tsc --noEmit`.

**How to apply:** When a Chakra `as="button"` needs button semantics, either (a) drop the native prop if redundant — `type="button"` is a no-op without an enclosing `<form>`; `disabled` is unneeded when the `onClick` is already guarded (`canX && ...`) and `opacity`/`cursor` convey the disabled state — or (b) use `Box/Center asChild` wrapping a native `<button>` (documented repo fix) when you genuinely need the DOM attr. Related: [[chakra-v3-gotchas]].

## chakra-dialog-ghost-restorefocus

Chakra v3 `Dialog.Root` (controlled `open`/`onOpenChange`): on close it restores focus to the element that opened it. If that trigger has disappeared/collapsed (e.g. an Edit `IconActionButton` inside a hover-revealed `.card-actions` overlay on a `role="button"` list card, hidden again once the mouse leaves), the `.focus()` restore stalls the dialog's exit transition → the modal stays **painted but closed**: `dialogState='closed'`, nothing `inert`, body pointer-events `auto`, yet the modal box is visible and unclickable and backdrop-click won't dismiss ("treo"). Page behind still scrolls (scroll-lock released = proof open already flipped false).

Diagnose live: in the stuck state run in console → `document.querySelector('[role=dialog]').getAttribute('data-state')`. `'closed'` + still rendered = this ghost.

Tell: SAME modal closes fine when opened from a STABLE trigger (e.g. a detail-page header button) but ghosts when opened from the list hover-card trigger. So the bug is the trigger context, not the modal.

Fixes (rainy used both): `restoreFocus={false}` on `Dialog.Root` (defensive), AND the real UX fix — removed Edit/Delete from Artists/Albums list cards entirely; actions live on detail pages with stable always-visible triggers (PR #34). Surfaced during [[rainy-fe-perm-gating]] work (the perm CTA gating put Edit in the hover overlay). Related Chakra gotchas: [[chakra-v3-gotchas]], [[chakra-v3-gotchas]].

## chakra-nativeselect-disabled-field-root

Chakra v3: for a `NativeSelect` **inside a `Field.Root`**, put `disabled` on the
**`Field.Root`**. `NativeSelect.Field` rejects it (TS2322), and on
`NativeSelect.Root` it is **silently dead** — no type error, no visual hint, the
select stays clickable.

```tsx
<Field.Root disabled={cond}>      {/* ✅ */}
  <NativeSelect.Root>            {/* ❌ disabled here does nothing in a Field */}
```

**Why:** `NativeSelectRoot` resolves it as
`Boolean(fieldContext?.disabled ?? props.disabled)`, and ark's `useField` always
supplies a boolean (`disabled = Boolean(fieldset?.disabled)`, default `false`), so
`??` never falls through. `Field.Root` feeds that same context, so it works (and
greys the label/helper too). **Outside** a `Field.Root` (bare `chakra.label`)
`NativeSelect.Root` DOES work — that is why two call sites in the same repo
disagree.

**How to apply:** grep `NativeSelect.Root disabled` when a select "won't disable".
Verify by RENDERING, not reading: `renderToString` the field and assert
`disabled` lands on the emitted `<select>` — the props alone tell you nothing.
Bundle a probe with `npx esbuild` from inside the `ui/` dir (module resolution)
and run it in node; Chakra needs `<ChakraProvider value={defaultSystem}>`.

Hit in gardener 2026-08 on all 4 selects of both entry forms (tree type +
growth stage) — the wrong placement had been documented as correct in its
CLAUDE.md, which is how it spread. Related: [[chakra-v3-gotchas]],
[[chakra-v3-gotchas]], [[chakra-v3-gotchas]].
