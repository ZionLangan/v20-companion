import {
    extensionSettings,
    wodRuntimeState,
    $userStatsContainer,
    getActiveWodSheet,
    getWodSheet,
    setActiveWodSheetId,
    recordWodChatOverride,
    removeWodChatOverride,
    isWodSheetDirty
} from '../../core/state.js';
import { saveChatData, saveSettings } from '../../core/persistence.js';

const ATTRIBUTE_MAX = 5;
const EXTENDED_MAX = 10;
const HEALTH_STATES = ['ok', 'bashing', 'lethal', 'aggravated'];

const uiState = {
    syncPanelSheet: null,
    logFilter: 'active',
    sectionToggles: new Map()
};

/**
 * Builds a lightweight textual summary for the currently active WoD sheet.
 * Used by legacy systems that still expect a user stats string.
 */
export function buildWodSheetSummary() {
    const sheet = getActiveWodSheet();
    if (!sheet) {
        return 'No World of Darkness sheet loaded.';
    }
    const meta = sheet.meta || {};
    const attrs = sheet.traits?.attributes || {};
    const phys = attrs.physical || {};
    const soc = attrs.social || {};
    const ment = attrs.mental || {};
    const wp = sheet.advantages?.willpower || {};
    const morality = sheet.advantages?.morality || {};
    return [
        `${meta.name || sheet.id} (${meta.concept || 'concept unknown'})`,
        `Physical: Str ${phys.strength ?? 0} Dex ${phys.dexterity ?? 0} Sta ${phys.stamina ?? 0}`,
        `Social: Cha ${soc.charisma ?? 0} Man ${soc.manipulation ?? 0} App ${soc.appearance ?? 0}`,
        `Mental: Per ${ment.perception ?? 0} Int ${ment.intelligence ?? 0} Wit ${ment.wits ?? 0}`,
        `Willpower ${wp.current ?? 0}/${wp.permanent ?? 0} · ${morality.type || 'Humanity'} ${morality.rating ?? 0}`
    ].join('\n');
}

/**
 * Main render function wired through renderUserStats().
 * Replaces the legacy stat bars with the WoD sheet editor.
 */
export function renderWodSheet() {
    if (!$userStatsContainer || $userStatsContainer.length === 0 || !extensionSettings.showUserStats) {
        return;
    }

    const sheet = getActiveWodSheet();
    const dirty = sheet ? isWodSheetDirty(sheet.id) : false;
    const html = `
        <div class="wod-sheet-root" data-sheet-id="${sheet?.id || ''}">
            ${renderCharacterToolbar(sheet, dirty)}
            ${sheet ? renderSheetContent(sheet) : renderEmptyState()}
            ${renderSyncPanel(sheet)}
            ${renderDiceLogSection(sheet)}
        </div>
    `;

    $userStatsContainer.html(html);
    ensureSheetEvents();
}

function renderCharacterToolbar(sheet, dirty) {
    const options = wodRuntimeState.sheetOrder.map(sheetId => {
        const entry = wodRuntimeState.sheets.get(sheetId);
        const label = entry?.meta?.name || entry?.meta?.concept || sheetId;
        const selected = sheetId === sheet?.id ? 'selected' : '';
        return `<option value="${sheetId}" ${selected}>${escapeHtml(label)}</option>`;
    }).join('');

    const dirtyBadge = dirty
        ? '<span class="wod-dirty-pill" title="Chat override pending sync">Chat override</span>'
        : '';

    const sheetIdLabel = sheet ? `<span class="wod-sheet-id">ID: ${escapeHtml(sheet.id)}</span>` : '';

    return `
        <div class="wod-toolbar">
            <label class="wod-toolbar-label" for="wod-character-select">Character</label>
            <select id="wod-character-select" class="wod-character-select">
                ${options}
            </select>
            ${sheet ? `
            <button class="wod-toolbar-btn" data-action="open-sync">
                <i class="fa-solid fa-file-export"></i>
                Sync to File
            </button>
            ${dirty ? `
            <button class="wod-toolbar-btn wod-toolbar-btn--ghost" data-action="revert-sheet">
                <i class="fa-solid fa-rotate-left"></i>
                Reset to File
            </button>` : ''}
            ` : ''}
            <div class="wod-toolbar-meta">
                ${sheetIdLabel}
                ${dirtyBadge}
            </div>
        </div>
    `;
}

