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
2. Serve by clicking a CPU creature.
3. Receive → click a teammate to **bump** to → click a teammate to **set** → a spiker who got the set **spikes**.
4. Spiking: click a CPU creature to aim (hover to see dig difficulty, out risk and block chance), then hit the
   timing bar (click or Space) when the marker is in the gold.
5. Abilities glow when usable. They recharge after a couple rallies. 💨 = winded (spiked recently, hits weaker).
