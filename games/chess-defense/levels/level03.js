// DIAGONAL PINCER — Gambit Defense level (editor.html)
//
// Bishop-only board: four diagonal roads that refuse the straight X. Each lane
// steps in from its corner, peels out to an edge midpoint, rides three-quarters
// of the outer diamond, then cuts into the King. Every segment stays on a true
// 45° — no ranks, no files — so Couriers keep their `diag` tag and the whole map
// stays one color-lattice. The four routes share the diamond ring (the
// chokepoint) and only split again on the final approach.
addLevel({
    name:  "DIAGONAL PINCER",
    blurb: "Four bishop roads that swirl the diamond before they strike the King.",
    gridW: 15,
    gridH: 15,
    base:  [7, 7],
    hpMul: 1,
    pathRoutes: ["diag", "diag", "diag", "diag"],
    paths: [
        [[1, 1], [4, 4], [1, 7], [7, 13], [13, 7], [10, 4], [7, 7]],
        [[1, 13], [4, 10], [7, 13], [13, 7], [7, 1], [4, 4], [7, 7]],
        [[13, 13], [10, 10], [13, 7], [7, 1], [1, 7], [4, 10], [7, 7]],
        [[13, 1], [10, 4], [7, 1], [1, 7], [7, 13], [10, 10], [7, 7]],
    ],
});