function renderSheetContent(sheet) {
    const sections = [
        renderTrackersCard(sheet),
        renderCollapsibleCard('identity', 'Identity & Chronicle', buildIdentityFields(sheet), { defaultCollapsed: false }),
        renderCollapsibleCard('attributes', 'Attributes', buildAttributesGrid(sheet)),
        renderCollapsibleCard('abilities', 'Abilities', buildAbilitiesGrid(sheet)),
        renderCollapsibleCard('backgrounds', 'Backgrounds & Virtues', buildBackgroundsContent(sheet)),
        renderCollapsibleCard('powers', 'Disciplines & Powers', buildPowersContent(sheet)),
        renderCollapsibleCard('equipment', 'Equipment & Assets', buildEquipmentContent(sheet)),
        renderCollapsibleCard('notes', 'Merits, Flaws & Notes', buildNotesContent(sheet))
    ];
    return `<div class="wod-sections">${sections.join('')}</div>`;
}

function buildIdentityFields(sheet) {
    const meta = sheet.meta || {};
    const metaNotes = Array.isArray(meta.notes) ? meta.notes.join('\n') : '';
    return `
        <div class="wod-grid wod-grid--two">
            ${renderTextInput('Name', 'meta.name', meta.name)}
            ${renderTextInput('Concept', 'meta.concept', meta.concept)}
            ${renderTextInput('Player', 'meta.player', meta.player)}
            ${renderTextInput('Chronicle', 'meta.chronicle', meta.chronicle)}
            ${renderTextInput('Faction Type', 'meta.faction.type', meta.faction?.type)}
            ${renderTextInput('Faction Value', 'meta.faction.value', meta.faction?.value)}
            ${renderTextInput('Supernatural Type', 'meta.supernaturalType', meta.supernaturalType)}
            ${renderTextInput('Supernatural Subtype', 'meta.supernaturalSubtype', meta.supernaturalSubtype)}
            ${renderTextInput('Nature', 'meta.nature', meta.nature)}
            ${renderTextInput('Demeanor', 'meta.demeanor', meta.demeanor)}
            ${renderNumberInput('Age', 'meta.age', meta.age, 0, 500)}
            ${renderNumberInput('Apparent Age', 'meta.apparentAge', meta.apparentAge, 0, 500)}
            ${renderTextInput('Pronouns', 'meta.pronouns', meta.pronouns)}
        </div>
        <label class="wod-field-label">Identity Notes</label>
        <textarea class="wod-field-input" data-path="meta.notes" data-input-type="string-array" rows="3">${escapeHtml(metaNotes)}</textarea>
    `;
}

function buildAttributesGrid(sheet) {
    const attributes = sheet.traits?.attributes || {};
    return `
        <div class="wod-grid wod-grid--three">
            ${renderAttributeColumn('Physical', attributes.physical || {}, 'traits.attributes.physical')}
            ${renderAttributeColumn('Social', attributes.social || {}, 'traits.attributes.social')}
            ${renderAttributeColumn('Mental', attributes.mental || {}, 'traits.attributes.mental')}
        </div>
    `;
}

function renderAttributeColumn(label, group, basePath) {
    return `
        <div class="wod-attribute-column">
            <h5>${label}</h5>
            ${Object.entries(group || {}).map(([key, value]) => `
                <div class="wod-trait-row">
                    <span>${toTitleCase(key)}</span>
                    ${renderDotTrack(`${basePath}.${key}`, value, ATTRIBUTE_MAX)}
                </div>
            `).join('')}
        </div>
    `;
}

function buildAbilitiesGrid(sheet) {
    const abilities = sheet.traits?.abilities || {};
    return `
        <div class="wod-grid wod-grid--three">
            ${renderAbilityBlock('Talents', abilities.talents || {}, 'traits.abilities.talents')}
            ${renderAbilityBlock('Skills', abilities.skills || {}, 'traits.abilities.skills')}
            ${renderAbilityBlock('Knowledges', abilities.knowledges || {}, 'traits.abilities.knowledges')}
        </div>
    `;
}

function renderAbilityBlock(label, group, basePath) {
    return `
        <div class="wod-ability-column">
            <h5>${label}</h5>
            ${Object.entries(group || {}).map(([key, value]) => `
                <div class="wod-trait-row">
                    <span>${toTitleCase(key)}</span>
                    ${renderDotTrack(`${basePath}.${key}`, value, ATTRIBUTE_MAX)}
                </div>
            `).join('')}
        </div>
    `;
}

