import {
    extensionSettings,
    wodRuntimeState,
    getActiveWodSheet,
    getWodSheet,
    appendWodDiceLog
} from '../../core/state.js';
import { saveChatData } from '../../core/persistence.js';
import { renderUserStats } from '../rendering/userStats.js';

const EXPLODE_THRESHOLDS = {
    '10-again': 10,
    '9-again': 9,
    '8-again': 8,
    'no-again': 11
};

const ROLL_TAG_REGEX = /\[\[WOD-ROLL\s+([\s\S]*?)\]\]/gi;

function defaultRng() {
    return Math.floor(Math.random() * 10) + 1;
}

function generateRollId() {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }
    return `roll-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function slugName(value = '') {
    return value.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');
}

function toTitle(value = '') {
    return value.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function rollStage(count, config, rng, label) {
    const dice = [];
    let successes = 0;
    let ones = 0;
    const threshold = EXPLODE_THRESHOLDS[config.explode] ?? EXPLODE_THRESHOLDS['10-again'];
    const queue = [];

    for (let i = 0; i < count; i++) {
        queue.push({ source: label });
    }

    while (queue.length > 0) {
        const token = queue.shift();
        const value = rng();
        dice.push(value);
        if (value >= config.difficulty) {
            successes += 1;
        }
        if (value === 1) {
            ones += 1;
        }
        if (value >= threshold && threshold <= 10) {
            queue.push({ source: label, explode: true });
        }
    }

    return { label, count, rolls: dice, successes, ones };
}

export function resolveDicePool(config = {}) {
    const parts = Array.isArray(config.parts) ? config.parts.filter(Boolean) : [];
    const basePool = typeof config.basePool === 'number'
        ? config.basePool
        : parts.reduce((sum, part) => sum + (Number(part.value) || 0), 0);
    const diceCount = Math.max(1, basePool);
    const rng = config.rng || defaultRng;
    const stages = [];
    const initialStage = rollStage(diceCount, config, rng, 'Initial');
    stages.push(initialStage);

    const rerollStages = Array.isArray(config.rerollStages) ? config.rerollStages : [];
    rerollStages.forEach((stageConfig, index) => {
        const count = Math.max(0, Number(stageConfig.count) || 0);
        if (count <= 0) {
            return;
        }
        const stageLabel = stageConfig.label || `Reroll ${index + 1}`;
        stages.push(rollStage(count, config, rng, stageLabel));
    });

    const allRolls = [];
    let naturalSuccesses = 0;
    let ones = 0;
    stages.forEach(stage => {
        allRolls.push(...stage.rolls);
        naturalSuccesses += stage.successes;
        ones += stage.ones;
    });

    const willpowerBonus = config.spendWillpower ? 1 : 0;
    const totalSuccesses = naturalSuccesses + willpowerBonus;
    const botch = naturalSuccesses <= 0 && ones > 0 && !config.spendWillpower;
    const outcome = botch ? 'botch' : totalSuccesses <= 0 ? 'failure' : 'success';

    return {
        id: config.id || generateRollId(),
        sheetId: config.sheetId || null,
        sheetName: config.sheetName || null,
        poolLabel: config.poolLabel || parts.map(p => `${p.label} (${p.value})`).join(' + '),
        parts,
        diceRolled: diceCount,
        difficulty: config.difficulty,
        explode: config.explode,
        specialtyApplies: !!config.specialtyApplies,
        spendWillpower: !!config.spendWillpower,
        willpowerBonus,
        rerollsUsed: rerollStages.reduce((sum, entry) => sum + (Number(entry.count) || 0), 0),
        stages,
        rolls: allRolls,
        successes: totalSuccesses,
        naturalSuccesses,
        ones,
        botch,
        outcome,
        notes: config.notes || null,
        requestedBy: config.requestedBy || 'user',
        timestamp: config.timestamp || Date.now()
    };
}

export function getAttributeOptionsForSheet(sheet) {
    if (!sheet?.traits?.attributes) {
        return [];
    }
    const options = [];
    Object.entries(sheet.traits.attributes).forEach(([category, traits]) => {
        Object.entries(traits).forEach(([name, value]) => {
            options.push({
                id: `attribute:${category}.${name}`,
                label: `${toTitle(name)} (${toTitle(category)})`,
                value,
                path: ['traits', 'attributes', category, name],
                slug: slugName(name)
            });
        });
    });
    return options;
}

export function getAbilityOptionsForSheet(sheet) {
    if (!sheet?.traits?.abilities) {
        return [];
    }
    const options = [];
    Object.entries(sheet.traits.abilities).forEach(([category, traits]) => {
        Object.entries(traits).forEach(([name, value]) => {
            options.push({
                id: `ability:${category}.${name}`,
                label: `${toTitle(name)} (${toTitle(category)})`,
                value,
                path: ['traits', 'abilities', category, name],
                slug: slugName(name)
            });
        });
    });
    return options;
}

export function buildPoolParts(sheet, attributeKey, abilityKey, extraDice = 0, modifier = 0) {
    const parts = [];
    const attribute = resolveSheetValue(sheet, attributeKey);
    if (attribute) {
        parts.push({ label: attribute.label, value: attribute.value });
    }
    const ability = resolveSheetValue(sheet, abilityKey);
    if (ability) {
        parts.push({ label: ability.label, value: ability.value });
    }
    if (extraDice) {
        parts.push({ label: 'Extra Dice', value: Number(extraDice) });
    }
    if (modifier) {
        parts.push({ label: 'Modifier', value: Number(modifier) });
    }
    return parts;
}

function resolveSheetValue(sheet, key) {
    if (!key) {
        return null;
    }
    const [scope, category, name] = key.split('.');
    if (scope === 'attribute' && sheet?.traits?.attributes?.[category]?.[name] !== undefined) {
        return {
            label: `${toTitle(name)} (${toTitle(category)})`,
            value: Number(sheet.traits.attributes[category][name]) || 0
        };
    }
    if (scope === 'ability' && sheet?.traits?.abilities?.[category]?.[name] !== undefined) {
        return {
            label: `${toTitle(name)} (${toTitle(category)})`,
            value: Number(sheet.traits.abilities[category][name]) || 0
        };
    }
    return null;
}

export function formatDiceSummary(result) {
    const parts = result.parts?.length
        ? result.parts.map(part => `${part.label} (${part.value >= 0 ? '+' : ''}${part.value})`).join(' + ')
        : result.poolLabel;
    const baseSummary = `${result.sheetName || 'Character'} rolls ${parts} at difficulty ${result.difficulty}.`;
    const details = `Rolls: [${result.rolls.join(', ')}] -> ${result.successes} success${result.successes === 1 ? '' : 'es'} (${result.outcome}).`;
    const willpower = result.spendWillpower ? ' Willpower spent for +1 success.' : '';
    const botchNotes = result.botch ? ' BOTCH!' : '';
    return `${baseSummary} ${details}${willpower}${botchNotes}`.trim();
}

export function logDiceResult(result) {
    appendWodDiceLog(result);
    extensionSettings.lastDiceRoll = {
        formula: result.poolLabel ? `${result.poolLabel} (diff ${result.difficulty})` : `Pool (diff ${result.difficulty})`,
        total: result.successes,
        rolls: result.rolls
    };
    saveChatData();
    renderUserStats();
}

function parseRollPayload(raw) {
    const trimmed = raw.trim();
    try {
        return JSON.parse(trimmed);
    } catch (error) {
        const pairs = trimmed.split(/;\s*/).filter(Boolean);
        if (pairs.length === 0) {
            return null;
        }
        const parsed = {};
        pairs.forEach(pair => {
            const [key, value] = pair.split('=');
            if (key && value !== undefined) {
                parsed[key.trim()] = value.trim();
            }
        });
        return parsed;
    }
}

function buildConfigFromPayload(payload = {}) {
    const activeSheet = getWodSheet(payload.sheet || payload.sheetId) || getActiveWodSheet();
    const sheetId = activeSheet?.id || null;
    const sheetName = activeSheet?.meta?.name || 'Unknown Character';
    let parts = [];
    const manualDice = Number(payload.dice || payload.poolDice || 0) || 0;
    const modifier = Number(payload.modifier || 0) || 0;

    if (payload.poolParts && Array.isArray(payload.poolParts)) {
        parts = payload.poolParts.map(part => ({
            label: part.label || '',
            value: Number(part.value) || 0
        }));
    } else if (payload.pool) {
        parts = resolvePoolPartsFromString(activeSheet, payload.pool);
    }

    if (manualDice) {
        parts.push({ label: 'Extra Dice', value: manualDice });
    }
    if (modifier) {
        parts.push({ label: 'Modifier', value: modifier });
    }

    if (parts.length === 0 && payload.diceTotal) {
        parts.push({ label: 'Declared Pool', value: Number(payload.diceTotal) || 0 });
    }

    const diceDefaults = wodRuntimeState.diceDefaults || {};
    const difficulty = Math.min(10, Math.max(3, Number(payload.difficulty) || diceDefaults.difficulty || 6));
    const explode = (payload.explode || diceDefaults.explode || '10-again');
    const rerolls = [];
    if (payload.rerolls) {
        if (Array.isArray(payload.rerolls)) {
            payload.rerolls.forEach((item, index) => {
                const count = Number(item.count ?? item) || 0;
                if (count > 0) {
                    rerolls.push({ count, label: item.label || `Reroll ${index + 1}` });
                }
            });
        } else {
            const count = Number(payload.rerolls) || 0;
            if (count > 0) {
                rerolls.push({ count, label: 'Reroll' });
            }
        }
    }

    const notes = payload.notes || payload.reason || null;

    return {
        sheetId,
        sheetName,
        parts,
        difficulty,
        explode,
        specialtyApplies: !!payload.specialty,
        spendWillpower: !!payload.willpower,
        rerollStages: rerolls,
        poolLabel: payload.label || parts.map(part => `${part.label} (${part.value})`).join(' + '),
        notes,
        requestedBy: payload.requestedBy || 'llm'
    };
}

function resolvePoolPartsFromString(sheet, poolString) {
    if (!poolString) {
        return [];
    }
    const tokens = poolString.split('+').map(token => token.trim()).filter(Boolean);
    const parts = [];
    tokens.forEach(token => {
        const entry = matchSheetTrait(sheet, token);
        if (entry) {
            parts.push({ label: entry.label, value: entry.value });
        } else {
            const numeric = Number(token);
            if (!Number.isNaN(numeric) && numeric !== 0) {
                parts.push({ label: 'Bonus Dice', value: numeric });
            }
        }
    });
    return parts;
}

function matchSheetTrait(sheet, token) {
    if (!sheet) return null;
    const normalized = slugName(token);
    if (!normalized) return null;

    const attributeMatch = getAttributeOptionsForSheet(sheet).find(opt => opt.slug === normalized);
    if (attributeMatch) {
        return { label: attributeMatch.label, value: attributeMatch.value };
    }

    const abilityMatch = getAbilityOptionsForSheet(sheet).find(opt => opt.slug === normalized);
    if (abilityMatch) {
        return { label: abilityMatch.label, value: abilityMatch.value };
    }

    const virtues = sheet?.advantages?.virtues || {};
    for (const [name, value] of Object.entries(virtues)) {
        if (slugName(name) === normalized) {
            return { label: `Virtue: ${toTitle(name)}`, value: Number(value) || 0 };
        }
    }

    const backgrounds = sheet?.advantages?.backgrounds || [];
    for (const entry of backgrounds) {
        if (slugName(entry.name) === normalized) {
            return { label: `Background: ${entry.name}`, value: Number(entry.rating) || 0 };
        }
    }

    const resourcePools = sheet?.advantages?.resourcePools || [];
    for (const pool of resourcePools) {
        if (slugName(pool.name) === normalized) {
            return { label: `Pool: ${pool.name}`, value: Number(pool.current) || 0 };
        }
    }

    if (slugName('willpower') === normalized && sheet?.advantages?.willpower) {
        return { label: 'Willpower', value: Number(sheet.advantages.willpower.current) || 0 };
    }

    return null;
}

export function processWodRollCommands(text, options = {}) {
    if (!text) {
        return { text, rolls: [], modified: false };
    }

    let modified = false;
    const executedRolls = [];
    let updatedText = text;

        const payload = parseRollPayload(payloadText);
        if (!payload) {
            return match;
        }
        const config = buildConfigFromPayload(payload);
        const result = resolveDicePool(config);
        logDiceResult(result);
        executedRolls.push(result);
        modified = true;
        return formatDiceSummary(result);
    });

    return { text: updatedText, rolls: executedRolls, modified };
}
