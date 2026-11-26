-- Therizinosaurus (GDD 7.1): fluffy pale gold, on Pao's T-Rex body. Giant
-- cream scythe claws hang from the arm (inside the front of the box) and
-- fold away in the slide; feather tips along the back.
-- Letters: h light, S main, d dark, b belly, a feather tips, w claws.
local L = ...

local palette = {
  h = '#E6C873', S = '#D2AE52', d = '#A08036', b = '#F3E3B0', a = '#B08A3A',
  w = '#FFF6E0', k = '#1B2340',
}

local slideHead = {
  '____________________________',
  '____________________________',
  '______a_a_a_a_a_a___________',
}

local function claws(rows, name, slide)
  if slide then return end
  -- Two solid hooked blades (4-connected, so each gets one clean outline).
  for _, p in ipairs({ { 12, 18 }, { 13, 18 }, { 14, 18 }, { 14, 19 },
                       { 12, 20 }, { 13, 20 }, { 14, 20 }, { 14, 21 },
                       { 9, 9 }, { 11, 7 }, { 13, 5 }, { 8, 11 } }) do
    L.set(rows, p[1], p[2], p[2] >= 18 and 'w' or 'a')
  end
end

return {
  palette = palette,
  frames = L.theropod({ head = {}, slideHead = slideHead, eye = { 13, 2 }, slideEye = { 20, 2 }, extra = claws }),
}