function renderTrackersCard(sheet) {
    const advantages = sheet.advantages || {};
    const willpower = advantages.willpower || {};
    const morality = advantages.morality || {};
    const health = advantages.health || [];
    const resourcePools = advantages.resourcePools || [];
    return `
        <section class="wod-card wod-card--essentials">
            <header class="wod-card-header">
                <h4>Resources & Health</h4>
            </header>
            <div class="wod-card-body">
                <div class="wod-grid wod-grid--two wod-essentials-primary">
                    <div>
                        <h5>Willpower</h5>
                        <label class="wod-field-label">Permanent</label>
                        ${renderDotTrack('advantages.willpower.permanent', willpower.permanent, EXTENDED_MAX, { enforce: 'willpower-permanent' })}
                        <label class="wod-field-label">Current</label>
                        ${renderDotTrack('advantages.willpower.current', willpower.current, EXTENDED_MAX, { enforce: 'willpower-current' })}
                        <label class="wod-field-label">Morality / Path</label>
                        <div class="wod-morality-row">
                            ${renderTextInput('Path', 'advantages.morality.type', morality.type, true)}
                            ${renderNumberInput('Rating', 'advantages.morality.rating', morality.rating, 0, EXTENDED_MAX, true)}
                        </div>
                        ${renderTextInput('Notes', 'advantages.morality.notes', morality.notes, true)}
                    </div>
                    <div>
                        <h5>Health Track</h5>
                        ${renderHealthTrack(health)}
                    </div>
                </div>
                <div class="wod-subsection">
                    <h5>Resource Pools</h5>
                    ${renderResourcePools(resourcePools)}
                    <button class="wod-mini-btn" data-action="add-row" data-template="resource" data-path="advantages.resourcePools">
                        <i class="fa-solid fa-plus"></i> Add Pool
                    </button>
                </div>
            </div>
        </section>
    `;
}

function renderCollapsibleCard(id, title, body, options = {}) {
    const collapsed = isSectionCollapsed(id, options.defaultCollapsed !== undefined ? options.defaultCollapsed : true);
    return `
        <section class="wod-card wod-collapsible ${collapsed ? 'is-collapsed' : ''}" data-section-id="${id}">
            <header class="wod-card-header">
                <h4>${title}</h4>
                <button class="wod-collapse-toggle" type="button" data-section-toggle="${id}" aria-expanded="${!collapsed}">
                    <i class="fa-solid fa-chevron-${collapsed ? 'down' : 'up'}"></i>
                </button>
            </header>
            <div class="wod-card-body" ${collapsed ? 'hidden' : ''}>
                ${body}
            </div>
        </section>
    `;
}

function isSectionCollapsed(sectionId, defaultCollapsed = true) {
    if (!uiState.sectionToggles.has(sectionId)) {
        uiState.sectionToggles.set(sectionId, defaultCollapsed);
    }
    return uiState.sectionToggles.get(sectionId);
}

function toggleSectionCollapsed(sectionId) {
    if (!sectionId) return;
    const current = isSectionCollapsed(sectionId, true);
    uiState.sectionToggles.set(sectionId, !current);
}

function buildBackgroundsContent(sheet) {
    const advantages = sheet.advantages || {};
    const virtues = advantages.virtues || {};
    const backgrounds = advantages.backgrounds || [];
    return `
        <div class="wod-grid">
            <div>
                <h5>Virtues</h5>
                ${Object.entries(virtues).map(([key, value]) => `
                    <label class="wod-field-label">${toTitleCase(key)}</label>
                    ${renderDotTrack(`advantages.virtues.${key}`, value, ATTRIBUTE_MAX)}
                `).join('')}
            </div>
            <div>
                <h5>Backgrounds</h5>
                ${renderBackgroundList(backgrounds)}
                <button class="wod-mini-btn" data-action="add-row" data-template="background" data-path="advantages.backgrounds">
                    <i class="fa-solid fa-plus"></i> Add Background
                </button>
            </div>
        </div>
    `;
}

function renderBackgroundList(list) {
    if (!Array.isArray(list) || list.length === 0) {
        return '<p class="wod-empty-hint">No backgrounds recorded.</p>';
    }
    return list.map((entry, index) => `
        <div class="wod-list-row" data-index="${index}">
            ${renderTextInput('Name', `advantages.backgrounds[${index}].name`, entry.name, true)}
            ${renderDotTrack(`advantages.backgrounds[${index}].rating`, entry.rating, ATTRIBUTE_MAX)}
            <textarea class="wod-field-input" rows="2" data-path="advantages.backgrounds[${index}].description">${escapeHtml(entry.description || '')}</textarea>
            <button class="wod-mini-btn wod-mini-btn--danger" data-action="remove-row" data-path="advantages.backgrounds[${index}]">
                Remove
            </button>
        </div>
    `).join('');
}

