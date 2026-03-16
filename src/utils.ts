export function hpBar(current: number, max: number, width: number = 10): string {
  const filled = Math.round((current / max) * width);
  const empty = width - filled;
  return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty));
}

export const C_HP   = '#ff6666';
export const C_MANA = '#44bbcc';
export const C_DMG  = '#ff8833';
export const C_DEF  = '#44cc88';
export const C_XP   = '#9966ff';
export const C_DIM  = '#888';

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function colorLine(line: string, titleColor: string, isFirst: boolean, flash = false): string {
  const cls = flash ? ' class="flash"' : '';
  const span = (color: string, text: string) => `<span${cls} style="color:${color}">${esc(text)}</span>`;
  if (isFirst) return span(titleColor, line);
  if (!line.trim()) return '';
  const trimmed = line.trimStart();
  if (trimmed.startsWith('◆') || trimmed.startsWith('→')) return span(C_DIM, line);
  if (line.startsWith('HP:'))    return span(C_HP, line);
  if (line.startsWith('DMG:'))   return span(C_DMG, line);
  if (line.startsWith('DEF:'))   return span(C_DEF, line);
  if (line.startsWith('DRAIN:')) return span(C_MANA, line);
  if (line.startsWith('+ ')) {
    if (/ XP/.test(line))   return span(C_XP, line);
    if (/ MANA/.test(line)) return span(C_MANA, line);
    if (/ HP/.test(line))   return span(C_HP, line);
    return span(C_DIM, line);
  }
  if (/[+-]\d+.*\b(dmg|damage)\b/i.test(line)) return span(C_DMG, line);
  if (/[+-]\d+.*\bdef\b/i.test(line))           return span(C_DEF, line);
  if (/[+-]\d+.*\bhp\b/i.test(line)) return span(C_HP, line);
  if (/ MANA/.test(line))          return span(C_MANA, line);
  if (/ XP/.test(line))            return span(C_XP, line);
  return span(C_DIM, line);
}

export function renderEncounterHtml(lines: string[], titleColor: string, flashLine?: (line: string) => boolean): string {
  return lines.map((line, idx) => colorLine(line, titleColor, idx === 0, flashLine?.(line) ?? false)).join('\n');
}
