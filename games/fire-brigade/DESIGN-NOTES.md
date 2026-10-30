# Fire Brigade: Design Notes

Open design questions and concerns. Once a note is resolved, record the decision in `GDD.md`.

## Open

- **Water refill system needs a rethink.** The current refill system (limited tank, refill at the truck or at wall standpipes, see GDD §3.5) copies Nuclear Blaze's approach too closely. We need to redesign it so it is our own.
- **Try one-hit kill.** If a player touches a fire for even one frame, they get knocked out and they lose the round. Today the game uses a health bar that refills, and a worn-out player comes back after 3 s (see the health section in the GDD).
