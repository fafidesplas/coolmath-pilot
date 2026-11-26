-- Parasaurolophus (GDD 7.1): teal, on Pao's T-Rex body. A long orange tube
-- crest swept back from the head (inside the 47 px height) and a broad cream
-- duck bill; it slides with the crest flat along its back.
-- Letters: h light, S main, d dark, b belly, a crest, A crest shade, c bill.
local L = ...

local palette = {
  h = '#4FB0A6', S = '#2F8F8A', d = '#1F6663', b = '#BFE3D2',
  a = '#F5A04A', A = '#C9682A', c = '#F4E3B5', w = '#FFF6E0', k = '#1B2340',
}

local head = {
  '..aaaaaaaa..hhhhh.....',
  '.aaaaaaaaaahhhhhhhh...',
  '..AAAAAAAAhSSSSSSSSS..',
  '..........hSSwwSSSSSS.',
  '...........SSwkSSSSSSc',
  '...........SSSSSSScccc',
  '...........dSSSSSkkkkk',
  '...........dSSSSSScccc',
}

local slideHead = {
  'h....aaaaaaaaaaa.hhhhhhh....',
  'hh..aaaaaaaaaaaahhhhhhhhhh..',
  'Shk..AAAAAAAAAAhhhSSwwSSSSS.',
  'dSSShSSSSSSSSSSSSSSSwkSSSScc',
  '.ddSSSSSSSSSSSSSSSSSSSSkkkkk',
  '..dddSSSSSSSSSSSSSSSSSSScccc',
}

return {
  palette = palette,
  frames = L.theropod({
    head = head, slideHead = slideHead,
    eye = { 13, 3 }, slideEye = { 20, 2 },
  }),
}
