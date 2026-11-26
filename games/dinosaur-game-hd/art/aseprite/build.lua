-- Builds art/aseprite/<name>.aseprite from the Lua script of that name in
-- art/aseprite/runners/, world/, bg/ or ui/.
--   aseprite -b --script-param root=<game folder> --script-param name=trex --script art/aseprite/build.lua
-- Overwrites the .aseprite file: hand edits made in Aseprite are lost, so
-- once a sprite is edited by hand, stop rebuilding it.
local root, name = app.params.root, app.params.name
assert(root and name, 'pass --script-param root=... --script-param name=...')
local dir = app.fs.joinPath(root, 'art', 'aseprite')
local L = dofile(app.fs.joinPath(dir, 'lib.lua'))
L.dir = dir
-- Runners live in runners/, world sprites (cacti, eggs...) in world/,
-- background layers in bg/, buttons and icons in ui/.
local file
for _, sub in ipairs({ 'runners', 'world', 'bg', 'ui' }) do
  local f = app.fs.joinPath(dir, sub, name .. '.lua')
  if app.fs.isFile(f) then file = f break end
end
assert(file, 'no Lua script for ' .. name)
local R = assert(loadfile(file))(L)
local out = app.fs.joinPath(dir, name .. '.aseprite')
if R.image then L.buildImage(out, R)
else (R.simple and L.buildSimple or L.build)(out, R.palette, R.frames, R.fps or 12) end
print('built ' .. name .. '.aseprite, ' .. #R.frames .. ' frames')
