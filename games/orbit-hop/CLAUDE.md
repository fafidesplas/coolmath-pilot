# Orbit Hop — game brief

> A tiny astronaut circles a planet; tap to launch at the right moment and slingshot to the next one.

**Rank:** #10 · **Genre:** One-button timing game · **Art family:** Night Neon · **Audience habit:** Play at the desk

@../../STANDARDS.md
@../../PHASES.md

## Why it works for Coolmath
One-button timing is instant to learn and hard to master, ideal for a quick break. Gravity arcs look beautiful and every launch is a small gamble.

## Core loop
Orbit a planet → tap to launch along the tangent → gravity of nearby planets bends your path → land in another planet's orbit or drift into space → collect stars on the way → reach the beacon (20–60 seconds per level).

## Mechanics
- Player orbits the current planet automatically. A tap launches along the current direction.
- In flight, planets within range pull you (simple inverse-square gravity, tuned for fun, not realism). Entering a planet's capture ring puts you in its orbit.
- Hazards: asteroids, black holes (strong pull), suns (too close = burn). Missing everything = drift out = retry.
- Aim guide: a short dotted preview of the first part of the trajectory (shorter in later worlds).
- Stars: 3 collectible stars per level.

## Controls
Space, click or tap to launch. P pause, R retry.

## Progression and content (v1)
- 40 levels in 4 galaxies, one new hazard each.
- Endless mode: procedurally placed planets, score by distance.

## Retention
Daily endless seed with emoji result; astronaut suits and trail colors unlocked with stars.

## Art direction
Night Neon: deep space background with soft nebula, planets as glowing flat circles with rings, the astronaut a tiny bright figure leaving a colored trail. Minimal, calm, beautiful.
Concept prompt: *"Minimal neon space game, a tiny glowing astronaut slingshotting between colorful flat planets with glowing orbit rings, dotted trajectory arc, dark navy space background with soft nebula, clean 2D game screenshot, 16:9"*

## Audio
Soft whoosh on launch, pitch-bending hum as gravity pulls, chime on capture, ambient pad music.

## GameAnalytics
- Extra events: `death:<cause>` (drift, asteroid, sun, blackhole), `endless:distance` (value).
- Question to answer: which hazard causes most retries, and how long do endless sessions last?

## Scope
- **v1:** 40 levels, endless, daily seed, cosmetics.
- **Later:** two-player race on one keyboard.

## Risks and open questions
- Gravity tuning is the whole game: expose constants in one config and tune by playing. Use a fixed physics step.

## Definition of done
`STANDARDS.md` checklist, plus: a new player clears level 1 within three tries.

## Vertical slice (phase 2)
Orbiting, launch on tap, gravity with capture rings, trajectory preview, one level with three planets and stars, instant retry, the full game shell and GameAnalytics stubs.

## How to start
Don't start coding. Follow `../../PHASES.md` from phase 1: write and approve `GDD.md` first, then build the vertical slice above.
