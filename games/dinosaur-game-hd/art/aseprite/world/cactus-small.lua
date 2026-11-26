-- Small cactus (GDD 3.5), 8×18 art px over the 17×35 box.
-- Redrawn: a two-armed saguaro with l light / g main / G shade ribs and
-- cream spine dots c.
local L = ...

local palette = {
  k = '#1B2340',
  c = '#FFF6E0',
  W = '#FFFFFF',
  g = '#3FA34D',
  l = '#6CC46F',
  G = '#2C7D3A',
}

return {
  palette = palette,
  simple = true,
  frames = {
    { tag = 'idle', rows = {
      '..lgg...',
      '..lgG...',
      '..lgG.lg',
      '..lcG.lG',
      '..lgG.cG',
      'lglgG.lG',
      'lGlgG.lG',
      'cGlgGggG',
      'lGlcG...',
      'lGlgG...',
      'gglgG...',
      '..lgG...',
      '..lgG...',
      '..lcG...',
      '..lgG...',
      '..lgG...',
      '..lgG...',
      '..lgG...',
    } },
  },
}
