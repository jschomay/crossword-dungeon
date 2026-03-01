export const TREASURE_ITEMS = [
  { name: 'Sword', description: 'A balanced blade for combat', slot: 'weapon' as const, base_damage_bonus: 3, damage_bonus_growth: 2 },
  { name: 'Axe', description: 'A heavy weapon for crushing blows', slot: 'weapon' as const, base_damage_bonus: 4, damage_bonus_growth: 2 },
  { name: 'Dagger', description: 'A quick, precise blade', slot: 'weapon' as const, base_damage_bonus: 2, damage_bonus_growth: 1 },
  { name: 'Shield', description: 'Protective barrier against attacks', slot: 'armor' as const, base_defense_bonus: 2, defense_bonus_growth: 1 },
  { name: 'Chainmail', description: 'Interlocking metal rings', slot: 'armor' as const, base_defense_bonus: 3, defense_bonus_growth: 2 },
  { name: 'Plate Armor', description: 'Heavy protective plating', slot: 'armor' as const, base_defense_bonus: 4, defense_bonus_growth: 2 },
  { name: 'Amulet of Power', description: 'Mystical charm enhancing strength', slot: 'amulet' as const, base_damage_bonus: 2, damage_bonus_growth: 1 },
  { name: 'Amulet of Protection', description: 'Mystical charm warding harm', slot: 'amulet' as const, base_defense_bonus: 2, defense_bonus_growth: 1 },
  { name: 'Amulet of Vitality', description: 'Mystical charm bolstering health', slot: 'amulet' as const, base_hp_bonus: 5, hp_bonus_growth: 2 },
] as const;

export const TREASURE_CONSUMABLES = [
  { name: 'Health Potion', description: 'Restores hit points', effect: 'restore_hp' as const, base_amount: 3, amount_growth: 2 },
  { name: 'Mana Potion', description: 'Restores mana', effect: 'restore_mana' as const, base_amount: 3, amount_growth: 1 },
  { name: 'Letter Reveal Scroll', description: 'Magically reveals a letter in the puzzle', effect: 'reveal_letter' as const, base_amount: 1, amount_growth: 0 },
] as const;

export const TREASURE_IMMEDIATE = [
  { name: 'Healing Shrine', description: 'Ancient altar radiating warmth', effect: 'restore_hp' as const, base_amount: 10, amount_growth: 5 },
  { name: 'Mana Well', description: 'Pool of glowing arcane energy', effect: 'restore_mana' as const, base_amount: 5, amount_growth: 2 },
  { name: 'Blessed Fountain', description: 'Sacred waters of renewal', effect: 'increase_max_hp' as const, base_amount: 2, amount_growth: 2 },
  { name: 'Arcane Nexus', description: 'Swirling vortex of pure magic', effect: 'increase_max_mana' as const, base_amount: 2, amount_growth: 2 },
  { name: 'Experience Tome', description: 'Ancient book of wisdom', effect: 'grant_xp' as const, base_amount: 10, amount_growth: 10 },
] as const;

export const TREASURE_MODIFIERS = [
  { name: 'Fine', description: 'Well-crafted and balanced', stat_multiplier: 1.2 },
  { name: 'Masterwork', description: 'Created by a skilled artisan', stat_multiplier: 1.4 },
  { name: 'Regenerating', description: 'Slowly mends wounds', passive_effect: 'hp_per_combat_round' as const, passive_amount: 3 },
  { name: 'Arcane', description: 'Infused with magical energy', passive_effect: 'mana_per_combat_round' as const, passive_amount: 2 },
] as const;
