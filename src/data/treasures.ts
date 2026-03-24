export const TREASURE_ITEMS = [
  { name: 'Sword', description: 'A balanced blade for combat', slot: 'weapon' as const, base_damage_bonus: 3, damage_bonus_growth: 2 },
  { name: 'Axe', description: 'A heavy weapon for crushing blows', slot: 'weapon' as const, base_damage_bonus: 4, damage_bonus_growth: 2 },
  { name: 'Dagger', description: 'A quick, precise blade', slot: 'weapon' as const, base_damage_bonus: 2, damage_bonus_growth: 1 },
  { name: 'Shield', description: 'Protective barrier against attacks', slot: 'armor' as const, base_defense_bonus: 2, defense_bonus_growth: 1 },
  { name: 'Chainmail', description: 'Interlocking metal rings', slot: 'armor' as const, base_defense_bonus: 3, defense_bonus_growth: 2 },
  { name: 'Plate Armor', description: 'Heavy protective plating', slot: 'armor' as const, base_defense_bonus: 4, defense_bonus_growth: 2 },
  { name: 'Amulet of Power', description: 'Mystical charm enhancing strength', slot: 'amulet' as const, base_damage_bonus: 2, damage_bonus_growth: 1 },
  { name: 'Amulet of Protection', description: 'Mystical charm warding harm', slot: 'amulet' as const, base_defense_bonus: 2, defense_bonus_growth: 1 },
  { name: 'Amulet of Vitality', description: 'Mystical charm bolstering health capacity', slot: 'amulet' as const, base_max_hp_bonus: 5, max_hp_bonus_growth: 2 },
  { name: 'Amulet of Sorcery', description: 'Mystical charm bolstering mana capacity', slot: 'amulet' as const, base_max_mana_bonus: 5, max_mana_bonus_growth: 2 },
] as const;

export const TREASURE_CONSUMABLES = [
  { name: 'Health Potion', description: 'Restores hit points', effect: 'restore_hp' as const, restore_amount: 20, base_quantity: 1, quantity_growth: 0.5 },
  { name: 'Mana Potion', description: 'Restores mana', effect: 'restore_mana' as const, restore_amount: 10, base_quantity: 1, quantity_growth: 0.5 },
  { name: 'Letter Reveal Scroll', description: 'Magically reveals a letter in the puzzle', effect: 'reveal_letter' as const, restore_amount: 1, base_quantity: 1, quantity_growth: 0.5 },
] as const;

export const TREASURE_IMMEDIATE = [
  { name: 'Healing Shrine', description: 'Ancient altar radiating warmth', effect: 'restore_hp' as const, base_amount: 10, amount_growth: 5 },
  { name: 'Mana Well', description: 'Pool of glowing arcane energy', effect: 'restore_mana' as const, base_amount: 5, amount_growth: 2 },
  { name: 'Experience Tome', description: 'Ancient book of wisdom', effect: 'grant_xp' as const, base_amount: 10, amount_growth: 10 },
  { name: 'Gold Chest', description: 'A chest brimming with coins', effect: 'grant_gold' as const, base_amount: 20, amount_growth: 11 },
] as const;

export const TREASURE_MODIFIERS = [
  { name: 'Fine',         description: 'Well-crafted and balanced',          stat_multiplier: 1.5 },
  { name: 'Regenerating', description: 'Slowly mends wounds',                passive_effect: 'hp_per_combat_round' as const,   passive_amount: 1 },
  { name: 'Arcane',       description: 'Infused with magical energy',        passive_effect: 'mana_per_combat_round' as const,  passive_amount: 2 },
  { name: 'Fortifying',   description: 'Strengthens the body while worn',    bonus_effect: 'max_hp' as const,   bonus_amount: 5 },
  { name: 'Imbued',       description: 'Suffused with greater magical capacity', bonus_effect: 'max_mana' as const, bonus_amount: 4 },
] as const;
