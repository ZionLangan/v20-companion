/**
 * Core State Management Module
 * Centralizes all extension state variables
 */

// Type imports
/** @typedef {import('../types/inventory.js').InventoryV2} InventoryV2 */
/** @typedef {import('../types/wod.js').WodCharacterSheet} WodCharacterSheet */
/** @typedef {import('../types/wod.js').WodRuntimeState} WodRuntimeState */
/** @typedef {import('../types/wod.js').DicePoolConfig} DicePoolConfig */
/** @typedef {import('../types/wod.js').DiceLogEntry} DiceLogEntry */

const DEFAULT_WOD_DICE_DEFAULTS = Object.freeze({
    difficulty: 6,
    explode: '10-again'
});

const HEALTH_TEMPLATE = [
    { level: 'Bruised', state: 'ok' },
    { level: 'Hurt', state: 'ok' },
    { level: 'Injured', state: 'ok' },
    { level: 'Wounded', state: 'ok' },
    { level: 'Mauled', state: 'ok' },
    { level: 'Crippled', state: 'ok' },
    { level: 'Incapacitated', state: 'ok' }
];

const ABILITY_TEMPLATE = {
    talents: {
        alertness: 0,
        athletics: 0,
        awareness: 0,
        brawl: 0,
        empathy: 0,
        expression: 0,
        intimidation: 0,
        leadership: 0,
        streetwise: 0,
        subterfuge: 0
    },
    skills: {
        animalKen: 0,
        crafts: 0,
        drive: 0,
        etiquette: 0,
        firearms: 0,
        larceny: 0,
        melee: 0,
        performance: 0,
        stealth: 0,
        survival: 0
    },
    knowledges: {
        academics: 0,
        computer: 0,
        finance: 0,
        investigation: 0,
        law: 0,
        medicine: 0,
        occult: 0,
        politics: 0,
        science: 0,
        technology: 0
    }
};

const TEMPLATE_WOD_SHEET = {
    id: 'wod-template',
    version: 1,
    meta: {
        name: 'Unnamed Character',
        concept: 'Blank template',
        notes: []
    },
    traits: {
        attributes: {
            physical: { strength: 1, dexterity: 1, stamina: 1 },
            social: { charisma: 1, manipulation: 1, appearance: 1 },
            mental: { perception: 1, intelligence: 1, wits: 1 }
        },
        abilities: ABILITY_TEMPLATE
    },
    advantages: {
        backgrounds: [],
        virtues: { conscience: 1, selfControl: 1, courage: 1 },
        morality: { type: 'Humanity', rating: 7 },
        willpower: { permanent: 5, current: 5 },
        health: HEALTH_TEMPLATE,
        resourcePools: []
    },
    powerSets: [],
    merits: [],
    flaws: [],
    equipment: {
        inventory: [],
        stored: [],
        assets: []
    },
    notes: []
};

/**
 * Returns a deep copy of the WoD template sheet with a new id/meta override
 * @param {Partial<WodCharacterSheet>} overrides
 * @returns {WodCharacterSheet}
 */
export function createEmptyWodSheet(overrides = {}) {
    const sheet = JSON.parse(JSON.stringify(TEMPLATE_WOD_SHEET));
    if (overrides.id) {
        sheet.id = overrides.id;
    } else {
        sheet.id = `wod-${Date.now()}`;
    }
    return {
        ...sheet,
        ...overrides,
        meta: { ...sheet.meta, ...(overrides.meta || {}) },
        traits: {
            attributes: {
                physical: { ...sheet.traits.attributes.physical, ...(overrides.traits?.attributes?.physical || {}) },
                social: { ...sheet.traits.attributes.social, ...(overrides.traits?.attributes?.social || {}) },
                mental: { ...sheet.traits.attributes.mental, ...(overrides.traits?.attributes?.mental || {}) }
            },
            abilities: {
                talents: { ...sheet.traits.abilities.talents, ...(overrides.traits?.abilities?.talents || {}) },
                skills: { ...sheet.traits.abilities.skills, ...(overrides.traits?.abilities?.skills || {}) },
                knowledges: { ...sheet.traits.abilities.knowledges, ...(overrides.traits?.abilities?.knowledges || {}) }
            }
        },
        advantages: {
            ...sheet.advantages,
            ...overrides.advantages,
            health: overrides.advantages?.health || HEALTH_TEMPLATE.map(level => ({ ...level })),
            resourcePools: overrides.advantages?.resourcePools || []
        },
        powerSets: overrides.powerSets || [],
        merits: overrides.merits || [],
        flaws: overrides.flaws || [],
        equipment: {
            inventory: overrides.equipment?.inventory || [],
            stored: overrides.equipment?.stored || [],
            assets: overrides.equipment?.assets || []
        },
        notes: overrides.notes || []
    };
}

