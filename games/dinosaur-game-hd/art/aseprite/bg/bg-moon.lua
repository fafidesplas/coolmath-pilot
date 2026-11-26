-- Moon (GDD 3.6), 14×14 art px: cream with a shaded right edge and craters.
local L = ...
local R = 7
return {
  image = true, w = 2 * R, h = 2 * R,
  palette = { c = '#FFF6E0', r = '#D8D2C0', s = '#E9E2CE', k = '#D3CCB6', K = '#C2BBA6' },
  frames = { { tag = 'idle', draw = function(px)
    for y = 0, 2 * R - 1 do
      local half = math.floor(math.sqrt(R * R - (y + 0.5 - R) ^ 2) + 0.5)
      for x = R - half, R + half - 1 do
        local dx, dy = x + 0.5 - R, y + 0.5 - R
        local k = 'c'
        if dx * dx + dy * dy > (R - 1) ^ 2 then k = 'r'
        elseif (dx + 2.5) ^ 2 + (dy + 1) ^ 2 > 44 then k = 's' end
        px(x, y, k)
      end
    end
    -- craters: a dark pixel under a light rim
    for _, c in ipairs({ { 4, 4, 2, 2 }, { 8, 8, 3, 2 }, { 5, 10, 2, 1 }, { 9, 3, 1, 1 } }) do
      for y = c[2], c[2] + c[4] - 1 do for x = c[1], c[1] + c[3] - 1 do px(x, y, 'k') end end
      px(c[1], c[2], 'K')
    end
  end } },
}