function renderHealthTrack(levels = []) {
    if (!Array.isArray(levels) || levels.length === 0) {
        return '<p class="wod-empty-hint">Health levels not configured.</p>';
    }
    return `
        <div class="wod-health-track">
            ${levels.map((level, index) => renderHealthLevel(level, index)).join('')}
        </div>
    `;
}

function renderHealthLevel(level, index) {
    const state = level.state || 'ok';
    const glyph = state === 'ok' ? '' : state === 'bashing' ? '/' : state === 'lethal' ? 'X' : '*';
    return `
        <button class="wod-health-box" data-index="${index}" data-level-label="${level.level}" data-state="${state}">
            <span class="wod-health-box__label">${escapeHtml(level.level)}</span>
            <span class="wod-health-box__glyph">${glyph}</span>
        </button>
    `;
}

function renderResourcePools(pools) {
    if (!Array.isArray(pools) || pools.length === 0) {
        return '<p class="wod-empty-hint">No resource pools configured.</p>';
    }
    return pools.map((pool, index) => {
        const maxDots = Math.max(Number(pool.capacity) || 0, Number(pool.current) || 0, 1);
        return `
            <div class="wod-list-row wod-list-row--pool" data-index="${index}">
                <div class="wod-grid wod-grid--two">
                    ${renderTextInput('Name', `advantages.resourcePools[${index}].name`, pool.name, true)}
                    ${renderTextInput('Type', `advantages.resourcePools[${index}].type`, pool.type, true)}
                </div>
                <div class="wod-resource-track">
                    <span class="wod-resource-track__value">${Number(pool.current) || 0}/${Number(pool.capacity) || 0}</span>
                    ${renderDotTrack(`advantages.resourcePools[${index}].current`, pool.current, maxDots)}
                </div>
                <div class="wod-grid wod-grid--two">
                    ${renderNumberInput('Capacity', `advantages.resourcePools[${index}].capacity`, pool.capacity, 0, 999, true)}
                    <textarea class="wod-field-input" rows="2" data-path="advantages.resourcePools[${index}].notes">${escapeHtml(pool.notes || '')}</textarea>
                </div>
                <button class="wod-mini-btn wod-mini-btn--danger" data-action="remove-row" data-path="advantages.resourcePools[${index}]">
                    Remove
                </button>
            </div>
        `;
    }).join('');
}

function buildPowersContent(sheet) {
    const powerSets = sheet.powerSets || [];
    return `
        <div class="wod-card-body">
            ${powerSets.length === 0 ? '<p class="wod-empty-hint">No power sets defined.</p>' : ''}
            ${powerSets.map((set, index) => renderPowerSet(set, index)).join('')}
            <button class="wod-mini-btn" data-action="add-row" data-template="powerSet" data-path="powerSets">
                <i class="fa-solid fa-plus"></i> Add Power Set
            </button>
        </div>
    `;
}

function renderPowerSet(set, index) {
    const powers = Array.isArray(set.powers) ? set.powers : [];
    return `
        <div class="wod-power-set">
            <div class="wod-grid wod-grid--two">
                ${renderTextInput('Name', `powerSets[${index}].name`, set.name, true)}
                ${renderTextInput('Category', `powerSets[${index}].category`, set.category, true)}
            </div>
            <label class="wod-field-label">Rating</label>
            ${renderDotTrack(`powerSets[${index}].rating`, set.rating, EXTENDED_MAX)}
            <label class="wod-field-label">Tags</label>
            ${renderTextInput('Comma separated', `powerSets[${index}].tags`, (set.tags || []).join(', '), true)}
            <label class="wod-field-label">Notes</label>
            <textarea class="wod-field-input" rows="2" data-path="powerSets[${index}].notes">${escapeHtml(set.notes || '')}</textarea>
            <div class="wod-subsection">
                <h5>Powers</h5>
                ${powers.length === 0 ? '<p class="wod-empty-hint">No individual powers recorded.</p>' : ''}
                ${powers.map((power, powerIndex) => `
                    <div class="wod-list-row" data-index="${powerIndex}">
                        ${renderTextInput('Name', `powerSets[${index}].powers[${powerIndex}].name`, power.name, true)}
                        ${renderNumberInput('Rating', `powerSets[${index}].powers[${powerIndex}].rating`, power.rating, 0, EXTENDED_MAX, true)}
                        <textarea class="wod-field-input" rows="2" data-path="powerSets[${index}].powers[${powerIndex}].description">${escapeHtml(power.description || '')}</textarea>
                        <button class="wod-mini-btn wod-mini-btn--danger" data-action="remove-row" data-path="powerSets[${index}].powers[${powerIndex}]">
                            Remove
                        </button>
                    </div>
                `).join('')}
                <button class="wod-mini-btn" data-action="add-row" data-template="power" data-path="powerSets[${index}].powers">
                    <i class="fa-solid fa-plus"></i> Add Power
                </button>
            </div>
            <button class="wod-mini-btn wod-mini-btn--danger" data-action="remove-row" data-path="powerSets[${index}]">
                Remove Set
            </button>
        </div>
    `;
}

