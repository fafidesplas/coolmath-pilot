-- Sun (GDD 3.6), 22×22 art px: a warm disc with a lit top-left and
-- sunset stripes cut through its lower half.
local L = ...
local R = 11
return {
  image = true, w = 2 * R, h = 2 * R,
  palette = { r = '#FDD27E', f = '#FFF1C2', l = '#FFFAE6', s = '#FBE0A0' },
  frames = { { tag = 'idle', draw = function(px)
    local cut = { [13] = true, [16] = true, [17] = true, [19] = true, [20] = true }
    for y = 0, 2 * R - 1 do
      if not cut[y] then
        local half = math.floor(math.sqrt(R * R - (y + 0.5 - R) ^ 2) + 0.5)
        for x = R - half, R + half - 1 do
          local edge = x == R - half or x == R + half - 1 or y == 0 or y == 2 * R - 1
          local dx, dy = x + 0.5 - R, y + 0.5 - R
          local k = 'f'
          if edge or dx * dx + dy * dy > (R - 1) ^ 2 then k = 'r'
          elseif (dx + 4) ^ 2 + (dy + 4) ^ 2 < 14 then k = 'l'
          elseif y > R + 1 then k = 's' end
          px(x, y, k)
        end
      end
    end
  end } },
}
