# World of Darkness v20 Rules Spec

This document is the source-of-truth for Step 1 of the AGENTS plan. Its job is to define how the dedicated WoD companion **must** represent character data, how dice pools work, and how both map to SillyTavern state so that Step 2 (data model & schema implementation) can land cleanly. Every section below can be translated directly into code without guessing.

---

## 1. Scope, Goals, and Guardrails

- **Mission recap** - Replace the generic RPG companion with a WoD-focused experience that models Attributes, Abilities, Advantages, supernatural powers, and resource tracks for multiple characters simultaneously.
- **LLM-first** - Anything rendered in the UI must serialize into the prompt builder exactly. Fields are integers, arrays, or enums; nothing is free-form markdown blobs.
- **File-backed sheets** - Canonical sheets live in `sheets/*.json`. The UI loads them read-only, then layers chat-specific overrides stored through SillyTavern persistence. Manual JSON edits must sync back via explicit user actions (export + re-import/refresh).
- **State architecture** - Continue to centralize runtime state in `src/core/state.js`, use `src/core/persistence.js` for SillyTavern APIs, and surface UI via `template.html` + `src/systems/**`.
- **Dice transparency** - Every roll logs the pool math (trait sources, difficulty, 10-again setting, willpower, rerolls, botches) for both UI and injected prompts.

---

## 2. Character Sheet Conceptual Model

Each sheet is a discrete JSON document that the UI can load, display, and edit. Sheets share the following structure:

1. **Identity metadata** - text fields that keep the sheet tied to fictional context.
2. **Traits** - Attributes (Physical, Social, Mental) and Abilities (Talents, Skills, Knowledges) rated 0-5 dots by default.
3. **Advantages & tracks** - Backgrounds, Virtues, Morality/Path, Willpower, Health, Blood Pool (or equivalent for other game lines).
4. **Supernatural powers** - Disciplines, Rituals, Gifts, or custom pools with per-power ratings/descriptions.
5. **Equipment & notes** - structured arrays for gear, merits/flaws, or free-form notes.

### 2.1 Identity & Narrative Metadata

- `name`, `player`, `chronicle`, `concept`
- `faction` (Clan, Tribe, Tradition, etc.)
- `supernaturalType` / `supernaturalSubtype` (optional) - e.g., `Kindred` / `Brujah`, `Ghoul` / `Ventrue Retainer`, `Mortal` / `Civilian`.
- `nature`, `demeanor` (or equivalent personality axes)
- `age`, `apparentAge`, `pronouns`
- `notes` - short descriptive strings that help the LLM understand context

### 2.2 Attributes (Innate Traits)

| Category | Traits (0-5 default) | Notes |
| --- | --- | --- |
| **Physical** | Strength, Dexterity, Stamina | Appearance is the only Attribute that can be 0 by default |
| **Social** | Charisma, Manipulation, Appearance | |
| **Mental** | Perception, Intelligence, Wits | |

### 2.3 Abilities (Learned Traits)

- **Talents** - Alertness, Athletics, Awareness, Brawl, Empathy, Expression, Intimidation, Leadership, Streetwise, Subterfuge.
- **Skills** - Animal Ken, Crafts, Drive, Etiquette, Firearms, Larceny, Melee, Performance, Stealth, Survival.
- **Knowledges** - Academics, Computer, Finance, Investigation, Law, Medicine, Occult, Politics, Science, Technology.

> The list is configurable; these v20 defaults seed new sheets. All Abilities are integers 0-5. Talents roll without penalty at 0 dots, Skills add +1 difficulty when untrained, Knowledges cannot be rolled untrained (difficulty automatically fails unless Storyteller allows otherwise).

### 2.4 Advantages and Resource Tracks

- **Backgrounds** - array of named entries with dot ratings (0-5). Examples: Allies, Contacts, Resources, Totem, Node.
- **Virtues** - Conscience/Conviction, Self-Control/Instinct, Courage (0-5). Needed to derive Morality/Path and Willpower.
- **Morality/Path** - Humanity, Path of Night, Clarity, etc. Store as `{ type, rating }` with explicit ranges (typically 0-10).
- **Willpower** - `{ permanent, current }` where permanent is 0-10 and current cannot exceed permanent.
- **Health Track** - ordered list of `{ level, state }` entries with states (`ok`, `bashing`, `lethal`, `aggravated`). Default v20 order: Bruised -> Incapacitated.
- **Resource Pools** – array of `{ name, type, capacity, current, notes }` describing any spendable meter (Blood, Rage, Quintessence, Glamour, Mana, Vitae, Faith, etc.). The schema never assumes which pools exist; each sheet declares its own.
- **Mortal blood tracking** – every true human needs a `"Blood"` resource pool with `capacity` 10 and `current` between 0–10 so draining scenes and ghoul feeding can be tracked mechanically.

