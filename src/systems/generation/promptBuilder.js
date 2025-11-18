/**
 * Prompt Builder Module
 * Handles all AI prompt generation for RPG tracker data
 */

import { chat } from '../../../../../../../script.js';
import {
    extensionSettings,
    committedTrackerData,
    wodRuntimeState,
    getActiveWodSheet
} from '../../core/state.js';
import {
    collectPersonaBindings,
    buildPersonaSceneEntries,
    normalizePersonaName
} from '../../core/personas.js';

// Type imports
/** @typedef {import('../../types/inventory.js').InventoryV2} InventoryV2 */

/**
 * Builds a formatted inventory summary for AI context injection.
 * Converts v2 inventory structure to multi-line plaintext format.
 *
 * @param {InventoryV2|string} inventory - Current inventory (v2 or legacy string)
 * @returns {string} Formatted inventory summary for prompt injection
 * @example
 * // v2 input: { onPerson: "Sword", stored: { Home: "Gold" }, assets: "Horse", version: 2 }
 * // Returns: "On Person: Sword\nStored - Home: Gold\nAssets: Horse"
 */
export function buildInventorySummary(inventory) {
    // Handle legacy v1 string format
    if (typeof inventory === 'string') {
        return inventory;
    }

    // Handle v2 object format
    if (inventory && typeof inventory === 'object' && inventory.version === 2) {
        let summary = '';

        // Add On Person section
        if (inventory.onPerson && inventory.onPerson !== 'None') {
            summary += `On Person: ${inventory.onPerson}\n`;
        }

        // Add Stored sections for each location
        if (inventory.stored && Object.keys(inventory.stored).length > 0) {
            for (const [location, items] of Object.entries(inventory.stored)) {
                if (items && items !== 'None') {
                    summary += `Stored - ${location}: ${items}\n`;
                }
            }
        }

        // Add Assets section
        if (inventory.assets && inventory.assets !== 'None') {
            summary += `Assets: ${inventory.assets}`;
        }

        return summary.trim();
    }

    // Fallback for unknown format
    return 'None';
}

export const MAX_PROMPT_SHEETS = 3;
export const MAX_PROMPT_DICE_LOG = 5;
const MAX_NOTES_PER_SHEET = 4;
const MAX_EQUIPMENT_ITEMS = 6;

function stringifyForPrompt(value) {
    try {
        return JSON.stringify(value, null, 2);
    } catch (error) {
        console.warn('[RPG Companion] Failed to stringify prompt payload', error);
        return '[]';
    }
}

function clipArray(values, limit) {
    if (!Array.isArray(values)) {
        return [];
    }
    if (!limit || values.length <= limit) {
        return values.slice();
    }
    return values.slice(0, limit);
}

function isLikelyJsonArray(text) {
    if (typeof text !== 'string') return false;
    const trimmed = text.trim();
    return trimmed.startsWith('[') && trimmed.endsWith(']');
}

function isLikelyJsonObject(text) {
    if (typeof text !== 'string') return false;
    const trimmed = text.trim();
    return trimmed.startsWith('{') && trimmed.endsWith('}');
}

export function collectSheetsForPrompt(limit = MAX_PROMPT_SHEETS) {
    const selected = [];
    const seen = new Set();
    const sheets = wodRuntimeState.sheets instanceof Map ? wodRuntimeState.sheets : new Map();

    const pushSheet = (sheet) => {
        if (sheet && sheet.id && !seen.has(sheet.id)) {
            selected.push(sheet);
            seen.add(sheet.id);
        }
    };

    pushSheet(getActiveWodSheet());

    const personaEntries = collectPersonaBindings();
    personaEntries.forEach(entry => {
        if (selected.length >= limit) {
            return;
        }
        if (entry.sheet) {
            pushSheet(entry.sheet);
        } else if (entry.sheetId) {
            pushSheet(sheets.get(entry.sheetId));
        }
    });

    const order = wodRuntimeState.sheetOrder || [];
    order.some(sheetId => {
        if (selected.length >= limit) {
            return true;
        }
        const sheet = sheets.get(sheetId);
        pushSheet(sheet);
        return false;
    });

    return selected.slice(0, limit);
}

