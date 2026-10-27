/**
 * Code 128 Barcode Generator (Pure TypeScript / SVG)
 * Supports full alphanumeric ASCII, perfectly compatible with WiredPower WPXD100 2D scanner.
 */

// Code 128 pattern table (107 patterns, each 11 modules wide, plus stop pattern 13 modules)
const CODE128_PATTERNS: string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", // 30-39
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112" // 100-106 (106 is STOP)
];

const START_CODE_B = 104;
const STOP_CODE = 106;

/**
 * Encodes text into Code 128 (Subset B)
 */
export function encodeCode128(text: string): { modules: number[]; checkSum: number } {
  const codes: number[] = [START_CODE_B];
  
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    // Code 128 B maps ASCII 32-127 directly to index (charCode - 32)
    const val = charCode >= 32 && charCode <= 126 ? charCode - 32 : 0;
    codes.push(val);
  }

  // Calculate checksum: (START + SUM(code[i] * i)) % 103
  let sum = START_CODE_B;
  for (let i = 1; i < codes.length; i++) {
    sum += codes[i] * i;
  }
  const checkSum = sum % 103;
  codes.push(checkSum);
  codes.push(STOP_CODE);

  // Convert pattern strings to module array (1 = bar, 0 = space)
  const modules: number[] = [];
  
  // Quiet zone: 10 empty modules
  for (let q = 0; q < 10; q++) modules.push(0);

  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code];
    let isBar = true;
    for (const widthChar of pattern) {
      const width = parseInt(widthChar, 10);
      for (let w = 0; w < width; w++) {
        modules.push(isBar ? 1 : 0);
      }
      isBar = !isBar;
    }
  }

  // Quiet zone: 10 empty modules
  for (let q = 0; q < 10; q++) modules.push(0);

  return { modules, checkSum };
}

/**
 * Generates an SVG string of a Code 128 Barcode
 */
export function generateBarcodeSvg(
  text: string,
  options: {
    height?: number;
    moduleWidth?: number;
    showText?: boolean;
    fillColor?: string;
    bgColor?: string;
  } = {}
): string {
  const {
    height = 64,
    moduleWidth = 2,
    showText = true,
    fillColor = '#1F1218',
    bgColor = '#FFFFFF',
  } = options;

  if (!text) return '';

  const { modules } = encodeCode128(text);
  const totalWidth = modules.length * moduleWidth;
  const barHeight = showText ? height - 16 : height;
  const totalHeight = height;

  // Build rects for consecutive 1s
  let rects = '';
  let inBar = false;
  let barStart = 0;

  for (let i = 0; i < modules.length; i++) {
    if (modules[i] === 1 && !inBar) {
      inBar = true;
      barStart = i;
    } else if (modules[i] === 0 && inBar) {
      inBar = false;
      const x = barStart * moduleWidth;
      const w = (i - barStart) * moduleWidth;
      rects += `<rect x="${x}" y="0" width="${w}" height="${barHeight}" fill="${fillColor}" />`;
    }
  }

  if (inBar) {
    const x = barStart * moduleWidth;
    const w = (modules.length - barStart) * moduleWidth;
    rects += `<rect x="${x}" y="0" width="${w}" height="${barHeight}" fill="${fillColor}" />`;
  }

  const textElement = showText
    ? `<text x="${totalWidth / 2}" y="${totalHeight - 3}" font-family="Plus Jakarta Sans, monospace, sans-serif" font-size="11" font-weight="600" text-anchor="middle" fill="${fillColor}" letter-spacing="1.5">${text}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}" style="background-color: ${bgColor}; max-width: 100%;">
    <rect width="${totalWidth}" height="${totalHeight}" fill="${bgColor}" />
    ${rects}
    ${textElement}
  </svg>`;
}

/**
 * Generate a random unique boutique barcode string
 */
export function generateRandomBarcode(prefix: string = 'CHQ'): string {
  const timestamp = Date.now().toString().slice(-6);
  const randomPart = Math.floor(1000 + Math.random() * 9000).toString();
  return `${prefix}-${timestamp}${randomPart}`;
}