/**
 * Live WoD runtime state for the UI / dice engine
 * @type {WodRuntimeState}
 */
export const wodRuntimeState = {
    baseSheets: new Map(),
    sheets: new Map(),
    sheetOrder: [],
    activeSheetId: null,
    diceLog: [],
    diceDefaults: { ...DEFAULT_WOD_DICE_DEFAULTS },
    chatOverrides: new Map(),
    dirtySheets: new Set()
};

/**
 * Extension settings - persisted to SillyTavern settings
 */
export let extensionSettings = {
    enabled: true,
    autoUpdate: true,
    updateDepth: 4, // How many messages to include in the context
    generationMode: 'together', // 'separate' or 'together' - whether to generate with main response or separately
    useSeparatePreset: false, // Use 'RPG Companion Trackers' preset for tracker generation instead of main API model
    showUserStats: true,
    showInfoBox: true,
    showCharacterThoughts: true,
    showInventory: true, // Show inventory section (v2 system)
    showThoughtsInChat: true, // Show thoughts overlay in chat
    enableHtmlPrompt: false, // Enable immersive HTML prompt injection
    skipInjectionsForGuided: 'none', // skip injections for instruct injections and quiet prompts (GuidedGenerations compatibility)
    enablePlotButtons: true, // Show plot progression buttons above chat input
    panelPosition: 'right', // 'left', 'right', or 'top'
    theme: 'default', // Theme: default, sci-fi, fantasy, cyberpunk, custom
    customColors: {
        bg: '#1a1a2e',
        accent: '#16213e',
        text: '#eaeaea',
        highlight: '#e94560'
    },
    statBarColorLow: '#cc3333', // Color for low stat values (red)
    statBarColorHigh: '#33cc66', // Color for high stat values (green)
    enableAnimations: true, // Enable smooth animations for stats and content updates
    mobileFabPosition: {
        top: 'calc(var(--topBarBlockSize) + 60px)',
        right: '12px'
    }, // Saved position for mobile FAB button
    wod: {
        version: 1,
        sheetRegistry: {},
        sheetOrder: [],
        activeSheetId: null,
        diceDefaults: { ...DEFAULT_WOD_DICE_DEFAULTS },
        diceLogRetention: 50 // Number of roll entries to keep client-side
    },
    /** @deprecated Legacy tracker placeholder until WoD UI replaces it */
    userStats: {
        health: 100,
        satiety: 100,
        energy: 100,
        hygiene: 100,
        arousal: 0,
        mood: '😐',
        conditions: 'None',
        /** @type {InventoryV2} */
        inventory: {
            version: 2,
            onPerson: "None",
            stored: {},
            assets: "None"
        }
    },
    statNames: {
        health: 'Health',
        satiety: 'Satiety',
        energy: 'Energy',
        hygiene: 'Hygiene',
        arousal: 'Arousal'
    },
    // Tracker customization configuration (legacy UI - pending WoD replacement)
    trackerConfig: {
        userStats: {
            // Array of custom stats (allows add/remove/rename)
            customStats: [
                { id: 'health', name: 'Health', enabled: true },
                { id: 'satiety', name: 'Satiety', enabled: true },
                { id: 'energy', name: 'Energy', enabled: true },
                { id: 'hygiene', name: 'Hygiene', enabled: true },
                { id: 'arousal', name: 'Arousal', enabled: true }
            ],
            // RPG Attributes (customizable D&D-style attributes)
            showRPGAttributes: true,
            rpgAttributes: [
                { id: 'str', name: 'STR', enabled: true },
                { id: 'dex', name: 'DEX', enabled: true },
                { id: 'con', name: 'CON', enabled: true },
                { id: 'int', name: 'INT', enabled: true },
                { id: 'wis', name: 'WIS', enabled: true },
                { id: 'cha', name: 'CHA', enabled: true }
            ],
            // Status section config
            statusSection: {
                enabled: true,
                showMoodEmoji: true,
                customFields: ['Conditions'] // User can edit what to track
            },
            // Optional skills field
            skillsSection: {
                enabled: false,
                label: 'Skills' // User-editable
            }
        },
        infoBox: {
            widgets: {
                date: { enabled: true, format: 'Weekday, Month, Year' }, // Format options in UI
                weather: { enabled: true },
                temperature: { enabled: true, unit: 'C' }, // 'C' or 'F'
                time: { enabled: true },
                location: { enabled: true },
                recentEvents: { enabled: true }
            }
        },
        presentCharacters: {
            // Fixed fields (always shown)
            showEmoji: true,
            showName: true,
            // Relationship fields (shown after name, separated by /)
            relationshipFields: ['Lover', 'Friend', 'Ally', 'Enemy', 'Neutral'],
            // Relationship to emoji mapping (shown on character portraits)
            relationshipEmojis: {
                'Lover': '❤️',
                'Friend': '⭐',
                'Ally': '🤝',
                'Enemy': '⚔️',
                'Neutral': '⚖️'
            },
            // Custom fields (appearance, demeanor, etc. - shown after relationship, separated by |)
            customFields: [
                { id: 'appearance', name: 'Appearance', enabled: true, description: 'Visible physical appearance (clothing, hair, notable features)' },
                { id: 'demeanor', name: 'Demeanor', enabled: true, description: 'Observable demeanor or emotional state' }
            ],
            // Thoughts configuration (separate line)
            thoughts: {
                enabled: true,
                name: 'Thoughts',
                description: 'Internal monologue (in first person POV, up to three sentences long)'
            },
            // Character stats toggle (optional feature)
            characterStats: {
                enabled: false,
                customStats: [
                    { id: 'health', name: 'Health', enabled: true },
                    { id: 'arousal', name: 'Arousal', enabled: true }
                ]
            }
        }
    },
    quests: {
        main: "None",        // Current main quest title
        optional: []         // Array of optional quest titles
    },
    level: 1, // User's character level
    classicStats: { // Legacy display values (to be replaced by WoD sheets)
        str: 10,
        dex: 10,
        con: 10,
        int: 10,
        wis: 10,
        cha: 10
    },
    lastDiceRoll: null, // Store last dice roll result
    collapsedInventoryLocations: [], // Array of collapsed storage location names
    inventoryViewModes: {
        onPerson: 'list', // 'list' or 'grid' view mode for On Person section
        stored: 'list',   // 'list' or 'grid' view mode for Stored section
        assets: 'list'    // 'list' or 'grid' view mode for Assets section
    },
    debugMode: false, // Enable debug logging visible in UI (for mobile debugging)
    memoryMessagesToProcess: 16 // Number of messages to process per batch in memory recollection
};

