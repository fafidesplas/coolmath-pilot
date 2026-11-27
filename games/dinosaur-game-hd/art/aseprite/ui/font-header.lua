-- Header font (GDD 8, 9), "Rubik Dirt (Pixel)": a hand-made pixel version of Rubik Dirt
-- (SIL Open Font License 1.1, see art/fonts/OFL-RubikDirt.txt), for headers.
-- 12 art px tall, 3 px stems, Rubik's heavy rounded shapes redrawn on the art
-- grid; the dirt specks ('d') are sampled from the real font's texture, inside
-- the letters only. Egg Cream on top, warm cream below; the builder adds the
-- Night Ink outline. Glyphs are left-aligned in a 11×12 cell. Generated once
-- by a script from the glyph shapes; edit this file or the .aseprite by hand.
local frames = {
  { tag = 'A', rows = { '...ccc.....', '..ccccc....', '.ccc.ccc...', '.ccc.ccc...', 'cdc...cdc..', 'cdc...cdc..', 'ccccccdcc..', 'wwwwwwdww..', 'www...wdw..', 'www...wdw..', 'www...wdw..', 'www...www..' } },
  { tag = 'B', rows = { 'ccccccc....', 'ccdccccc...', 'ccc..ccc...', 'ccc..ccc...', 'ccc..ccc...', 'ccccccc....', 'cccccccc...', 'www..www...', 'www..www...', 'www..www...', 'wwwwwwww...', 'wwwwwww....' } },
  { tag = 'C', rows = { '..ccccc....', '.ccccccc...', 'cdc...cc...', 'ccc........', 'ccc........', 'ccc........', 'ccc........', 'www........', 'www........', 'www...ww...', '.wwwwwww...', '..wwwww....' } },
  { tag = 'D', rows = { 'cccccc.....', 'cddcccc....', 'cdc..ccc...', 'cdc..ccc...', 'cdc..ccc...', 'cdc..ccc...', 'ccc..ccc...', 'www..www...', 'www..www...', 'www..www...', 'wwwwwww....', 'wwwwww.....' } },
  { tag = 'E', rows = { 'ccccccc....', 'ccccccc....', 'ccc........', 'ccc........', 'ccc........', 'cdcccc.....', 'ccdccc.....', 'www........', 'www........', 'www........', 'wwwwwww....', 'wwwwwww....' } },
  { tag = 'F', rows = { 'ccccccc....', 'ccccccc....', 'ccc........', 'ccc........', 'cdc........', 'cdcccc.....', 'cccccc.....', 'www........', 'wdw........', 'www........', 'www........', 'www........' } },
  { tag = 'G', rows = { '..ccccc....', '.cdccccc...', 'ccc...cc...', 'ccc........', 'ccc........', 'ccc.cccc...', 'ccc.cccc...', 'www...ww...', 'www...ww...', 'www...ww...', '.wwwwwww...', '..wwwwww...' } },
  { tag = 'H', rows = { 'ccc..ccc...', 'ccc..ccc...', 'ccc..ccc...', 'ccc..ccc...', 'ccc..ccc...', 'cccccccc...', 'cccccccc...', 'www..wdw...', 'www..wdw...', 'www..wdw...', 'www..www...', 'www..www...' } },
  { tag = 'I', rows = { 'ccc........', 'ccc........', 'ccc........', 'cdc........', 'cdc........', 'ccc........', 'cdc........', 'wdw........', 'www........', 'wdw........', 'www........', 'www........' } },
  { tag = 'J', rows = { '....ccc....', '....ccc....', '....ccc....', '....ccc....', '....cdc....', '....cdc....', '....cdc....', '....wdw....', 'ww..wdw....', 'www.wdw....', '.wwwwww....', '..wwww.....' } },
  { tag = 'K', rows = { 'ccc..ccc...', 'ccc.cdc....', 'ccc.ccc....', 'cccccc.....', 'ccccc......', 'ccdc.......', 'ccccc......', 'wwdwww.....', 'www.wdw....', 'wdw.www....', 'www..www...', 'www..www...' } },
  { tag = 'L', rows = { 'ccc........', 'ccc........', 'ccc........', 'cdc........', 'cdc........', 'cdc........', 'cdc........', 'www........', 'wdw........', 'www........', 'wwwwwww....', 'wwwwwww....' } },
  { tag = 'M', rows = { 'cccc...cccc', 'ccccc.ccccc', 'ccccdcdcccc', 'ccc.cdc.ccc', 'ccc..c..ccc', 'ccc.....cdc', 'ccc.....cdc', 'www.....www', 'www.....www', 'www.....wdw', 'www.....wdw', 'www.....www' } },
  { tag = 'N', rows = { 'ccc...ccc..', 'cccc..ccc..', 'cccc..ccc..', 'ccccc.ccc..', 'ccccc.ccc..', 'ccc.ccccc..', 'ccc.cccdc..', 'www..wwdw..', 'www..wddw..', 'www...wdw..', 'www...www..', 'www...www..' } },
  { tag = 'O', rows = { '..cccc.....', '.cccccc....', 'ccc..ccc...', 'ccc..cdc...', 'ccc..ccc...', 'ccc..cdc...', 'ccc..cdc...', 'www..wdw...', 'www..wdw...', 'www..www...', '.wwwwww....', '..wwww.....' } },
  { tag = 'P', rows = { 'ccccccc....', 'cccccdcc...', 'ccc..cdc...', 'ccc..cdc...', 'ccc..cdc...', 'ccccccdc...', 'ccccccc....', 'www........', 'www........', 'www........', 'www........', 'www........' } },
  { tag = 'Q', rows = { '..cccc.....', '.cccccc....', 'ccc..ccc...', 'ccc..ccc...', 'ccc..ccc...', 'ccc..cdc...', 'ccc..ccc...', 'www..www...', 'www.wwdw...', 'www..www...', '.wwwwwww...', '..wwwwww...' } },
  { tag = 'R', rows = { 'ccccccc....', 'cccccccc...', 'ccc..ccc...', 'ccc..ccc...', 'ccc..ccc...', 'cccccccc...', 'ccccccc....', 'www.www....', 'www..www...', 'www..www...', 'www..www...', 'www..www...' } },
  { tag = 'S', rows = { '.cccccc....', 'cddcccdc...', 'ccc...cc...', 'cdc........', 'ccdc.......', '.ccdccc....', '..cccccc...', '.....www...', '.....www...', 'ww...www...', 'wwwwwwww...', '.wwwwww....' } },
  { tag = 'T', rows = { 'ccccccccc..', 'cccddcccc..', '...cdc.....', '...ccc.....', '...cdc.....', '...cdc.....', '...ccc.....', '...www.....', '...wdw.....', '...www.....', '...www.....', '...www.....' } },
  { tag = 'U', rows = { 'ccc..ccc...', 'ccc..ccc...', 'ccc..ccc...', 'ccc..cdc...', 'ccc..cdc...', 'ccc..cdc...', 'ccc..cdc...', 'www..wdw...', 'www..wdw...', 'www..wdw...', '.wwwwww....', '..wwww.....' } },
  { tag = 'V', rows = { 'ccc...ccc..', 'ccc...ccc..', 'ccc...ccc..', 'ccc...ccc..', 'ccc...ccc..', '.cdc.cdc...', '.ccc.ccc...', '.www.www...', '..wwwww....', '..wwwdw....', '...www.....', '...www.....' } },
  { tag = 'W', rows = { 'ccc.....ccc', 'cdc.....ccc', 'ccc.....ccc', 'cdc.....ccc', 'cdc.....ccc', 'ccc.....ccc', 'ccc..c..ccc', 'www.www.www', 'wwwwwwwwwww', 'wwwwwwwwwww', 'wwwww.wwwww', 'wwww...wwww' } },
  { tag = 'X', rows = { 'ccc...ccc..', 'ccc...ccc..', '.ccc.ccc...', '.ccc.ccc...', '..cdcdc....', '...ccc.....', '...ccc.....', '..wdwww....', '.wdw.www...', '.www.www...', 'www...www..', 'www...www..' } },
  { tag = 'Y', rows = { 'ccc...ccc..', 'ccc...cdc..', '.ccc.cdc...', '.ccc.cdc...', '..cdcdc....', '...cdc.....', '...cdc.....', '...www.....', '...www.....', '...www.....', '...www.....', '...www.....' } },
  { tag = 'Z', rows = { 'cccccccc...', 'cccccddc...', '.....cdc...', '....cdc....', '....ccc....', '...ccc.....', '..ccc......', '.www.......', '.www.......', 'www........', 'wwwwwwww...', 'wwwwwwww...' } },
  { tag = '0', rows = { '..cccc.....', '.cccccc....', 'cdc..ccc...', 'ccc..ccc...', 'ccc.cccc...', 'ccc.cccc...', 'cccc.ccc...', 'wwww.www...', 'wdw..www...', 'www..www...', '.wwwwww....', '..wwww.....' } },
  { tag = '1', rows = { '..ccc......', '.cccc......', 'cccdc......', '..ccc......', '..cdc......', '..cdc......', '..cdc......', '..wdw......', '..wdw......', '..wdw......', '..wdw......', '..www......' } },
  { tag = '2', rows = { '.cccccc....', 'ccdccddc...', 'ccc..cdc...', '.....cdc...', '....cddc...', '...ccdc....', '..cccc.....', '.wwww......', 'wwww.......', 'www........', 'wwwwwwww...', 'wwwwwwww...' } },
  { tag = '3', rows = { '.cccccc....', 'cccccccc...', 'ccc..ccc...', '.....ccc...', '.....cdc...', '..cccdc....', '..ccccdc...', '.....www...', '.....www...', 'www..www...', 'wwwwwwww...', '.wwwwww....' } },
  { tag = '4', rows = { '....cccc...', '...cddcc...', '..cdcddc...', '.ccc.cdc...', 'ccc..cdc...', 'ccc..cdc...', 'ccccccdc...', 'wwwwwwdw...', '.....www...', '.....www...', '.....wdw...', '.....www...' } },
  { tag = '5', rows = { 'cccccccc...', 'cccccccc...', 'ccc........', 'ccc........', 'ccccccc....', 'cccccdcc...', '.....cdc...', '.....wdw...', '.....wdw...', 'www..wdw...', 'wwwwwwdw...', '.wwwwww....' } },
  { tag = '6', rows = { '.cccccc....', 'cddcccdc...', 'cdc..ccc...', 'cdc........', 'ccccccc....', 'ccccccdc...', 'ccc..ccc...', 'www..www...', 'www..www...', 'www..www...', 'wwwwwwww...', '.wwwwww....' } },
  { tag = '7', rows = { 'cccccccc...', 'cccccccc...', '.....ccc...', '....ccc....', '....ccc....', '...ccc.....', '...ccc.....', '..www......', '..www......', '..www......', '..www......', '..www......' } },
  { tag = '8', rows = { '.cccccc....', 'cccccccc...', 'ccc..ccc...', 'cdc..ccc...', 'cdc..ccc...', '.cdcccc....', 'cccccccc...', 'www..www...', 'www..www...', 'www..www...', 'wwwwwwww...', '.wwwwww....' } },
  { tag = '9', rows = { '.cccccc....', 'cccccdcc...', 'ccc..cdc...', 'ccc..cdc...', 'cdc..ccc...', 'cccccddc...', '.ccccddc...', '.....www...', '.....wdw...', 'www..wdw...', 'wdwwwddw...', '.wwwwww....' } },
  { tag = 'excl', rows = { 'ccc........', 'ccc........', 'ccc........', 'ccc........', 'ccc........', 'ccc........', 'ccc........', 'wdw........', 'www........', '...........', 'www........', 'www........' } },
  { tag = 'quest', rows = { '.cccccc....', 'cccccccc...', 'ccc..ccc...', '.....ccc...', '....ccdc...', '...cccc....', '...ccc.....', '...www.....', '...........', '...........', '...www.....', '...www.....' } },
  { tag = 'dash', rows = { '...........', '...........', '...........', '...........', '...........', 'ccccc......', 'ccccc......', '...........', '...........', '...........', '...........', '...........' } },
  { tag = 'apos', rows = { 'ccc........', 'cdc........', 'cdc........', 'ccc........', '...........', '...........', '...........', '...........', '...........', '...........', '...........', '...........' } },
  { tag = 'dot', rows = { '...........', '...........', '...........', '...........', '...........', '...........', '...........', '...........', '...........', '...........', 'www........', 'www........' } },
}
return { simple = true, palette = { c = '#FFF6E0', w = '#F8DDA4', d = '#E2B66E' }, frames = frames }
