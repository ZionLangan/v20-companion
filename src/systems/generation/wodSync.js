import { getWodSheet, recordWodChatOverride } from '../../core/state.js';

const HEALTH_STATES = new Set(['ok', 'bashing', 'lethal', 'aggravated']);
const STRING_LIMIT = 400;
const NOTE_LIMIT = 10;
const EQUIPMENT_LIMIT = 12;
const POWER_LIMIT = 10;
const PRESENT_CHAR_LIMIT = 6;

function clampNumber(value, min, max) {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
        return min;
    }
    return Math.min(Math.max(numeric, min), max);
}

function cleanString(value, limit = STRING_LIMIT) {
    if (value === undefined || value === null) {
        return undefined;
    }
    return String(value).trim().slice(0, limit);
}

function sanitizeMeta(raw = {}) {
    const meta = {};
    const keys = ['name', 'player', 'chronicle', 'concept', 'nature', 'demeanor', 'supernaturalType', 'supernaturalSubtype', 'age', 'apparentAge', 'pronouns'];
    keys.forEach(key => {
        if (raw[key] !== undefined) {
            const cleaned = cleanString(raw[key]);
            if (cleaned !== undefined) {
                meta[key] = cleaned;
            }
        }
    });
    if (raw.faction && typeof raw.faction === 'object') {
        const type = cleanString(raw.faction.type, 120);
        const value = cleanString(raw.faction.value, 120);
        meta.faction = {};
        if (type) meta.faction.type = type;
        if (value) meta.faction.value = value;
    }
    if (Array.isArray(raw.notes)) {
        meta.notes = raw.notes
            .map(entry => cleanString(entry, STRING_LIMIT))
            .filter(Boolean)
            .slice(0, NOTE_LIMIT);
    }
    return Object.keys(meta).length > 0 ? meta : undefined;
}