syncWodDiceDefaultsFromSettings();

/**
 * Last generated data from AI response
 */
export let lastGeneratedData = {
    userStats: null,
    infoBox: null,
    characterThoughts: null,
    html: null
};

/**
 * Tracks the "committed" tracker data that should be used as source for next generation
 * This gets updated when user sends a new message or first time generation
 */
export let committedTrackerData = {
    userStats: null,
    infoBox: null,
    characterThoughts: null
};

/**
 * Tracks whether the last action was a swipe (for separate mode)
 * Used to determine whether to commit lastGeneratedData to committedTrackerData
 */
export let lastActionWasSwipe = false;

/**
 * Flag indicating if generation is in progress
 */
export let isGenerating = false;

/**
 * Tracks if we're currently doing a plot progression
 */
export let isPlotProgression = false;

/**
 * Debug logs array for troubleshooting
 */
export let debugLogs = [];

/**
 * Add a debug log entry
 * @param {string} message - The log message
 * @param {any} data - Optional data to log
 */
export function addDebugLog(message, data = null) {
    const timestamp = new Date().toISOString();
    debugLogs.push({ timestamp, message, data });
    // Keep only last 100 logs
    if (debugLogs.length > 100) {
        debugLogs.shift();
    }
}

/**
 * Feature flags for gradual rollout of new features
 */
