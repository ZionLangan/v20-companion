/**
 * Dice System Module
 * Handles WoD dice rolling logic, display updates, and LLM-friendly logging
 */

import {
    extensionSettings,
    wodRuntimeState,
    getActiveWodSheet,
    getWodSheet,
    setActiveWodSheetId,
    clearWodDiceLog
} from '../../core/state.js';
import { saveChatData, saveSettings } from '../../core/persistence.js';
import {
    resolveDicePool,
    buildPoolParts,
    getAttributeOptionsForSheet,
    getAbilityOptionsForSheet,
    logDiceResult,
    formatDiceSummary
} from './wodDice.js';

function wait(delay = 400) {
    return new Promise(resolve => setTimeout(resolve, delay));
}

function getSelectedSheetId() {
    const sheetId = String($('#wod-dice-sheet').val() || '');
    return sheetId || wodRuntimeState.activeSheetId || null;
}

function getSheetOptions() {
    const options = [];
    wodRuntimeState.sheetOrder.forEach(sheetId => {
        const sheet = getWodSheet(sheetId);
        if (!sheet) return;
        options.push({
            id: sheet.id,
            label: sheet.meta?.name || sheet.id
        });
    });
    return options;
}

function populateSelectOptions($select, options, placeholder) {
    $select.empty();
    if (placeholder) {
        $select.append(`<option value="">${placeholder}</option>`);
    }
    options.forEach(option => {
        $select.append(`<option value="${option.id}">${option.label}</option>`);
    });
}

export function refreshDiceFormOptions() {
    const $sheetSelect = $('#wod-dice-sheet');
    if ($sheetSelect.length === 0) {
        return;
    }

    const sheetId = getSelectedSheetId();
    const sheetOptions = getSheetOptions();
    populateSelectOptions($sheetSelect, sheetOptions, 'Select character');
    if (sheetId) {
        $sheetSelect.val(sheetId);
    }

    const sheet = getWodSheet(sheetId) || getActiveWodSheet();
    if (!sheet) {
        $('#wod-dice-attribute').empty();
        $('#wod-dice-ability').empty();
        return;
    }

    const attributeOptions = getAttributeOptionsForSheet(sheet);
    const abilityOptions = getAbilityOptionsForSheet(sheet);
    populateSelectOptions($('#wod-dice-attribute'), attributeOptions, 'Choose Attribute');
    populateSelectOptions($('#wod-dice-ability'), abilityOptions, 'Choose Ability');
}

export async function rollDice(diceModal) {
    if (!diceModal) return;

    const sheetId = getSelectedSheetId();
    const sheet = getWodSheet(sheetId) || getActiveWodSheet();
    if (!sheet) {
        toastr.error('No WoD character sheet loaded. Import or select one before rolling.');
        return;
    }

    if (sheetId && sheetId !== wodRuntimeState.activeSheetId) {
        setActiveWodSheetId(sheetId);
    }

    const attributeKey = String($('#wod-dice-attribute').val() || '');
    const abilityKey = String($('#wod-dice-ability').val() || '');
    const extraDice = Number($('#wod-dice-extra').val() || 0);
    const modifier = Number($('#wod-dice-modifier').val() || 0);
    const difficulty = parseInt(String($('#wod-dice-difficulty').val()), 10) || wodRuntimeState.diceDefaults.difficulty || 6;
    const explode = String($('#wod-dice-explode').val() || wodRuntimeState.diceDefaults.explode || '10-again');
    const specialty = $('#wod-dice-specialty').prop('checked');
    const willpower = $('#wod-dice-willpower').prop('checked');
    const rerollsCount = parseInt(String($('#wod-dice-rerolls').val()), 10) || 0;
    const rerollStages = rerollsCount > 0 ? [{ count: rerollsCount, label: 'Reroll' }] : [];
    const notes = String($('#wod-dice-notes').val() || '').trim() || null;
    const labelInput = String($('#wod-dice-label').val() || '').trim();

    const parts = buildPoolParts(sheet, attributeKey, abilityKey, extraDice, modifier);
    if (parts.length === 0) {
        toastr.warning('Select at least one trait or enter extra dice to form a pool.');
        return;
    }

    const poolLabel = labelInput || parts.map(part => `${part.label} (${part.value})`).join(' + ');

    diceModal.startRolling();
    await wait(850);

    const result = resolveDicePool({
        sheetId: sheet.id,
        sheetName: sheet.meta?.name,
        parts,
        difficulty,
        explode,
        specialtyApplies: specialty,
        spendWillpower: willpower,
        rerollStages,
        poolLabel,
        notes,
        requestedBy: 'user'
    });

    logDiceResult(result);
    diceModal.showResult(result);
    updateDiceDisplay();
}

export function updateDiceDisplay() {
    const lastEntry = wodRuntimeState.diceLog[wodRuntimeState.diceLog.length - 1];
    if (lastEntry) {
        $('#rpg-last-roll-text').text(formatDiceSummary(lastEntry));
    } else {
        $('#rpg-last-roll-text').text('No Vampire: the Masquerade rolls logged yet.');
    }
}

export function clearDiceRoll() {
    clearWodDiceLog();
    extensionSettings.lastDiceRoll = null;
    saveSettings();
    saveChatData();
    updateDiceDisplay();
}

export function addDiceQuickReply() {
    if (window.quickReplyApi && typeof window.quickReplyApi.registerButton === 'function') {
        window.quickReplyApi.registerButton({
            id: 'wod-dice',
            label: 'Roll WoD Dice',
            icon: 'fa-dice-d20',
            onClick: () => $('#rpg-dice-display').trigger('click')
        });
    }
}