### 2.5 Powers & Edge Systems

WoD games offer dozens of supernatural subsystems, but they all boil down to structured talents with ratings and learned sub-abilities. Model them with a single schema:

- `powerSets` - array of objects:
  - `name` - e.g., "Celerity", "True Faith", "Hedge Sorcery"
  - `category` - high-level tag (`discipline`, `gift`, `ritual`, `edge`, `sorcery`, `custom`)
  - `rating` - dots or levels in the parent power (0-10 depending on system)
  - `powers` - array of sub-abilities, each `{ name, rating, description, cost?, reference? }`
  - `tags` - optional metadata (clan, tradition, tribe, etc.)
- This format supports anything from Disciplines to Numina, Hedge Magic paths, or even mortal edges by simply varying `category` and `tags`.

Merits/Flaws remain optional arrays with names, ratings, and descriptions.

### 2.6 Equipment & Holdings

Keep gear organized so both the UI and LLM know what is on-hand vs stashed:

- `equipment.inventory` - array of items actively carried/worn.
- `equipment.stored` - array of items in havens, cars, chantries, arsenals, etc. Include a `location` field per item.
- `equipment.assets` - array of major possessions (vehicles, businesses, safehouses, cults). These generally grant narrative leverage rather than being wielded directly.

Each item entry follows `{ name, type, location?, description, tags? }`.

---

## 3. JSON Sheet Structure (Implementation-Ready)

The extension should treat every sheet as a JSON object shaped like the example below. Individual sections can be omitted when empty, but the top-level keys remain consistent to keep prompts predictable.

```jsonc
{
  "id": "brujah-anna",
  "version": 1,
  "meta": {
    "name": "Anna 'Redline' Torres",
    "player": "GM Seed",
    "chronicle": "Blood on the Freeway",
    "concept": "Anarch wheelman",
    "nature": "Rebel",
    "demeanor": "Celebrant",
    "faction": { "type": "Clan", "value": "Brujah" },
    "age": 43,
    "apparentAge": 26,
    "pronouns": "she/her",
    "notes": [
      "Prefers night street races.",
      "Baby vamp, recently Embraced."
    ]
  },
  "traits": {
    "attributes": {
      "physical": { "strength": 3, "dexterity": 4, "stamina": 3 },
      "social": { "charisma": 2, "manipulation": 3, "appearance": 3 },
      "mental": { "perception": 3, "intelligence": 2, "wits": 3 }
    },
    "abilities": {
      "talents": { "alertness": 3, "athletics": 2, "brawl": 2, "subterfuge": 1 },
      "skills": { "drive": 4, "larceny": 2, "firearms": 2, "stealth": 1 },
      "knowledges": { "academics": 1, "investigation": 2, "technology": 2 }
    }
  },
  "advantages": {
    "backgrounds": [
      { "name": "Allies", "rating": 2 },
      { "name": "Contacts", "rating": 3 },
      { "name": "Safehouse Network", "rating": 1 }
    ],
    "virtues": { "conscience": 3, "selfControl": 2, "courage": 4 },
    "morality": { "type": "Humanity", "rating": 7 },
    "willpower": { "permanent": 6, "current": 4 },
    "resourcePools": [
      { "name": "Vitae", "type": "blood", "capacity": 13, "current": 9, "notes": "13th gen cap" },
      { "name": "True Faith", "type": "faith", "capacity": 1, "current": 1 }
    ],
    "health": [
      { "level": "Bruised", "state": "ok" },
      { "level": "Hurt", "state": "ok" },
      { "level": "Injured", "state": "ok" },
      { "level": "Wounded", "state": "ok" },
      { "level": "Mauled", "state": "ok" },
      { "level": "Crippled", "state": "ok" },
      { "level": "Incapacitated", "state": "ok" }
    ]
  },
  "powerSets": [
    {
      "name": "Celerity",
      "category": "discipline",
      "rating": 2,
      "tags": ["Brujah"],
      "powers": [
        { "rating": 1, "name": "Alacrity", "description": "Gain +1 move each turn." },
        { "rating": 2, "name": "Blurred Momentum", "description": "Split dice pools across multiple actions." }
      ]
    },
    {
      "name": "True Faith",
      "category": "edge",
      "rating": 1,
      "powers": [
        { "rating": 1, "name": "Ward of Light", "description": "Spend Faith to repel vampires (Dexterity + Faith resisted)." }
      ]
    }
  ],
  "merits": [
    { "name": "Enchanting Voice", "rating": 2 }
  ],
  "flaws": [
    { "name": "Prey Exclusion", "rating": -2, "description": "Won't feed on truckers." }
  ],
  "equipment": {
    "inventory": [
      { "name": "Custom pistol", "type": "weapon", "description": "Silenced 9mm", "tags": ["concealed"] },
      { "name": "Flashlight", "type": "utility", "description": "Wide-beam LED" }
    ],
    "stored": [
      { "name": "Sniper rifle", "type": "weapon", "location": "Haven gun locker", "description": "Scoped .308" }
    ],
    "assets": [
      { "name": "Nitrous street racer", "type": "vehicle", "description": "Armored muscle car", "tags": ["asset"] },
      { "name": "Auto shop front", "type": "business", "description": "Provides cover + Tools" }
    ]
  },
  "notes": [
    "Brujah Anarch allied with Odessa's crew."
  ]
}
```

