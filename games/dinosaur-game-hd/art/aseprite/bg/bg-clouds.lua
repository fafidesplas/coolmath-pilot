-- Clouds (GDD 3.6), a 320×30 art px tile: puffy clouds with a flat base,
-- a cream lit top, a warm body and a peach underside.
local L = ...
local W, H = 320, 30
-- { left x, base y, width }
local CLOUDS = { { 15, 22, 30 }, { 95, 13, 20 }, { 165, 27, 36 }, { 235, 16, 24 }, { 290, 27, 18 } }
return {
  image = true, w = W, h = H,
  palette = { t = '#FFFBF0D9', b = '#FFEFD2D9', u = '#F9D8A8D9', U = '#F3C38CD9' },   -- 85% opaque, as before the redraw
  frames = { { tag = 'idle', draw = function(px)
    for ci, c in ipairs(CLOUDS) do
      local x0, base, w = c[1], c[2], c[3]
      local r = L.rand(ci * 31)
      local puffs, n = {}, math.max(3, math.floor(w / 6))
      for i = 0, n - 1 do
        local t = i / (n - 1)
        local rad = 2.5 + 4.5 * math.sin(t * math.pi) + r() * 1.5   -- taller in the middle
        puffs[#puffs + 1] = { x0 + 2 + (w - 4) * t, base - 1 - rad * 0.45, rad }
      end
      local function inside(x, y)
        if y > base then return false end
        if x < x0 or x >= x0 + w then return false end
        if y >= base - 2 then return true end
        for _, p in ipairs(puffs) do
          if (x + 0.5 - p[1]) ^ 2 + (y + 0.5 - p[2]) ^ 2 <= p[3] ^ 2 then return true end
        end
        return false
      end
      for y = 0, H - 1 do
        for x = x0 - 2, x0 + w + 2 do
          if inside(x, y) then
            local k = 'b'
            if y == base then k = 'U'
            elseif y >= base - 1 then k = 'u'
            elseif not inside(x, y - 1) or not inside(x, y - 2) and (x + y) % 2 == 0 then k = 't' end
            px(x, y, k)
          end
        end
      end
    end
  end } },
}