function buildEquipmentContent(sheet) {
    const equipment = sheet.equipment || {};
    return `
        <div class="wod-card-body wod-grid wod-grid--three">
            ${renderEquipmentGroup('On Person', equipment.inventory || [], 'equipment.inventory')}
            ${renderEquipmentGroup('Stored', equipment.stored || [], 'equipment.stored')}
            ${renderEquipmentGroup('Assets', equipment.assets || [], 'equipment.assets')}
        </div>
    `;
}

function renderEquipmentGroup(label, items, basePath) {
    return `
        <div class="wod-equipment-column">
            <h5>${label}</h5>
            ${(!items || items.length === 0) ? '<p class="wod-empty-hint">Nothing listed.</p>' : ''}
            ${(items || []).map((item, index) => `
                <div class="wod-list-row" data-index="${index}">
                    ${renderTextInput('Name', `${basePath}[${index}].name`, item.name, true)}
                    ${renderTextInput('Type', `${basePath}[${index}].type`, item.type, true)}
                    ${renderTextInput('Location', `${basePath}[${index}].location`, item.location, true)}
                    <textarea class="wod-field-input" rows="2" data-path="${basePath}[${index}].description">${escapeHtml(item.description || '')}</textarea>
                    <button class="wod-mini-btn wod-mini-btn--danger" data-action="remove-row" data-path="${basePath}[${index}]">
                        Remove
                    </button>
                </div>
            `).join('')}
            <button class="wod-mini-btn" data-action="add-row" data-template="equipment" data-path="${basePath}">
                <i class="fa-solid fa-plus"></i> Add Item
            </button>
        </div>
    `;
}

function buildNotesContent(sheet) {
    const merits = sheet.merits || [];
    const flaws = sheet.flaws || [];
    const notes = Array.isArray(sheet.notes) ? sheet.notes.join('\n') : '';
    return `
        <div class="wod-grid wod-grid--two">
            ${renderTraitList('Merits', merits, 'merits')}
            ${renderTraitList('Flaws', flaws, 'flaws')}
        </div>
        <label class="wod-field-label">Story Notes</label>
        <textarea class="wod-field-input" rows="4" data-path="notes" data-input-type="string-array">${escapeHtml(notes)}</textarea>
    `;
}

function renderTraitList(label, list, path) {
    return `
        <div>
            <h5>${label}</h5>
            ${(!list || list.length === 0) ? `<p class="wod-empty-hint">No ${label.toLowerCase()} tracked.</p>` : ''}
            ${(list || []).map((entry, index) => `
                <div class="wod-list-row">
                    ${renderTextInput('Name', `${path}[${index}].name`, entry.name, true)}
                    ${renderNumberInput('Rating', `${path}[${index}].rating`, entry.rating, -5, 10, true)}
                    <textarea class="wod-field-input" rows="2" data-path="${path}[${index}].description">${escapeHtml(entry.description || '')}</textarea>
                    <button class="wod-mini-btn wod-mini-btn--danger" data-action="remove-row" data-path="${path}[${index}]">
                        Remove
                    </button>
                </div>
            `).join('')}
            <button class="wod-mini-btn" data-action="add-row" data-template="${path === 'merits' ? 'merit' : 'flaw'}" data-path="${path}">
                <i class="fa-solid fa-plus"></i> Add ${label.slice(0, -1)}
            </button>
        </div>
    `;
}

function renderSyncPanel(sheet) {
    if (!sheet || uiState.syncPanelSheet !== sheet.id) {
        return '';
    }
    const json = JSON.stringify(sheet, null, 2);
    return `
        <section class="wod-card wod-sync-panel">
            <header class="wod-card-header">
                <h4>Sync with File</h4>
                <button class="wod-mini-btn" data-action="close-sync">Close</button>
            </header>
            <p class="wod-sync-help">
                Copy this JSON into <code>sheets/${escapeHtml(sheet.id)}.json</code> (or your custom sheet file) with a text editor, then refresh SillyTavern.
            </p>
            <textarea class="wod-sync-output" readonly>${escapeHtml(json)}</textarea>
            <div class="wod-sync-actions">
                <button class="wod-toolbar-btn" data-action="copy-sync">
                    <i class="fa-solid fa-copy"></i> Copy JSON
                </button>
            </div>
        </section>
    `;
}