> **Implementation tip** - Keep keys predictable (camelCase) and prefer explicit objects over arrays for dot ratings. This makes it trivial for the parser to look up `traits.abilities.skills.drive` and keeps prompt diffs small.

---

## 4. Runtime State & Persistence Strategy

Runtime state must be capable of holding:

1. **Registry of sheets** (global + chat overrides)
2. **Active sheet pointer** (the sheet currently shown/edited)
3. **Dice log** - chronological list of WoD roll summaries
4. **Dirty flags** - tracks which sheets diverged from on-disk JSON

Proposed `state.js` shape:

```js
export const extensionState = {
  sheets: new Map(), // key: sheetId, value: normalized sheet object
  sheetOrder: [],
  activeSheetId: null,
  diceLog: [],
  persistence: {
    globalVersion: 1,
    chatOverrides: new Map(), // key: chatId, value: per-sheet diff patches
    dirtySheets: new Set()
  }
};
```

- **Global load** - On init, fetch bundled JSON from `/extensions/v20-companion/sheets/*.json`, normalize them, and store in `sheets`.
- **Chat overrides** - `chat_metadata.rpg_companion_v20` stores per-sheet diffs (only fields changed). On load, merge `baseSheet` with overrides (deep merge, overrides win). Track `updatedAt` timestamps per override to detect conflicts.
- **Saving** - When the UI edits a trait, mark the sheet dirty for the current chat and call `saveChatData`. Offer a "Sync to File" action that surfaces the merged JSON for manual copy/paste back into the filesystem.
- **Selection** - The UI should expose a dropdown or tab list sourced from `sheetOrder`. Switching sheets updates `activeSheetId` and re-renders traits/dice options.

### 4.1 LLM Tracker Sync (Step 7)

1. **Character Sheets block** ? The parser reads the JSON array emitted in the `Character Sheets` fence, sanitizes it (clamping dots/resources, validating health states, trimming strings), and deep-merges it into the active sheets via `recordWodChatOverride`. Only sheet IDs already registered in the chat are accepted, and the prompt only injects the storyteller sheet plus persona/scene participants, so stray data cannot introduce new actors.
2. **Scene Info block** ? The single JSON object is normalized (location/time/weather/aspects/present characters) and written to `wodRuntimeState.sceneInfo`, which is persisted in `chat_metadata.rpg_companion_v20`. Clearing fields is as simple as returning empty arrays/objects; the sidebar updates silently and no text leaks into the roleplay transcript.
3. **Dice Log block** ? The client remains authoritative. Models should copy the log verbatim, and every `[[WOD-ROLL {...}]]` call rewrites the log from the true roll history before the next prompt injection. The parser ignores any attempt to fabricate results, so the LLM must always request a new outcome instead of inventing one.
4. **Prompt snapshots** ? After applying edits, the extension re-serializes the active sheets, scene info, and dice log into the same JSON blocks. These canonical strings populate `committedTrackerData` so both Together and Separate modes send the exact state that the UI displays.
5. **Dice instructions** ? Together-mode prompts explicitly document the `[[WOD-ROLL {...}]]` schema (see ?5.4) so the assistant knows which fields are required before requesting a pool mid-response.
---

## 5. Dice Pool Specification

### 5.1 Core Dice Rules

