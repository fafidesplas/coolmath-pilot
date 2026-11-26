-- Shared helpers for the runner build scripts (Aseprite Lua, batch mode).
-- A runner script returns { palette, frames }: each frame is a grid of
-- characters, one per art pixel, '.' transparent. The builder adds the 1 px
-- Night Ink outline around every frame (4-connected, no corners, like the
-- game's old cell maps) and lays the frames out in one sprite:
--   canvas 30×25, standing frames in the 'stand' slice (0,0,24,25),
--   slide frames in the 'slide' slice (0,13,30,12); both share the ground line.
-- After a build, the .aseprite file is the source: edit it by hand in Aseprite
-- and re-export with tools/export-sprites.sh. Re-running a build overwrites it.

local M = {}

M.W, M.H = 30, 25
M.STAND = { x = 0, y = 0, w = 24, h = 25 }
M.SLIDE = { x = 0, y = 13, w = 30, h = 12 }
M.INK = '#1B2340'

local function rgba(hex)
  local r, g, b = hex:match('#(%x%x)(%x%x)(%x%x)')
  return app.pixelColor.rgba(tonumber(r, 16), tonumber(g, 16), tonumber(b, 16), 255)
end

-- Replace part of a row: set(rows, y, x, s) with 0-based x and y, like art.js.
function M.set(rows, y, x, s)
  local r = rows[y + 1]
  rows[y + 1] = r:sub(1, x) .. s .. r:sub(x + #s + 1)
end

function M.copy(rows)
  local t = {}
  for i, r in ipairs(rows) do t[i] = r end
  return t
end

function M.concat(a, b)
  local t = M.copy(a)
  for _, r in ipairs(b) do t[#t + 1] = r end
  return t
end

-- Draw a grid with its outline into an image at (ox, oy) + 1 (the margin).
local function paint(img, rows, palette, ox, oy)
  local w = #rows[1]
  for y, r in ipairs(rows) do
    assert(#r == w, 'row ' .. y .. ' is ' .. #r .. ' wide, expected ' .. w)
  end
  local function at(x, y)   -- 1-based grid coords
    local r = rows[y]
    if not r or x < 1 or x > w then return nil end
    local c = r:sub(x, x)
    if c == '.' then return nil end
    return c
  end
  local ink = rgba(M.INK)
  for y = 0, #rows + 1 do
    for x = 0, w + 1 do
      local c = at(x, y)
      if c then
        local hex = palette[c]
        assert(hex, "no color for '" .. c .. "'")
        img:drawPixel(ox + x, oy + y, rgba(hex))
      elseif at(x - 1, y) or at(x + 1, y) or at(x, y - 1) or at(x, y + 1) then
        img:drawPixel(ox + x, oy + y, ink)
      end
    end
  end
end

-- frames: list of { tag = name, slide = bool, rows = grid }, in order.
-- Frames with the same tag next to each other become one tag.
function M.build(out, palette, frames, fps)
  local spr = Sprite(M.W, M.H, ColorMode.RGB)
  local layer = spr.layers[1]
  layer.name = 'art'
  for i = 2, #frames do spr:newEmptyFrame() end
  for i, f in ipairs(frames) do
    local img = Image(M.W, M.H, ColorMode.RGB)
    local box = f.slide and M.SLIDE or M.STAND
    local gw, gh = #f.rows[1] + 2, #f.rows + 2
    assert(gw == box.w and gh == box.h,
      f.tag .. ' frame ' .. i .. ' is ' .. gw .. 'x' .. gh .. ' with outline, expected ' .. box.w .. 'x' .. box.h)
    paint(img, f.rows, palette, box.x, box.y)
    spr:newCel(layer, i, img, Point(0, 0))
    spr.frames[i].duration = 1 / (f.fps or fps)
  end
  local i = 1
  while i <= #frames do
    local j = i
    while j < #frames and frames[j + 1].tag == frames[i].tag do j = j + 1 end
    local tag = spr:newTag(i, j)
    tag.name = frames[i].tag
    i = j + 1
  end
  for name, b in pairs({ stand = M.STAND, slide = M.SLIDE }) do
    local s = spr:newSlice(Rectangle(b.x, b.y, b.w, b.h))
    s.name = name
  end
  -- The runner's colors as the sprite's palette, for hand edits.
  local keys = {}
  for k in pairs(palette) do keys[#keys + 1] = k end
  table.sort(keys)
  local pal = Palette(#keys + 2)
  pal:setColor(0, Color { r = 0, g = 0, b = 0, a = 0 })
  pal:setColor(1, Color(rgba(M.INK)))
  for n, k in ipairs(keys) do pal:setColor(n + 1, Color(rgba(palette[k]))) end
  spr:setPalette(pal)
  spr:saveAs(out)
  spr:close()
end

-- A world sprite (cactus, pterodactyl, egg...): every frame is its grid plus
-- the 1 px outline margin, all frames the same size, no slices.
function M.buildSimple(out, palette, frames, fps)
  local gw, gh = #frames[1].rows[1] + 2, #frames[1].rows + 2
  local spr = Sprite(gw, gh, ColorMode.RGB)
  local layer = spr.layers[1]
  layer.name = 'art'
  for i = 2, #frames do spr:newEmptyFrame() end
  for i, f in ipairs(frames) do
    assert(#f.rows[1] + 2 == gw and #f.rows + 2 == gh, f.tag .. ' frame ' .. i .. ' is a different size')
    local img = Image(gw, gh, ColorMode.RGB)
    paint(img, f.rows, palette, 0, 0)
    spr:newCel(layer, i, img, Point(0, 0))
    spr.frames[i].duration = 1 / (f.fps or fps)
  end
  local i = 1
  while i <= #frames do
    local j = i
    while j < #frames and frames[j + 1].tag == frames[i].tag do j = j + 1 end
    local tag = spr:newTag(i, j)
    tag.name = frames[i].tag
    i = j + 1
  end
  spr:saveAs(out)
  spr:close()
end

-- Lay a block over a grid from row y0 (0-based): '_' keeps the pixel under it.
function M.overlay(rows, y0, block)
  for i, b in ipairs(block) do
    local r = rows[y0 + i]
    assert(#b == #r, 'overlay row ' .. (y0 + i - 1) .. ' is ' .. #b .. ' wide, expected ' .. #r)
    local out = {}
    for x = 1, #r do
      local c = b:sub(x, x)
      out[x] = c == '_' and r:sub(x, x) or c
    end
    rows[y0 + i] = table.concat(out)
  end
  return rows
end

-- The face, as Pao drew it on the T-Rex: open eye 'ww' over 'wk', X eyes
-- (3×3, centered one column right of the eye's left) or a shut line.
-- ex, ey: 0-based position of the eye's top-left white.
function M.face(rows, kind, ex, ey)
  if kind == 'dizzy' then
    M.set(rows, ey, ex - 1, 'kSk')
    M.set(rows, ey + 1, ex - 1, 'SkS')
    M.set(rows, ey + 2, ex - 1, 'kSk')
  elseif kind == 'shut' then
    M.set(rows, ey, ex, 'SS')
    M.set(rows, ey + 1, ex, 'kk')
  else
    M.set(rows, ey, ex, 'ww')
    M.set(rows, ey + 1, ex, 'wk')
  end
  return rows
end

-- A two-legged runner built on Pao's T-Rex (runners/base.lua): every frame
-- gets the species' standing or slide overlay, then its face.
--   spec = { head = block from row 0, slideHead = block from row 0,
--            eye = {x, y}, slideEye = {x, y}, extra = function(rows, frame) }
local FRAMES = {
  { 'run0', 'run' }, { 'run1', 'run' }, { 'run2', 'run' }, { 'run3', 'run' },
  { 'jump', 'jump' }, { 'crash', 'crash', 'dizzy' }, { 'sleep', 'sleep', 'shut', 1 },
  { 'slide0', 'slide' }, { 'slide1', 'slide' }, { 'slideCrash', 'slideCrash', 'dizzy' },
}
function M.theropod(spec)
  local base = dofile(app.fs.joinPath(M.dir, 'runners', 'base.lua'))
  local frames = {}
  for _, f in ipairs(FRAMES) do
    local name, tag, kind, fps = f[1], f[2], f[3], f[4]
    local slide = tag:sub(1, 5) == 'slide'
    local rows = M.copy(base[name])
    M.overlay(rows, 0, slide and spec.slideHead or spec.head)
    local e = slide and spec.slideEye or spec.eye
    M.face(rows, kind, e[1], e[2])
    if spec.extra then spec.extra(rows, name, slide) end
    frames[#frames + 1] = { tag = tag, slide = slide, rows = rows, fps = fps }
  end
  return frames
end

-- A painted image (backgrounds, UI): no outline, drawn pixel by pixel.
--   spec = { w, h, palette = { key = '#RRGGBB' or '#RRGGBBAA' },
--            frames = { { tag = name, draw = function(px) end }, ... } }
-- px(x, y, key) sets a pixel with 0-based x and y; x wraps around the width,
-- so a tile drawn with px meets itself at the seam. Keys not in the
-- palette are an error; '.' clears the pixel.
local function rgbaA(hex)
  local r, g, b, a = hex:match('#(%x%x)(%x%x)(%x%x)(%x?%x?)')
  return app.pixelColor.rgba(tonumber(r, 16), tonumber(g, 16), tonumber(b, 16), a ~= '' and tonumber(a, 16) or 255)
end
function M.buildImage(out, spec)
  local w, h = spec.w, spec.h
  local spr = Sprite(w, h, ColorMode.RGB)
  local layer = spr.layers[1]
  layer.name = 'art'
  for i = 2, #spec.frames do spr:newEmptyFrame() end
  local colors = {}
  for k, hex in pairs(spec.palette) do colors[k] = rgbaA(hex) end
  for i, f in ipairs(spec.frames) do
    local img = Image(w, h, ColorMode.RGB)
    f.draw(function(x, y, key)
      if y < 0 or y >= h then return end
      x = math.floor(x) % w
      if key == '.' then img:drawPixel(x, math.floor(y), 0) return end
      img:drawPixel(x, math.floor(y), assert(colors[key], "no color for '" .. tostring(key) .. "'"))
    end, f)
    spr:newCel(layer, i, img, Point(0, 0))
  end
  local i = 1
  while i <= #spec.frames do
    local j = i
    while j < #spec.frames and spec.frames[j + 1].tag == spec.frames[i].tag do j = j + 1 end
    local tag = spr:newTag(i, j)
    tag.name = spec.frames[i].tag
    i = j + 1
  end
  for _, s in ipairs(spec.slices or {}) do
    local sl = spr:newSlice(Rectangle(s.x, s.y, s.w, s.h))
    sl.name = s.name
    if s.center then sl.center = Rectangle(s.center.x, s.center.y, s.center.w, s.center.h) end
  end
  -- The colors as the sprite's palette, for hand edits.
  local keys = {}
  for k in pairs(spec.palette) do keys[#keys + 1] = k end
  table.sort(keys)
  local pal = Palette(#keys + 1)
  pal:setColor(0, Color { r = 0, g = 0, b = 0, a = 0 })
  for n, k in ipairs(keys) do pal:setColor(n, Color(colors[k])) end
  spr:setPalette(pal)
  spr:saveAs(out)
  spr:close()
end

-- A small deterministic random generator, so a tile is the same every build.
function M.rand(seed)
  local s = seed
  return function()
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  end
end

return M
