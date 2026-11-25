# VolleyStars

A turn-based creature volleyball game that runs in the browser.

## Files
- `index.html`: the page
- `style.css`: how it looks (court, animations)
- `js/creatures.js`: creature stats, classes, abilities text (edit this to balance)
- `js/rules.js`: all the game math + the CPU's brain (CONFIG at the top has the main knobs)
- `js/game.js`: screens, animations and match flow
- `assets/`: art

## How to play
1. Place 6 creatures in positions 1–6. Spot 1 serves. You rotate clockwise each time you win the serve back.
2. Serving: choose **Float** (always in, easy to receive) or **Hard** (timing bar, strong, can go out), then click a target.
3. Receive → click a teammate to **bump** to → click a teammate to **set** → a spiker who got the set **spikes**.
   The big text at the top always shows which touch you're on.
4. Spiking: brighter red glow = more likely to drop it. Hover a target to see blockers (blue). Then hit the timing bar.
5. Combo: perfect passes, perfect sets, abilities and perfect timing build spike power (the fiery aura on the ball).
6. Abilities: when one can be used, a purple button pops up above that creature. A glowing name = ability ready.
   A faded creature is winded (spiked recently and hits weaker).
