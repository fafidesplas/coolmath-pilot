-- Buttons (GDD 8): 9-slice frames, 12×12 art px, drawn at any size in game
-- (corners fixed, edges and middle stretched; slice 'nine').
-- Tags: orange (Play, Retry, Rematch...), slate (the rest), gold (Fly);
-- each has a normal and a pressed frame. Pressed sinks 2 art px into its lip:
-- the label moves down with it.
-- Night Ink border with cut corners, a lit line under the top edge, a soft
-- shade row and a 2 px darker lip along the bottom, like the code-drawn box.
local L = ...
local NORMAL = {
  '.kkkkkkkkkk.',
  'kffffffffffk',
  'kfhhhhhhhhfk',
  'kffffffffffk',
  'kffffffffffk',
  'kffffffffffk',
  'kffffffffffk',
  'kffffffffffk',
  'kddddddddddk',
  'kllllllllllk',
  'kllllllllllk',
  '.kkkkkkkkkk.',
}
local PRESSED = {
  '............',
  '............',
  '.kkkkkkkkkk.',
  'klllllllllLk',
  'kffffffffffk',
  'kffffffffffk',
  'kffffffffffk',
  'kffffffffffk',
  'kffffffffffk',
  'kffffffffffk',
  'kddddddddddk',
  '.kkkkkkkkkk.',
}
local COLORS = {   -- fill, lit line, shade row, lip
  orange = { '#F08A24', '#F5B066', '#E07E1C', '#C46A12' },
  slate  = { '#5A6B7D', '#949CA0', '#526273', '#46546A' },
  gold   = { '#F5C542', '#F8D679', '#E8B838', '#C9932A' },
}
local palette, frames = { k = '#1B2340' }, {}
for _, name in ipairs({ 'orange', 'slate', 'gold' }) do
  local c, p = COLORS[name], name:sub(1, 1)
  palette[p .. 'f'], palette[p .. 'h'], palette[p .. 'd'], palette[p .. 'l'] = c[1], c[2], c[3], c[4]
  for _, rows in ipairs({ NORMAL, PRESSED }) do
    frames[#frames + 1] = { tag = name, draw = function(px)
      for y, r in ipairs(rows) do
        for x = 1, #r do
          local ch = r:sub(x, x)
          if ch == 'k' then px(x - 1, y - 1, 'k')
          elseif ch == 'L' then px(x - 1, y - 1, p .. 'l')
          elseif ch ~= '.' then px(x - 1, y - 1, p .. ch) end
        end
      end
    end }
  end
end
return {
  image = true, w = 12, h = 12, palette = palette, frames = frames,
  slices = { { name = 'nine', x = 0, y = 0, w = 12, h = 12, center = { x = 3, y = 4, w = 6, h = 4 } } },
}
