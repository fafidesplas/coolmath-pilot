-- Allosaurus (GDD 7.1, the 2P bonus): purple-gray, on Pao's T-Rex body, with
-- a red horn crest over the eye (its one clear head feature among the big
-- meat-eaters). Letters: h light, S main, d dark, b belly, a crest, A crest shade.
local L = ...

local palette = {
  h = '#9A8DAE', S = '#7D6F8F', d = '#5C5070', b = '#C9BFD6', a = '#D4574A', A = '#A33A30',
  w = '#FFF6E0', k = '#1B2340',
}

local head = {
  '............aaa.hhhh..',
  '...........hAAhhhhhhh.',
}

local slideHead = {
  'h..................aaa.hhh..',
  'hh...............hhAAhhhhhh.',
}

return {
  palette = palette,
  frames = L.theropod({ head = head, slideHead = slideHead, eye = { 13, 2 }, slideEye = { 20, 2 } }),
}
