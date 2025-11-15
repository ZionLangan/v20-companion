/**
 * WoD Typedefs
 * Shared schema definitions for Storyteller character sheets and dice pools.
 */

/**
 * Dot-based trait value (0-5 by default, but may exceed for elders/epics)
 * @typedef {number} WodDotValue
 */

/**
 * Standard attribute grouping (Physical/Social/Mental)
 * @typedef {Object} WodAttributeSet
 * @property {WodDotValue} strength
 * @property {WodDotValue} dexterity
 * @property {WodDotValue} stamina
 * @property {WodDotValue} charisma
 * @property {WodDotValue} manipulation
 * @property {WodDotValue} appearance
 * @property {WodDotValue} perception
 * @property {WodDotValue} intelligence
 * @property {WodDotValue} wits
 */

/**
 * Ability grouping buckets
 * @typedef {Object} WodAbilityGroup
 * @property {Record<string, WodDotValue>} talents
 * @property {Record<string, WodDotValue>} skills
 * @property {Record<string, WodDotValue>} knowledges
 */

/**
 * Background entry (Allies, Contacts, etc.)
 * @typedef {Object} WodBackground
 * @property {string} name
 * @property {WodDotValue} rating
 * @property {string} [description]
 */

/**
 * Virtues (Conscience/Self-Control/Courage etc.)
 * @typedef {Object} WodVirtues
 * @property {WodDotValue} conscience
 * @property {WodDotValue} selfControl
 * @property {WodDotValue} courage
 */

/**
 * Morality or Path track
 * @typedef {Object} WodMorality
 * @property {string} type
 * @property {number} rating
 * @property {string} [notes]
 */

/**
 * Willpower track
 * @typedef {Object} WodWillpower
 * @property {number} permanent
 * @property {number} current
 */

/**
 * Individual health level state
 * @typedef {Object} WodHealthLevel
 * @property {string} level // e.g., "Bruised", "Hurt"
 * @property {"ok"|"bashing"|"lethal"|"aggravated"} state
 */

/**
 * Ordered health track for a sheet
 * @typedef {WodHealthLevel[]} WodHealthTrack
 */

/**
 * Resource pool (Blood, Rage, Quintessence, Faith, etc.)
 * @typedef {Object} WodResourcePool
 * @property {string} name
 * @property {string} type
 * @property {number} capacity
 * @property {number} current
 * @property {string} [notes]
 */

/**
 * Sub-power entry for a given power set (e.g., Dot 2 Discipline Power)
 * @typedef {Object} WodPower
 * @property {string} name
 * @property {number} rating
 * @property {string} description
 * @property {string[]} [tags]
 * @property {string} [cost]
 */

/**
 * Parent power group (Discipline, Sorcery path, Gift list, etc.)
 * @typedef {Object} WodPowerSet
 * @property {string} name
 * @property {string} category
 * @property {WodDotValue|number} rating
 * @property {WodPower[]} powers
 * @property {string[]} [tags]
 * @property {string} [notes]
 */

/**
 * Item entry for equipment/inventory/asset tracking
 * @typedef {Object} WodEquipmentItem
 * @property {string} name
 * @property {string} type
 * @property {string} [location]
 * @property {string} [description]
 * @property {string[]} [tags]
 */

/**
 * Structured equipment categories
 * @typedef {Object} WodEquipment
 * @property {WodEquipmentItem[]} inventory
 * @property {WodEquipmentItem[]} stored
 * @property {WodEquipmentItem[]} assets
 */

/**
 * Identity metadata fields
 * @typedef {Object} WodMeta
 * @property {string} name
 * @property {string} [player]
 * @property {string} [chronicle]
 * @property {string} [concept]
 * @property {{type: string, value: string}} [faction]
 * @property {string} [nature]
 * @property {string} [demeanor]
 * @property {number} [age]
 * @property {number} [apparentAge]
 * @property {string} [pronouns]
 * @property {string[]} [notes]
 */

/**
 * Canonical WoD character sheet object
 * @typedef {Object} WodCharacterSheet
 * @property {string} id
 * @property {number} version
 * @property {WodMeta} meta
 * @property {{
 *   attributes: {
 *     physical: { strength: WodDotValue, dexterity: WodDotValue, stamina: WodDotValue },
 *     social: { charisma: WodDotValue, manipulation: WodDotValue, appearance: WodDotValue },
 *     mental: { perception: WodDotValue, intelligence: WodDotValue, wits: WodDotValue }
 *   };
 *   abilities: WodAbilityGroup;
 * }} traits
 * @property {{
 *   backgrounds: WodBackground[],
 *   virtues: WodVirtues,
 *   morality: WodMorality,
 *   willpower: WodWillpower,
 *   health: WodHealthLevel[],
 *   resourcePools: WodResourcePool[]
 * }} advantages
 * @property {WodPowerSet[]} powerSets
 * @property {{ name: string, rating: number, description?: string }[]} [merits]
 * @property {{ name: string, rating: number, description?: string }[]} [flaws]
 * @property {WodEquipment} equipment
 * @property {string[]} [notes]
 */

/**
 * Dice pool configuration used by the WoD dice engine
 * @typedef {Object} DicePoolConfig
 * @property {string} sheetId
 * @property {string} poolLabel
 * @property {number} basePool
 * @property {number} modifier
 * @property {number} difficulty
 * @property {"10-again"|"9-again"|"8-again"|"no-again"} explode
 * @property {boolean} specialtyApplies
 * @property {boolean} spendWillpower
 * @property {number} maxRerolls
 * @property {(sides: number) => number} rng
 */

/**
 * Dice log entry persisted alongside chat metadata
 * @typedef {Object} DiceLogEntry
 * @property {string} id
 * @property {string} sheetId
 * @property {string} poolLabel
 * @property {number} diceRolled
 * @property {number[]} rolls
 * @property {number} successes
 * @property {boolean} botch
 * @property {number} difficulty
 * @property {"10-again"|"9-again"|"8-again"|"no-again"} explode
 * @property {boolean} specialtyApplies
 * @property {boolean} spendWillpower
 * @property {number} rerollsUsed
 * @property {string} outcome
 * @property {number} timestamp
 * @property {string} [notes]
 */

/**
 * Registry of loaded sheets
 * @typedef {Map<string, WodCharacterSheet>} WodSheetMap
 */

/**
 * Top-level WoD runtime state
 * @typedef {Object} WodRuntimeState
 * @property {WodSheetMap} sheets
 * @property {string[]} sheetOrder
 * @property {string|null} activeSheetId
 * @property {DiceLogEntry[]} diceLog
 * @property {{ difficulty: number, explode: "10-again"|"9-again"|"8-again"|"no-again" }} diceDefaults
 */

export {};