function pruneEmpty(value) {
    if (Array.isArray(value)) {
        const prunedArray = value
            .map(item => pruneEmpty(item))
            .filter(item => {
                if (item === undefined || item === null) return false;
                if (Array.isArray(item)) return item.length > 0;
                if (typeof item === 'object') return Object.keys(item).length > 0;
                return true;
            });
        return prunedArray;
    }

    if (value && typeof value === 'object') {
        const prunedObject = {};
        Object.entries(value).forEach(([key, entry]) => {
            const pruned = pruneEmpty(entry);
            if (pruned === undefined || pruned === null) {
                return;
            }
            if (Array.isArray(pruned) && pruned.length === 0) {
                return;
            }
            if (typeof pruned === 'object' && !Array.isArray(pruned) && Object.keys(pruned).length === 0) {
                return;
            }
            prunedObject[key] = pruned;
        });
        return prunedObject;
    }

    return value;
}

function filterAbilityValues(record = {}) {
    const filtered = {};
    Object.entries(record).forEach(([key, value]) => {
        const numeric = Number(value) || 0;
        if (numeric > 0) {
            filtered[key] = numeric;
        }
    });
    return filtered;
}

export function serializeSheetForPrompt(sheet) {
    if (!sheet) {
        return null;
    }
    const meta = sheet.meta || {};
    const traits = sheet.traits || {};
    const abilities = traits.abilities || {};
    const attributes = traits.attributes || {};
    const advantages = sheet.advantages || {};
    const equipment = sheet.equipment || {};

    return pruneEmpty({
        sheetId: sheet.id,
        name: meta.name || sheet.id,
        concept: meta.concept || null,
        chronicle: meta.chronicle || null,
        faction: meta.faction?.value || meta.faction?.type || null,
        supernaturalType: meta.supernaturalType || meta.supernaturalSubtype || null,
        nature: meta.nature || null,
        demeanor: meta.demeanor || null,
        notes: clipArray(Array.isArray(sheet.notes) ? sheet.notes : meta.notes || [], MAX_NOTES_PER_SHEET),
        traits: {
            attributes: {
                physical: attributes.physical || {},
                social: attributes.social || {},
                mental: attributes.mental || {}
            },
            abilities: {
                talents: filterAbilityValues(abilities.talents || {}),
                skills: filterAbilityValues(abilities.skills || {}),
                knowledges: filterAbilityValues(abilities.knowledges || {})
            }
        },
        advantages: {
            backgrounds: clipArray(advantages.backgrounds || [], MAX_EQUIPMENT_ITEMS).map(entry => ({
                name: entry.name,
                rating: Number(entry.rating) || 0,
                description: entry.description || undefined
            })),
            virtues: advantages.virtues || undefined,
            morality: advantages.morality || undefined,
            willpower: advantages.willpower || undefined,
            health: advantages.health || undefined,
            resourcePools: clipArray(advantages.resourcePools || [], MAX_EQUIPMENT_ITEMS).map(pool => ({
                name: pool.name,
                type: pool.type,
                capacity: pool.capacity,
                current: pool.current,
                notes: pool.notes || undefined
            }))
        },
        powerSets: clipArray(sheet.powerSets || [], MAX_EQUIPMENT_ITEMS).map(set => pruneEmpty({
            name: set.name,
            category: set.category,
            rating: set.rating,
            tags: set.tags,
            notes: set.notes,
            powers: clipArray(set.powers || [], MAX_EQUIPMENT_ITEMS).map(power => pruneEmpty({
                name: power.name,
                rating: power.rating,
                description: power.description,
                tags: power.tags,
                cost: power.cost
            }))
        })),
        merits: clipArray(sheet.merits || [], MAX_EQUIPMENT_ITEMS),
        flaws: clipArray(sheet.flaws || [], MAX_EQUIPMENT_ITEMS),
        equipment: pruneEmpty({
            inventory: clipArray(equipment.inventory || [], MAX_EQUIPMENT_ITEMS),
            stored: clipArray(equipment.stored || [], MAX_EQUIPMENT_ITEMS),
            assets: clipArray(equipment.assets || [], MAX_EQUIPMENT_ITEMS)
        })
    });
}

