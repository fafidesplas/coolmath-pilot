-- Velociraptor (GDD 7.1): rust brown, a slim build of its own (Pao: skinnier).
-- A long, low snout with a long mouth line (no teeth), a dark feather tuft
-- behind the head, a thin neck, a slim body with a small belly, a stiff 2 px
-- tail with dark feather bands, longer clawed arms, a narrow thigh, and a
-- cream sickle claw raised over each planted foot. The legs below the thigh
-- are Pao's T-Rex run cycle (runners/base.lua), so the steps match the other
-- runners. Ducks low and flat. Same 22×23 / 28×10 grids as the other runners.
-- Letters: h light, S main, d dark, b belly, a feather bands, w cream, k ink.
local L = ...

local palette = {
  h = '#D27A48', S = '#B4552B', d = '#7E3A1F', b = '#EBC08E', a = '#5C2A16',
  w = '#FFF6E0', k = '#1B2340',
}

-- Head, neck, body, tail, arm and thigh: rows 0-18 of every standing frame.
local upper = {
  '............aa.hhhhh..',
  '............aahhhhhhhh',
  '.............ahSSSSSSS',
  '.............SSSSSSSSS',
  '.............SSSSkkkkk',
  '.............dSSSSSSS.',
  '............dSSSS.....',
  '............dSSS......',
  'h..........dSSS.......',
  'ah.........dSSS.......',
  'dSh.......hSSSSS......',
  '.daSh....hSSSSSSdS....',
  '...daSh.hSSSSSbbdSS...',
  '.....daShSSSSbbb.dk...',
  '.....dddSSSSbbb.......',
  '......ddSSSSbb........',
  '.......ddSSSd.........',
  '........ddSSd.........',
  '......dddSSd..........',
}

local slide = {
  'h..................a.hhhhhh.',
  'ah................aahhhhhhhh',
  'dSh..hhhhhhhhhhhhhhSSSSSSSSS',
  '.daShSSSSSSSSSSSSSSSSSSSkkkk',
  '...daSSSSSSSSSSSSSSSSSSSSSS.',
  '....ddaSSSSSbbbbbbSSddddddd.',
  '...ddddSSSSbbbbbbdd.........',
  '..kkddddddddddddd...........',
  '.ddkkddddddddd..............',
  '.dddddddddd.................',
}

local EYE, SLIDE_EYE = { 15, 2 }, { 21, 2 }

-- A sickle claw over the front end of each foot planted on the bottom row.
local function claws(rows)
  local last, above = rows[#rows], rows[#rows - 1]
  for x = 1, #last do
    local c, n = last:sub(x, x), last:sub(x + 1, x + 1)
    if c ~= '.' and (n == '.' or n == '') and above:sub(x, x) == '.' then
      L.set(rows, #rows - 2, x - 1, 'w')
    end
  end
end

local FRAMES = {
  { 'run0', 'run' }, { 'run1', 'run' }, { 'run2', 'run' }, { 'run3', 'run' },
  { 'jump', 'jump' }, { 'crash', 'crash', 'dizzy' }, { 'sleep', 'sleep', 'shut', 1 },
  { 'slide0', 'slide' }, { 'slide1', 'slide' }, { 'slideCrash', 'slideCrash', 'dizzy' },
}

local base = dofile(app.fs.joinPath(L.dir, 'runners', 'base.lua'))
local frames = {}
for _, f in ipairs(FRAMES) do
  local name, tag, kind, fps = f[1], f[2], f[3], f[4]
  local isSlide = tag:sub(1, 5) == 'slide'
  local rows
  if isSlide then
    rows = L.copy(slide)
    L.face(rows, kind, SLIDE_EYE[1], SLIDE_EYE[2])
  else
    rows = L.copy(upper)
    for y = #upper + 1, #base[name] do rows[y] = base[name][y] end
    L.face(rows, kind, EYE[1], EYE[2])
    claws(rows)
  end
  frames[#frames + 1] = { tag = tag, slide = isSlide, rows = rows, fps = fps }
end

return { palette = palette, frames = frames }
