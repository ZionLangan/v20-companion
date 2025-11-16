import { extensionFolderPath } from './config.js';
import {
    extensionSettings,
    wodRuntimeState,
    setWodSheetRegistry,
    setWodSheetDigests,
    setWodLastSheetRefreshInfo
} from './state.js';

/**
 * Normalizes the SillyTavern extension path for fetch usage.
 * @param {string} rawPath
 * @returns {string}
 */
function normalizeExtensionPath(rawPath = '') {
    const normalized = String(rawPath || '').replace(/\\/g, '/');
    return normalized.startsWith('/') ? normalized.slice(1) : normalized;
}

const SHEETS_BASE_PATH = `/${normalizeExtensionPath(extensionFolderPath)}/sheets`;
const SHEET_HASH_STORAGE_KEY = 'v20-companion.sheet-hashes';

async function fetchJson(url, label) {
    try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
            console.warn(`[RPG Companion] Failed to load ${label} from ${url}: ${response.status}`);
            return null;
        }
        return await response.json();
    } catch (error) {
        console.error(`[RPG Companion] Error loading ${label} from ${url}`, error);
        return null;
    }
}

function readStoredSheetHashes() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return {};
    }
    const raw = window.localStorage.getItem(SHEET_HASH_STORAGE_KEY);
    if (!raw) {
        return {};
    }
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        console.warn('[RPG Companion] Failed to parse cached sheet hashes:', error);
        return {};
    }
}

function persistSheetHashes(payload) {
    if (typeof window === 'undefined' || !window.localStorage) {
        return;
    }
    try {
        window.localStorage.setItem(SHEET_HASH_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
        console.warn('[RPG Companion] Failed to persist sheet hashes:', error);
    }
}

function collectCustomDigests() {
    const custom = {};
    if (!wodRuntimeState.sheetDigests) {
        return custom;
    }
    wodRuntimeState.sheetDigests.forEach((entry, sheetId) => {
        if (!entry) {
            return;
        }
        if (entry.source === 'custom' || entry.source === 'import') {
            custom[sheetId] = { ...entry };
        }
    });
    return custom;
}

/**
 * Loads bundled WoD sheets from the extension folder and merges them
 * into the active registry so manual JSON edits become available immediately.
 * @param {{ source?: 'startup'|'manual' }} options
 * @returns {{ addedSheetIds: string[], removedSheetIds: string[], changedSheetIds: string[] }}
 */
export async function loadBundledSheets(options = {}) {
    const loadSource = options.source || 'startup';

    if (!SHEETS_BASE_PATH) {
        console.warn('[RPG Companion] Sheets base path missing; skipping bundled sheet load');
        return { addedSheetIds: [], removedSheetIds: [], changedSheetIds: [] };
    }

    const indexUrl = `${SHEETS_BASE_PATH}/sheet-index.json`;
    const manifest = await fetchJson(indexUrl, 'sheet index');
    if (!manifest || !Array.isArray(manifest.sheets)) {
        console.warn('[RPG Companion] No sheet-index.json found or invalid format; skipping bundled sheet load');
        return { addedSheetIds: [], removedSheetIds: [], changedSheetIds: [] };
    }

    const bundledSheets = {};
    const bundledDigests = {};
    const manifestOrder = [];
    const now = Date.now();

    for (const entry of manifest.sheets) {
        if (!entry || !entry.id || !entry.file) {
            continue;
        }
        const sheetUrl = `${SHEETS_BASE_PATH}/${entry.file}`;
        const sheet = await fetchJson(sheetUrl, `sheet ${entry.id}`);
        if (!sheet || !sheet.id) {
            continue;
        }
        bundledSheets[sheet.id] = sheet;
        manifestOrder.push(sheet.id);
        bundledDigests[sheet.id] = {
            hash: computeSheetHash(sheet),
            file: entry.file,
            source: 'file',
            lastLoaded: now
        };
    }

    const existing = extensionSettings?.wod?.sheetRegistry || {};
    const merged = { ...existing };
    Object.entries(bundledSheets).forEach(([sheetId, sheetData]) => {
        merged[sheetId] = sheetData;
    });

    const preferredOrder = [...manifestOrder];
    Object.keys(merged).forEach(sheetId => {
        if (!preferredOrder.includes(sheetId)) {
            preferredOrder.push(sheetId);
        }
    });

    setWodSheetRegistry(merged, { preferredOrder });

    const storedHashes = readStoredSheetHashes();
    const changedSheetIds = [];
    const addedSheetIds = [];
    Object.entries(bundledDigests).forEach(([sheetId, payload]) => {
        const previous = storedHashes[sheetId];
        if (!previous) {
            addedSheetIds.push(sheetId);
            changedSheetIds.push(sheetId);
            return;
        }
        if (previous.hash !== payload.hash) {
            changedSheetIds.push(sheetId);
        }
    });
    const removedSheetIds = Object.keys(storedHashes).filter(sheetId => !bundledDigests[sheetId]);

    const combinedDigests = {
        ...collectCustomDigests(),
        ...bundledDigests
    };
    setWodSheetDigests(combinedDigests);
    persistSheetHashes(bundledDigests);
    setWodLastSheetRefreshInfo({
        timestamp: now,
        source: loadSource,
        changedSheetIds,
        addedSheetIds,
        removedSheetIds
    });

    return { addedSheetIds, removedSheetIds, changedSheetIds };
}

export function computeSheetHash(sheet) {
    if (!sheet) {
        return '';
    }
    const payload = typeof sheet === 'string' ? sheet : JSON.stringify(sheet);
    let hash = 5381;
    for (let i = 0; i < payload.length; i += 1) {
        hash = ((hash << 5) + hash) ^ payload.charCodeAt(i);
    }
    const normalized = (hash >>> 0).toString(16);
    return `h${payload.length}_${normalized}`;
}
