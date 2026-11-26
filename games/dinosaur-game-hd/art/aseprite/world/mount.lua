-- Bonus flight mount (GDD 3.8), 23×20 art px, faces right: wings up, wings down.
-- Redrawn as its own sprite: teal, a lit wing edge H, an orange beak B and
-- a red saddle R with a cream trim; the runner sits on it.
local L = ...

local palette = {
  k = '#1B2340',
  c = '#FFF6E0',
  W = '#FFFFFF',
  P = '#3E8A9A',
  D = '#2C6474',
  H = '#5BAFBF',
  B = '#F08A24',
  R = '#C2463A',
  f = '#9ED3D6',
  w = '#FFF6E0',
}

return {
  palette = palette,
  simple = true,
  frames = {
    { tag = 'flap', rows = {
      '...........HH..........',
      '..........HDD..........',
      '.........HDDD..........',
      '........HDDDD..PP......',
      '.......HDDDDD.PPPP.....',
      '......HDDDDDD.PPPPP....',
      '.....HDDDDDDDPPPwwPP...',
      '....PPRRRRcPPPPPkwPPBBB',
      'PPPPPPPPPPPPPPPPPPPPBBB',
      'PPPPPffffffPPPPPPPPP...',
      '..PPPffffffPPP.........',
      '..PPPPPPPPPPP..........',
      '.......................',
      '.......................',
      '.......................',
      '.......................',
      '.......................',
      '.......................',
      '.......................',
      '.......................',
    } },
    { tag = 'flap', rows = {
      '.......................',
      '.......................',
      '.......................',
      '...............PP......',
      '..............PPPP.....',
      '..............PPPPP....',
      '.............PPPwwPP...',
      '....PPRRRRcPPPPPkwPPBBB',
      'PPPPPPPPPPPPPPPPPPPPBBB',
      'PPPPPffffffPPPPPPPPP...',
      '..PPPffffffPPP.........',
      '..PPPPPPPPPPP..........',
      '.....DDDDDDDD..........',
      '......DDDDDDD..........',
      '.......DDDDDD..........',
      '........DDDDD..........',
      '.........DDDD..........',
      '..........DDD..........',
      '...........DD..........',
      '.......................',
    } },
  },
}
