# RPG Companion Extension for SillyTavern

An immersive RPG extension for browsers that tracks character stats, scene information, and character thoughts in a beautiful, customizable UI panel. All automated! Works with any preset. Choose between Together or Separate generation modes for context and generation control.

## World of Darkness v20 Sheets

The v20 overhaul replaces the generic tracker panels with a fully structured WoD character sheet editor:

- Load multiple JSON sheets from `sheets/` and swap between them via the new character selector.
- Edit Attributes, Abilities, Backgrounds, Virtues, Willpower, resource pools, health states, powers, merits/flaws, equipment, and notes directly inside the sidebar. All controls enforce WoD dot/box limits.
- Every edit is tracked per chat via SillyTavern persistence (dirty sheets are flagged with a “Chat override” pill). Dice rolls launched from the modal automatically appear in the built-in dice log panel so both you and the LLM can reference authoritative results.
- The **Characters** tab lists every SillyTavern persona that is currently in the chat. Each dropdown auto-selects the correct sheet by reading the persona’s metadata (`rpg_companion_v20.sheetId`, `extensions["third-party/v20-companion"].sheetId`, or a `wod-sheet:` tag), while still allowing manual overrides for edge cases.

### Editing & Resource Tracking

- The sheet opens in **view mode** so you can reference mechanics without worrying about stray clicks. Hit the **Edit Sheet** button in the toolbar to unlock structural edits (attributes, abilities, backgrounds, powers, etc.). Inventory rows and live resources stay editable even while the rest of the sheet is locked.
- Health levels now behave like the printed tracker: clicking any level cycles through Bashing -> Lethal -> Aggravated damage while automatically filling every box up to that point. Click the same level again to clear all wounds back to "ok".
- Willpower uses the same single-track display as blood pools, so filled dots equal current points and grey dots show the permanent cap.
- Every other resource pool renders as a single dot track: filled dots show the current amount, greyed dots show remaining capacity, and clicking a dot immediately sets the pool to that value.

### Persona Linking & Characters Tab

- The **Characters** tab now mirrors the Personas panel under the sheet toolbar, showing every SillyTavern persona that is currently in the chat (group chats show all members). Each row displays the linked sheet, the linking source (metadata/manual/auto-match), and a quick **Open** button that focuses that sheet.
- Any persona with a linked sheet (metadata, tag, or manual binding) is automatically serialized into the `Character Sheets` tracker block, so the prompt builder always supplies real mechanical data to the LLM without waiting for manual Scene Info edits.
- To link a persona permanently, open it in SillyTavern’s Persona Manager and add a metadata entry such as:

  ```json
  {
    "rpg_companion_v20": {
      "sheetId": "vtm-brujah-valeria"
    }
  }
  ```

  You can also use `extensions["third-party/v20-companion"].sheetId` or add a persona tag like `wod-sheet:vtm-brujah-valeria`. Metadata-driven links are read-only inside the UI so you always know when the persona manager is authoritative.
- If no metadata is present the dropdown stays editable—select a sheet to create a global manual binding or leave it blank to rely on automatic name matching.

### Tracker Injection Flow

- The extension now injects the canonical `Character Sheets`, `Scene Info`, and `Dice Log` JSON code fences directly into the Together-mode prompt before every reply. The assistant no longer echoes those trackers; it simply references the blocks that already exist in context, keeping responses shorter and reducing hallucinations.
- When Separate mode is enabled, the narration pass still omits trackers. A second “tracker update” pass replays the same canonical blocks and asks the model to edit only the fields that changed. The parser applies those edits back into the UI, so the extension remains authoritative.
- Dice rolls continue to use `[[WOD-ROLL {...}]]` commands. The injected dice log is read-only during narration; only tracker-update prompts expect JSON fences in the response.

### Manual JSON Sync

Sheets remain file-backed so you can keep authoritative copies in version control:

1. Open the active character and click **Sync to File** to expose the raw JSON. From there you can copy it, download it, or import a JSON file to update the active sheet.
2. Save your edits into `sheets/<sheet-id>.json` (or a new file) with your text editor of choice.
3. Click **Reload Sheets** in the Characters tab to pull fresh copies from disk. The extension stores hashes of every bundled sheet, so the reload banner tells you exactly which files were added, updated, or removed. You can also use the **Import Sheet** button in the Characters tab to load custom JSON without editing the filesystem.

Hit **Reset to File** whenever you want to drop the current chat override and revert to the on-disk copy.

Any chat-specific tweaks are stored under `chat_metadata.rpg_companion_v20`, so swipes/regenerations preserve sheet state even if the source JSON changes underneath.

