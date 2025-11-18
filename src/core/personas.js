import { this_chid, characters } from '../../../../../../../script.js';
import {
    wodRuntimeState,
    getPersonaLink,
    getWodSheet
} from './state.js';
import { extensionName } from './config.js';

/**
 * Collects persona bindings for the current chat (single or group).
 * @returns {Array<{key: string, name: string, sheetId: string|null, sheetName: string, sheetExists: boolean, linkSource: string, metadataPath?: string, autoReason?: string, persona?: any, sheet?: import('../types/wod.js').WodCharacterSheet}>}
 */
export function collectPersonaBindings() {
    const personas = getCharactersInCurrentChat();
    const seen = new Set();
    const results = [];

    personas.forEach(persona => {
        if (!persona) {
            return;
        }
        const personaKey = resolvePersonaKey(persona);
        if (!personaKey || seen.has(personaKey)) {
            return;
        }
        seen.add(personaKey);

        const metadataLink = extractSheetFromMetadata(persona);
        const manualLink = getPersonaLink(personaKey);
        const autoLink = (!metadataLink && !manualLink) ? autoMatchSheet(persona) : null;
        const sheetId = metadataLink?.sheetId || manualLink?.sheetId || autoLink?.sheetId || null;
        const sheet = sheetId ? getWodSheet(sheetId) : null;
        results.push({
            key: personaKey,
            name: persona.name || 'Persona',
            sheetId,
            sheetName: sheet?.meta?.name || sheetId || '',
            sheetExists: !!sheet,
            linkSource: metadataLink ? 'metadata' : manualLink ? 'manual' : autoLink ? 'auto' : 'none',
            metadataPath: metadataLink?.path,
            autoReason: autoLink?.reason,
            persona,
            sheet
        });
    });

    return results;
}

/**
 * Builds Scene Info presentCharacters entries from persona bindings.
 * @returns {Array<{name: string, sheetId?: string, role?: string, status?: string}>}
 */
export function buildPersonaSceneEntries() {
    return collectPersonaBindings()
        .filter(entry => entry.sheetId)
        .map(entry => ({
            name: entry.name,
            sheetId: entry.sheetId,
            role: entry.linkSource === 'metadata' ? 'Linked persona' : undefined,
            status: entry.linkSource === 'auto' ? 'Auto-matched' : undefined
        }));
}

function getCharactersInCurrentChat() {
    let personas = [];
    const groupId = getCurrentGroupId();
    if (groupId) {
        const members = getCurrentGroupMembers(groupId);
        personas = members.filter(Boolean);
    } else {
        const index = Number(this_chid);
        if (!Number.isNaN(index) && characters && characters[index]) {
            personas = [characters[index]];
        }
    }
    return personas;
}

function resolvePersonaKey(character) {
    if (!character) {
        return null;
    }
    return character.avatar || character.characterId || character.id || character.name || null;
}

function extractSheetFromMetadata(character) {
    const metadata = parsePersonaMetadata(character?.metadata);
    const candidates = [];
    if (metadata) {
        candidates.push({
            path: 'metadata.rpg_companion_v20.sheetId',
            value: metadata?.rpg_companion_v20?.sheetId
        });
        candidates.push({
            path: 'metadata.rpgCompanion.sheetId',
            value: metadata?.rpgCompanion?.sheetId
        });
        candidates.push({
            path: 'metadata.rpgCompanionSheet',
            value: metadata?.rpgCompanionSheet
        });
        candidates.push({
            path: `metadata.extensions["${extensionName}"].sheetId`,
            value: metadata?.extensions?.[extensionName]?.sheetId
        });
        candidates.push({
            path: 'metadata.extensions.v20.sheetId',
            value: metadata?.extensions?.v20?.sheetId
        });
        candidates.push({
            path: 'metadata.sheetId',
            value: metadata?.sheetId
        });
        candidates.push({
            path: 'metadata.wodSheetId',
            value: metadata?.wodSheetId
        });
        for (const candidate of candidates) {
            if (typeof candidate.value === 'string' && candidate.value.trim().length > 0) {
                return {
                    sheetId: candidate.value.trim(),
                    path: candidate.path
                };
            }
        }
    }
    const tagSheet = extractSheetFromTags(character?.tags);
    if (tagSheet) {
        return {
            sheetId: tagSheet,
            path: 'tags[wod-sheet]'
        };
    }
    return null;
}

function parsePersonaMetadata(raw) {
    if (!raw) {
        return null;
    }
    if (typeof raw === 'object') {
        return raw;
    }
    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw);
        } catch (error) {
            console.warn('[RPG Companion] Failed to parse persona metadata JSON:', error);
            return null;
        }
    }
    return null;
}

function extractSheetFromTags(tags) {
    if (!Array.isArray(tags)) {
        return null;
    }
    for (const rawTag of tags) {
        if (typeof rawTag !== 'string') {
            continue;
        }
        const normalized = rawTag.trim();
        const match = normalized.match(/^(?:wod[-_]?sheet|sheet)\s*[:=]\s*(.+)$/i);
        if (match && match[1]) {
            return match[1].trim();
        }
    }
    return null;
}

function autoMatchSheet(character) {
    const normalizedName = normalizeName(character?.name);
    if (!normalizedName) {
        return null;
    }
    const matches = [];
    wodRuntimeState.sheets.forEach((sheet, sheetId) => {
        const sheetName = normalizeName(sheet?.meta?.name);
        if (sheetName && sheetName === normalizedName) {
            matches.push({ sheetId, label: sheet?.meta?.name || sheetId });
        }
    });
    if (matches.length === 1) {
        return {
            sheetId: matches[0].sheetId,
            reason: `Matches ${matches[0].label}`
        };
    }
    return null;
}

function normalizeName(value) {
    if (!value) {
        return '';
    }
    return String(value).trim().toLowerCase();
}

export function normalizePersonaName(value) {
    return normalizeName(value);
}

/**
 * Returns the currently selected group id, if any.
 * @returns {string|null}
 */
export function getCurrentGroupId() {
    if (typeof selected_group !== 'undefined' && selected_group) {
        return selected_group;
    }
    if (typeof window !== 'undefined' && window.selected_group) {
        return window.selected_group;
    }
    return null;
}

/**
 * Returns the group members for the given group id.
 * @param {string} groupId
 * @returns {Array<any>}
 */
export function getCurrentGroupMembers(groupId = getCurrentGroupId()) {
    if (!groupId) {
        return [];
    }
    const globalGetter = typeof getGroupMembers === 'function'
        ? getGroupMembers
        : (typeof window !== 'undefined' && typeof window.getGroupMembers === 'function'
            ? window.getGroupMembers
            : null);
    if (globalGetter) {
        try {
            const members = globalGetter(groupId);
            if (Array.isArray(members)) {
                return members;
            }
        } catch (error) {
            console.warn('[RPG Companion] Failed to read group members', error);
        }
    }
    if (typeof window !== 'undefined') {
        const byId = window.group_members || window.groupMembers;
        if (byId && Array.isArray(byId[groupId])) {
            return byId[groupId];
        }
    }
    return [];
}
