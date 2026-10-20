// Vertical Waves Test — Gambit Defense level (editor.html)
//
// Plays by the normal rules (gold, shop, build anywhere) for now, with the free
// pick after every wave that all boards get. The gold-free roguelike ruleset is
// parked, not removed — to bring it back, add these fields to the addLevel call
// below and see notes/vertical-waves-ideas.md:
//     draft: true,        // no gold; 5 picks at the start, 1 after every wave
//     buildRows: [7, 8],  // only these rows hold pieces
addLevel({
    name:  "Vertical Waves Test",
    blurb: "Five straight lanes, one King per lane.",
    gridW: 5,
    gridH: 10,
    bases: [[9, 4], [9, 3], [9, 2], [9, 1], [9, 0]],
    hpMul: 1,
    paths: [
        [[0, 0], [9, 0]],
        [[0, 1], [9, 1]],
        [[0, 2], [9, 2]],
        [[0, 3], [9, 3]],
        [[0, 4], [9, 4]],
    ],
});
