# Kinematic zones in pole space

This note derives the stereonet zones drawn by `packages/kinematics`
(`buildPlanarSlidingOverlay`, `buildDirectTopplingOverlay`). It records how each
zone follows from the evaluator conditions. The evaluators remain the authority for
classification (ADR-009).

Notation: `αs` slope dip direction, `ψf` slope dip, `φ` friction angle, `αd` and
`d` discontinuity dip direction and dip. All angles are decimal degrees. Boundary
conditions are strict inequalities.

## Plotting convention

Poles are plotted on the lower hemisphere of the Wulff (equal-angle) net (ADR-008).

- Pole plunge = 90° − `d`.
- Pole trend = `αd` + 180°.
- On the equal-angle net a line of plunge `p` lies at radius `tan(45° − p/2)`, so a
  plane of dip `d` has its pole at

  `r(d) = tan(d / 2)`

- Circles of constant dip are circles centred on the net centre. Lines of constant
  trend are straight radial lines.

## Planar sliding (Markland; Hoek & Bray §5)

Conditions implemented by `evaluatePlanarSliding`:

| Condition                            | Pole-space boundary                               |
| ------------------------------------ | ------------------------------------------------- |
| `d < ψf` (daylight)                  | circle `r = tan(ψf/2)`; admissible side is inside |
| `d > φ` (friction)                   | circle `r = tan(φ/2)`; admissible side is outside |
| `\|αd − αs\| < sector` (default 20°) | pole trend within ±sector of `αs + 180°`          |

Admissible poles form the annular sector `tan(φ/2) < r < tan(ψf/2)` centred on pole
trend `αs + 180°`.

- The zone is empty when `ψf ≤ φ`.
- When `φ = 0` the inner radius is zero and the zone reaches the net centre.
- When the sector half-width is 180° the zone is a full annulus.

## Direct toppling (Goodman & Bray, as implemented)

Conditions implemented by `evaluateDirectToppling`:

- `d > 90° − ψf + φ` (steepness). In pole space this is the region outside the
  circle `r = tan((90° − ψf + φ)/2)`, out to the rim `r = 1`.
- `|αd − (αs + 180°)| < 20°`. The pole trend is `αd + 180°`, so the admissible pole
  trend lies within ±20° of `αs` (not `αs + 180°`).

The zone is empty when `ψf ≤ φ`. The rim is part of the zone: a vertical plane
(`d = 90°`) satisfies the steepness condition when `ψf > φ`.

## What the overlay does not do

- **Classification.** The drawn zone never decides whether a plane is admissible.
- **Wedge sliding.** The wedge criterion acts on intersection lines, not poles, and no
  wedge overlay exists. The current wedge evaluator tests the intersection-line plunge
  against the true slope dip. An apparent-dip interpretation, in which the plunge is
  compared with the dip of the slope face measured along the line's trend,
  `tan ψapp = tan ψf · cos(αL − αs)`, has been identified as a possible scientific
  discrepancy. The two differ whenever `αL ≠ αs`. This is unverified: the primary
  Hoek & Bray text has not been inspected, so the requirement is not attributed to it.
  Resolving it needs a separate, reference-backed corrective phase for the Phase 2A.2
  evaluator. It is not an overlay issue.
- **Flexural toppling.** It needs layer thickness and spacing, which the domain does not model.

## Numerical notes

- Arcs are sampled at 1° steps (`OVERLAY_ARC_STEP_DEG`). Chord sagitta is about
  4 × 10⁻⁵ of the arc radius.
- A pole within about 0.01° of a boundary can fall on either side of the drawn
  polygon. The evaluator verdict takes precedence.

## Evaluator tolerance

`KINEMATIC_ANGULAR_TOLERANCE` is 1 × 10⁻⁶ degrees (`packages/geometry/src/tolerance.ts`).
The evaluators apply it on the inadmissible side of each strict boundary:

- Daylight, friction, and steepness conditions compute an angular excess (for example
  `d − φ`) and reject when `excess ≤ tolerance`. A plane is admissible only when the
  excess is greater than 10⁻⁶°.
- The dip-direction sector test accepts a plane only when the angular difference is
  less than `sector − tolerance`, so the effective half-width is 10⁻⁶° narrower than
  the nominal sector (20° by default).

The mathematical admissibility region is the open set defined by the strict
inequalities in the sections above. The evaluator's admissible set is that region
shrunk by 10⁻⁶° at each tolerance-guarded boundary. The tolerance keeps a plane
that lies on a boundary up to floating-point error from being classified as
admissible, and it is not an engineering tolerance. The toppling rim is affected
as well: a vertical plane is admissible only when `ψf − φ > 10⁻⁶°`.

The overlay draws the open set from the nominal boundary values and does not include
the tolerance. A band 10⁻⁶° wide is far below one pixel at any practical net
size, so the drawing cannot show it. Overlay and evaluator agree away from
boundaries. They are not exactly equivalent within 10⁻⁶° of a boundary, and the
evaluator verdict stands there.
