# Ink Path — game brief

> Draw one line with a limited pot of ink; when you let go, the ball rolls and must reach the goal.

![How Ink Path plays](mechanic.svg)

**Rank:** #9 · **Genre:** Physics drawing puzzle · **Art family:** Toybox Flat · **Audience habit:** Play at the desk

@../../STANDARDS.md
@../../PHASES.md

## Why it works for Coolmath
Draw-a-line puzzles have many valid answers, so every player feels clever in their own way. Easy to start with a mouse or trackpad, endlessly replayable for 3 stars.

## Core loop
See the ball, the goal and the obstacles → draw one line → release → physics plays out → ball reaches the goal or falls → retry instantly → stars for using little ink (30 seconds–2 minutes per level).

## Mechanics
- One stroke per attempt; the line becomes a solid static body when released, then the ball drops.
- Ink meter limits the stroke length; stars for staying under ink targets.
- Elements: walls, gaps, bouncy pads, moving platforms, no-draw zones, fans, buttons that open gates, two balls that must both arrive.
- Optional stars on the level that the ball must touch for 3 stars.

## Controls
Mouse or trackpad: press and drag to draw. Touch: finger drag. R or a button to retry, Z to undo the line before release (if the ball has not dropped yet).

## Progression and content (v1)
- 50 levels in 4 worlds (Notebook, Kitchen, Garden, Space).

## Retention
Ink-saving records per level, a replay of your best solution, pen colors and line styles unlocked with stars.

## Art direction
Toybox Flat with a paper-craft feel: lined-paper or cardboard backgrounds, thick hand-drawn ink line with a slight wobble, a shiny cartoon ball with a face. Bright, clean, readable.

### Concept art prompts
Starting points for any image generator; the art direction above wins if they disagree. Paste each one whole.

- **Gameplay screenshot (16:9):** *"Flat cartoon physics drawing puzzle, a thick hand-drawn ink line guiding a cute shiny ball with a face towards a goal cup, paper craft notebook background, bouncy pads and walls, warm light colors, thick outlines, 2D game screenshot, 16:9"*
- **Key art / thumbnail (16:9 and 1:1, no text):** *"a thick wobbly hand-drawn ink line on notebook paper guiding a shiny cartoon ball with a happy face as it rolls towards a goal cup with a flag, ink drops and doodles around, flat vector cartoon style, bright flat colors, thick dark outlines, soft drop shadows, warm cream background, toy-like and clean, highly readable shapes, centered composition with room for a title, game key art"*
- **Character and element sheet:** *"pieces on a plain background: the shiny ball with a face in several expressions, goal cup, ink pot meter full and empty, wall block, bouncy pad, a sample ink stroke, flat vector cartoon style, bright flat colors, thick dark outlines, soft drop shadows, warm cream background, toy-like and clean, highly readable shapes, game asset sheet on a plain light background, evenly spaced, consistent scale"*
- **Logo (try several, keep the most readable):** *"the words "INK PATH" written as one continuous thick ink stroke, with a small cartoon ball rolling along the end of the line, flat vector cartoon style, bright flat colors, thick dark outlines, soft drop shadows, warm cream background, toy-like and clean, highly readable shapes, game logo on a plain background, bold and readable at small size"*
- **Negative prompt (generators that support it; drop "text, letters" for the logo):** *"text, letters, watermark, signature, photorealistic, gritty, horror, violence, weapons, blood, cluttered background, blurry, low contrast, extra limbs, UI buttons"*

## Audio
Pen scratch while drawing, soft rolling, boing on pads, applause on goal.

## GameAnalytics
- Extra events: `level:ink_used` (percent), `level:attempts` (value).
- Question to answer: how many attempts per level, and do players replay for ink stars?

## Scope
- **v1:** 50 levels, ink stars, replays, cosmetics.
- **Later:** level editor with share codes.

## Risks and open questions
- Use a small, well-tested 2D physics approach (circle vs polyline collision, fixed step). Simplify the drawn stroke (Ramer–Douglas–Peucker) to keep collisions cheap.
- Determinism so a solution replays the same.

## Definition of done
`STANDARDS.md` checklist, plus: each level has a recorded reference solution that passes.

## Vertical slice (phase 2)
Stroke drawing with an ink meter, line to static body, ball physics on a fixed step, goal detection, instant retry, 3 tutorial levels, the full game shell and GameAnalytics stubs.

## How to start
Don't start coding. Follow `../../PHASES.md` from phase 1: write and approve `GDD.md` first, then build the vertical slice above.
