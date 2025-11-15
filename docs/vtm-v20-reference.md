# Vampire: the Masquerade v20 Reference Notes

These notes capture quick mechanical reminders gathered from commonly cited rules summaries online. They avoid verbatim copy but keep enough structure to inform JSON sheets and UI behavior.

## Sources Consulted
- White Wolf Wiki entries on [Backgrounds](https://whitewolf.fandom.com/wiki/Backgrounds_(VTM)), [Merits](https://whitewolf.fandom.com/wiki/Merit_(VTM)), [Disciplines](https://whitewolf.fandom.com/wiki/Discipline), [Bloodlines](https://whitewolf.fandom.com/wiki/Bloodline_(VTM)), [Banes](https://whitewolf.fandom.com/wiki/Bane_(VTM)), and [Ghouls](https://whitewolf.fandom.com/wiki/Ghoul_(VTM)).
- Clan write-ups and quick reference discussions compiled across Storyteller forums (e.g., Onyx Path community threads, 2023-2024).

## Background Hooks
- **Allies/Contacts** - Dots measure reach and reliability. 1 dot is a single helper or informant, 5 dots means a network with influence equal to a city department head. Allies offer favors; Contacts primarily provide intel.
- **Resources** - Liquid wealth; dots roughly double monthly disposable income (1 = four-figure salary, 3 = wealthy professional, 5 = corporate mogul). Used to justify equipment purchases without extra rolls.
- **Herd** - Counts the number of reliable vessels (roughly three mortals per dot). Each dot can refresh one blood point per night safely.
- **Retainers** - Bodyguards or assistants; 1 dot is a single competent helper, 5 dots is a trained coterie. Each retainer is built with simplified mortal/ghoul stats.
- **Influence/Fame/Status** - Represent social leverage; each dot reduces difficulties or enables automatic successes in matching spheres (media, church, criminal, etc.).

## Advantages & Virtues
- **Virtues** - Conscience/Conviction sets moral restraint, Self-Control/Instinct resists frenzy or temptation, Courage resists fear and Rotschreck. Ratings 0-5, average 2.
- **Morality/Paths** - Humanity 7 is typical. Dropping below 7 imposes Predator's Taint penalties with mortals; at 0 the vampire falls to Wassail. Alternate paths (e.g., Path of Night) swap Virtue pairings but stay 0-10.
- **Willpower** - Permanent equals Courage + highest Virtue (Humanity) caps, current can never exceed permanent. Spending grants one automatic success or cancels frenzy per core book.
- **Health track** - Bruised through Incapacitated, each step imposes -1 cumulative dice penalties starting at Injured.

## Merits & Flaws
- **Merits** typically cost 1-5 points; each gives precise dice bonuses (e.g., Danger Sense reduces ambush difficulties, Enchanting Voice gives -2 diff on spoken social rolls). Storytellers often cap total Merit value to 7.
- **Flaws** refund freebie points but hand the ST complications. Addiction or Nightmares enforce extra rolls; Short Fuse adds +2 difficulty to frenzy checks. Keep the description short and actionable so the parser can reason about it.

## Disciplines & Rituals
- **Physical (Celerity, Potence, Fortitude)** - Grant extra dice, automatic successes, or soak dice. Celerity costs 1 Vitae per additional action in v20; Potence level provides automatic success plus spendable dice.
- **Social/Mental (Presence, Dominate, Auspex)** - Work via Attribute + Ability pools contested by Willpower; mind-affecting powers need eye contact or voice.
- **Clan exclusives** (Obtenebration, Melpominee, etc.) bring unique mechanics but still share a clear pool and effect summary. Record target pools, costs, and duration per entry.
- **Rituals** (Thaumaturgy/Necromancy) include level, roll, cost, and casting time; best tracked as nested entries under their parent path.

## Bloodlines & Banes
- **Bloodlines** - Branch clans with altered Disciplines or weaknesses. Example: Daughters of Cacophony keep Presence but trade for Melpominee; Blood Brothers share a hive-mind and take extra damage from fire.
- **Clan Banes** - Always-on drawbacks (Brujah frenzy easier, Ventrue restricted feeding, Nosferatu cursed appearance). Store them in sheet notes or as zero-die traits so prompts remind the LLM.
- **Generation caps** - Blood pool maximum = 10 + (13 - generation). Lower generations spend more blood per turn but have higher attribute caps.

## Mortals & Ghouls
- **Mortals** - Attributes average 2, Abilities 1-2. They lack Disciplines and can only spend Willpower for successes. Health track identical to vampires but lethal damage is deadly.
- **Ghouls** - Gain +1 to Physical Attributes while vitae infused (cap 6), may hold up to 10 Vitae, and learn the first dot of any Discipline their regnant knows. They must drink weekly or lose bonuses.
- **Banes on ghouls** - They share their domitor's sunlight allergy only if overfed; otherwise sunlight sickens but does not ash them. Still, Bond-related compulsions should be noted for prompt clarity.

## Usage Notes
- Keep every mechanical note to a sentence so the prompt builder can echo it safely.
- Cite Vitae costs, action types (reflexive/simple), and resisted pools for powers wherever possible.
- When exporting sheets, include source reference (book + page) in the `notes` array instead of storing copyrighted prose.
