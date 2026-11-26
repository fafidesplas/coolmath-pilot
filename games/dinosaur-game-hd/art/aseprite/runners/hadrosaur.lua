-- Hadrosaur (GDD 7.1): olive, on Pao's T-Rex body. A flat cream duck bill
-- and no crest (the Parasaurolophus has the crest); it slides bill first.
-- Letters: h light, S main, d dark, b belly, c bill.
local L = ...

local palette = {
  h = '#9AA852', S = '#7C8A3A', d = '#5A6629', b = '#EBDDB0', c = '#F4E3B5',
  w = '#FFF6E0', k = '#1B2340',
}

local head = {
  '............hhhhh.....',
  '...........hhhhhhhh...',
  '..........hSSSSSSSSS..',
  '..........hSSwwSSSSSS.',
  '...........SSwkSSSSSSc',
  '...........SSSSSSScccc',
  '...........dSSSSSkkkkk',
  '...........dSSSSSScccc',
}

local slideHead = {
  'h................hhhhhhh....',
  'hh..............hhhhhhhhhh..',
  'Shk..hhhhhhhhhhhhhSSwwSSSSS.',
  'dSSShSSSSSSSSSSSSSSSwkSSSScc',
  '.ddSSSSSSSSSSSSSSSSSSSSkkkkk',
  '..dddSSSSSSSSSSSSSSSSSSScccc',
}

return {
  palette = palette,
  frames = L.theropod({ head = head, slideHead = slideHead, eye = { 13, 3 }, slideEye = { 20, 2 } }),
}
