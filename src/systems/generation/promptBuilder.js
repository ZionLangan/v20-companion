/**
 * Prompt Builder Module
 * Handles all AI prompt generation for RPG tracker data
 */

import { chat } from '../../../../../../../script.js';
import { extensionSettings } from '../../core/state.js';
import { recomputeWodContextSnapshot } from '../../core/context.js';

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

let cachedSnapshot = null;

function ensureContextSnapshot() {
    if (!cachedSnapshot) {
        cachedSnapshot = recomputeWodContextSnapshot();
    }
    return cachedSnapshot;
}

function resetContextSnapshot() {
    cachedSnapshot = null;
}

function parseJsonArray(text, fallback = []) {
    if (!text) {
        return fallback;
    }
    try {
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed : fallback;
    } catch (error) {
        return fallback;
    }
}

function parseJsonObject(text, fallback = null) {
    if (!text) {
        return fallback;
    }
    try {
        const parsed = JSON.parse(text);
        return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (error) {
        return fallback;
    }
}

function buildCharacterSheetsBlock() {
    return ensureContextSnapshot().characterSheets;
}

function buildSceneInfoBlock() {
    return ensureContextSnapshot().sceneInfo;
}

function buildDiceLogBlock() {
    return ensureContextSnapshot().diceLog;
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

    const result = blocks.join('\n\n').trim();
    resetContextSnapshot();
    return result;
}

/**
 * Generates the instruction portion - format specifications and guidelines.
 *
 * @param {boolean} includeHtmlPrompt - Whether to include the HTML prompt (true for main generation, false for separate tracker generation)
 * @param {boolean} includeContinuation - Whether to include "After updating the trackers, continue..." instruction
 * @returns {string} Formatted instruction text for the AI
 */
export function generateTrackerInstructions(options = {}) {
    const {
        mode = 'together',
        includeContinuation = true
    } = options;

    if (mode === 'separate') {
        let msg = `Update the World of Darkness tracker blocks below. Modify only the fields that changed and return the updated JSON code fences exactly as formatted. Keep values within canonical ranges (dots 0-5 unless otherwise noted, resource pools between 0 and capacity, health states limited to "ok", "bashing", "lethal", or "aggravated"). When a roll is required, request it with [[WOD-ROLL {...}]] instead of inventing results.`;
        if (includeContinuation) {
            msg += ` Focus solely on mechanical updates--do not add narration.`;
        }
        return msg.trim();
    }

    let instructions = `Use the World of Darkness tracker blocks above as the definitive state. Do not emit tracker code fences in your reply; reference those values naturally in the narrative. When dice are needed, issue a [[WOD-ROLL {...}]] command and continue describing the scene while the extension resolves it.`;

    if (includeContinuation) {
        instructions += ` Keep roleplay immersive, letting injuries, resources, and scene notes shape character behavior.`;
    }

    return instructions.trim();
}

/**
 * Generates a formatted contextual summary for SEPARATE mode injection.
 * Summaries are derived from the canonical WoD snapshot (same data sent to Together mode),
 * so the model always sees the latest sheet/scene/dice state even if no prior JSON was emitted.
 *
 * @returns {string} Formatted contextual summary
 */
export function generateContextualSummary() {
    const snapshot = ensureContextSnapshot();
    const sections = [];

    if (extensionSettings.showUserStats) {
        const sheetSummaries = parseJsonArray(snapshot.characterSheets)
            .map(buildSheetSummary)
            .filter(Boolean);
        if (sheetSummaries.length > 0) {
            sections.push(`Character Sheets:
${sheetSummaries.join('\n')}`);
        }
    }

    if (extensionSettings.showInfoBox) {
        const sceneInfo = parseJsonObject(snapshot.sceneInfo);
        const sceneSummary = buildSceneInfoSummary(sceneInfo);
        if (sceneSummary) {
            sections.push(`Scene Info: ${sceneSummary}`);
        }
    }

    if (extensionSettings.showCharacterThoughts) {
        const diceEntries = parseJsonArray(snapshot.diceLog);
        const diceSummary = buildDiceLogSummary(diceEntries);
        if (diceSummary) {
            sections.push(`Dice Log: ${diceSummary}`);
        }
    }

    resetContextSnapshot();
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
    let instructionMessage = `</history>

`;
    instructionMessage += `Use the tracker blocks below as the single source of truth. Update only the fields that changed and return the revised JSON fences exactly as formatted.
`;
    if (trackerSnapshot) {
        instructionMessage += `${trackerSnapshot}

`;
    }
    instructionMessage += generateTrackerInstructions({ mode: 'separate', includeContinuation: false });
    instructionMessage += ` Provide ONLY those tracker code fences--no narration or commentary.`;

messages.push({
        role: 'user',
        content: instructionMessage
    });

    return messages;
}

