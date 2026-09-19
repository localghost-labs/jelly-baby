# Jelly Baby

![Jelly Baby](public/og_image.png)

***Play live at: https://jelly.scottsun.io*** · This is [localghost-labs](https://github.com/localghost-labs/jelly-baby)'s fork, which also serves the Smashbar auth backdrop (see [Smashbar embed mode](#smashbar-embed-mode)).

## A very small world with excellent bounce

Jelly Baby is a 7 cm resident of a warm wooden tabletop. It has no errands, no
scoreboard, and no interest in standing still for long.

Wander over to the swing. Try the trampoline. Pull the little jelly by the
crown, give it a hop, then let go and watch the wobble travel through it. The
room is quiet enough to notice the details: the window light on the table, the
soft thump of a landing, the face changing its mind halfway through a stretch.

Choose a flavor when the mood changes. Lime is the default; strawberry,
blueberry, and lemon are waiting in the palette.

## Make it move

On desktop, use `WASD` or the arrow keys to wander and `Space` to hop. Drag the
tabletop to look around; scroll or pinch to move closer. Drag the baby itself to
stretch and throw it. `R` brings everything back to its starting place.

On touch, the joystick handles wandering and the round button handles hopping.
The play button appears when a facility is close enough. The same button gets
you off again.

Sound begins with your first interaction and can be muted from the top corner.

## Smashbar embed mode

This fork adds a second scene to the same build: the backdrop beside the
login, signup and onboarding forms at [smash.bar](https://smash.bar). It is
selected at runtime by `?embed=1` and configured in one place,
`src/app/scene-config.ts`; without the flag the playroom above runs exactly as
before. Nothing upstream is deleted or hidden to get there — the runtime
constructs only what the scene names.

Embed mode: grape jelly alone on a white sweep; no furniture, no portal, no other worlds; the mute button, the
keyboard hints and a `source` link for chrome; a loading card in Smashbar
colours with self-hosted Inter (`public/fonts`, SIL OFL). It is desktop-only by
the embedder's choice, so there are no touch controls.

**Protocol.** The page posts `{type:"jelly:ready"}` to its parent window once
the first frame has been presented and `{type:"jelly:failed"}` if startup
fails. The embedder keeps a still of the scene under the frame and cross-fades
on `ready`; it checks `event.origin`. While the document is hidden the
animation loop is stopped, not just skipped.

**Budget.** The embed's first-visit transfer must stay under 10 MB compressed.
`npm run check:embed-budget` measures it from the build manifest — the static
import graph from the document plus the runtime chunk and the transport worker,
with their CSS and assets — and CI fails above the limit. The table, the night
map and the playroom are reached only by dynamic import, so they never count
and never download in embed mode; the check also fails if one of their assets
leaks onto the embed's side of the graph. The studio HDR ships at 512×256 for
the same reason (`scripts/build-studio-environment.mjs`).

**Hosting.** Static, at `jelly.smash.bar`. `public/_headers` carries Cloudflare
Pages cache rules for the hashed output; any other host ignores it.

### Changes from upstream

- `src/app/scene-config.ts` — the two scene configurations and the `?embed=1` switch; `src/app/idle-hop.ts` — the embed's timed hop until the first interaction.
- `src/main.ts`, `src/app/runtime.ts` — markup and construction driven by the configuration; `jelly:ready`/`jelly:failed`; pause while hidden.
- `src/graphics/scene/sweep.ts`, `wordmark.ts`, `src/assets/smashbar-wordmark.svg` — the sweep ground and an extruded wordmark (available to a scene configuration; the Smashbar scene does not use it).
- `src/graphics/scene/environment.ts`, `night-environment.ts`, `src/app/lighting-mode.ts`, `src/worlds/main/playroom.ts` — the night map, the lighting switch, the table and the playroom furniture moved behind dynamic imports; the code inside is unchanged.
- `src/worlds/travel.ts` — the home portal is optional (`portal=false` builds no worlds).
- `src/graphics/character/jelly-flavors.ts` — a `grape` flavor; the default stays lime.
- `src/graphics/scene/renderer.ts` — the narrow-viewport camera offset is optional.
- `index.html` — mode-specific preloads are promoted from an inert `rel` so the embed never starts a wood fetch.
- `scripts/check-embed-budget.mjs`, `scripts/build-studio-environment.mjs` (half-resolution studio map), `.github/workflows/ci.yml`, `public/_headers`, `public/fonts`.

## License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0-only).

You may use, modify, and redistribute this software under the terms of the GPLv3. If you distribute a modified or derivative version of this project, you must also make the corresponding source code available under the GPLv3.

See the [LICENSE](./LICENSE) file for the full license terms.