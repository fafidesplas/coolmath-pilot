-- T-Rex (GDD 7.1): the classic, in Dino Slate. Light from the top left:
-- h highlight, S main, d shadow and far leg, b belly, w cream, r mouth, k ink.
-- Standing grids are 22×23 (19 body rows + 4 leg rows); slide grids 28×10.
local L = ...

local palette = {
  h = '#7D8FA4', S = '#5A6B7D', d = '#414D61', b = '#A5B3C1',
  w = '#FFF6E0', r = '#A33B52', k = '#1B2340',
}

local BODY = {
  '............hhhhhhhh..',
  '...........hhhhhhhhhh.',
  '...........hSwwSSSSSSS',
  '...........SSwkSSSSSdS',
  '...........SSSSSSSSSSS',
  '...........SSSSSSSSSSS',
  '...........dSSSSSkkkkk',
  '...........dSSSSSSwdw.',
  '..........dSSSSSSdd...',
  'h........hSSSSSSSSd...',
  'Sh......hSSSSSSSdhSS..',
  'dSh....hSSSSSSSbbdSw..',
  'ddSh..hSSSSSSSbbb.....',
  '.ddSShSSSSShSbbbb.....',
  '..ddSSSSSShSSbbbb.....',
  '...dddSSShSSdbbb......',
  '....dddSSSSdbbb.......',
  '.....ddddSSSSS........',
  '......dddSSSSd........',
}

-- The tiny arm swings 1 px between the two halves of the run.
local ARM_BACK = function(rows)
  L.set(rows, 10, 16, 'dhS.')
  L.set(rows, 11, 15, 'bbdw..')
  return rows
end

-- Legs: d far (back) leg, h/S near (front) leg. The planted foot alternates
-- every frame like the original: front, back, front, back (FOOTFALL_X).
local LEGS = {
  stand = {
    '......dd...hS.........',
    '......dd...hS.........',
    '......dd...hS.........',
    '......ddd..hSS........',
  },
  jump = {   -- back foot tucked up
    '......dd...hS.........',
    '......dd...hS.........',
    '.....dd....hS.........',
    '...........hSS........',
  },
  run0 = {   -- front planted, back leg kicked high behind
    '......dd...hS.........',
    '.....ddd...hS.........',
    '...ddd.....hS.........',
    '...........hSS........',
  },
  run1 = {   -- back planted, front knee up and forward
    '......dd...hSS........',
    '......dd....hSS.......',
    '......dd..............',
    '......ddd.............',
  },
  run2 = {   -- front planted, back leg tucked under
    '......dd...hS.........',
    '.......dd..hS.........',
    '...........hS.........',
    '...........hSS........',
  },
  run3 = {   -- back planted, front leg swung back
    '......dd..hS..........',
    '......dd.hS...........',
    '......dd..............',
    '......ddd.............',
  },
}

local function face(rows, kind, ex, ey, mx, my)
  if kind == 'dizzy' then   -- X eyes and an open mouth
    L.set(rows, ey, ex, 'kSk')
    L.set(rows, ey + 1, ex, 'SkS')
    L.set(rows, ey + 2, ex, 'kSk')
    L.set(rows, my, mx, 'rrr')
  elseif kind == 'shut' then
    L.set(rows, ey, ex, 'SSS')
    L.set(rows, ey + 1, ex, 'kkS')
  end
  return rows
end

local function standing(legs, kind, armBack)
  local rows = L.concat(BODY, LEGS[legs])
  if armBack then ARM_BACK(rows) end
  if kind == 'dizzy' then
    face(rows, 'dizzy', 12, 2, 17, 7)
    L.set(rows, 2, 11, 'h')
  elseif kind == 'shut' then
    face(rows, 'shut', 13, 2)
  end
  return rows
end

-- Flat on the belly, head forward, legs laid back along the sand.
local SLIDE = {
  'h.................hhhhhhhh..',
  'hh...............hhhhhhhhhh.',
  'Sh...hhhhhhhhhhhhhSSwwSSSSSS',
  'dSSShSSSSSSSSSSSSSSSwkSSSSdS',
  '.ddSSSSSSSSSSSSSSSSSSSSSkkkk',
  '..dddSSSSSSSSSSSbbbbSSSSwdw.',
  '...ddddSSSSSSSSbbbbbdSSSSS..',
}
local SLIDE_LEGS = {
  {
    '....ddddSSSSSSSSbbbb.S.S....',
    '.dd..ddddddSSSSSSS..........',
    '.dhhhhhhSSSSSSS.............',
  },
  {
    '....ddddSSSSSSSSbbbb.S.S....',
    'dd...ddddddSSSSSSS..........',
    'dhhhhhhSSSSSSSS.............',
  },
}
local function sliding(i, kind)
  local rows = L.concat(SLIDE, SLIDE_LEGS[i])
  if kind == 'dizzy' then
    L.set(rows, 2, 19, 'kSk')
    L.set(rows, 3, 19, 'SkS')
    L.set(rows, 4, 19, 'kSk')
    L.set(rows, 5, 24, 'rrr')
  end
  return rows
end

return {
  palette = palette,
  frames = {
    { tag = 'run', rows = standing('run0') },
    { tag = 'run', rows = standing('run1', nil, true) },
    { tag = 'run', rows = standing('run2') },
    { tag = 'run', rows = standing('run3', nil, true) },
    { tag = 'jump', rows = standing('jump') },
    { tag = 'crash', rows = standing('stand', 'dizzy') },
    { tag = 'sleep', rows = standing('stand', 'shut'), fps = 1 },
    { tag = 'slide', slide = true, rows = sliding(1) },
    { tag = 'slide', slide = true, rows = sliding(2) },
    { tag = 'slideCrash', slide = true, rows = sliding(1, 'dizzy') },
  },
}
