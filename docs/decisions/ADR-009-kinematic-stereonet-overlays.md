# ADR-009: Kinematic stereonet overlays

## Status

Accepted

## Context

Phase 2A.3 draws the planar sliding and direct toppling criteria on the Wulff
stereonet and colours plane poles by admissibility. Two sources of truth would
arise if a drawn zone could also classify a pole: the evaluators decide with
strict inequalities and an angular tolerance, while a polyline cannot reproduce
either exactly.

## Decision

1. **Classification authority.** `evaluatePlanarSliding` and
   `evaluateDirectToppling` are the only source of admissibility and rejection
   reasons. Overlays are visual aids. No code classifies a plane by
   point-in-polygon.
2. **Pole-space zones.** Zones are defined for plane poles on the lower-hemisphere
   Wulff net (ADR-008). A plane of dip `d` plots at radius `tan(d/2)`. The
   derivations are in `docs/science/kinematic-zones.md`.
3. **Package placement.**
   - `packages/geometry`: generic small-circle arcs and plunge/trend sector rings. No
     slope vocabulary.
   - `packages/kinematics`: `buildPlanarSlidingOverlay`,
     `buildDirectTopplingOverlay`, and the shared sector constants used by both the
     evaluators and the overlays.
   - `packages/ui`: renders pre-projected regions, curves, and a semantic pole
     `status`. It imports no kinematics or geological domain types.
   - `apps/web`: maps domain results to labels, status, and inspector fields in
     `src/lib/kinematic-view-model.ts`, and owns analysis state with `useState`.
4. **Open-set rendering.** Every boundary except the toppling rim is an exclusive
   limit of a strict inequality, so boundary curves are drawn dashed. Dip = 90° satisfies
   the toppling steepness condition, so the rim is the one closed boundary.
5. **Parameter validation.** Overlay builders throw `RangeError` for non-finite
   values, a friction angle outside `[0°, 90°)`, a slope dip outside `[0°, 90°]`,
   or a sector outside `(0°, 180°]`. The workspace validates input before calling
   them and keeps the last valid parameters while the user edits.
6. **Status encoding.** Admissible poles render as filled markers with a heavy
   outline and rejected poles as hollow markers, so status does not depend on hue.

## Consequences

- An overlay and an evaluator agree away from boundaries. A consistency test in
  `packages/kinematics/test/overlay.test.ts` sweeps dip direction and dip and
  compares zone membership with the evaluator verdict outside a stated angular
  margin. A pole within about 0.01° of a boundary can look inside the drawn zone and
  still be rejected; the evaluator verdict stands.
- Overlays are polyline approximations at 1° arc steps. Constant-trend edges are exact.
- Adding a rejection reason to the domain package fails typecheck in the view-model
  until a label exists.
- `apps/web` now depends on `@geokinematics/kinematics`.

## Status of related work

- **Planned** (code and tests exist in the working tree; becomes Implemented when
  committed): planar sliding and direct toppling overlays, pole status colouring,
  rejection reasons in the inspector.
- **Architectural Direction**: a wedge sliding overlay. It is not scheduled. The wedge
  evaluator compares the intersection-line plunge with the true slope dip. Comparing
  against the apparent dip of the face in the line's trend direction has been
  identified as a possible scientific discrepancy. This is unverified: the primary
  Hoek & Bray text has not been inspected, so the criterion is not attributed to it.
  A separate, reference-backed corrective phase must settle the criterion before a
  wedge overlay is built.
- **Architectural Direction**: flexural toppling.
