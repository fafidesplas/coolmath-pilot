-- Dunes (GDD 3.6), a 320×25 art px tile resting on the ground line (0.2×
-- parallax): a lit crest, slopes facing away from the sun in shade, and
-- dashed wind ripples. The curve repeats every 320 art px.
local L = ...
local W, H = 320, 25
local function height(x)
  return math.floor(10 + 4.5 * math.sin(x / W * math.pi * 6) + 3 * math.sin(x / W * math.pi * 10 + 1) + 0.5)
end
return {
  image = true, w = W, h = H,
  palette = { c = '#F6D592', b = '#EDBE6E', s = '#E3AE5E', r = '#E6B465' },
  frames = { { tag = 'idle', draw = function(px)
    for x = 0, W - 1 do
      local h = height(x)
      local top = H - h
      local away = height(x + 1) > h or height(x + 2) > h   -- rising to the right: faces left, away from the sun
      for y = top, H - 1 do
        local d = y - top   -- depth below the crest
        local k = 'b'
        if d == 0 then k = away and 'b' or 'c'
        elseif away and d <= 3 then k = (d == 3 and (x + y) % 2 == 0) and 'b' or 's'
        elseif d >= 3 and (y + math.floor(x / 9)) % 6 == 0 and x % 7 ~= 0 then k = 'r' end
        px(x, y, k)
      end
    end
  end } },
}
