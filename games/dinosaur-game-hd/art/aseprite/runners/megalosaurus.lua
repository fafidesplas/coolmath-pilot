-- Megalosaurus (GDD 7.1): the first dinosaur ever named, a plain heavy
-- meat-eater in brown with a cream belly, on Pao's T-Rex body. A deeper jaw
-- and a dark stripe from behind the eye down the back.
-- Letters: h light, S main, d dark, b belly, a stripe.
local L = ...

local palette = {
  h = '#967352', S = '#7A5A3A', d = '#5A4029', b = '#E8D2A8', a = '#3E2A1A',
  w = '#FFF6E0', k = '#1B2340',
}

local head = {
  '______________________',
  '______________________',
  '______________________',
  '______________________',
  '___________a__________',
  '___________a__________',
  '___________a__________',
  '___________aSSSSSSSSSS',
}

local slideHead = {
  '____________________________',
  '____________________________',
  '____________________________',
  '______aaaaaaaaaaaaaa________',
  '_______aaaaaaaaaaaa_________',
}

local function stripe(rows, name, slide)
  if slide then return end
  for _, p in ipairs({ { 8, 10 }, { 9, 10 }, { 10, 9 }, { 11, 8 }, { 12, 7 }, { 13, 6 },
                       { 8, 11 }, { 9, 11 }, { 10, 10 }, { 11, 9 }, { 12, 8 }, { 13, 7 }, { 14, 6 } }) do
    L.set(rows, p[1], p[2], 'a')
  end
end

return {
  palette = palette,
  frames = L.theropod({ head = head, slideHead = slideHead, eye = { 13, 2 }, slideEye = { 20, 2 }, extra = stripe }),
}
