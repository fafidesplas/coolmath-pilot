// NEW BOARD — Gambit Defense level (editor.html)
addLevel({
    name:  "NEW BOARD",
    blurb: "Describe the board in one line.",
    gridW: 10,
    gridH: 10,
    base:  [9, 5],
    hpMul: 1,
    paths: [
        [[2, 1], [2, 9], [5, 9], [5, 5], [9, 5]],
    ],
    blocked: [[5, 1]],
    walls:   [[1, 1], [4, 1], [4, 2], [4, 3], [4, 4], [4, 5], [4, 6], [4, 7], [4, 8]],
});
