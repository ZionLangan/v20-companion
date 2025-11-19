import {
    wodRuntimeState,
    getActiveWodSheet,
    getWodSheet,
    setWodContextSnapshot
} from './state.js';
import { collectPersonaBindings, buildPersonaSceneEntries, normalizePersonaName } from './personas.js';

const MAX_PROMPT_SHEETS = 6;
const MAX_EQUIPMENT_ITEMS = 6;
const MAX_PROMPT_DICE_LOG = 6;

/**
 * Recomputes the canonical WoD context snapshot (character sheets, scene info, dice log)
 * and stores it on the runtime state for prompt injection.
 * @returns {{ characterSheets: string, sceneInfo: string, diceLog: string }}
 */
export function recomputeWodContextSnapshot() {
    const sheets = buildCanonicalSheets();
    const sceneInfo = buildCanonicalSceneInfo();
    const diceLog = buildCanonicalDiceLog();
    const snapshot = {
        characterSheets: JSON.stringify(sheets, null, 2),
        sceneInfo: JSON.stringify(sceneInfo, null, 2),
        diceLog: JSON.stringify(diceLog, null, 2)
    };
    setWodContextSnapshot(snapshot);
    return snapshot;
}

function buildCanonicalSheets(limit = MAX_PROMPT_SHEETS) {
    const selected = [];
    const seen = new Set();

    const pushSheet = (sheet) => {
        if (sheet && sheet.id && !seen.has(sheet.id)) {
            selected.push(serializeSheetForPrompt(sheet));
            seen.add(sheet.id);
        }
    };

    pushSheet(getActiveWodSheet());

    const personaEntries = collectPersonaBindings();
    personaEntries.forEach(entry => {
        if (selected.length >= limit) {
            return;
        }
        const sheet = entry.sheet || getWodSheet(entry.sheetId);
        if (sheet) {
            pushSheet(sheet);
        }
    });

    const order = wodRuntimeState.sheetOrder || [];
    order.some(sheetId => {
        if (selected.length >= limit) {
            return true;
        }
        pushSheet(getWodSheet(sheetId));
        return false;
    });

    return selected.slice(0, limit);
}

function buildCanonicalSceneInfo() {
    const base = wodRuntimeState.sceneInfo
        ? JSON.parse(JSON.stringify(wodRuntimeState.sceneInfo))
        : {
            location: 'Unknown location',
            time: 'Unset',
            weather: null,
            sceneAspects: [],
            openThreads: [],
            presentCharacters: []
        };

    const personaEntries = buildPersonaSceneEntries();
    if (!Array.isArray(base.presentCharacters) || base.presentCharacters.length === 0) {
        base.presentCharacters = personaEntries;
    } else if (personaEntries.length > 0) {
        const byName = new Map();
        personaEntries.forEach(entry => {
            byName.set(normalizePersonaName(entry.name), entry);
        });
        base.presentCharacters = base.presentCharacters.map(entry => {
            if (!entry || entry.sheetId || !entry.name) {
                return entry;
            }
            const match = byName.get(normalizePersonaName(entry.name));
            if (match && match.sheetId) {
                return { ...entry, sheetId: match.sheetId };
            }
            return entry;
        });
    }

    return base;
}

function buildCanonicalDiceLog(limit = MAX_PROMPT_DICE_LOG) {
    return clipArray(wodRuntimeState.diceLog || [], limit).map(entry => pruneEmpty({
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

function serializeSheetForPrompt(sheet) {
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
        name: meta.name,
        concept: meta.concept,
        chronicle: meta.chronicle,
        faction: meta.faction,
        traits: pruneEmpty({
            attributes,
            abilities: {
                talents: filterAbilityValues(abilities.talents),
                skills: filterAbilityValues(abilities.skills),
                knowledges: filterAbilityValues(abilities.knowledges || abilities.knowledge)
            }
        }),
        advantages: pruneEmpty({
            backgrounds: clipArray(advantages.backgrounds || [], MAX_EQUIPMENT_ITEMS),
            virtues: advantages.virtues,
            morality: advantages.morality,
            willpower: advantages.willpower,
            health: advantages.health,
            resourcePools: clipArray(advantages.resourcePools || [], MAX_EQUIPMENT_ITEMS)
        }),
        powerSets: clipArray(sheet.powerSets || [], MAX_EQUIPMENT_ITEMS).map(set => pruneEmpty({
            name: set.name,
            category: set.category,
            rating: set.rating,
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
        }),
        notes: sheet.notes || []
    });
}

function clipArray(values, limit) {
    if (!Array.isArray(values)) {
        return [];
    }
    if (values.length <= limit) {
        return values.map(item => pruneEmpty(item));
    }
    return values.slice(0, limit).map(item => pruneEmpty(item));
}

function pruneEmpty(value) {
    if (Array.isArray(value)) {
        return value
            .map(item => pruneEmpty(item))
            .filter(item => {
                if (item === undefined || item === null) return false;
                if (Array.isArray(item)) return item.length > 0;
                if (typeof item === 'object') return Object.keys(item).length > 0;
                return true;
            });
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

export {
    MAX_PROMPT_SHEETS,
    MAX_EQUIPMENT_ITEMS,
    MAX_PROMPT_DICE_LOG,
    serializeSheetForPrompt
};
