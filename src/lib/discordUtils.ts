import type { Activity, Data } from './LanyardTypes.ts'
import type { ProfileSettings } from './parameters.ts'
import { ImageSize } from './helpers.ts'
import { encodeBase64 } from './toBase64.ts'

/** Public “profile” badges users actually see on profiles. */
const BADGE_BITS = {
  // Order matches typical profile display order
  Staff:               1 << 0,   // Discord Employee
  Partner:             1 << 1,   // Partnered Server Owner
  HypeSquad_Events:    1 << 2,
  Bug_Hunter_Level_1:  1 << 3,
  House_Bravery:       1 << 6,
  House_Brilliance:    1 << 7,
  House_Balance:       1 << 8,
  Early_Supporter:     1 << 9,
  Bug_Hunter_Level_2:  1 << 14,
  Verified_Bot:        1 << 16,  // (rarely relevant for human accounts; included for completeness)
  Early_Verified_Bot_Developer: 1 << 17,
  Discord_Certified_Moderator:  1 << 18,
  Active_Developer:    1 << 22,
} as const

export type BadgeKey = keyof typeof BADGE_BITS

export function getUserBadges(publicFlags: number | undefined): BadgeKey[] {
  if (!publicFlags) return []
  const keys = Object.keys(BADGE_BITS) as BadgeKey[]
  return keys.filter((k) => (publicFlags & BADGE_BITS[k]) === BADGE_BITS[k])
}

export async function resolveAppIconViaEndpoint(appId: string, endpoint = '/api/discord-app-icon'): Promise<string | null> {
  try {
    const r = await fetch(`${endpoint}?id=${encodeURIComponent(appId)}`)
    if (!r.ok) return null
    const { url } = (await r.json()) as { url?: string }
    return url ?? null
  } catch { return null }
}