function renderDiceLogSection(sheet) {
    const filter = uiState.logFilter;
    const entries = (wodRuntimeState.diceLog || []).filter(entry => {
        if (filter === 'all') {
            return true;
        }
        if (filter === 'active') {
            return !sheet || entry.sheetId === sheet.id;
        }
        return entry.sheetId === filter;
    }).slice(-8).reverse();

    const options = ['<option value="active">Active Character</option>', '<option value="all">All Characters</option>'];
    wodRuntimeState.sheetOrder.forEach(sheetId => {
        const name = wodRuntimeState.sheets.get(sheetId)?.meta?.name || sheetId;
        const selected = filter === sheetId ? 'selected' : '';
        options.push(`<option value="${sheetId}" ${selected}>${escapeHtml(name)}</option>`);
    });

    const rows = entries.length === 0
        ? '<li class="wod-empty-hint">No rolls logged yet.</li>'
        : entries.map(entry => `
            <li class="wod-dice-row">
                <div class="wod-dice-row__header">
                    <strong>${escapeHtml(entry.poolLabel || 'Dice Pool')}</strong>
                    <span class="wod-dice-row__result wod-dice-row__result--${entry.outcome}">
                        ${entry.successes} successes
                    </span>
                </div>
                <div class="wod-dice-row__meta">
                    <span>Diff ${entry.difficulty}</span>
                    <span>${entry.explode}</span>
                    ${entry.spendWillpower ? '<span>Willpower</span>' : ''}
                    ${entry.botch ? '<span class="wod-danger">Botch</span>' : ''}
                    <span>${new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div class="wod-dice-row__details">
                    Dice: [${entry.rolls.join(', ')}]
                </div>
                ${entry.notes ? `<div class="wod-dice-row__notes">${escapeHtml(entry.notes)}</div>` : ''}
            </li>
        `).join('');

    return `
        <section class="wod-card wod-dice-log">
            <header class="wod-card-header">
                <h4>Dice Log</h4>
                <select class="wod-log-filter">
                    ${options.join('')}
                </select>
            </header>
            <ul class="wod-dice-log-list">
                ${rows}
            </ul>
        </section>
    `;
}

function renderEmptyState() {
    return `
        <section class="wod-card wod-empty">
            <p>No WoD sheets are loaded. Add JSON files under the <code>sheets/</code> directory or import a sheet via SillyTavern, then refresh.</p>
        </section>
    `;
}

function renderTextInput(label, path, value, compact = false) {
    return `
        <label class="wod-field">
            <span class="wod-field-label">${label}</span>
            <input class="wod-field-input" type="text" value="${escapeHtml(value ?? '')}" data-path="${path}" ${compact ? 'data-compact="true"' : ''}/>
        </label>
    `;
}

function renderNumberInput(label, path, value, min = 0, max = 10, compact = false) {
    const safe = Number.isFinite(Number(value)) ? Number(value) : '';
    return `
        <label class="wod-field">
            <span class="wod-field-label">${label}</span>
            <input class="wod-field-input" type="number" data-input-type="number" data-min="${min}" data-max="${max}" value="${safe}" data-path="${path}" ${compact ? 'data-compact="true"' : ''}/>
        </label>
    `;
}

function renderDotTrack(path, value = 0, max = ATTRIBUTE_MAX, options = {}) {
    const safeValue = Number(value) || 0;
    const dots = [];
    for (let i = 1; i <= max; i++) {
        const active = i <= safeValue ? 'is-active' : '';
        dots.push(`<button type="button" class="wod-dot ${active}" data-value="${i}" aria-label="${i} dots"></button>`);
    }
    const attrs = [
        `data-path="${path}"`,
        `data-max="${max}"`,
        `data-current="${safeValue}"`,
        `data-resettable="${options.resettable === false ? 'false' : 'true'}"`
    ];
    if (options.enforce) {
        attrs.push(`data-enforce="${options.enforce}"`);
    }
    return `<div class="wod-dot-track" ${attrs.join(' ')}>${dots.join('')}</div>`;
}