function buildCharacterSheetsBlock() {
    const committed = committedTrackerData.userStats;
    if (committed && isLikelyJsonArray(committed)) {
        return committed.trim();
    }
    const sheets = collectSheetsForPrompt();
    if (sheets.length === 0) {
        return stringifyForPrompt([]);
    }
    const payload = sheets
        .map(serializeSheetForPrompt)
        .filter(Boolean);
    return stringifyForPrompt(payload);
}

function buildSceneInfoBlock() {
    const committed = committedTrackerData.infoBox;
    if (committed && isLikelyJsonObject(committed)) {
        return committed.trim();
    }
    const runtimeScene = wodRuntimeState.sceneInfo ? JSON.parse(JSON.stringify(wodRuntimeState.sceneInfo)) : null;
    const sceneInfo = runtimeScene || {
        location: 'Unknown location',
        time: 'Unset',
        weather: null,
        sceneAspects: [],
        openThreads: [],
        presentCharacters: []
    };
    injectPersonaPresence(sceneInfo);
    return stringifyForPrompt(sceneInfo);
}

function buildDiceLogBlock() {
    const committed = committedTrackerData.characterThoughts;
    if (committed && isLikelyJsonArray(committed)) {
        return committed.trim();
    }
    const diceEntries = formatDiceLogEntries(wodRuntimeState.diceLog || []);
    return stringifyForPrompt(diceEntries);
}

export function formatDiceLogEntries(entries, limit = MAX_PROMPT_DICE_LOG) {
    return clipArray(entries || [], limit).map(entry => pruneEmpty({
        id: entry.id,
        sheetId: entry.sheetId || undefined,
        sheetName: entry.sheetName || undefined,
        pool: entry.poolLabel,
        difficulty: entry.difficulty,
        explode: entry.explode,
        specialty: entry.specialtyApplies ? true : undefined,
        willpower: entry.spendWillpower ? true : undefined,
        successes: entry.successes,
        outcome: entry.outcome,
        rolls: entry.rolls,
        timestamp: entry.timestamp,
        notes: entry.notes || undefined
    }));
}

function parseSceneInfoBlock(blockText) {
    if (!blockText) {
        return null;
    }
    try {
        return JSON.parse(blockText);
    } catch (error) {
        return null;
    }
}

function buildSheetSummary(sheetObject) {
    if (!sheetObject) {
        return null;
    }
    const attributes = sheetObject.traits?.attributes || {};
    const advantages = sheetObject.advantages || {};
    const willpower = advantages.willpower;
    const resourcePools = advantages.resourcePools || [];
    const primaryPool = resourcePools[0];

    const lines = [];
    lines.push(`${sheetObject.name || sheetObject.sheetId} (${sheetObject.sheetId}) - ${sheetObject.concept || 'No concept provided'}`);
    const physical = attributes.physical || {};
    const social = attributes.social || {};
    const mental = attributes.mental || {};
    lines.push(`Physical Str${physical.strength ?? 0}/Dex${physical.dexterity ?? 0}/Sta${physical.stamina ?? 0}. Social Cha${social.charisma ?? 0}/Man${social.manipulation ?? 0}/App${social.appearance ?? 0}. Mental Per${mental.perception ?? 0}/Int${mental.intelligence ?? 0}/Wit${mental.wits ?? 0}.`);
    if (willpower) {
        lines.push(`Willpower ${willpower.current ?? 0}/${willpower.permanent ?? 0}.`);
    }
    if (primaryPool) {
        lines.push(`${primaryPool.name}: ${primaryPool.current ?? 0}/${primaryPool.capacity ?? 0}.`);
    }
    return lines.join(' ');
}

