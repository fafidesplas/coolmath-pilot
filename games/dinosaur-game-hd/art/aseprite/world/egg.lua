-- Egg (GDD 3.7), 5×7 art px: plain, glinting.
-- Kept from the placeholder (5×7 is too small to add more): cream c,
-- orange speckles o, sand shade f, white glint W.
local L = ...

local palette = {
  k = '#1B2340',
  c = '#FFF6E0',
  W = '#FFFFFF',
  o = '#F08A24',
  f = '#F2C879',
}

return {
  palette = palette,
  simple = true,
  frames = {
    { tag = 'glint', rows = {
      '.ccc.',
      'ccccc',
      'cccoc',
      'ccccc',
      'coccc',
      'cccff',
      '.fff.',
    } },
    { tag = 'glint', rows = {
      '.ccc.',
      'cWccc',
      'cWcoc',
      'ccccc',
      'coccc',
      'cccff',
      '.fff.',
    } },
  },
}
