-- Large cactus (GDD 3.5), 12×25 art px over the 25×50 box.
-- Redrawn: the tested outline, reshaded, cream spine dots c and a pink
-- flower p on top.
local L = ...

local palette = {
  k = '#1B2340',
  c = '#FFF6E0',
  W = '#FFFFFF',
  g = '#3FA34D',
  l = '#6CC46F',
  G = '#2C7D3A',
  p = '#E86A92',
}

return {
  palette = palette,
  simple = true,
  frames = {
    { tag = 'idle', rows = {
      '.....pp.....',
      '....glgG....',
      '....glgG....',
      '....gcgG....',
      '....glgG..g.',
      '....glgG.lG.',
      'gg..glgG.lG.',
      'lG..glgG.lG.',
      'lG..glcG.lG.',
      'cG..glgG.cG.',
      'lG..glgG.lG.',
      'lG..glgGglG.',
      'lG..glgGggG.',
      'lGgggcgG....',
      'lgggglgG....',
      'lG..glgG.lG.',
      'cG..glgG.cG.',
      'lG..glgG.lG.',
      'lG..glcG.lG.',
      'lG..glgG.lG.',
      'lGg.glgG.lG.',
      'lGggglgGglG.',
      '.GggglgGggG.',
      '....glcG....',
      '....glgG....',
    } },
  },
}
