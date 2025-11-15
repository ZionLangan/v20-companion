import { extensionFolderPath } from './config.js';
import { extensionSettings, setWodSheetRegistry } from './state.js';

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

/**
 * Loads bundled WoD sheets from the extension folder and merges them
 * into the active registry so manual JSON edits become available immediately.
 */
export async function loadBundledSheets() {
    if (!SHEETS_BASE_PATH) {
        console.warn('[RPG Companion] Sheets base path missing; skipping bundled sheet load');
        return;
    }

    const indexUrl = `${SHEETS_BASE_PATH}/sheet-index.json`;
    const manifest = await fetchJson(indexUrl, 'sheet index');
    if (!manifest || !Array.isArray(manifest.sheets)) {
        console.warn('[RPG Companion] No sheet-index.json found or invalid format; skipping bundled sheet load');
        return;
    }

    const bundledSheets = {};
    const manifestOrder = [];

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
}
