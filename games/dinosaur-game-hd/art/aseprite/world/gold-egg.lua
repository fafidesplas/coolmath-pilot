-- Golden egg (GDD 3.7), 6×8 art px: plain, glinting.
-- Kept from the placeholder: gold y, dark gold Y, white glint W.
local L = ...

local palette = {
  k = '#1B2340',
  c = '#FFF6E0',
  W = '#FFFFFF',
  y = '#F5C542',
  Y = '#C9932A',
}

return {
  palette = palette,
  simple = true,
  frames = {
    { tag = 'glint', rows = {
      '..yy..',
      '.yyyy.',
      'yWyyyy',
      'yWyyyy',
      'yyyyyy',
      'yyyyYY',
      '.yyYY.',
      '..YY..',
    } },
    { tag = 'glint', rows = {
      '..yy..',
      '.WWyy.',
      'WWyyyy',
      'yWyyyy',
      'yyyyyy',
      'yyyyYY',
      '.yyYY.',
      '..YY..',
    } },
  },
}
