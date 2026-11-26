-- Spinosaurus (GDD 7.1, the completionist prize): deep blue, on Pao's T-Rex
-- body. A tall orange sail with dark spines rising from the back (inside the
-- 47 px height) and a long, low croc snout; the sail lies flat in the slide.
-- Letters: h light, S main, d dark, b belly, a sail, A spines.
local L = ...

local palette = {
  h = '#4A68AE', S = '#2E4A8F', d = '#22366A', b = '#A9BCE0', a = '#F08A3A', A = '#B85A24',
  w = '#FFF6E0', k = '#1B2340',
}

local head = {
  '............hhhhh.....',
  '.......A...hhhhhhh....',
  '....A..A..AhSwwSSShh..',
  '....A.aAa.ASSwkSSSSShh',
  '....AaaAaaASSSSSSSSSSS',
  '...aAaaAaaASSSSSSSSSdS',
  '...aAaaAaaAdSSSSkkkkkk',
  '...aAaaAaaAdSSSSSSSSSS',
  '...aAaaAaa____________',
  '___aAaaAa_____________',
  '____AaaA______________',
  '_____aa_______________',
}

local slideHead = {
  'h....aAaaAaaAaaA..hhhhhhhh..',
  'hh..aaAaaAaaAaaAahhhhhhhhhh.',
}

return {
  palette = palette,
  frames = L.theropod({ head = head, slideHead = slideHead, eye = { 13, 2 }, slideEye = { 20, 2 } }),
}