/** Formats ms → "mm:ss" (or "h:mm:ss" if ≥ 1h). */
function msToLabel(ms: number): string {
  const sTotal = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(sTotal / 3600)
  const m = Math.floor((sTotal % 3600) / 60)
  const s = sTotal % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** Resolve an activity asset to a CDN URL usable in <img> and encodeBase64. */
function resolveActivityAssetUrl(
  activity: Activity,
  which: 'large_image' | 'small_image'
): string | null {
  const id = activity.assets?.[which]
  if (!id) return null

  // External images from the client come prefixed as `mp:external/...`
  if (id.startsWith('mp:external/')) {
    return `https://media.discordapp.net/${id.replace('mp:', '')}`
  }

  // Spotify embeds look like "spotify:<hash>" — prefer the official CDN below
  if (id.startsWith('spotify:')) {
    const hash = id.split(':')[1]
    return `https://i.scdn.co/image/${hash}`
  }

  // Otherwise it’s an application asset
  if (activity.application_id) {
    return `https://cdn.discordapp.com/app-assets/${activity.application_id}/${id}.webp`
  }

  return null
}

/** Build the proper CDN URL for a user’s avatar (falls back to default avatar). */
function avatarUrl(data: Data, optimized: boolean): string {
  const avatar = data.discord_user.avatar
  const id = data.discord_user.id
  if (avatar) {
    const isGif = avatar.startsWith('a_') && !optimized
    const ext = isGif ? 'gif' : 'webp'
    const size = isGif ? 64 : 256
    return `https://cdn.discordapp.com/avatars/${id}/${avatar}.${ext}?size=${size}`
  }

  // Default avatar (discriminatorless accounts use snowflake shard trick)
  const discrim = data.discord_user.discriminator
  const index =
    discrim === '0'
      ? Number(BigInt(id) >> BigInt(22)) % 6
      : Number(discrim) % 5

  return `https://cdn.discordapp.com/embed/avatars/${index}.png?size=128`
}

/** Server tag (a.k.a. clan tag) badge image, if present. */
function serverTagUrl(data: Data): string | null {
  const pg = (data as any).discord_user?.primary_guild
  if (pg?.identity_guild_id && pg?.badge) {
    return `https://cdn.discordapp.com/clan-badges/${pg.identity_guild_id}/${pg.badge}.png?size=32`
  }
  return null
}

/** Custom status emoji (only for guild emoji with an ID; unicode is not fetched here). */
function statusEmojiUrl(activity: Activity, animatedAllowed: boolean): string | null {
  const emoji = (activity as any)?.emoji
  if (!emoji?.id) return null
  const ext = emoji?.animated && animatedAllowed ? 'gif' : 'webp'
  return `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}?size=32`
}

export interface DiscordActivityWithImages {
  activity: Activity
  assetLargeImage?: string | null
  assetSmallImage?: string | null
}

export interface SpotifyWithProgress {
  track_id: string
  song: string
  artist: string
  album: string
  album_art_url: string
  timestamps: { start: number; end: number }
  albumCover?: string | null
  progress: {
    durationMs: number
    elapsedMs: number
    remainingMs: number
    percent: number // 0..1
    elapsedLabel: string
    totalLabel: string
  }
}

export interface BuiltDiscordProfile {
  user: {
    id: string
    username: string
    global_name?: string | null
    discriminator: string
    avatar: string // base64
    avatarDecoration?: string | null
    badges: BadgeKey[]
    serverTagBadge?: string | null
    status: Data['discord_status']
    customStatus?: {
      text?: string
      emojiImage?: string | null // base64
    } | null
  }
  activities: DiscordActivityWithImages[]
  spotify?: SpotifyWithProgress | null
}

/**
 * Build a rich, pre-encoded snapshot of a Lanyard presence:
 * - user (avatar, decoration, badges, server tag, status emoji)
 * - all activities (with large/small images resolved & base64-encoded)
 * - spotify (with live progress + album cover)
 */
export async function buildDiscordProfile(
  data: Data,
  settings: ProfileSettings
): Promise<BuiltDiscordProfile> {
  // === User images ===
  const avatarB64 = await encodeBase64(
    avatarUrl(data, !!settings.optimized),
    ImageSize.USER_AVATAR
  )

  let avatarDecorationB64: string | null = null
  if (data.discord_user.avatar_decoration_data?.asset) {
    avatarDecorationB64 = await encodeBase64(
      `https://cdn.discordapp.com/avatar-decoration-presets/${data.discord_user.avatar_decoration_data.asset}.png?size=64&passthrough=${settings.animatedDecoration || 'false'}`,
      ImageSize.USER_DECORATION
    )
  }

  let serverTagBadgeB64: string | null = null
  const tagUrl = serverTagUrl(data)
  if (tagUrl) {
    serverTagBadgeB64 = await encodeBase64(tagUrl, ImageSize.SERVER_TAG)
  }

  // === Badges ===
  const badges = getUserBadges((data.discord_user as any).public_flags)

  // === Custom status (type 4) & emoji ===
  const customStatus = data.activities.find((a) => a.type === 4)
  let statusEmojiB64: string | null = null
  if (customStatus) {
    const emojiUrl = statusEmojiUrl(customStatus, !settings.optimized)
    if (emojiUrl) {
      statusEmojiB64 = await encodeBase64(emojiUrl, ImageSize.EMOJI)
    }
  }

  // === Activities (encode images for each) ===
  const ignored = new Set(settings.ignoreAppId ?? [])
  const activities: DiscordActivityWithImages[] = []

  for (const act of data.activities) {
    // If caller wants to hide certain apps entirely:
    if (act.application_id && ignored.has(String(act.application_id))) continue

    // Build images when present (works for type 0, Spotify, etc.)
    let largeB64: string | null = null
    let smallB64: string | null = null

    const largeUrl = resolveActivityAssetUrl(act, 'large_image')
    const smallUrl = resolveActivityAssetUrl(act, 'small_image')

    // Fallback: if there are no assets but we have an application_id, try to get the public app icon
    let fallbackLargeUrl: string | null = null
    if (!largeUrl && !smallUrl && act.application_id) {
      fallbackLargeUrl = await resolveAppIconViaEndpoint(String(act.application_id))
    }

    if (largeUrl || fallbackLargeUrl) {
      const u = largeUrl ?? fallbackLargeUrl!
      largeB64 = await encodeBase64(u, ImageSize.ACTIVITY_LARGE, settings.theme)
    }

    if (smallUrl) {
      smallB64 = await encodeBase64(smallUrl, ImageSize.ACTIVITY_SMALL, settings.theme)
    }

    activities.push({
      activity: act,
      assetLargeImage: largeB64,
      assetSmallImage: smallB64,
    })
  }

  // === Spotify (with progress) ===
  let spotifyOut: SpotifyWithProgress | null = null
  if ((data as any).listening_to_spotify && data.spotify) {
    const now = Date.now()
    const { timestamps } = data.spotify
    const durationMs = Math.max(0, timestamps.end - timestamps.start)
    const elapsedMs = Math.min(durationMs, Math.max(0, now - timestamps.start))
    const remainingMs = Math.max(0, durationMs - elapsedMs)
    const percent = durationMs > 0 ? elapsedMs / durationMs : 0

    let albumCover: string | null = null
    if (data.spotify.album_art_url) {
      albumCover = await encodeBase64(data.spotify.album_art_url, ImageSize.ACTIVITY_LARGE)
    }

    spotifyOut = {
      track_id: data.spotify.track_id,
      song: data.spotify.song,
      artist: data.spotify.artist,
      album: data.spotify.album,
      album_art_url: data.spotify.album_art_url,
      timestamps: data.spotify.timestamps,
      albumCover,
      progress: {
        durationMs,
        elapsedMs,
        remainingMs,
        percent,
        elapsedLabel: msToLabel(elapsedMs),
        totalLabel: msToLabel(durationMs),
      },
    }
  }

  return {
    user: {
      id: data.discord_user.id,
      username: data.discord_user.username,
      global_name: (data.discord_user as any).global_name ?? (data as any).discord_user?.display_name ?? null,
      discriminator: data.discord_user.discriminator,
      avatar: avatarB64,
      avatarDecoration: avatarDecorationB64,
      badges,
      serverTagBadge: serverTagBadgeB64,
      status: data.discord_status,
      customStatus: customStatus
        ? {
            text: (customStatus as any).state ?? (customStatus as any).name ?? undefined,
            emojiImage: statusEmojiB64,
          }
        : null,
    },
    activities,
    spotify: spotifyOut,
  }
}