function sanitizeAbilityBucket(bucket = {}) {
    const sanitized = {};
    Object.entries(bucket).forEach(([key, value]) => {
        const label = cleanString(key, 80);
        if (!label) return;
        sanitized[label] = clampNumber(value, 0, 10);
    });
    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function sanitizeAttributes(raw = {}) {
    const sections = {};
    ['physical', 'social', 'mental'].forEach(section => {
        if (raw[section] && typeof raw[section] === 'object') {
            const sanitized = {};
            Object.entries(raw[section]).forEach(([key, value]) => {
                sanitized[key] = clampNumber(value, 0, 10);
            });
            sections[section] = sanitized;
        }
    });
    return Object.keys(sections).length > 0 ? sections : undefined;
}

function sanitizeAbilities(raw = {}) {
    const abilities = {};
    ['talents', 'skills', 'knowledges'].forEach(section => {
        if (raw[section]) {
            const bucket = sanitizeAbilityBucket(raw[section]);
            if (bucket) {
                abilities[section] = bucket;
            }
        }
    });
    return Object.keys(abilities).length > 0 ? abilities : undefined;
}

function sanitizeBackgrounds(raw) {
    if (!Array.isArray(raw)) {
        return undefined;
    }
    const cleaned = raw
        .map(entry => ({
            name: cleanString(entry?.name, 120),
            rating: clampNumber(entry?.rating, 0, 5),
            description: cleanString(entry?.description)
        }))
        .filter(entry => entry.name);
    return cleaned;
}

function sanitizeVirtues(raw = {}) {
    const virtues = {};
    ['conscience', 'selfControl', 'instinct', 'courage'].forEach(key => {
        if (raw[key] !== undefined) {
            virtues[key] = clampNumber(raw[key], 0, 5);
        }
    });
    return Object.keys(virtues).length > 0 ? virtues : undefined;
}

function sanitizeMorality(raw = {}) {
    const morality = {};
    if (raw.type !== undefined) {
        const type = cleanString(raw.type, 120);
        if (type) morality.type = type;
    }
    if (raw.rating !== undefined) {
        morality.rating = clampNumber(raw.rating, 0, 10);
    }
    if (raw.notes !== undefined) {
        const notes = cleanString(raw.notes);
        if (notes) morality.notes = notes;
    }
    return Object.keys(morality).length > 0 ? morality : undefined;
}

function sanitizeWillpower(raw = {}) {
    const willpower = {};
    if (raw.permanent !== undefined) {
        willpower.permanent = clampNumber(raw.permanent, 0, 10);
    }
    if (raw.current !== undefined) {
        const perm = willpower.permanent !== undefined ? willpower.permanent : clampNumber(raw.permanent ?? 10, 0, 10);
        willpower.current = clampNumber(raw.current, 0, perm);
    }
    return Object.keys(willpower).length > 0 ? willpower : undefined;
}

function sanitizeHealth(raw) {
    if (!Array.isArray(raw)) {
        return undefined;
    }
    const cleaned = raw
        .map(entry => {
            const level = cleanString(entry?.level, 80);
            const state = cleanString(entry?.state, 40)?.toLowerCase();
            if (!level || !state || !HEALTH_STATES.has(state)) {
                return null;
            }
            return { level, state };
        })
        .filter(Boolean);
    return cleaned;
}

function sanitizeResourcePools(raw) {
    if (!Array.isArray(raw)) {
        return undefined;
    }
    const cleaned = raw
        .map(entry => {
            const name = cleanString(entry?.name, 120);
            if (!name) return null;
            const type = cleanString(entry?.type, 80);
            const capacity = clampNumber(entry?.capacity ?? 0, 0, 100);
            const current = clampNumber(entry?.current ?? 0, 0, capacity || 100);
            const notes = cleanString(entry?.notes);
            const pool = { name, capacity, current };
            if (type) pool.type = type;
            if (notes) pool.notes = notes;
            return pool;
        })
        .filter(Boolean);
    return cleaned;
}

function sanitizePowerSets(raw) {
    if (!Array.isArray(raw)) {
        return undefined;
    }
    const cleaned = raw
        .map(entry => {
            const name = cleanString(entry?.name, 120);
            if (!name) return null;
            const powerSet = {
                name,
                category: cleanString(entry?.category, 80),
                rating: clampNumber(entry?.rating ?? 0, 0, 10)
            };
            if (Array.isArray(entry?.tags)) {
                powerSet.tags = entry.tags
                    .map(tag => cleanString(tag, 60))
                    .filter(Boolean)
                    .slice(0, 6);
            }
            if (entry?.notes) {
                const notes = cleanString(entry.notes);
                if (notes) powerSet.notes = notes;
            }
            if (Array.isArray(entry?.powers)) {
                powerSet.powers = entry.powers
                    .map(power => {
                        const powerName = cleanString(power?.name, 120);
                        if (!powerName) return null;
                        const cleanedPower = {
                            name: powerName,
                            rating: clampNumber(power?.rating ?? 0, 0, 10)
                        };
                        const description = cleanString(power?.description);
                        if (description) cleanedPower.description = description;
                        if (power?.cost) {
                            const cost = cleanString(power.cost, 120);
                            if (cost) cleanedPower.cost = cost;
                        }
                        if (Array.isArray(power?.tags)) {
                            cleanedPower.tags = power.tags
                                .map(tag => cleanString(tag, 60))
                                .filter(Boolean)
                                .slice(0, 6);
                        }
                        return cleanedPower;
                    })
                    .filter(Boolean)
                    .slice(0, POWER_LIMIT);
            }
            return powerSet;
        })
        .filter(Boolean)
        .slice(0, POWER_LIMIT);
    return cleaned;
}

function sanitizeMerits(raw) {
    if (!Array.isArray(raw)) {
        return undefined;
    }
    return raw
        .map(entry => {
            const name = cleanString(entry?.name, 120);
            if (!name) return null;
            const cleaned = {
                name,
                rating: clampNumber(entry?.rating ?? 0, -5, 5)
            };
            const description = cleanString(entry?.description);
            if (description) cleaned.description = description;
            return cleaned;
        })
        .filter(Boolean)
        .slice(0, POWER_LIMIT);
}

function sanitizeEquipmentItems(items) {
    if (!Array.isArray(items)) {
        return undefined;
    }
    return items
        .map(item => {
            const name = cleanString(item?.name, 120);
            if (!name) return null;
            const record = { name };
            const type = cleanString(item?.type, 80);
            if (type) record.type = type;
            const location = cleanString(item?.location, 120);
            if (location) record.location = location;
            const description = cleanString(item?.description);
            if (description) record.description = description;
            if (Array.isArray(item?.tags)) {
                record.tags = item.tags
                    .map(tag => cleanString(tag, 60))
                    .filter(Boolean)
                    .slice(0, 6);
            }
            return record;
        })
        .filter(Boolean)
        .slice(0, EQUIPMENT_LIMIT);
}

function sanitizeEquipment(raw = {}) {
    const equipment = {};
    if (raw.inventory !== undefined) {
        equipment.inventory = sanitizeEquipmentItems(raw.inventory) || [];
    }
    if (raw.stored !== undefined) {
        equipment.stored = sanitizeEquipmentItems(raw.stored) || [];
    }
    if (raw.assets !== undefined) {
        equipment.assets = sanitizeEquipmentItems(raw.assets) || [];
    }
    return Object.keys(equipment).length > 0 ? equipment : undefined;
}

function sanitizeNotes(raw) {
    if (!Array.isArray(raw)) {
        return undefined;
    }
    return raw
        .map(entry => cleanString(entry, STRING_LIMIT))
        .filter(Boolean)
        .slice(0, NOTE_LIMIT);
}

export function sanitizeSheetsFromPrompt(rawSheets = []) {
    if (!Array.isArray(rawSheets)) {
        return [];
    }
    const sanitized = [];
    rawSheets.forEach(raw => {
        if (!raw || typeof raw !== 'object') {
            return;
        }
        const sheetId = cleanString(raw.sheetId ?? raw.id, 200);
        if (!sheetId) {
            return;
        }
        const patch = { id: sheetId };
        const meta = sanitizeMeta(raw.meta || raw.metaData);
        if (meta) patch.meta = meta;

        if (raw.traits && typeof raw.traits === 'object') {
            const traits = {};
            const attributes = sanitizeAttributes(raw.traits.attributes || {});
            if (attributes) traits.attributes = attributes;
            const abilities = sanitizeAbilities(raw.traits.abilities || {});
            if (abilities) traits.abilities = abilities;
            if (Object.keys(traits).length > 0) {
                patch.traits = traits;
            }
        }

        if (raw.advantages && typeof raw.advantages === 'object') {
            const advantages = {};
            if ('backgrounds' in raw.advantages) {
                advantages.backgrounds = sanitizeBackgrounds(raw.advantages.backgrounds) || [];
            }
            if ('virtues' in raw.advantages) {
                const virtues = sanitizeVirtues(raw.advantages.virtues);
                if (virtues) advantages.virtues = virtues;
            }
            if ('morality' in raw.advantages) {
                const morality = sanitizeMorality(raw.advantages.morality);
                if (morality) advantages.morality = morality;
            }
            if ('willpower' in raw.advantages) {
                const willpower = sanitizeWillpower(raw.advantages.willpower);
                if (willpower) advantages.willpower = willpower;
            }
            if ('health' in raw.advantages) {
                advantages.health = sanitizeHealth(raw.advantages.health) || [];
            }
            if ('resourcePools' in raw.advantages) {
                advantages.resourcePools = sanitizeResourcePools(raw.advantages.resourcePools) || [];
            }
            if (Object.keys(advantages).length > 0) {
                patch.advantages = advantages;
            }
        }

        if ('powerSets' in raw) {
            const powerSets = sanitizePowerSets(raw.powerSets);
            if (powerSets) {
                patch.powerSets = powerSets;
            }
        }

        if ('merits' in raw) {
            patch.merits = sanitizeMerits(raw.merits) || [];
        }

        if ('flaws' in raw) {
            patch.flaws = sanitizeMerits(raw.flaws) || [];
        }

        if ('equipment' in raw) {
            const equipment = sanitizeEquipment(raw.equipment);
            if (equipment) patch.equipment = equipment;
        }

        if ('notes' in raw) {
            patch.notes = sanitizeNotes(raw.notes) || [];
        }

        sanitized.push(patch);
    });
    return sanitized;
}

export function applySheetsFromPrompt(sanitizedSheets = []) {
    if (!Array.isArray(sanitizedSheets) || sanitizedSheets.length === 0) {
        return [];
    }
    const updatedSheets = [];
    sanitizedSheets.forEach(patch => {
        const sheet = getWodSheet(patch.id);
        if (!sheet) {
            return;
        }
        const merged = deepClone(sheet);
        mergeObjects(merged, { ...patch, id: sheet.id });
        recordWodChatOverride(merged);
        updatedSheets.push(deepClone(merged));
    });
    return updatedSheets;
}

export function sanitizeSceneInfo(raw) {
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    const info = {};
    if (raw.location !== undefined) {
        const location = cleanString(raw.location, 200);
        if (location) info.location = location;
    }
    if (raw.time !== undefined) {
        const time = cleanString(raw.time, 200);
        if (time) info.time = time;
    }
    if (raw.weather !== undefined) {
        const weather = cleanString(raw.weather, 200);
        if (weather) info.weather = weather;
    }
    if (Array.isArray(raw.sceneAspects)) {
        info.sceneAspects = raw.sceneAspects
            .map(entry => cleanString(entry, 160))
            .filter(Boolean)
            .slice(0, NOTE_LIMIT);
    }
    if (Array.isArray(raw.openThreads)) {
        info.openThreads = raw.openThreads
            .map(entry => cleanString(entry, 200))
            .filter(Boolean)
            .slice(0, NOTE_LIMIT);
    }
    if (Array.isArray(raw.presentCharacters)) {
        info.presentCharacters = raw.presentCharacters
            .map(entry => {
                if (!entry || typeof entry !== 'object') return null;
                const name = cleanString(entry.name, 160);
                if (!name) return null;
                const record = { name };
                const sheetId = cleanString(entry.sheetId ?? entry.id, 200);
                if (sheetId) record.sheetId = sheetId;
                const role = cleanString(entry.role, 160);
                if (role) record.role = role;
                const status = cleanString(entry.status, 160);
                if (status) record.status = status;
                const intent = cleanString(entry.intent, 200);
                if (intent) record.intent = intent;
                const thoughts = cleanString(entry.thoughts, 200);
                if (thoughts) record.thoughts = thoughts;
                return record;
            })
            .filter(Boolean)
            .slice(0, PRESENT_CHAR_LIMIT);
    }
    return Object.keys(info).length > 0 ? info : null;
}

function mergeObjects(target, patch) {
    Object.entries(patch).forEach(([key, value]) => {
        if (key === 'id') {
            target.id = value;
            return;
        }
        if (Array.isArray(value)) {
            target[key] = value.map(item => (typeof item === 'object' ? deepClone(item) : item));
        } else if (value && typeof value === 'object') {
            if (!target[key] || typeof target[key] !== 'object') {
                target[key] = {};
            }
            mergeObjects(target[key], value);
        } else if (value !== undefined) {
            target[key] = value;
        }
    });
}

function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}
