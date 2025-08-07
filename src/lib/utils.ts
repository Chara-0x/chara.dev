import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Vibrant } from "node-vibrant/browser";


/**
 * Linearly mix a hex color toward white by `amount` (0→original, 1→white).
 */
function lightenHex(hex: string, amount: number): string {
  // strip “#” and parse
  const num = parseInt(hex.slice(1), 16)
  let r = (num >> 16) & 0xff
  let g = (num >> 8) & 0xff
  let b = num & 0xff

  // move each channel toward 255
  r = Math.round(r + (255 - r) * amount)
  g = Math.round(g + (255 - g) * amount)
  b = Math.round(b + (255 - b) * amount)

  // reassemble and pad
  return `#${((1 << 24) | (r << 16) | (g << 8) | b)
    .toString(16)
    .slice(1)}`
}

export async function getImageGradient(imageUrl: string): Promise<string> {
  try {
    // lower quality & fewer clusters → faster palette extraction
    const palette = await Vibrant
      .from(imageUrl)
      .quality(1)           // sample every 1px instead of default 10px
      .maxColorCount(16)    // cluster into just 16 colors
      .getPalette()

    // fallbacks:
    const rawPrimary   = palette.Vibrant?.hex   ?? '#000000'
    const rawSecondary = palette.Muted?.hex     ?? '#FFFFFF'

    // lighten more toward white (0.0–1.0)
    const primary   = lightenHex(rawPrimary,   0.8)
    const secondary = lightenHex(rawSecondary, 0.9  )

    return `linear-gradient(135deg, ${primary}, ${secondary})`
  } catch (e) {
    console.error('Gradient generation failed', e)
    return 'linear-gradient(135deg, #333, #777)'
  }
}

// /**
//  * Given an image URL, extracts two complementary palette colors
//  * and returns a CSS linear-gradient.
//  */
// export async function getImageGradient(imageUrl: string): Promise<string> {
//   try {
//     const palette = await Vibrant.from(imageUrl).getPalette();
//     // pick two swatches; fall back to hex black/white if missing
//     const primary   = palette.Vibrant?.hex   ?? '#000000';
//     const secondary = palette.Muted?.hex     ?? '#FFFFFF';
//     // 135deg gives a nice diagonal sweep
//     return `linear-gradient(135deg, ${primary}, ${secondary})`;
//   } catch (e) {
//     console.error('Gradient generation failed', e);
//     // sensible default
//     return 'linear-gradient(135deg, #333, #777)';
//   }
// }



export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date) {
  return Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

export function calculateWordCountFromHtml(
  html: string | null | undefined,
): number {
  if (!html) return 0
  const textOnly = html.replace(/<[^>]+>/g, '')
  return textOnly.split(/\s+/).filter(Boolean).length
}

export function readingTime(wordCount: number): string {
  const readingTimeMinutes = Math.max(1, Math.round(wordCount / 200))
  return `${readingTimeMinutes} min read`
}

export function getHeadingMargin(depth: number): string {
  const margins: Record<number, string> = {
    3: 'ml-4',
    4: 'ml-8',
    5: 'ml-12',
    6: 'ml-16',
  }
  return margins[depth] || ''
}

export function getElapsedTime(unixTimestamp: number): string {
  const createdAt = new Date(unixTimestamp)
  const now = new Date()
  let difference = now.getTime() - createdAt.getTime()
  const hours = Math.floor(difference / (1000 * 60 * 60))
  difference -= hours * (1000 * 60 * 60)
  const minutes = Math.floor(difference / (1000 * 60))
  difference -= minutes * (1000 * 60)
  const seconds = Math.floor(difference / 1000)
  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${seconds.toString().padStart(2, '0')} elapsed`
}