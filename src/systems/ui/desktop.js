/**
 * Desktop UI Module
 * Handles desktop-specific UI functionality: tab navigation
 */

/**
 * Sets up desktop tab navigation for organizing content.
 * Only runs on desktop viewports (>1000px).
 * Creates desktop panes for Status (active sheet), Characters, and Quests.
 */
export function setupDesktopTabs() {
    const isDesktop = window.innerWidth > 1000;
    if (!isDesktop) return;

    // Check if tabs already exist
    if ($('.rpg-tabs-nav').length > 0) return;

    const $contentBox = $('.rpg-content-box');

    // Get existing sections
    const $userStats = $('#rpg-user-stats');
    const $characters = $('#rpg-characters');
    const $quests = $('#rpg-quests');

    // If no sections exist, nothing to organize
    if ($userStats.length === 0 && $characters.length === 0 && $quests.length === 0) {
        return;
    }

    // Create tab navigation
    const $tabNav = $(`
        <div class="rpg-tabs-nav">
            <button class="rpg-tab-btn active" data-tab="status">
                <i class="fa-solid fa-chart-simple"></i>
                <span>Status</span>
            </button>
            <button class="rpg-tab-btn" data-tab="characters">
                <i class="fa-solid fa-users"></i>
                <span>Characters</span>
            </button>
            <button class="rpg-tab-btn" data-tab="quests">
                <i class="fa-solid fa-scroll"></i>
                <span>Quests</span>
            </button>
        </div>
    `);

    // Create tab content containers
    const $statusTab = $('<div class="rpg-tab-content active" data-tab-content="status"></div>');
    const $charactersTab = $('<div class="rpg-tab-content" data-tab-content="characters"></div>');
    const $questsTab = $('<div class="rpg-tab-content" data-tab-content="quests"></div>');

    // Move sections into their respective tabs (detach to preserve event handlers)
    if ($userStats.length > 0) {
        $statusTab.append($userStats.detach());
        $userStats.show();
    }
    if ($quests.length > 0) {
        $questsTab.append($quests.detach());
        $quests.show();
    }
    if ($characters.length > 0) {
        $charactersTab.append($characters.detach());
        $characters.show();
    }

    // Hide dividers on desktop tabs (tabs separate content naturally)
    $('.rpg-divider').hide();

    // Build desktop tab structure
    const $tabsContainer = $('<div class="rpg-tabs-container"></div>');
    $tabsContainer.append($tabNav);
    $tabsContainer.append($statusTab);
    $tabsContainer.append($charactersTab);
    $tabsContainer.append($questsTab);

    // Replace content box with tabs container
    $contentBox.html('').append($tabsContainer);

    // Handle tab switching
    $tabNav.find('.rpg-tab-btn').on('click', function() {
        const tabName = $(this).data('tab');

        // Update active tab button
        $tabNav.find('.rpg-tab-btn').removeClass('active');
        $(this).addClass('active');

        // Update active tab content
        $('.rpg-tab-content').removeClass('active');
        $(`.rpg-tab-content[data-tab-content="${tabName}"]`).addClass('active');
    });

    console.log('[RPG Desktop] Desktop tabs initialized');
}

/**
 * Removes desktop tab navigation and restores original layout.
 * Used when transitioning from desktop to mobile.
 */
export function removeDesktopTabs() {
    // Get sections from tabs before removing
    const $userStats = $('#rpg-user-stats').detach();
    const $characters = $('#rpg-characters').detach();
    const $quests = $('#rpg-quests').detach();

    // Remove tabs container
    $('.rpg-tabs-container').remove();

    // Restore original sections to content box in correct order
    const $contentBox = $('.rpg-content-box');

    $contentBox.append($userStats);
    $contentBox.append($characters);
    $contentBox.append($quests);

    // Show sections and dividers
    $userStats.show();
    $characters.show();
    $quests.show();

    console.log('[RPG Desktop] Desktop tabs removed');
}
