# AGENTS

## Mission
Build a dedicated World of Darkness (WoD) v20 rules companion for SillyTavern by replacing the existing generic RPG Companion extension. The new system must:
- Model WoD mechanics (Attributes, Abilities, Advantages, Disciplines/Rituals, health levels, blood pools, willpower, etc.) for multiple characters simultaneously.
- Provide an LLM-friendly serialization so SillyTavern prompts and tracker updates stay authoritative per swipe/character.
- Surface an in-panel workflow for selecting a character sheet, updating mechanical values, and kicking off dice pools/roll resolution.
- Allow optional manual editing by keeping each sheet as a discrete JSON file on disk that can be opened in a text editor and synced back into the UI.

All work happens inside this repo’s ES-module front-end codebase (no build step). Keep compatibility with SillyTavern’s Together/Separate generation modes, persistence APIs, and UI theme hooks.

## Ground Rules
1. **Respect existing architecture** – continue to centralize state in `src/core/state.js`, load/save via `src/core/persistence.js`, and surface UI in `template.html` + `src/systems/**` modules.
2. **WoD-first schema** – percentages and placeholder fields must be phased out in favor of explicit dot/box tracks that mirror v20. Use integers (0–5 dots, etc.) and structured arrays/objects; do not store WoD data as markdown blobs.
3. **LLM synchronization** – anything rendered in the sidebar must also be emitted through the prompt builder and parsed back verbatim. Update `generateTrackerInstructions`, `generateContextualSummary`, parser, and SillyTavern injection hooks in tandem.
4. **File-based sheets** – keep canonical character sheets as JSON under a new `sheets/` directory. Provide loader/saver utilities that (a) fetch files for default seeds and (b) optionally serialize edits back through SillyTavern’s `saveSettings`/chat metadata so per-chat tweaks persist even if the underlying JSON is edited manually.
5. **Dice transparency** – log each WoD dice pool calculation (pool size, difficulty, 10-again rules, botches, willpower expenditures, rerolls) so both the UI and the LLM can reference authoritative roll outcomes.
6. **Incremental delivery** – complete the numbered steps below one at a time. Each step should be reviewable/mergeable on its own.
7. **No backend writes outside SillyTavern APIs** – any filesystem interaction must leverage fetch-style reads from the extension directory (for bundled sheets) and rely on SillyTavern persistence (settings/chat metadata) for runtime changes. Document manual-edit instructions in README updates.
8. **Accessibility & theming** – when touching UI, honor existing theme tokens, keyboard interactions, and responsive layout helpers (`mobile.js`, `layout.js`).
9. **Documentation** – every structural change must be reflected in `README.md` and inline JSDoc so future maintainers understand the WoD schema and dice math.

## Current Reference Points
- **Bootstrap**: `index.js` wires SillyTavern events (`eventSource`, `onMessageReceived`, `commitTrackerData`, etc.) and renders the extension template into the sidebar.
- **State**: `src/core/state.js` defines extension settings, tracker defaults, dice metadata, and DOM references. The WoD overhaul will replace most of this file.
- **Persistence**: `src/core/persistence.js` saves/loads settings plus per-chat `chat_metadata.rpg_companion`. This is the hook for syncing WoD sheets per swipe.
- **Prompt/Parser**: `src/systems/generation/promptBuilder.js` & `parser.js` drive instruction injection and response parsing. Both must be rewritten for WoD formatting.
- **Rendering**: `src/systems/rendering/**` control User Stats, Info Box, Thoughts, Inventory, Quests. Expect to archive or repurpose them for WoD sheet panels and dice logs.
- **Dice UI**: `src/systems/features/dice.js` + `src/systems/ui/modals.js` currently handle simple NdM rolling. Use them as scaffolding for the WoD pool roller.

## Sequential Plan of Attack
Each step should result in compiling code, updated docs, and (when applicable) tests. Do **not** skip steps.

1. **WoD Rules Research & Spec Draft**
   - Gather authoritative v20 references for Attributes, Abilities, Advantages (Backgrounds, Virtues, Humanity/Path), health levels, blood pool limits per generation, willpower, and common Disciplines/Rituals.
   - Produce a design document (e.g., `docs/wod-spec.md`) capturing sheet structure, JSON schema for characters, dice pool logic (including specialties, 10-again, botches), and how trackers map to prompts.
   - Identify any gaps (e.g., mage spheres, thaumaturgy rituals) and outline optional modules.

2. **Data Model & Schema Implementation**
   - Replace `extensionSettings.userStats`, `classicStats`, and related tracker config with WoD-specific structures (per-character objects, sheet registry, dice defaults).
   - Define TypeScript-style typedefs in `src/types/` for `WodCharacterSheet`, `DicePoolConfig`, `HealthTrack`, etc.
   - Ensure state can handle multiple sheets simultaneously plus a pointer to the “active” character for UI interactions.

