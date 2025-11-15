/**
 * Legacy bridge module.
 * The original userStats renderer has been replaced by the WoD sheet UI,
 * but other systems still import these helpers. This file simply proxies
 * to the new renderer in wodSheet.js so existing imports stay intact.
 */

import { renderWodSheet, buildWodSheetSummary } from './wodSheet.js';

export function buildUserStatsText() {
    return buildWodSheetSummary();
}

export function renderUserStats() {
    renderWodSheet();
}
