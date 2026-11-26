-- Mesas and hills (GDD 3.6), a 320×55 art px tile resting on the ground
-- line (0.1× parallax): flat-topped mesas with rock strata and rounded hills,
-- each lit on the left with a shaded right side.
local L = ...
local W, H = 320, 55
-- { kind, x, width, height }, as before the redraw
local SHAPES = {
  { 'mesa', 10, 54, 35 }, { 'hill', 72, 46, 48 }, { 'hill', 108, 44, 30 }, { 'mesa', 156, 60, 40 },
  { 'hill', 208, 40, 52 }, { 'hill', 250, 38, 34 }, { 'hill', 292, 26, 28 },
}
return {
  image = true, w = W, h = H,
  palette = { T = '#EDB073', l = '#E39A57', s = '#CF844A', d = '#C27943', b = '#D98E50', B = '#BF7440' },
  frames = { { tag = 'idle', draw = function(px)
    -- rock specks on the lit faces, the same every build
    local function speck(xx, yy) return ((xx * 73 + yy * 151) % 97) < 3 end
    for _, sh in ipairs(SHAPES) do
      local kind, x, w, h = sh[1], sh[2], sh[3], sh[4]
      for row = 0, h - 1 do
        local y = H - h + row
        if kind == 'mesa' then
          local grow = math.floor(row / 3)
          local l, rr = x - grow, x + w + grow     -- [l, rr)
          local strata = row >= 5 and (row - 5) % 7 == 0
          for xx = l, rr - 1 do
            local k = row < 2 and 'T' or 'l'
            if strata and row >= 2 then k = ((xx + row) % 5 == 0) and 'l' or 'b' end
            if xx >= rr - 4 then k = strata and 'B' or 's' end
            if xx == rr - 5 and row >= 2 and (row % 2 == 0) then k = 's' end   -- dithered edge of the shade
            if k == 'l' and row >= 4 and speck(xx, y) then k = 'b' end
            px(xx, y, k)
          end
        else
          local cx, t = x + math.floor(w / 2), (row + 0.5) / h
          local half = math.floor((w / 2) * t ^ 0.55 + 0.5)
          local l, rr = cx - half, cx + half + 1
          local split = cx + math.floor(half * 0.2 + 0.5)
          for xx = l, rr - 1 do
            local k = row < 2 and 'T' or 'l'
            if row >= 3 and xx >= split then k = 's' end
            if row >= 3 and xx == split - 1 and (row % 2 == 0) then k = 's' end   -- dithered terminator
            if row >= 2 and xx == l and row % 3 ~= 0 then k = 'T' end             -- lit left rim
            if k == 'l' and row >= 4 and speck(xx, y) then k = 'b' end
            if k == 's' and row >= 4 and speck(xx + 5, y) then k = 'd' end
            px(xx, y, k)
          end
        end
      end
    end
  end } },
}