function ensureSheetEvents() {
    if (!$userStatsContainer || $userStatsContainer.data('wod-sheet-bound')) {
        return;
    }
    $userStatsContainer
        .on('change', '.wod-character-select', handleCharacterSelect)
        .on('click', '.wod-dot-track button', handleDotTrackClick)
        .on('change', '.wod-field-input', handleFieldInputChange)
        .on('blur', '.wod-field-input', handleFieldInputChange)
        .on('click', '.wod-mini-btn[data-action="add-row"]', handleAddRow)
        .on('click', '.wod-mini-btn[data-action="remove-row"]', handleRemoveRow)
        .on('click', '.wod-health-box', handleHealthClick)
        .on('click', '.wod-collapse-toggle', handleSectionToggle)
        .on('click', '[data-action="open-sync"]', handleOpenSync)
        .on('click', '[data-action="close-sync"]', handleCloseSync)
        .on('click', '[data-action="copy-sync"]', handleCopySync)
        .on('click', '[data-action="revert-sheet"]', handleRevertSheet)
        .on('change', '.wod-log-filter', handleLogFilterChange);
    $userStatsContainer.data('wod-sheet-bound', true);
}

function handleCharacterSelect(event) {
    const sheetId = $(event.currentTarget).val();
    if (!sheetId) {
        return;
    }
    setActiveWodSheetId(sheetId);
    uiState.syncPanelSheet = null;
    saveSettings();
    renderWodSheet();
}

function handleDotTrackClick(event) {
    event.preventDefault();
    const $button = $(event.currentTarget);
    const $track = $button.closest('.wod-dot-track');
    const sheetId = $button.closest('.wod-sheet-root').data('sheetId');
    if (!sheetId || !$track.length) {
        return;
    }
    const rawValue = Number($button.data('value')) || 0;
    const current = Number($track.data('current')) || 0;
    const max = Number($track.data('max')) || ATTRIBUTE_MAX;
    const resettable = $track.data('resettable') !== 'false';
    let nextValue = rawValue;
    if (resettable && rawValue === current) {
        nextValue = 0;
    }
    nextValue = Math.max(0, Math.min(max, nextValue));
    const path = $track.data('path');
    const enforce = $track.data('enforce');
    applySheetUpdate(sheetId, draft => {
        if (enforce === 'willpower-current') {
            const perm = Number(draft?.advantages?.willpower?.permanent) || 0;
            nextValue = Math.min(nextValue, perm);
        }
        setValueByPath(draft, path, nextValue);
    });
}

function handleFieldInputChange(event) {
    const target = event.currentTarget;
    if (!target.dataset.path) {
        return;
    }
    const sheetId = $(target).closest('.wod-sheet-root').data('sheetId');
    if (!sheetId) {
        return;
    }
    const type = target.dataset.inputType || target.getAttribute('type') || 'text';
    applySheetUpdate(sheetId, draft => {
        let value = target.value;
        if (type === 'number') {
            value = clampNumber(value, target.dataset.min, target.dataset.max);
        } else if (type === 'string-array') {
            value = value.split('\n').map(line => line.trim()).filter(Boolean);
        } else if (target.dataset.path.endsWith('.tags')) {
            value = value.split(',').map(token => token.trim()).filter(Boolean);
        }
        setValueByPath(draft, target.dataset.path, value);
    });
}

function handleAddRow(event) {
    event.preventDefault();
    const $button = $(event.currentTarget);
    const template = $button.data('template');
    const path = $button.data('path');
    const sheetId = $button.closest('.wod-sheet-root').data('sheetId');
    if (!sheetId || !template || !path) {
        return;
    }
    applySheetUpdate(sheetId, draft => {
        const socket = getOrCreatePath(draft, path, true);
        if (!Array.isArray(socket.container[socket.key])) {
            socket.container[socket.key] = [];
        }
        socket.container[socket.key].push(buildTemplate(template));
    });
}

function handleRemoveRow(event) {
    event.preventDefault();
    const path = $(event.currentTarget).data('path');
    const sheetId = $(event.currentTarget).closest('.wod-sheet-root').data('sheetId');
    if (!sheetId || !path) {
        return;
    }
    applySheetUpdate(sheetId, draft => {
        removeAtPath(draft, path);
    });
}

function handleHealthClick(event) {
    event.preventDefault();
    const $button = $(event.currentTarget);
    const index = Number($button.data('index'));
    const sheetId = $button.closest('.wod-sheet-root').data('sheetId');
    if (!sheetId || Number.isNaN(index)) {
        return;
    }
    applySheetUpdate(sheetId, draft => {
        const track = draft?.advantages?.health;
        if (!Array.isArray(track) || !track[index]) {
            return;
        }
        const current = track[index].state || 'ok';
        const nextIndex = (HEALTH_STATES.indexOf(current) + 1) % HEALTH_STATES.length;
        track[index].state = HEALTH_STATES[nextIndex];
    });
}

function handleSectionToggle(event) {
    event.preventDefault();
    const sectionId = $(event.currentTarget).data('sectionToggle');
    toggleSectionCollapsed(sectionId);
    renderWodSheet();
}