1. **Pool creation** - Most rolls are Attribute + Ability + modifiers. Some use Backgrounds, Willpower, or power ratings instead. Pool size cannot drop below 1 die unless explicitly stated.
2. **Difficulty** - Default is 6. Range: 3 (easy) to 10 (nearly impossible). Some environmental modifiers adjust difficulty instead of dice.
3. **Successes** - Each die >= difficulty counts as one success. Tens may grant rerolls depending on the 10-again setting.
4. **Botches** - If a roll yields zero successes and at least one die shows 1, the result is a botch.
5. **Willpower** - Spending 1 current Willpower adds one automatic success (does not roll an extra die) and records the expenditure.
6. **Specialties** - When rolling 7+ dice or when a specialty applies, 10s explode per the selected rule (10-again by default, optional 9-/8-again).
7. **Rerolls** - The UI may allow limited rerolls based on powers or Storyteller calls; rerolls include the same difficulty and 10-again rule and must be logged separately.

### 5.2 Dice Engine Responsibilities

- Deterministic randomness via injected RNG for testing.
- Accepts a `DicePoolConfig` object describing trait sources, modifiers, willpower usage, and reroll options.
- Returns `{ successes, outcome, dice, difficulty, modifiers, willpowerSpent, botch, logEntries }`.
- Emits log entries for each stage (initial roll, rerolls, automatic successes).

Illustrative implementation sketch:

```js
/**
 * @typedef {Object} DicePoolConfig
 * @property {string} sheetId
 * @property {string} label // e.g., "Dexterity + Drive"
 * @property {number} basePool // attribute + ability total
 * @property {number} modifier // situational dice adjustments
 * @property {number} difficulty // 3-10
 * @property {"10-again"|"9-again"|"8-again"|"no-again"} explode
 * @property {boolean} spendWillpower
 * @property {number} maxRerolls
 * @property {(sides: number) => number} rng
 */
export function resolveDicePool(config) {
  const diceRolled = Math.max(1, config.basePool + config.modifier);
  const rolls = [];
  let successes = config.spendWillpower ? 1 : 0;
  let ones = 0;

  const rollDie = () => {
    const value = config.rng(10);
    rolls.push(value);
    if (value === 1) ones += 1;
    if (value >= config.difficulty) successes += 1;
    const explodeThreshold = config.explode === "10-again" ? 10 :
      config.explode === "9-again" ? 9 :
      config.explode === "8-again" ? 8 : 11;
    if (value >= explodeThreshold && explodeThreshold <= 10) rollDie();
  };

  for (let i = 0; i < diceRolled; i++) rollDie();

  const botch = successes === (config.spendWillpower ? 1 : 0) && ones > 0;
  const outcome = botch
    ? "botch"
    : successes === (config.spendWillpower ? 1 : 0)
      ? "failure"
      : "success";

  return {
    ...config,
    diceRolled,
    rolls,
    successes,
    botch,
    outcome,
    timestamp: Date.now()
  };
}
```

> The UI and prompt builder log the returned object verbatim so the LLM can cite the exact dice math.

### 5.3 Dice Log Entry Shape

```jsonc
{
  "id": "roll-1699487630123",
  "sheetId": "brujah-anna",
  "pool": "Dexterity (4) + Drive (4) + Vehicle Rig (1)",
  "diceRolled": 9,
  "difficulty": 6,
  "explode": "10-again",
  "willpower": true,
  "rolls": [9, 10, 7, 6, 2, 5, 1, 10, 8, 6],
  "successes": 6,
  "botch": false,
  "outcome": "success",
  "notes": "Spent Willpower for +1 success; rerolled two dice due to Celerity 2."
}
```

### 5.4 LLM Roll Tags

- The assistant can request an authoritative roll mid-response using the inline command `[[WOD-ROLL {...}]]`.
- Payloads are strict JSON objects with the following keys:
  - `sheetId` (optional): defaults to the active sheet when omitted.
  - `pool`: Attribute/Ability string split by `+` (`"Dexterity + Brawl + Specialty"`). Tokens are matched case-insensitively against sheet traits; unknown tokens can be numbers for flat bonuses.
  - `difficulty` (default 6), `explode` (`"10-again"`, `"9-again"`, `"8-again"`, `"no-again"`), `modifier`, `dice` (manual pool), `rerolls`, `willpower`, and `specialty`.
  - `label`/`notes`: optional human-readable context.
- The client replaces the tag with a formatted summary (pool label, dice list, successes, outcome) and stores the resulting entry in `wodRuntimeState.diceLog` plus `chat_metadata.rpg_companion_v20`.
- Example: `[[WOD-ROLL {"sheetId":"vtm-brujah-valeria","pool":"Dexterity + Brawl","difficulty":6,"modifier":1,"willpower":false}]]`

