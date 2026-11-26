-- Sky (GDD 3.6), 320×125 art px from the top of the view to the ground line.
-- Six stepped bands with a 2 row dither into the next band: the 16-bit look
-- of a gradient. Tag 'day': warm sunset; tag 'night': deep blue.
-- Tiles every 320 art px (640 logical).
local L = ...
local W, H = 320, 125
local DAY = { '#FFEFC9', '#FFE6B0', '#FDDA97', '#FBCB80', '#F8B96A', '#F5A55A' }
local NIGHT = { '#0F1530', '#141B3A', '#1B2340', '#222B4D', '#2B355C', '#36406A' }
local palette = {}
for i, c in ipairs(DAY) do palette['d' .. i] = c end
for i, c in ipairs(NIGHT) do palette['n' .. i] = c end

local function sky(p)
  return function(px)
    local bh = H / 6
    for y = 0, H - 1 do
      local band = math.min(6, math.floor(y / bh) + 1)
      local toNext = math.floor(band * bh + 0.5) - y   -- rows to the next band
      for x = 0, W - 1 do
        local b = band
        if band < 6 and toNext == 1 and (x + y) % 2 == 0 then b = band + 1 end            -- 50%
        if band < 6 and toNext == 2 and (x + 2 * (y % 2)) % 4 == 0 then b = band + 1 end  -- 25%
        px(x, y, p .. b)
      end
    end
  end
end

return {
  image = true, w = W, h = H, palette = palette,
  frames = { { tag = 'day', draw = sky('d') }, { tag = 'night', draw = sky('n') } },
}