export const FEATURE_FLAGS = {
    useNewInventory: true // Enable v2 inventory system with categorized storage
};

/**
 * Fallback avatar image (base64-encoded SVG with "?" icon)
 * Using base64 to avoid quote-encoding issues in HTML attributes
 */
export const FALLBACK_AVATAR_DATA_URI = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2NjY2NjYyIgb3BhY2l0eT0iMC4zIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIiBmaWxsPSIjNjY2IiBmb250LXNpemU9IjQwIj4/PC90ZXh0Pjwvc3ZnPg==';

/**
 * UI Element References (jQuery objects)
 */
export let $panelContainer = null;
export let $userStatsContainer = null;
export let $infoBoxContainer = null;
export let $thoughtsContainer = null;
export let $inventoryContainer = null;
export let $questsContainer = null;

/**
 * State setters - provide controlled mutation of state variables
 */
export function setExtensionSettings(newSettings) {
    extensionSettings = newSettings;
    ensureWodSettings();
    syncWodDiceDefaultsFromSettings();
}

export function updateExtensionSettings(updates) {
    Object.assign(extensionSettings, updates);
    ensureWodSettings();
    syncWodDiceDefaultsFromSettings();
}

export function setLastGeneratedData(data) {
    lastGeneratedData = data;
}

export function updateLastGeneratedData(updates) {
    Object.assign(lastGeneratedData, updates);
}

export function setCommittedTrackerData(data) {
    committedTrackerData = data;
}

export function updateCommittedTrackerData(updates) {
    Object.assign(committedTrackerData, updates);
}

export function setLastActionWasSwipe(value) {
    lastActionWasSwipe = value;
}

export function setIsGenerating(value) {
    isGenerating = value;
}

export function setIsPlotProgression(value) {
    isPlotProgression = value;
}

export function setPanelContainer($element) {
    $panelContainer = $element;
}

export function setUserStatsContainer($element) {
    $userStatsContainer = $element;
}

export function setInfoBoxContainer($element) {
    $infoBoxContainer = $element;
}

export function setThoughtsContainer($element) {
    $thoughtsContainer = $element;
}

export function setInventoryContainer($element) {
    $inventoryContainer = $element;
}

export function setQuestsContainer($element) {
    $questsContainer = $element;
}

/**
 * WoD runtime helpers
 */
export function getActiveWodSheet() {
    if (!wodRuntimeState.activeSheetId) {
        return null;
    }
    return wodRuntimeState.sheets.get(wodRuntimeState.activeSheetId) || null;
}

export function getWodSheet(sheetId) {
    if (!sheetId) {
        return null;
    }
    return wodRuntimeState.sheets.get(sheetId) || null;
}

export function isWodSheetDirty(sheetId) {
    if (!sheetId) {
        return false;
    }
    return wodRuntimeState.dirtySheets?.has(sheetId) || false;
}

export function getDirtyWodSheetIds() {
    if (!wodRuntimeState.dirtySheets) {
        return [];
    }
    return Array.from(wodRuntimeState.dirtySheets);
}

export function markWodSheetDirty(sheetId) {
    if (!sheetId) {
        return;
    }
    if (!wodRuntimeState.dirtySheets) {
        wodRuntimeState.dirtySheets = new Set();
    }
    wodRuntimeState.dirtySheets.add(sheetId);
}

export function markWodSheetClean(sheetId) {
    if (!sheetId || !wodRuntimeState.dirtySheets) {
        return;
    }
    wodRuntimeState.dirtySheets.delete(sheetId);
}

export function setActiveWodSheetId(sheetId) {
    if (sheetId && !wodRuntimeState.sheets.has(sheetId)) {
        return;
    }
    wodRuntimeState.activeSheetId = sheetId || null;
    ensureWodSettings();
    extensionSettings.wod.activeSheetId = wodRuntimeState.activeSheetId;
}

