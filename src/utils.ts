export function hpBar(current: number, max: number, width: number = 10): string {
  const filled = Math.round((current / max) * width);
  const empty = width - filled;
  return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty));
}

export const C_HP   = '#ff6666';
export const C_MANA = '#00ffff';
export const C_DMG  = '#ff8833';
export const C_XP   = '#9966ff';
export const C_DIM  = '#888';

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function colorLine(line: string, titleColor: string, isFirst: boolean): string {
  if (isFirst) return `<span style="color:${titleColor}">${esc(line)}</span>`;
  if (!line.trim()) return '';
  const trimmed = line.trimStart();
  if (trimmed.startsWith('◆') || trimmed.startsWith('→')) return `<span style="color:${C_DIM}">${esc(line)}</span>`;
  if (line.startsWith('HP:'))    return `<span style="color:${C_HP}">${esc(line)}</span>`;
  if (line.startsWith('DMG:'))   return `<span style="color:${C_DMG}">${esc(line)}</span>`;
  if (line.startsWith('DRAIN:')) return `<span style="color:${C_MANA}">${esc(line)}</span>`;
  if (line.startsWith('+ ')) {
    if (/ XP/.test(line))   return `<span style="color:${C_XP}">${esc(line)}</span>`;
    if (/ MANA/.test(line)) return `<span style="color:${C_MANA}">${esc(line)}</span>`;
    if (/ HP/.test(line))   return `<span style="color:${C_HP}">${esc(line)}</span>`;
    return `<span style="color:${C_DIM}">${esc(line)}</span>`;
  }
  if (/\+\d+.*damage/i.test(line)) return `<span style="color:${C_DMG}">${esc(line)}</span>`;
  if (/\+\d+.*\bhp\b/i.test(line)) return `<span style="color:${C_HP}">${esc(line)}</span>`;
  if (/ MANA/.test(line))          return `<span style="color:${C_MANA}">${esc(line)}</span>`;
  if (/ XP/.test(line))            return `<span style="color:${C_XP}">${esc(line)}</span>`;
  return `<span style="color:${C_DIM}">${esc(line)}</span>`;
}

export function renderEncounterHtml(lines: string[], titleColor: string): string {
  return lines.map((line, idx) => colorLine(line, titleColor, idx === 0)).join('\n');
}