[![My Discord](https://img.shields.io/badge/Discord-Join%20Server-7289da)](https://discord.com/invite/KdAkTg94ME)
[![Support Me](https://img.shields.io/badge/Ko--fi-Support%20Creator-ff5e5b)](https://ko-fi.com/marinara_spaghetti)

## 📥 Installation

1. Open SillyTavern

2. Go to the Extensions tab (cubes icon at the top)

3. Go to Install extension

4. Copy-paste this link: https://github.com/SpicyMarinara/rpg-companion-sillytavern

5. Press Install for all users/Install just for me

![png](https://i.imgur.com/DYuIMWt.png)

![png](https://i.imgur.com/IJyIEMF.png)

## ✨ Features

![png](https://i.imgur.com/cVCAby0.png)

### Core Functionality

- **📊 User Stats Tracker**: Fully customizable stats with visual progress bars, custom status fields, skills section, and dynamic inventory management
- **🌍 Info Box Dashboard**: Configurable widgets for date, weather, temperature, time, location, and recent events
- **💭 Present Characters Panel**: Track multiple characters with custom fields, relationship badges, character-specific stats, and internal thoughts
- **🎭 Floating Thought Bubbles**: Optional thought bubbles positioned next to character avatars in chat
- **🎲 Classic RPG Stats**: STR, DEX, CON, INT, WIS, CHA attributes with dice roll support
- **📦 Advanced Inventory System**: Multi-location storage (On Person, Stored locations, Assets) with v2 format
- **🎯 Character Stats**: Track health, energy, or any custom stats for each present character with color interpolation
- **📜 Immersive HTML**: Enhance the immersion by including creative HTML/CSS/JS elements in your roleplay
- **➡️ Plot Progression**: Progress the plot with randomized events or natural progression with a click of a button
- **🎨 Multiple Themes**: Cyberpunk, Fantasy, Minimal, Dark, Light, and Custom themes
- **✏️ Live Editing**: Edit all tracker fields directly in the panels with auto-save
- **💾 Per-Swipe Data Storage**: Each swipe preserves its own tracker data
- **🎛️ Tracker Configuration**: Customize every aspect of trackers - add/remove stats, fields, widgets, and more

### Smart Features

- **🔄 Swipe Detection**: Automatically handles swipes and maintains correct tracker context
- **📝 Context-Aware**: Weather, stats, and character states naturally influence the narrative
- **🎭 Multiple Characters**: Tracks thoughts, relationships, and stats for all present characters
- **📍 Thought Bubbles in Chat**: Optional floating thought bubbles positioned next to character avatars
- **🌈 Customizable Colors**: Create your own theme with custom color schemes
- **📱 Mobile Support**: Responsive design with horizontal scrolling for stats
- **🔧 Advanced Configuration**: Add custom stats, fields, and widgets through Tracker Settings
- **🎨 Color Interpolation**: Stats smoothly transition from low to high colors based on values
- **💬 Multi-line Format**: Clean, structured format for AI generation and parsing
- **🧹 Auto-cleanup**: Automatically removes placeholder brackets from AI responses

### To-Do

1. Allow users to use a different model for the separate trackers generation
2. ~~Make all trackers and fields customizable~~ ✅ Done!
3. ~~Kill myself~~

## ⚙️ Settings

### Main Panel Controls

- **Panel Position**: Left or Right side of the chat
- **Theme**: Choose from 6 built-in themes or create a custom
- **Auto-update after messages**: Automatically refresh RPG data after each message
- **Context Messages**: How many recent messages to include when generating updates (only for Separate generation mode)

### Display Options

- **Show User Stats**: Display the character stats panel
- **Show Info Box**: Display the scene information panel
- **Show Character Thoughts**: Display the AI character's internal thoughts

### Generation Modes

#### Together Mode

Tracker data is generated within the main AI response and automatically extracted:

Example:
User: walks into the tavern

AI: Trackers + Full roleplay response

↓ Extension extracts tracker data from the response

↓ Displays in sidebar panels

↓ Main chat shows clean roleplay text

Pros:
- Single API call
- Faster response
- Simpler setup

Cons:
- Tracker formatting mixed in AI response
- May affect roleplay quality slightly

#### Separate Mode

Tracker data is generated in a separate API call after the main response:

Example:
User: walks into the tavern

AI: Pure roleplay response - no tracker data

AI: Separate call with just the tracker data

↓ Extension sends a separate request with context

↓ AI generates only tracker data

↓ Displays in sidebar panels

↓ Context summary injected into the next generation

Pros:
- Clean roleplay responses
- Better roleplay quality
- Contextual summary enhances immersion

Cons:
- Extra API call
- Slightly slower

### Model Selection

- **Use main chat model**: Use the same model as your chat (recommended)
- Custom model selection (coming soon)

## 📝 How to Use

### Quick Start

1. Enable the extension in the Extensions tab
2. Choose your generation mode: Together or Separate
3. Select which panels to display (User Stats, Info Box, Character Thoughts)
4. Start chatting! The tracker updates automatically

### WoD Sheet Files & Manual Editing

- Bundled character sheets now live in `sheets/`. The extension reads `sheet-index.json` on startup and hydrates every listed JSON file into the WoD registry automatically.
- To customize a baseline sheet, open its JSON file in a text editor, adjust the fields defined in `docs/wod-spec.md`, and refresh SillyTavern (or toggle the extension off/on). The loader fetches the file on every page load, so your edits appear immediately.
- Session-specific tweaks stay in `chat_metadata.rpg_companion_v20` as overrides with timestamps. File edits always win when IDs collide, but the chat metadata keeps your latest per-chat adjustments layered on top.
- Keep the schema handy by referencing `docs/vtm-v20-reference.md` for condensed mechanical summaries (Backgrounds, Disciplines, Banes, etc.) before editing the JSON.

### WoD Dice Engine & LLM Rolls

- Open the dice modal from the sidebar to roll Attribute + Ability pools pulled directly from the active sheet. The modal supports difficulty selection, explosion rules (10-/9-/8-again), bonus dice, rerolls, willpower spends, and free-form notes; every roll is logged automatically.
- The dice display now shows the most recent WoD log entry instead of generic NdM output. Use the clear button if you need to wipe the local log for a scene reset.
- The LLM can request authoritative rolls mid-response by emitting a single tag such as `[[WOD-ROLL {"sheetId":"vtm-brujah-valeria","pool":"Dexterity + Brawl","difficulty":6,"willpower":false}]]`. The extension executes the pool, replaces the tag with a human-readable summary, and records the outcome so future prompts stay consistent.
- Logs persist per chat via `chat_metadata.rpg_companion_v20`, so dice references remain authoritative across swipes, reloads, and manual JSON edits.

### Prompt Schema & Context Blocks

- Every model response now starts with up to three labeled JSON code fences: `Character Sheets`, `Scene Info`, and `Dice Log`. These blocks mirror the in-panel WoD sheet, the current scene tracker, and the authoritative dice history so SillyTavern can round-trip edits with zero loss.
- **Character Sheets** is an array of sheet objects following the schema in `docs/wod-spec.md`. Include only the characters currently in play, keep dots as integers (0–5 unless an elder explicitly exceeds it), never let resource pools exceed capacity, and stick to the standard health states (`ok`, `bashing`, `lethal`, `aggravated`).
- **Scene Info** is a single object with keys such as `location`, `time`, `weather`, `sceneAspects`, `openThreads`, and `presentCharacters`. Each present character entry pairs the WoD sheet ID (when available) with role/status/intent/thoughts notes so the model and UI stay synchronized.
- **Dice Log** is an array of recent roll summaries (`id`, `sheetId`, `pool`, `difficulty`, `explode`, `willpower`, `successes`, `outcome`, `rolls`, `notes`). Treat it as read-only unless a new `[[WOD-ROLL {...}]]` tag was executed during the response—the extension replaces the tag with the official summary and rewrites the log before the next prompt injection.
- Together and Separate generation modes both inject these same blocks plus a concise textual summary, so the LLM always reads the exact data that the sidebar renders and vice versa.

### Tracker Synchronization

- The extension now sanitizes and applies the `Character Sheets` JSON emitted by the model to the active WoD sheets. Values are clamped to v20 ranges, health states are validated, and changes are stored as chat overrides so they persist per conversation without touching the on-disk sheet files.
- `Scene Info` is also parsed and saved in chat metadata. Updating the JSON silently refreshes the sidebar scene card without surfacing any extra text inside the roleplay transcript.
- `Dice Log` remains authoritative on the client: the model simply copies the latest block, and the UI regenerates it from the tracked rolls after every response. Whenever the assistant needs a new outcome it must call the `[[WOD-ROLL {...}]]` tool; the user never sees these bookkeeping updates in chat.

### Editing Tracker Data

You can edit most fields by clicking on them:

- **User Stats**: Click on stat percentages, mood emoji, status fields, skills, inventory items, or quests
- **Info Box**: Click on date fields, weather, temperature, time, location, or recent events
- **Present Characters**: Click on character emoji, name, custom fields, relationship badge, or stats
- **Thought Bubbles**: Click on thought text to edit (bubble will refresh to maintain positioning)

### Tracker Configuration

Access comprehensive customization through the Tracker Settings button:

**User Stats Configuration:**
- Add/remove custom stats with unique names
- Configure Status section (mood emoji + custom fields)
- Configure Skills section with custom skill fields
- Toggle RPG attributes display

**Info Box Configuration:**
- Enable/disable individual widgets (Date, Weather, Temperature, Time, Location, Recent Events)
- Choose temperature unit (Celsius/Fahrenheit)

**Present Characters Configuration:**
- Add custom character fields (appearance, action, demeanor, etc.)
- Configure relationship status options
- Enable character-specific stats tracking
- Customize thought bubble label and description
- All fields are dynamically generated in prompts

### Swipe Support

The extension fully supports swipes:

- Each swipe stores its own tracker data
- Swiping loads the data for that specific swipe
- New swipe generation uses the committed data from before the swipe
- User edits are preserved across swipes

### Manual Update

You can click the "Refresh RPG Info" button in the settings to refresh the RPG data at any time in separate generation mode.

### Compatibility with Guided Generations

This extension detects when a "guided generation" prompt is submitted (for example, via the GuidedGenerations extension which injects an ephemeral `instruct` prompt), and will avoid adding its tracker injection instructions (requests for stats, info box, and context prompts) to the generation context. This prevents conflicting instructions and ensures guided generations behave as the user expects.

If you want tracker prompts to apply during a guided generation, run the update via separate generation or temporarily disable guided generation in the other extension.

There is a new setting "Skip Tracker & HTML Injections during Guided Generations" in the RPG Companion settings (Advanced section). It now supports three modes:
- none: never skip (always inject the tracker prompts as usual, default)
- impersonation: only skip when an impersonation-style guided generation is detected
- guided: skip whenever a guided `instruct` or `quiet_prompt` generation is detected


## 🎨 Themes

Choose from 6 beautiful themes:

- **Cyberpunk**: Neon pink and cyan with futuristic vibes
- **Fantasy**: Purple and gold with mystical aesthetics
- **Minimal**: Clean monochrome design
- **Dark**: Deep blacks and subtle accents
- **Light**: Bright and airy interface
- **Custom**: Create your own with custom colors

## 🛠️ Technical Details

If you ever have an awesome idea to do your own SillyTavern extension, don't.

## 🐛 Troubleshooting

### Extension doesn't appear

- Refresh your browser
- Restart SillyTavern
- Ensure it's enabled in the Extensions tab

### Stats not updating

- Check that "Auto-update" is enabled
- Try clicking "Manual Update" to test
- Verify your AI backend is responding correctly
- Check console for error messages

### Display issues

- Try refreshing the page
- Check if other extensions are conflicting
- Verify CSS is loading correctly

### Thought bubble positioning

- Bubbles use a fixed 350px width for consistent positioning
- Bubbles refresh after edits to maintain alignment
- If issues persist, try toggling the Character Thoughts display

## 📜 License

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

Copyright (C) 2024 marinara_spaghetti

## 💖 Support

If you enjoy this extension, consider supporting development:

- [Join our Discord community](https://discord.com/invite/KdAkTg94ME)
- [Support on Ko-fi](https://ko-fi.com/marinara_spaghetti)

## 🙏 Credits

- Extension Development: Marinara with assistance from GitHub Copilot
- Immersive HTML concept: Credit to u/melted_walrus
- Info Box prompt inspiration: MidnightSleeper
- Stats Tracker concept: Community feedback
- Special thanks to Quack for helping me with the CSS
- Massive kudos to Paperboy for making the mobile version work, fixing bugs, and adding the inventory system
- Thanks to IDeathByte for solving some CSS scaling issues

## 🚀 Planned Features

- Support for selecting a different model for RPG updates

## 💡 Tips

1. **Context Messages**: Start with 4 messages and adjust based on your needs. More messages = better context, but slower updates
2. **Performance**: If updates are slow, consider reducing the context depth or using a faster model
3. **Customization**: You can modify the prompts in index.js to add your own stat categories or change the format

## 📋 Compatibility

- Requires SillyTavern 1.11.0 or higher
- Works with all AI backends (OpenAI, Claude, KoboldAI, etc.)

---

Made with ❤️ by Marinara

PS I'm looking for a job or a sponsor to fund my custom AI frontend, contact me if interested:
mgrabower97@gmail.com