export function setWodSheetRegistry(registry = {}, options = {}) {
    ensureWodSettings();
    const sanitizedRegistry = {};
    Object.entries(registry).forEach(([sheetId, sheetData]) => {
        if (!sheetId || !sheetData || typeof sheetData !== 'object') {
            return;
        }
        sanitizedRegistry[sheetId] = cloneSheetData(sheetData);
    });
    extensionSettings.wod.sheetRegistry = sanitizedRegistry;
    wodRuntimeState.baseSheets = new Map();
    wodRuntimeState.dirtySheets = new Set();
    Object.entries(sanitizedRegistry).forEach(([sheetId, sheetData]) => {
        wodRuntimeState.baseSheets.set(sheetId, cloneSheetData(sheetData));
    });
    reapplyWodOverrides();
    const preferredOrder = Array.isArray(options.preferredOrder) && options.preferredOrder.length > 0
        ? options.preferredOrder
        : extensionSettings.wod.sheetOrder || [];
    const filteredOrder = preferredOrder.filter(id => wodRuntimeState.sheets.has(id));
    wodRuntimeState.sheetOrder = filteredOrder.length > 0 ? [...filteredOrder] : Array.from(wodRuntimeState.sheets.keys());
    extensionSettings.wod.sheetOrder = [...wodRuntimeState.sheetOrder];
    const candidateActive = options.activeSheetId || extensionSettings.wod.activeSheetId || wodRuntimeState.sheetOrder[0] || null;
    if (candidateActive && wodRuntimeState.sheets.has(candidateActive)) {
        wodRuntimeState.activeSheetId = candidateActive;
    } else {
        wodRuntimeState.activeSheetId = wodRuntimeState.sheetOrder[0] || null;
        extensionSettings.wod.activeSheetId = wodRuntimeState.activeSheetId;
    }
}

export function upsertWodSheet(sheet) {
    if (!sheet || !sheet.id) {
        return;
    }
    ensureWodSettings();
    const safeSheet = cloneSheetData(sheet);
    if (!wodRuntimeState.baseSheets) {
        wodRuntimeState.baseSheets = new Map();
    }
    wodRuntimeState.baseSheets.set(sheet.id, cloneSheetData(safeSheet));
    wodRuntimeState.sheets.set(sheet.id, cloneSheetData(safeSheet));
    extensionSettings.wod.sheetRegistry[sheet.id] = cloneSheetData(safeSheet);
    if (!wodRuntimeState.sheetOrder.includes(sheet.id)) {
        wodRuntimeState.sheetOrder.push(sheet.id);
    }
    extensionSettings.wod.sheetOrder = [...wodRuntimeState.sheetOrder];
    reapplyWodOverrides();
    if (!wodRuntimeState.activeSheetId) {
        setActiveWodSheetId(sheet.id);
    }
}

export function removeWodSheet(sheetId) {
    if (!sheetId) {
        return;
    }
    wodRuntimeState.sheets.delete(sheetId);
    if (wodRuntimeState.baseSheets) {
        wodRuntimeState.baseSheets.delete(sheetId);
    }
    wodRuntimeState.sheetOrder = wodRuntimeState.sheetOrder.filter(id => id !== sheetId);
    ensureWodSettings();
    delete extensionSettings.wod.sheetRegistry[sheetId];
    extensionSettings.wod.sheetOrder = [...wodRuntimeState.sheetOrder];
    reapplyWodOverrides();
    if (wodRuntimeState.activeSheetId === sheetId) {
        setActiveWodSheetId(wodRuntimeState.sheetOrder[0] || null);
    }
}

export function appendWodDiceLog(entry) {
    if (!entry) {
        return;
    }
    wodRuntimeState.diceLog.push(entry);
    const retention = extensionSettings?.wod?.diceLogRetention ?? 50;
    while (wodRuntimeState.diceLog.length > retention) {
        wodRuntimeState.diceLog.shift();
    }
}

export function clearWodDiceLog() {
    wodRuntimeState.diceLog = [];
}