function buildSceneInfoSummary(sceneInfo) {
    if (!sceneInfo) {
        return 'Scene info not yet set.';
    }
    const parts = [];
    if (sceneInfo.location) {
        parts.push(`Location: ${sceneInfo.location}`);
    }
    if (sceneInfo.time) {
        parts.push(`Time: ${sceneInfo.time}`);
    }
    if (sceneInfo.weather) {
        parts.push(`Weather: ${sceneInfo.weather}`);
    }
    const aspects = Array.isArray(sceneInfo.sceneAspects) ? sceneInfo.sceneAspects : [];
    if (aspects.length > 0) {
        parts.push(`Aspects: ${aspects.join(', ')}`);
    }
    const threads = Array.isArray(sceneInfo.openThreads) ? sceneInfo.openThreads : [];
    if (threads.length > 0) {
        parts.push(`Open threads: ${threads.join('; ')}`);
    }
    const present = Array.isArray(sceneInfo.presentCharacters) ? sceneInfo.presentCharacters : [];
    if (present.length > 0) {
        const charSummaries = present.map(char => {
            const bits = [char.name];
            if (char.role) bits.push(`role: ${char.role}`);
            if (char.status) bits.push(`status: ${char.status}`);
            if (char.intent) bits.push(`intent: ${char.intent}`);
            return bits.filter(Boolean).join(' | ');
        });
        parts.push(`Present: ${charSummaries.join(' || ')}`);
    }
    return parts.join(' ');
}

function buildDiceLogSummary(entries) {
    if (!entries || entries.length === 0) {
        return 'No WoD dice rolls logged yet.';
    }
    return entries.map(entry => {
        const actor = entry.sheetName || entry.sheetId || 'Unknown character';
        return `${actor} rolled ${entry.poolLabel || 'a pool'} at difficulty ${entry.difficulty}: ${entry.successes} successes (${entry.outcome}).`;
    }).join(' ');
}

function injectPersonaPresence(sceneInfo) {
    if (!sceneInfo) {
        return;
    }
    const personaEntries = buildPersonaSceneEntries();
    if (!Array.isArray(sceneInfo.presentCharacters) || sceneInfo.presentCharacters.length === 0) {
        if (personaEntries.length > 0) {
            sceneInfo.presentCharacters = personaEntries;
        }
        return;
    }
    if (personaEntries.length === 0) {
        return;
    }
    const personaMap = new Map();
    personaEntries.forEach(entry => {
        if (entry.name) {
            personaMap.set(normalizePersonaName(entry.name), entry);
        }
    });
    sceneInfo.presentCharacters = sceneInfo.presentCharacters.map(entry => {
        if (!entry || entry.sheetId || !entry.name) {
            return entry;
        }
        const match = personaMap.get(normalizePersonaName(entry.name));
        if (match && match.sheetId) {
            return { ...entry, sheetId: match.sheetId };
        }
        return entry;
    });
}

/**
 * Builds a dynamic attributes string based on configured RPG attributes.
 * Uses custom attribute names and values from classicStats.
 *
 * @returns {string} Formatted attributes string (e.g., "STR 10, DEX 12, INT 15, LVL 5")
 */

/**
 * Generates an example block showing current tracker states in markdown code blocks.
 * Uses COMMITTED data (not displayed data) for generation context.
 *
 * @returns {string} Formatted example text with tracker data in code blocks
 */
