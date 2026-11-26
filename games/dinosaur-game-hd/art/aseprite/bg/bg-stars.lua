-- Stars (GDD 3.6), a 320×100 art px tile over the night sky: dim dots,
-- bright dots and a few little crosses with a white heart.
local L = ...
local W, H = 320, 100
return {
  image = true, w = W, h = H,
  palette = { d = '#8E8C9E', m = '#C9C3BC', c = '#FFF6E0', W = '#FFFFFF' },
  frames = { { tag = 'idle', draw = function(px)
    local r = L.rand(7)
    for i = 0, 89 do
      local x, y = math.floor(r() * W), 2 + math.floor(r() * (H - 4))
      if i % 11 == 0 then        -- a cross
        px(x - 1, y, 'c'); px(x + 1, y, 'c'); px(x, y - 1, 'c'); px(x, y + 1, 'c'); px(x, y, 'W')
      elseif i % 4 == 0 then px(x, y, 'c')
      elseif i % 3 == 0 then px(x, y, 'm')
      else px(x, y, 'd') end
    end
  end } },
}