export function setWodDiceDefaults(defaults = {}) {
    ensureWodSettings();
    extensionSettings.wod.diceDefaults = {
        ...extensionSettings.wod.diceDefaults,
        ...defaults
    };
    syncWodDiceDefaultsFromSettings();
}

export function setWodChatOverrides(overrides = {}) {
    wodRuntimeState.chatOverrides = new Map();
    wodRuntimeState.dirtySheets = new Set();
    if (overrides && typeof overrides === 'object') {
        Object.entries(overrides).forEach(([sheetId, payload]) => {
            if (!payload || !payload.sheet) {
                return;
            }
            wodRuntimeState.chatOverrides.set(sheetId, {
                updatedAt: payload.updatedAt || Date.now(),
                sheet: cloneSheetData(payload.sheet)
            });
            markWodSheetDirty(sheetId);
        });
    }
    reapplyWodOverrides();
}

export function clearWodChatOverrides() {
    wodRuntimeState.chatOverrides = new Map();
    wodRuntimeState.dirtySheets = new Set();
    reapplyWodOverrides();
}

export function recordWodChatOverride(sheet, updatedAt = Date.now()) {
    if (!sheet || !sheet.id) {
        return;
    }
    if (!wodRuntimeState.chatOverrides) {
        wodRuntimeState.chatOverrides = new Map();
    }
    wodRuntimeState.chatOverrides.set(sheet.id, {
        updatedAt,
        sheet: cloneSheetData(sheet)
    });
    markWodSheetDirty(sheet.id);
    reapplyWodOverrides();
}

export function removeWodChatOverride(sheetId) {
    if (!sheetId || !wodRuntimeState.chatOverrides) {
        return;
    }
    if (!wodRuntimeState.chatOverrides.has(sheetId)) {
        return;
    }
    wodRuntimeState.chatOverrides.delete(sheetId);
    markWodSheetClean(sheetId);
    reapplyWodOverrides();
}

export function serializeWodChatOverrides() {
    const payload = {};
    if (!wodRuntimeState.chatOverrides) {
        return payload;
    }
    wodRuntimeState.chatOverrides.forEach((entry, sheetId) => {
        if (!entry || !entry.sheet) {
            return;
        }
        payload[sheetId] = {
            updatedAt: entry.updatedAt || Date.now(),
            sheet: cloneSheetData(entry.sheet)
        };
    });
    return payload;
}

function cloneSheetData(sheet) {
    return JSON.parse(JSON.stringify(sheet));
}

function refreshWodSheetsFromBase() {
    wodRuntimeState.sheets = new Map();
    if (!wodRuntimeState.baseSheets) {
        wodRuntimeState.baseSheets = new Map();
        return;
    }
    wodRuntimeState.baseSheets.forEach((sheet, sheetId) => {
        wodRuntimeState.sheets.set(sheetId, cloneSheetData(sheet));
    });
}

function reapplyWodOverrides() {
    refreshWodSheetsFromBase();
    if (!wodRuntimeState.chatOverrides || wodRuntimeState.chatOverrides.size === 0) {
        return;
    }
    wodRuntimeState.chatOverrides.forEach((entry, sheetId) => {
        if (!entry || !entry.sheet) {
            return;
        }
        wodRuntimeState.sheets.set(sheetId, cloneSheetData(entry.sheet));
        if (!wodRuntimeState.sheetOrder.includes(sheetId)) {
            wodRuntimeState.sheetOrder.push(sheetId);
        }
    });
}

function ensureWodSettings() {
    if (!extensionSettings.wod) {
        extensionSettings.wod = {
            version: 1,
            sheetRegistry: {},
            sheetOrder: [],
            activeSheetId: null,
            diceDefaults: { ...DEFAULT_WOD_DICE_DEFAULTS },
            diceLogRetention: 50
        };
    }
}

function syncWodDiceDefaultsFromSettings() {
    ensureWodSettings();
    const diceDefaults = extensionSettings.wod.diceDefaults || DEFAULT_WOD_DICE_DEFAULTS;
    wodRuntimeState.diceDefaults = {
        ...DEFAULT_WOD_DICE_DEFAULTS,
        ...diceDefaults
    };
}
