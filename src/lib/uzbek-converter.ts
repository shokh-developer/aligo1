// Uzbek Cyrillic ↔ Latin converter
// Handles all digraphs, apostrophe variants, and case preservation

type Direction = 'cyr2lat' | 'lat2cyr';

// Cyrillic → Latin mapping (order matters: multi-char first)
const CYR_TO_LAT: [string, string][] = [
  // Digraphs / special
  ['Ш', 'Sh'], ['ш', 'sh'],
  ['Ч', 'Ch'], ['ч', 'ch'],
  ['Ё', 'Yo'], ['ё', 'yo'],
  ['Ю', 'Yu'], ['ю', 'yu'],
  ['Я', 'Ya'], ['я', 'ya'],
  ['Ц', 'Ts'], ['ц', 'ts'],
  ['Ў', 'Oʻ'], ['ў', 'oʻ'],
  ['Ғ', 'Gʻ'], ['ғ', 'gʻ'],
  ['Ҳ', 'H'], ['ҳ', 'h'],
  ['Қ', 'Q'], ['қ', 'q'],
  // Single chars
  ['А', 'A'], ['а', 'a'],
  ['Б', 'B'], ['б', 'b'],
  ['В', 'V'], ['в', 'v'],
  ['Г', 'G'], ['г', 'g'],
  ['Д', 'D'], ['д', 'd'],
  ['Е', 'E'], ['е', 'e'],
  ['Ж', 'J'], ['ж', 'j'],
  ['З', 'Z'], ['з', 'z'],
  ['И', 'I'], ['и', 'i'],
  ['Й', 'Y'], ['й', 'y'],
  ['К', 'K'], ['к', 'k'],
  ['Л', 'L'], ['л', 'l'],
  ['М', 'M'], ['м', 'm'],
  ['Н', 'N'], ['н', 'n'],
  ['О', 'O'], ['о', 'o'],
  ['П', 'P'], ['п', 'p'],
  ['Р', 'R'], ['р', 'r'],
  ['С', 'S'], ['с', 's'],
  ['Т', 'T'], ['т', 't'],
  ['У', 'U'], ['у', 'u'],
  ['Ф', 'F'], ['ф', 'f'],
  ['Х', 'X'], ['х', 'x'],
  ['Э', 'E'], ['э', 'e'],
  ['Ъ', 'ʼ'], ['ъ', 'ʼ'],
];

// Latin → Cyrillic mapping (longest match first)
// We handle multiple apostrophe variants: ʻ (U+02BB), ʼ (U+02BC), ' (U+2018), ' (U+2019), ' (U+0027)
const APOSTROPHE_VARIANTS = ["ʻ", "ʼ", "\u2018", "\u2019", "'"];

// Build Latin→Cyrillic digraph table
const LAT_TO_CYR_DIGRAPHS: [string, string][] = [];

// For each apostrophe variant, add o' and g' mappings
for (const ap of APOSTROPHE_VARIANTS) {
  LAT_TO_CYR_DIGRAPHS.push(
    [`O${ap}`, 'Ў'], [`o${ap}`, 'ў'],
    [`G${ap}`, 'Ғ'], [`g${ap}`, 'ғ'],
  );
}

// Standard digraphs
LAT_TO_CYR_DIGRAPHS.push(
  ['Sh', 'Ш'], ['sh', 'ш'],
  ['SH', 'Ш'],
  ['Ch', 'Ч'], ['ch', 'ч'],
  ['CH', 'Ч'],
  ['Yo', 'Ё'], ['yo', 'ё'],
  ['YO', 'Ё'],
  ['Yu', 'Ю'], ['yu', 'ю'],
  ['YU', 'Ю'],
  ['Ya', 'Я'], ['ya', 'я'],
  ['YA', 'Я'],
  ['Ts', 'Ц'], ['ts', 'ц'],
  ['TS', 'Ц'],
  ['Ng', 'Нг'], ['ng', 'нг'],
  ['NG', 'НГ'],
);

const LAT_TO_CYR_SINGLE: [string, string][] = [
  ['A', 'А'], ['a', 'а'],
  ['B', 'Б'], ['b', 'б'],
  ['D', 'Д'], ['d', 'д'],
  ['E', 'Е'], ['e', 'е'],
  ['F', 'Ф'], ['f', 'ф'],
  ['G', 'Г'], ['g', 'г'],
  ['H', 'Ҳ'], ['h', 'ҳ'],
  ['I', 'И'], ['i', 'и'],
  ['J', 'Ж'], ['j', 'ж'],
  ['K', 'К'], ['k', 'к'],
  ['L', 'Л'], ['l', 'л'],
  ['M', 'М'], ['m', 'м'],
  ['N', 'Н'], ['n', 'н'],
  ['O', 'О'], ['o', 'о'],
  ['P', 'П'], ['p', 'п'],
  ['Q', 'Қ'], ['q', 'қ'],
  ['R', 'Р'], ['r', 'р'],
  ['S', 'С'], ['s', 'с'],
  ['T', 'Т'], ['t', 'т'],
  ['U', 'У'], ['u', 'у'],
  ['V', 'В'], ['v', 'в'],
  ['X', 'Х'], ['x', 'х'],
  ['Y', 'Й'], ['y', 'й'],
  ['Z', 'З'], ['z', 'з'],
];

// Sort digraphs by length descending for longest-match-first
const SORTED_LAT_DIGRAPHS = [...LAT_TO_CYR_DIGRAPHS].sort(
  (a, b) => b[0].length - a[0].length
);

// Build lookup maps for performance
const cyrToLatMap = new Map<string, string>(CYR_TO_LAT);
const latSingleMap = new Map<string, string>(LAT_TO_CYR_SINGLE);

export function cyrillicToLatin(text: string): string {
  let result = '';
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    const mapped = cyrToLatMap.get(char);
    if (mapped !== undefined) {
      result += mapped;
      i++;
    } else {
      result += char;
      i++;
    }
  }
  return result;
}

export function latinToCyrillic(text: string): string {
  let result = '';
  let i = 0;
  const len = text.length;

  while (i < len) {
    let matched = false;

    // Try digraphs (longest first)
    for (const [lat, cyr] of SORTED_LAT_DIGRAPHS) {
      const latLen = lat.length;
      if (i + latLen <= len && text.substring(i, i + latLen) === lat) {
        result += cyr;
        i += latLen;
        matched = true;
        break;
      }
    }

    if (!matched) {
      const char = text[i];
      const mapped = latSingleMap.get(char);
      if (mapped !== undefined) {
        result += mapped;
      } else {
        result += char;
      }
      i++;
    }
  }
  return result;
}

export function convert(text: string, direction: Direction): string {
  if (!text) return '';
  return direction === 'cyr2lat' ? cyrillicToLatin(text) : latinToCyrillic(text);
}

export function detectDirection(text: string): Direction {
  // Count Cyrillic vs Latin characters
  let cyr = 0;
  let lat = 0;
  for (let i = 0; i < Math.min(text.length, 500); i++) {
    const code = text.charCodeAt(i);
    if (code >= 0x0400 && code <= 0x04FF) cyr++;
    else if ((code >= 0x0041 && code <= 0x005A) || (code >= 0x0061 && code <= 0x007A)) lat++;
  }
  return cyr >= lat ? 'cyr2lat' : 'lat2cyr';
}

export type { Direction };
