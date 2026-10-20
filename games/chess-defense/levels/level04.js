// THE WARD LAB — Gambit Defense level (editor.html)
//
// Test board: `wardsOnly` swaps the wave table for WARD_WAVES, which sends
// nothing but Alabaster and Obsidian. One lane, inset one square from every
// edge so pawns (which only hit up-board) have a rank to stand on below every
// stretch of it, and so both square colors have open squares on both sides.
addLevel({
    name:  "THE WARD LAB",
    blurb: "Test board: Alabaster and Obsidian only, nothing else.",
    gridW: 11,
    gridH: 11,
    base:  [9, 5],
    hpMul: 1,
    wardsOnly: true,
    paths: [
        [[1, 1], [1, 9], [5, 9], [5, 1], [9, 1], [9, 5]],
    ],
});
