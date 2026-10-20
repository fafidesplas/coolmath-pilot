// PINCER — Gambit Defense level (editor.html)
//
// The two routes are 180-degree rotations of each other and the same length,
// so neither side is the soft one. Each lane switchbacks on odd ranks only,
// leaving every even rank open to build on. They touch only on the King's
// square, the ranks either side of him stay clear (the middle is the one place
// a piece can cover both lanes at once), and neither route uses the outermost
// rank — pawns hit up-board, so a lane on the bottom row would have nothing
// beneath it to shoot from.
addLevel({
    name:  "PINCER",
    blurb: "Two lanes, north and south. Your King stands in the middle.",
    gridW: 15,
    gridH: 15,
    base:  [7, 7],
    hpMul: 1,
    paths: [
        [[1, 1], [1, 13], [3, 13], [3, 3], [5, 3], [5, 11], [7, 11], [7, 7]],
        [[13, 13], [13, 1], [11, 1], [11, 11], [9, 11], [9, 3], [7, 3], [7, 7]],
    ],
});
