-- Body font (GDD 8, 9), "Jersey 25 (Pixel)": a hand-made pixel version
-- of Jersey 25 (SIL Open Font License 1.1, see art/fonts/OFL-Jersey25.txt), for
-- body and button text. Jersey 25 is a pixel font 25 dots tall; this redraws its
-- heavy square letters, cut corners and flat ends on the art grid at the 5x7
-- font's size: capitals 7 art px tall, 2 px stems, 1 px bars, mostly 5 px wide
-- (M, N, T, W, X, Y wider; I, 1 and punctuation narrower). Q and the comma use
-- the 8th row. Glyphs are left-aligned in a 7x8 cell; the advance is the glyph's
-- width plus 1. One white color; the game tints it. Capitals only.
-- Generated once by a script; edit this file or the .aseprite by hand.
local frames = {
  { tag = 'A', rows = { '.ccc...', 'cc.cc..', 'cc.cc..', 'ccccc..', 'cc.cc..', 'cc.cc..', 'cc.cc..', '.......' } },
  { tag = 'B', rows = { 'cccc...', 'cc.cc..', 'cc.cc..', 'cccc...', 'cc.cc..', 'cc.cc..', 'cccc...', '.......' } },
  { tag = 'C', rows = { '.cccc..', 'cc.....', 'cc.....', 'cc.....', 'cc.....', 'cc.....', '.cccc..', '.......' } },
  { tag = 'D', rows = { 'cccc...', 'cc.cc..', 'cc.cc..', 'cc.cc..', 'cc.cc..', 'cc.cc..', 'cccc...', '.......' } },
  { tag = 'E', rows = { 'ccccc..', 'cc.....', 'cc.....', 'cccc...', 'cc.....', 'cc.....', 'ccccc..', '.......' } },
  { tag = 'F', rows = { 'ccccc..', 'cc.....', 'cc.....', 'cccc...', 'cc.....', 'cc.....', 'cc.....', '.......' } },
  { tag = 'G', rows = { '.cccc..', 'cc.....', 'cc.....', 'cc.cc..', 'cc.cc..', 'cc.cc..', '.cccc..', '.......' } },
  { tag = 'H', rows = { 'cc.cc..', 'cc.cc..', 'cc.cc..', 'ccccc..', 'cc.cc..', 'cc.cc..', 'cc.cc..', '.......' } },
  { tag = 'I', rows = { 'cc.....', 'cc.....', 'cc.....', 'cc.....', 'cc.....', 'cc.....', 'cc.....', '.......' } },
  { tag = 'J', rows = { '...cc..', '...cc..', '...cc..', '...cc..', '...cc..', 'cc.cc..', '.ccc...', '.......' } },
  { tag = 'K', rows = { 'cc.cc..', 'cc.cc..', 'cccc...', 'ccc....', 'cccc...', 'cc.cc..', 'cc.cc..', '.......' } },
  { tag = 'L', rows = { 'cc.....', 'cc.....', 'cc.....', 'cc.....', 'cc.....', 'cc.....', 'ccccc..', '.......' } },
  { tag = 'M', rows = { 'cc...cc', 'ccc.ccc', 'ccccccc', 'cc.c.cc', 'cc...cc', 'cc...cc', 'cc...cc', '.......' } },
  { tag = 'N', rows = { 'cc..cc.', 'ccc.cc.', 'cccccc.', 'cc.ccc.', 'cc..cc.', 'cc..cc.', 'cc..cc.', '.......' } },
  { tag = 'O', rows = { '.ccc...', 'cc.cc..', 'cc.cc..', 'cc.cc..', 'cc.cc..', 'cc.cc..', '.ccc...', '.......' } },
  { tag = 'P', rows = { 'cccc...', 'cc.cc..', 'cc.cc..', 'cccc...', 'cc.....', 'cc.....', 'cc.....', '.......' } },
  { tag = 'Q', rows = { '.ccc...', 'cc.cc..', 'cc.cc..', 'cc.cc..', 'cc.cc..', 'cc.cc..', '.ccc...', '...cc..' } },
  { tag = 'R', rows = { 'cccc...', 'cc.cc..', 'cc.cc..', 'cccc...', 'cc.cc..', 'cc.cc..', 'cc.cc..', '.......' } },
  { tag = 'S', rows = { '.cccc..', 'cc.....', 'cc.....', '.ccc...', '...cc..', '...cc..', 'cccc...', '.......' } },
  { tag = 'T', rows = { 'cccccc.', '..cc...', '..cc...', '..cc...', '..cc...', '..cc...', '..cc...', '.......' } },
  { tag = 'U', rows = { 'cc.cc..', 'cc.cc..', 'cc.cc..', 'cc.cc..', 'cc.cc..', 'cc.cc..', '.ccc...', '.......' } },
  { tag = 'V', rows = { 'cc.cc..', 'cc.cc..', 'cc.cc..', 'cc.cc..', 'cc.cc..', '.ccc...', '..c....', '.......' } },
  { tag = 'W', rows = { 'cc...cc', 'cc...cc', 'cc...cc', 'cc.c.cc', 'ccccccc', 'ccc.ccc', '.c...c.', '.......' } },
  { tag = 'X', rows = { 'cc..cc.', 'cc..cc.', '.cccc..', '..cc...', '.cccc..', 'cc..cc.', 'cc..cc.', '.......' } },
  { tag = 'Y', rows = { 'cc..cc.', 'cc..cc.', '.cccc..', '..cc...', '..cc...', '..cc...', '..cc...', '.......' } },
  { tag = 'Z', rows = { 'ccccc..', '...cc..', '..ccc..', '.ccc...', 'ccc....', 'cc.....', 'ccccc..', '.......' } },
  { tag = '0', rows = { '.ccc...', 'cc.cc..', 'cc.cc..', 'cc.cc..', 'cc.cc..', 'cc.cc..', '.ccc...', '.......' } },
  { tag = '1', rows = { '.cc....', 'ccc....', '.cc....', '.cc....', '.cc....', '.cc....', '.cc....', '.......' } },
  { tag = '2', rows = { '.ccc...', 'cc.cc..', '...cc..', '..cc...', '.cc....', 'cc.....', 'ccccc..', '.......' } },
  { tag = '3', rows = { 'cccc...', '...cc..', '...cc..', '.ccc...', '...cc..', '...cc..', 'cccc...', '.......' } },
  { tag = '4', rows = { 'cc.cc..', 'cc.cc..', 'cc.cc..', 'ccccc..', '...cc..', '...cc..', '...cc..', '.......' } },
  { tag = '5', rows = { 'ccccc..', 'cc.....', 'cccc...', '...cc..', '...cc..', 'cc.cc..', '.ccc...', '.......' } },
  { tag = '6', rows = { '.ccc...', 'cc.....', 'cc.....', 'cccc...', 'cc.cc..', 'cc.cc..', '.ccc...', '.......' } },
  { tag = '7', rows = { 'ccccc..', '...cc..', '...cc..', '..cc...', '..cc...', '.cc....', '.cc....', '.......' } },
  { tag = '8', rows = { '.ccc...', 'cc.cc..', 'cc.cc..', '.ccc...', 'cc.cc..', 'cc.cc..', '.ccc...', '.......' } },
  { tag = '9', rows = { '.ccc...', 'cc.cc..', 'cc.cc..', '.cccc..', '...cc..', '...cc..', '.ccc...', '.......' } },
  { tag = 'dot', rows = { '.......', '.......', '.......', '.......', '.......', 'cc.....', 'cc.....', '.......' } },
  { tag = 'comma', rows = { '.......', '.......', '.......', '.......', '.......', 'cc.....', 'cc.....', 'c......' } },
  { tag = 'excl', rows = { 'cc.....', 'cc.....', 'cc.....', 'cc.....', '.......', 'cc.....', 'cc.....', '.......' } },
  { tag = 'quest', rows = { '.ccc...', 'cc.cc..', '...cc..', '..cc...', '.......', '..cc...', '..cc...', '.......' } },
  { tag = 'colon', rows = { '.......', 'cc.....', 'cc.....', '.......', 'cc.....', 'cc.....', '.......', '.......' } },
  { tag = 'dash', rows = { '.......', '.......', '.......', 'cccc...', '.......', '.......', '.......', '.......' } },
  { tag = 'slash', rows = { '...cc..', '...cc..', '..cc...', '..cc...', '.cc....', 'cc.....', 'cc.....', '.......' } },
  { tag = 'apos', rows = { 'cc.....', 'cc.....', '.c.....', '.......', '.......', '.......', '.......', '.......' } },
  { tag = 'plus', rows = { '.......', '..cc...', '..cc...', 'cccccc.', '..cc...', '..cc...', '.......', '.......' } },
  { tag = 'lparen', rows = { '.cc....', 'cc.....', 'cc.....', 'cc.....', 'cc.....', 'cc.....', '.cc....', '.......' } },
  { tag = 'rparen', rows = { 'cc.....', '.cc....', '.cc....', '.cc....', '.cc....', '.cc....', 'cc.....', '.......' } },
}
return { simple = true, outline = false, palette = { c = '#FFFFFF' }, frames = frames }