export function generateTrackerExample() {
    const blocks = [];

    if (extensionSettings.showUserStats) {
        blocks.push([
            '```Character Sheets',
            buildCharacterSheetsBlock(),
            '```'
        ].join('\n'));
    }

    if (extensionSettings.showInfoBox) {
        blocks.push([
            '```Scene Info',
            buildSceneInfoBlock(),
            '```'
        ].join('\n'));
    }

    if (extensionSettings.showCharacterThoughts) {
        blocks.push([
            '```Dice Log',
            buildDiceLogBlock(),
            '```'
        ].join('\n'));
    }

    return blocks.join('\n\n').trim();
}

/**
 * Generates the instruction portion - format specifications and guidelines.
 *
 * @param {boolean} includeHtmlPrompt - Whether to include the HTML prompt (true for main generation, false for separate tracker generation)
 * @param {boolean} includeContinuation - Whether to include "After updating the trackers, continue..." instruction
 * @returns {string} Formatted instruction text for the AI
 */
export function generateTrackerInstructions(includeHtmlPrompt = true, includeContinuation = true) {
    const hasSheets = !!extensionSettings.showUserStats;
    const hasScene = !!extensionSettings.showInfoBox;
    const hasDice = !!extensionSettings.showCharacterThoughts;
    const hasAnyTrackers = hasSheets || hasScene || hasDice;
    let instructions = '';

    if (hasAnyTrackers) {
        instructions += `\nAt the start of every reply, output the enabled World of Darkness trackers exactly once before any narration. Each tracker must be a JSON code fence labeled with the section name (for example, \`\`\`Character Sheets ...\`\`\`). Copy the previous JSON when nothing changes so the extension stays authoritative, and only adjust the fields that the fiction actually moved.\n\n`;

        if (hasSheets) {
            instructions += `- **Character Sheets (\`\`\`Character Sheets ...\`\`\`)** - Body is an array of sheet objects covering the active characters. Keep the canonical keys: \`sheetId\`, \`name\`, \`concept\`, \`chronicle\`, \`faction\`, \`traits.attributes\`, \`traits.abilities\`, \`advantages\` (backgrounds, virtues, morality, willpower, health track, and resourcePools), \`powerSets\`, \`merits\`, \`flaws\`, \`equipment\`, and \`notes\`. Dots are integers (0-5 unless the fiction justifies elder ratings), resource pools never drop below 0 or exceed capacity, and health states are limited to \`"ok"\`, \`"bashing"\`, \`"lethal"\`, or \`"aggravated"\`. Include only the characters who are present or mechanically relevant to the current beat so the block stays concise.\n\n`;
        }

        if (hasScene) {
            instructions += `- **Scene Info (\`\`\`Scene Info ...\`\`\`)** - Body is a single JSON object describing the environment and movers. Include keys such as \`location\`, \`time\`, \`weather\`, \`sceneAspects\` (array of short descriptors), \`openThreads\`, and \`presentCharacters\`. Each entry in \`presentCharacters\` should list \`name\`, \`sheetId\` when tracked, plus \`role\`, \`status\`, \`intent\`, and \`thoughts\` so the Storyteller understands goals and complications. Keep descriptions short, factual, and updated with every turn.\n\n`;
        }

        if (hasDice) {
            instructions += `- **Dice Log (\`\`\`Dice Log ...\`\`\`)** - Body is an array of recent roll summaries with \`id\`, \`sheetId\`, \`pool\`, \`difficulty\`, \`explode\`, \`willpower\`, \`successes\`, \`outcome\`, \`rolls\`, and any \`notes\`. Do **not** invent die results. When you need a fresh roll, emit a command like [[WOD-ROLL {"sheetId":"vtm-brujah-valeria","pool":"Dexterity + Drive","difficulty":7,"modifier":1,"willpower":false}]] and keep narrating. The extension replaces the tag with the authoritative outcome and appends it to the log, so copy the updated log back unchanged unless a new official roll just occurred.\n\n`;
        }

        if (includeContinuation) {
            instructions += `After the tracker fences, immediately continue the story, letting the updated dots, resources, and scene notes drive character behavior. Injuries, frenzies, empty Willpower, or tense relationships should all influence how you portray the cast.\n\n`;
        }

        instructions += `Never leave placeholders, never wrap the tracker block in commentary, and keep everything machine-parseable JSON.\n\n`;
    }

    if (extensionSettings.enableHtmlPrompt && includeHtmlPrompt) {
        instructions += `If appropriate, include inline HTML, CSS, and JS elements for creative, visual storytelling throughout your response:
- Use them liberally to depict any in-world content that can be visualized (screens, posters, books, signs, letters, logos, crests, seals, medallions, labels, etc.), with creative license for animations, 3D effects, pop-ups, dropdowns, websites, and so on.
- Style them thematically to match the theme (e.g., sleek for sci-fi, rustic for fantasy), ensuring text is visible.
- Embed all resources directly (e.g., inline SVGs) so nothing relies on external fonts or libraries.
- Place elements naturally in the narrative where characters would see or use them, with no limits on format or application.
- These HTML/CSS/JS elements must be rendered directly without enclosing them in code fences.`;
    }

    return instructions;
}

