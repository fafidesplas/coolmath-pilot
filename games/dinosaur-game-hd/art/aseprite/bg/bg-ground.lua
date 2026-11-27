-- Ground (GDD 3.6), a 320×55 art px tile from the ground line down (1×
-- parallax): a dark ground line with bumps, then clean sand
-- with light specks and short wind streaks (no dark pebbles).
local L = ...
local W, H = 320, 55
return {
  image = true, w = W, h = H,
  palette = { S = '#F2C879', D = '#B07A3A', m = '#D7A458', l = '#FBDDA0' },
  frames = { { tag = 'idle', draw = function(px)
    local r = L.rand(11)
    for y = 0, H - 1 do for x = 0, W - 1 do px(x, y, 'S') end end
    for x = 0, W - 1 do px(x, 0, 'D'); px(x, 1, 'm') end
    for i = 1, 14 do                         -- bumps on the ground line
      local x = math.floor(r() * W)
      px(x, 1, 'D'); if i % 2 == 0 then px(x + 1, 1, 'D') end
    end
    for i = 1, 26 do                         -- wind streaks
      local x, y, w = math.floor(r() * W), 4 + math.floor(r() * (H - 6)), 3 + math.floor(r() * 5)
      for xx = x, x + w - 1 do px(xx, y, 'm') end
    end
    for i = 1, 50 do                         -- light sand specks
      px(math.floor(r() * W), 3 + math.floor(r() * (H - 4)), 'l')
    end
  end } },
}