3. **Persistence & Sheet Loading Layer**
   - Add a `sheets/` directory with sample JSON sheets (e.g., `brujah.json`). Implement a loader utility that fetches bundled sheets at startup and merges them into `extensionSettings`.
   - Extend persistence so chat-specific edits live in `chat_metadata.rpg_companion_v20`, while global sheets remain editable via filesystem. Provide conflict resolution rules (e.g., prefer chat overrides, track `updatedAt`).
   - Document manual-edit workflow in README (path to files, reload instructions).

4. **WoD Dice Engine & Logging**
   - Implement a deterministic dice engine (`src/systems/features/wodDice.js`) that supports: attribute+ability pools, target difficulties, 10-again variants (optional 9-/8-again), specialties adding rerolls, willpower auto-successes, reroll limits, botch detection, and success tallying.
   - Provide pure functions so we can unit-test them without SillyTavern.
   - Update the dice modal to accept WoD inputs (trait dropdowns sourced from the active sheet, difficulty selector, toggles for spend willpower/reroll rules) and to emit structured roll summaries stored alongside chat history.

5. **Sheet UI & Editing Experience**
   - Replace the existing User Stats/Info Box panels with a WoD sheet layout: Attributes/Abilities (by categories), Advantages, Disciplines, Rituals, Background notes, Health/Willpower/Blood tracks, equipment.
   - Support multiple characters by providing a selector (dropdown or tabs) that swaps the visible sheet, and per-field editing with validation (dot limits, box states, etc.).
   - Ensure edits mark sheets as “dirty” so persistence updates run, and offer a “sync back to file” action that serializes JSON to download/copyable text (since direct writes aren’t possible in-browser).

6. **Context Injection & Prompt Templates**
   - Rewrite `generateTrackerInstructions`, `generateTrackerExample`, `generateContextualSummary`, and `generateSeparateUpdatePrompt` to describe the WoD sheet format (probably multiple fenced blocks: `Character Sheet`, `Scene Info`, `Dice Log`).
   - Include explicit instructions for how the LLM should update multiple characters (e.g., list each present character with their traits and statuses) and how dice results should be referenced.
   - Ensure Together and Separate modes both send identical schemas and remain configurable via the extension’s enable flags.

7. **Parser & SillyTavern Integration**
   - Update `parseResponse` to read the new code fences, validate values (dots stay 0–5, health levels align with Bruised–Incapacitated, etc.), and map them into the sheet state.
   - Maintain per-swipe storage (`message.extra.rpg_companion_swipes`) and committed tracker snapshots so swipes/regens stay consistent.
   - Ensure dice logs and sheet edits propagate into chat metadata via `saveChatData`/`loadChatData`.

8. **File-backed Multi-character Sync**
   - Provide commands/buttons to import/export sheet JSON (per character) so users can edit files manually. Consider a lightweight “watcher” by storing a hash of the JSON in `localStorage` and prompting to reload if the filesystem copy changes (user-initiated via refresh button).
   - Handle group chats by detecting `selected_group` and automatically loading sheets for each participant (matching by character name or config mapping).

9. **Testing & QA Harness**
   - Introduce a minimal `package.json` with dev dependencies (e.g., `vitest` or `uvu`) so dice logic and parser formatting can be unit-tested headlessly (`npm test`).
   - Add test cases for dice pools, health track serialization, parser round-trips, and prompt generation shape.
   - Document manual test scripts for SillyTavern (Together vs Separate modes, sheet switching, dice rolls) in `docs/testing.md`.

10. **Docs & Migration Guide**
    - Update `README.md` with setup instructions, JSON schema docs, dice usage, and manual edit workflow.
    - Provide a migration script or instructions for existing users to export their old tracker data before installing the WoD version.
    - Ensure in-extension help text/tooltips reference WoD terminology.

## Testing Expectations
- **Automated**: Once the dice/parser modules exist, run `npm test` (to be introduced in Step 9) locally before every PR. Include fixtures covering edge cases like botches, 10-again cascades, sheet parsing, and prompt serialization.
- **Manual (SillyTavern)**: For UI/LLM integration steps, validate both Together and Separate modes by:
  1. Installing the extension in a SillyTavern sandbox.
  2. Loading at least two character sheets and switching between them.
  3. Sending a few turns to confirm trackers update and swipes preserve sheet state.
  4. Running multiple dice rolls (with/without willpower) and verifying logs appear in chat and prompts.
  5. Refreshing SillyTavern to ensure persistence works across sessions and manual JSON edits are picked up via the reload action.
- Record any manual test deviations in the PR description until automated coverage exists.

## Outstanding Questions / Info to Gather
- Canonical list of Disciplines/Rituals that should be first-class vs. free-form notes.
- Exact JSON format for bundled sheet files (decide on dot arrays vs. scalar integers, nested power descriptions, etc.).
- Whether SillyTavern exposes APIs to write to extension files at runtime (likely no; plan assumes read-only plus manual export/import).
- How to best map SillyTavern group members to sheet files (naming convention? custom metadata?). Document the chosen approach in the spec before implementation.

Follow this plan sequentially. Each step should leave the repository in a releasable state (even if some panels temporarily display placeholder warnings) before moving on.
