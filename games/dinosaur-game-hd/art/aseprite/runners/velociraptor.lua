-- Velociraptor (GDD 7.1): rust brown, on Pao's T-Rex body. A dark feather
-- tuft behind the head, a long flat snout (no teeth, a long mouth line), the
-- same rising tail as the T-Rex with dark feather bands, longer clawed arms and a cream
-- sickle claw raised over each planted foot. Ducks low and flat.
-- Letters: h light, S main, d dark, b belly, a feather bands, w cream.
local L = ...

local palette = {
  h = '#D27A48', S = '#B4552B', d = '#7E3A1F', b = '#EBC08E', a = '#5C2A16',
  w = '#FFF6E0', k = '#1B2340',
}

local head = {
  '..........aa.hhhhh....',
  '..........aahhhhhhhhh.',
  '...........ahwwSSSSSSS',
  '...........aSwkSSSSSSS',
  '...........SSSSSSSSSdS',
  '...........SSSSSkkkkkk',
  '...........dSSSSSSSSS.',
  '...........dSSSSSSS...',
  '..........dSSSSSS.....',
  '______________________',
  '______________________',
  '_a____________________',
  '__a______________dS___',
  '___a______________w___',
}

local slideHead = {
  '________________a.hhhhhhhh..',
  '_______________aahhhhhhhhhh.',
  '_______a__________SSwwSSSSSS',
  '_____a_a____________wkSSSSSS',
  '_____a_________________kkkkk',
}

-- A sickle claw over the front end of each foot planted on the bottom row.
local function claws(rows, name, slide)
  if slide then return end
  local last, above = rows[#rows], rows[#rows - 1]
  for x = 1, #last do
    local c, n = last:sub(x, x), last:sub(x + 1, x + 1)
    if c ~= '.' and (n == '.' or n == '') and above:sub(x, x) == '.' then
      L.set(rows, #rows - 2, x - 1, 'w')
    end
  end
end

return {
  palette = palette,
  frames = L.theropod({
    head = head, slideHead = slideHead,
    eye = { 13, 2 }, slideEye = { 20, 2 },
    extra = claws,
  }),
}