---

## 6. Serialization & Prompt Expectations

- **Tracker instructions** - Prompts must describe each active character with consistent block formatting: one block for sheet data, one for resource tracks, one for dice log summary.
- **LLM updates** - Parser expects JSON-like fenced blocks in replies with the same structure as stored sheets (only changed fields required). Values stay within defined ranges (e.g., dots 0-5, blood pool 0-capacity).
- **Dice references** - When the LLM triggers a roll, it must cite the dice log entry ID or recreated label so the client can verify.

---

## 7. Step 5 Deliverable – Sheet UI, Editing & Personas

1. **WoD-first sidebar** – The User Stats column is now a full character sheet: Attributes/Abilities grouped by category, Advantages (Backgrounds, Virtues, Morality, Willpower), Health/Blood/resource pools, Disciplines, gear, merits/flaws, notes, and the in-panel dice log.
2. **Interactive editing model** – Live-mode keeps resources clickable while structural traits require toggling **Edit Sheet**. Dot tracks enforce caps (0–5 dots or dynamic capacities), health boxes cascade damage states, and every field writes into chat overrides for SillyTavern persistence.
3. **Dirty tracking & manual sync** – Any edit marks the sheet dirty, mirrors into `chat_metadata.rpg_companion_v20`, and exposes “Sync to File” / “Reset to File” actions so the canonical JSON on disk stays authoritative.
4. **Dice log integration** – Recent rolls appear in the sidebar with filters (active character / all / per-sheet) so storytellers and the LLM can cite outcomes outside the modal roller.
5. **Persona quickbar** – Whenever SillyTavern personas (single chats or group members) are present, the toolbar renders a dropdown per persona. Selecting a sheet links that persona globally, and the “Open” button instantly focuses its WoD sheet—multi-persona chats can flip between bound sheets without hunting through the global selector.

## 8. Step 8 Deliverable – File-backed Multi-character Sync

1. **Persona metadata contracts** – The Characters tab renders every SillyTavern persona detected in the current chat (group members included) and resolves their sheet via metadata first. Supported keys: `metadata.rpg_companion_v20.sheetId`, `metadata.extensions["third-party/v20-companion"].sheetId`, or persona tags like `wod-sheet:vtm-brujah-valeria`. Metadata-driven links are read-only in the UI so Persona Manager remains the canonical source. When no metadata exists, the dropdown remains editable and falling back to manual bindings stored in extension settings; a last-resort auto-match searches for a sheet whose `meta.name` equals the persona name (case-insensitive) and displays it as “Auto-match”.
2. **Characters tab tooling** – Each persona row exposes its current sheet, the link source (Metadata / Manual / Auto), and an **Open** button to focus that sheet without using the global selector. The tab header also surfaces global actions: **Reload Sheets** re-fetches every JSON declared in `sheet-index.json`, while **Import Sheet** lets users load an arbitrary WoD JSON file without writing to the filesystem.
3. **Sync to File workflow** – The per-sheet sync panel now offers Copy, Download, and Import controls so Storytellers can round-trip JSON without leaving the UI. Importing JSON for the active sheet replaces the canonical copy (subject to ID validation) while leaving chat overrides intact. Downloaded files retain the sheet ID as filename for easy manual edits.
4. **Hash-based watcher** – Every time bundled sheets are fetched, the loader computes a simple hash of each JSON payload and stores it in `localStorage` (`v20-companion.sheet-hashes`) alongside runtime metadata (`wodRuntimeState.sheetDigests`). Manual reloads compare the new hashes to the previous set and produce a summary (`addedSheetIds`, `removedSheetIds`, `changedSheetIds`) that the Characters tab displays in a reload banner. This satisfies the “user-initiated watcher” requirement: the UI clearly signals when filesystem edits changed a sheet and which IDs were affected without attempting forbidden background file writes.
5. **Prompt auto-sync** – Persona bindings directly feed the prompt builder: every linked sheet is serialized into the `Character Sheets` tracker block each turn, even if the user never edits Scene Info. Present characters fallback to persona data so the `Scene Info` fence always lists sheet IDs, keeping LLM responses grounded in real mechanics.

---

**Changelog (Step 1)** - Reorganized the specification to emphasize concrete data shapes, runtime state expectations, and dice-handling pseudocode aligned with the AGENTS plan. This file now serves as the contract for Step 2 development.
