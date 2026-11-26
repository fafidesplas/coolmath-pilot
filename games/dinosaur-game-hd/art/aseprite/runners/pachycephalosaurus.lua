-- Pachycephalosaurus (GDD 7.1): dusty rose, on Pao's T-Rex body. A thick
-- cream bone dome ringed with dark knobs and a short beak; it slides with the
-- dome forward, like a ram.
-- Letters: h light, S main, d dark, b belly, a dome, A dome shade, n knobs.
local L = ...

local palette = {
  h = '#CC8597', S = '#B4677A', d = '#86475A', b = '#EBC3B5',
  a = '#F0DDB8', A = '#C9A77A', n = '#7A4A3A', w = '#FFF6E0', k = '#1B2340',
}

local head = {
  '............aaaaaa....',
  '...........aaaaaaaaa..',
  '..........naaaaaaAAAn.',
  '...........nSwwSSnSnSS',
  '...........SSwkSSSSSdS',
  '...........SSSSSSSSSSS',
  '...........dSSSSSSkkkk',
  '...........dSSSSSSSSS.',
}

local slideHead = {
  'h..................hhhaaaa..',
  'hh...............hhhhnaaaaa.',
  'Shk..hhhhhhhhhhhhhSwwSnaaAAA',
  'dSSShSSSSSSSSSSSSSSwkSnAAAAn',
  '.ddSSSSSSSSSSSSSSSSSSSSnSSkk',
}

return {
  palette = palette,
  frames = L.theropod({
    head = head, slideHead = slideHead,
    eye = { 13, 3 }, slideEye = { 19, 2 },
  }),
}
