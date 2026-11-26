-- Icon glyphs (GDD 8), 12×12 art px each, drawn over a slate button frame
-- at the button's top left (arrows centered on their taller buttons).
-- Cream with a 1 px slate-lip drop shadow. Tags: pause, soundOn, soundOff,
-- prev, next.
local L = ...
local ICONS = {
  { 'pause', {
    '............',
    '............',
    '............',
    '...cc..cc...',
    '...cc..cc...',
    '...cc..cc...',
    '...cc..cc...',
    '...cc..cc...',
    '............',
    '............',
    '............',
    '............',
  } },
  { 'soundOn', {
    '............',
    '............',
    '....c.......',
    '...cc....c..',
    '..ccc..c.c..',
    '..ccc..c.c..',
    '..ccc..c.c..',
    '...cc....c..',
    '....c.......',
    '............',
    '............',
    '............',
  } },
  { 'soundOff', {
    '............',
    '............',
    '....c.......',
    '...cc.c..c..',
    '..ccc..cc...',
    '..ccc..cc...',
    '..ccc.c..c..',
    '...cc.......',
    '....c.......',
    '............',
    '............',
    '............',
  } },
  { 'prev', {
    '............',
    '............',
    '.......c....',
    '......cc....',
    '.....ccc....',
    '....cccc....',
    '.....ccc....',
    '......cc....',
    '.......c....',
    '............',
    '............',
    '............',
  } },
  { 'next', {
    '............',
    '............',
    '....c.......',
    '....cc......',
    '....ccc.....',
    '....cccc....',
    '....ccc.....',
    '....cc......',
    '....c.......',
    '............',
    '............',
    '............',
  } },
}
local frames = {}
for _, icon in ipairs(ICONS) do
  local rows = icon[2]
  local function on(x, y) local r = rows[y] return r and r:sub(x, x) == 'c' end
  frames[#frames + 1] = { tag = icon[1], draw = function(px)
    for y = 1, #rows do for x = 1, 12 do
      if on(x, y) then px(x - 1, y - 1, 'c')
      elseif on(x, y - 1) then px(x - 1, y - 1, 's') end
    end end
  end }
end
return { image = true, w = 12, h = 12, palette = { c = '#FFF6E0', s = '#3A4658' }, frames = frames }
