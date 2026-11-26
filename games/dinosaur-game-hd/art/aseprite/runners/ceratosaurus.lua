-- Ceratosaurus (GDD 7.1): red-orange, on Pao's T-Rex body. A cream horn on
-- the nose, dark bumps along the back and dark stripes on the body.
-- Letters: h light, S main, d dark, b belly, a stripes and bumps, c horn.
local L = ...

local palette = {
  h = '#DE7450', S = '#C4502E', d = '#8E3520', b = '#F0C9A0', a = '#6E2416',
  c = '#F0DDB8', w = '#FFF6E0', k = '#1B2340',
}

local head = {
  '............hhhhh..c..',
  '...........hhhhhhhhcc.',
}

local slideHead = {
  'h.................hhhhhh.c..',
  'hh.....a..a..a...hhhhhhhhcc.',
  '_______a___a___a____________',
}

-- Bumps just above the back's top edge, stripes across the body.
local function marks(rows, name, slide)
  if slide then return end
  for _, p in ipairs({ { 8, 9 }, { 10, 7 }, { 12, 5 }, { 10, 11 }, { 11, 11 }, { 13, 8 }, { 14, 8 } }) do
    L.set(rows, p[1], p[2], 'a')
  end
end

return {
  palette = palette,
  frames = L.theropod({ head = head, slideHead = slideHead, eye = { 13, 2 }, slideEye = { 20, 2 }, extra = marks }),
}