function handleOpenSync(event) {
    event.preventDefault();
    uiState.syncPanelSheet = $(event.currentTarget).closest('.wod-sheet-root').data('sheetId') || null;
    renderWodSheet();
}

function handleCloseSync(event) {
    event.preventDefault();
    uiState.syncPanelSheet = null;
    renderWodSheet();
}

function handleCopySync(event) {
    event.preventDefault();
    const textarea = $(event.currentTarget).closest('.wod-sync-panel').find('.wod-sync-output').get(0);
    if (!textarea) {
        return;
    }
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    try {
        document.execCommand('copy');
        toastr.success('Sheet JSON copied to clipboard.');
    } catch (error) {
        console.warn('[RPG Companion] Clipboard copy failed', error);
    }
    textarea.blur();
}

function handleRevertSheet(event) {
    event.preventDefault();
    const sheetId = $(event.currentTarget).closest('.wod-sheet-root').data('sheetId');
    if (!sheetId) {
        return;
    }
    removeWodChatOverride(sheetId);
    uiState.syncPanelSheet = null;
    saveChatData();
    renderWodSheet();
}

function handleLogFilterChange(event) {
    uiState.logFilter = event.currentTarget.value || 'active';
    renderWodSheet();
}

function applySheetUpdate(sheetId, mutator) {
    if (!sheetId || typeof mutator !== 'function') {
        return;
    }
    const current = getWodSheet(sheetId);
    if (!current) {
        return;
    }
    const draft = cloneSheet(current);
    mutator(draft);
    recordWodChatOverride(draft, Date.now());
    saveChatData();
    renderWodSheet();
}

function setValueByPath(target, path, value) {
    const { container, key } = getOrCreatePath(target, path);
    container[key] = value;
}

function removeAtPath(target, path) {
    const segments = parsePath(path);
    if (segments.length === 0) {
        return;
    }
    const last = segments.pop();
    let current = target;
    for (const segment of segments) {
        const resolved = resolveSegment(segment);
        if (current[resolved] === undefined) {
            return;
        }
        current = current[resolved];
    }
    const finalKey = resolveSegment(last);
    if (Array.isArray(current) && typeof finalKey === 'number') {
        current.splice(finalKey, 1);
    } else {
        delete current[finalKey];
    }
}

function getOrCreatePath(target, path, forceArray = false) {
    const segments = parsePath(path);
    const key = segments.pop();
    let current = target;
    segments.forEach((segment, index) => {
        const resolved = resolveSegment(segment);
        if (current[resolved] === undefined || current[resolved] === null) {
            const nextSegment = segments[index + 1];
            const nextIsIndex = typeof resolveSegment(nextSegment) === 'number';
            current[resolved] = nextIsIndex ? [] : {};
        }
        current = current[resolved];
    });
    const finalKey = resolveSegment(key);
    if (forceArray && current[finalKey] === undefined) {
        current[finalKey] = [];
    }
    return { container: current, key: finalKey };
}

function parsePath(path = '') {
    return path.match(/[^.[\]]+/g) || [];
}

function resolveSegment(segment) {
    if (segment === undefined) {
        return undefined;
    }
    const numeric = Number(segment);
    return Number.isNaN(numeric) ? segment : numeric;
}

function cloneSheet(sheet) {
    return JSON.parse(JSON.stringify(sheet));
}

function buildTemplate(template) {
    switch (template) {
        case 'background':
            return { name: 'New Background', rating: 1, description: '' };
        case 'resource':
            return { name: 'Blood', type: 'pool', capacity: 10, current: 10, notes: '' };
        case 'powerSet':
            return { name: 'New Discipline', category: 'discipline', rating: 1, powers: [] };
        case 'power':
            return { name: 'New Power', rating: 1, description: '' };
        case 'merit':
            return { name: 'Merit', rating: 1, description: '' };
        case 'flaw':
            return { name: 'Flaw', rating: -1, description: '' };
        case 'equipment':
            return { name: 'Item', type: 'gear', location: '', description: '' };
        default:
            return {};
    }
}

function clampNumber(value, min, max) {
    let numeric = Number(value);
    if (Number.isNaN(numeric)) {
        numeric = 0;
    }
    if (min !== undefined) {
        numeric = Math.max(Number(min), numeric);
    }
    if (max !== undefined && max !== '') {
        numeric = Math.min(Number(max), numeric);
    }
    return numeric;
}

function escapeHtml(value) {
    if (value === null || value === undefined) {
        return '';
    }
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function toTitleCase(value) {
    return String(value || '')
        .replace(/([A-Z])/g, ' $1')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, ch => ch.toUpperCase())
        .trim();
}