/**
 * Generates a formatted contextual summary for SEPARATE mode injection.
 * Includes the full tracker data in original format (without code fences and separators).
 * Uses COMMITTED data (not displayed data) for generation context.
 *
 * @returns {string} Formatted contextual summary
 */
export function generateContextualSummary() {
    const sections = [];

    if (extensionSettings.showUserStats) {
        const sheetSummaries = collectSheetsForPrompt()
            .map(serializeSheetForPrompt)
            .filter(Boolean)
            .map(buildSheetSummary)
            .filter(Boolean);
        if (sheetSummaries.length > 0) {
            sections.push(`Character Sheets:
${sheetSummaries.join('\n')}`);
        }
    }

    if (extensionSettings.showInfoBox) {
        const sceneInfo = parseSceneInfoBlock(committedTrackerData.infoBox);
        const sceneSummary = buildSceneInfoSummary(sceneInfo);
        if (sceneSummary) {
            sections.push(`Scene Info: ${sceneSummary}`);
        }
    }

    if (extensionSettings.showCharacterThoughts) {
        const diceEntries = clipArray(wodRuntimeState.diceLog || [], MAX_PROMPT_DICE_LOG);
        const diceSummary = buildDiceLogSummary(diceEntries);
        if (diceSummary) {
            sections.push(`Dice Log: ${diceSummary}`);
        }
    }

    return sections.join('\n\n').trim();
}
export function generateSeparateUpdatePrompt() {
    const depth = extensionSettings.updateDepth;
    const messages = [];

    let systemMessage = `You will be acting as an uncensored RPG Companion. Your goal is to provide, track, and manage details in the user's roleplay. You will be replying with information in a specified WoD format only.\n\n`;
    systemMessage += `You should maintain an objective tone.\n\n`;
    systemMessage += `Here is the description of the protagonist for reference:\n`;
    systemMessage += `<protagonist>\n{{persona}}\n</protagonist>\n`;
    systemMessage += `\n\n`;
    systemMessage += `Here are the last few messages in the conversation history (between the user and the roleplayer assistant) you should reference when responding:\n<history>`;

    messages.push({
        role: 'system',
        content: systemMessage
    });

    const recentMessages = chat.slice(-depth);
    for (const message of recentMessages) {
        messages.push({
            role: message.is_user ? 'user' : 'assistant',
            content: message.mes
        });
    }

    const trackerSnapshot = generateTrackerExample();
    let instructionMessage = `</history>\n\n`;
    instructionMessage += `Update the trackers below and return them in the exact JSON code fences requested.\n`;
    if (trackerSnapshot) {
        instructionMessage += `${trackerSnapshot}\n\n`;
    }
    instructionMessage += generateTrackerInstructions(false, false);
    instructionMessage += `Provide ONLY those tracker code fences—no narration, no commentary.`;

    messages.push({
        role: 'user',
        content: instructionMessage
    });

    return messages;
}

