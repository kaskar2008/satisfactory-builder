# Game item icons and recipe data

The PNG icons are original Satisfactory game item artwork, © Coffee Stain Studios.
Local 64 × 64 copies come from the game's extracted icons published by
https://github.com/greeny/SatisfactoryTools/tree/master/www/assets/images/items

Recipe additions use that project's extracted game documentation, checked against
https://satisfactory.wiki.gg/wiki/Recipes (2026-10-09). The standard Radio Control
Unit uses two Computers per cycle, as documented in the current wiki.

The machine crafting catalog (276 recipes, including 111
alternates; seasonal FICSMAS recipes are excluded) is imported from
https://github.com/greeny/SatisfactoryTools/blob/master/data/data1.0-ficsmas.json.
The downloaded source is preserved in game-data-source.json; rebuild the compact
runtime catalog with `node build-recipe-catalog.cjs`. Ingredients, all products,
batch sizes and cycle durations are retained. Fluid amounts in this source are
already cubic metres and must not be divided by 1000.

Generation supports the 276 machine recipes, including fluid ports and multiple
products. Refineries, packagers, blenders, converters, particle accelerators and
quantum encoders use distinct building envelopes. Raw resources remain imports.

Pipe throughput follows Mk.1 (300 m³/min) and Mk.2 (600 m³/min):
https://satisfactory.wiki.gg/wiki/Pipelines. Liquid lifts add Mk.1 pumps (20 m
head lift, 4 MW). Simulation uses an explicitly approximate directed flow model
with effective storage 1 m³ per metre, volume conservation, fractional batches,
startup travel/filling, finite buffers and backpressure. It does not reproduce
bidirectional sloshing or the game's exact internal hydraulic solver.
