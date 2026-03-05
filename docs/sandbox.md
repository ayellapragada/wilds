# Screen Preview (Sandbox)

Preview any screen component without a server. Run `npm run dev` and navigate to `#/sandbox`.

## Tabs

### Screen Preview

Pick a phase, pick a preset, see the screen render with working buttons.

**Phases:** lobby, route, hub, world

**Presets per phase:**

| Phase | Preset | Description |
|-------|--------|-------------|
| Lobby | Empty lobby | No players joined |
| Lobby | 3 players | Three trainers waiting to start |
| Route | Mid-game (2 drawn) | Ash has drawn 2 pokemon, Misty exploring |
| Route | One busted | Ash busted (threshold forced to 1), needs penalty choice |
| Hub | Fresh hub | Just entered, free picks and shop available |
| Hub | One confirmed | Misty confirmed, Ash still shopping |
| World | Fresh world | No votes cast, two routes available |
| World | Some voted | Misty voted, Ash still needs to vote |

Buttons work locally — actions go through `resolveAction` directly, no server needed. The event log (collapsed by default) shows all engine events.

### Route Sandbox

The original deck builder + route stepper. Build a custom deck from the pokemon catalog, then step through a route hitting/stopping manually. Useful for testing specific pokemon ability interactions.

## Adding Presets

Presets live in `src/sandbox/presets.ts`. Each preset is a factory function returning:

```typescript
{
  label: string;       // Short name shown on button
  description: string; // Tooltip text
  state: GameState;    // Fabricated game state
  myId: string;        // Which trainer "you" are
}
```

Add a new function, then add it to the `presets` record at the bottom of the file.

**Tips:**
- Use `resolveAction` to build realistic states by replaying actions (see lobby presets)
- Or construct `GameState` manually for precise control (see route/hub/world presets)
- Call `resetPokemonIdCounter()` once at the top of each preset that creates pokemon manually
- Use `makeTrainer()` helper for quick trainer construction

## File Structure

```
src/
  Sandbox.svelte              # Tab navigation (Screen Preview / Route Sandbox)
  sandbox/
    PreviewShell.svelte       # Phase tabs + preset selector + GameScreen rendering
    presets.ts                # State factory functions
```
