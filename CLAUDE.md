# Claude

## Architecture
- `engine/` — Pure TypeScript game engine. NO PartyKit imports. NO side effects.
  - State + Action → New State + Events
  - All types in `engine/types.ts`
  - Test with `npx vitest`
- `party/` — Cloudflare Worker server using `partyserver`. Thin wrapper. Receives actions, calls engine, broadcasts.
- `src/` — Svelte frontend. TV display + phone controller.

## Key Rules
- Engine is pure. No I/O, no network, no framework imports.
- State is immutable. Always return new objects.
- Every state change emits events (discriminated unions).
- Types first. Define types before implementing.
- Test the engine, not the server.
- TDD: write failing test first, then implement.

## Code Style
- TypeScript strict mode
- Pure functions for game logic (no side effects)
- Svelte 5 runes syntax ($state, $derived, $props)
- `partyserver` (not `partykit`) for the server — same pattern as mahjong project

## Git Commits
- Do NOT add "Co-Authored-By" lines to commits
