import { useMemo, useState, useEffect, useCallback, useRef, memo } from 'react'
import { FaSpotify } from 'react-icons/fa'
import { useLanyard, type LanyardResponse } from 'react-use-lanyard'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, getElapsedTime } from '@/lib/utils'
import AvatarComponent from '@/components/ui/avatar'
import { getAppIconURL } from '@/lib/appIconCatalog'

/** NEW: use the enriched profile builder */
import { buildDiscordProfile, type BuiltDiscordProfile } from '@/lib/discordUtils'

const DISCORD_USER_ID = '640550361853198348'

interface Activity {
  type: number
  name?: string
  details?: string
  state?: string
  application_id?: string
  assets?: {
    large_image?: string
    small_image?: string
  }
  timestamps?: {
    start?: number
  }
}

interface LanyardData {
  discord_status: 'online' | 'idle' | 'dnd' | 'offline'
  activities?: Activity[]
}

const STATUS_CONFIGS = {
  online: {
    bgClass: 'bg-green-600',
    hasIndicator: false,
  },
  idle: {
    bgClass: 'bg-yellow-500',
    hasIndicator: true,
    indicator: (
      <div
        className="bg-white-100 size-[10px] rounded-full"
        style={{
          clipPath: 'circle(50% at 50% 50%)',
          background:
            'radial-gradient(circle at 20% 20%, transparent 40%, currentColor 50%)',
        }}
      />
    ),
  },
  dnd: {
    bgClass: 'bg-red-600',
    hasIndicator: true,
    indicator: <div className="bg-background h-[4px] w-[11px] rounded-full" />,
  },
  offline: {
    bgClass: 'bg-muted-foreground',
    hasIndicator: true,
    indicator: <div className="bg-background size-2 rounded-full" />,
  },
} as const

const StatusIndicator = memo<{ status: LanyardData['discord_status'] }>(
  ({ status }) => {
    const config = STATUS_CONFIGS[status]

    return (
      <div
        className={cn(
          'ring-muted absolute right-0.5 bottom-2 size-3 rounded-full ring-6',
          config.bgClass,
          config.hasIndicator && 'flex items-center justify-center',
        )}
      >
        {config.hasIndicator && config.indicator}
      </div>
    )
  },
)


const DecorativeBadges = memo(() => {
  // size-* exists, but these icons are tiny; bump to size-4 for visibility
  const badgeStyles = useMemo(
    () => [
      'size-5 px-4',
      'size-6',
      'size-7',
      'size-6',
    ],
    [],
  )

  // Just store the paths; we'll wrap them in url(...) below
  const badgeUrls = useMemo(
    () => [
      '/static/badges/1.png',
      '/static/badges/2.png',
      '/static/badges/3.png',
      '/static/badges/4.png',
    ],
    [],
  )

  return (
    <div className="bg-[#000000]/3 rounded flex items-center gap-0.5 px-2 py-1">
      {badgeUrls.map((src, i) => (
        <div
          key={i}
          className={badgeStyles[i]}
          style={{
            backgroundImage: `url('${src}')`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            backgroundSize: 'contain',
          }}
          aria-label={`badges-${i + 1}`}
        />
      ))}
    </div>
  )
})

const UserInfo = memo(() => (
  <div className="bg-[#000000]/8 flex flex-col gap-y-1 p-3 rounded-md">
    <span className="text-base leading-none">Chara</span>
    <span className="text-muted-foreground text-xs leading-none">@chara0x</span>
  </div>
))

const AvatarSection = memo<{
  statusIndicator: React.ReactNode
}>(({ statusIndicator }) => (
  <div className="flex justify-between gap-x-1">
    <div className="relative">
      <AvatarComponent
        src="/static/bento/avatar.webp"
        alt="Avatar"
        fallback="C"
        className="-mt-12 aspect-square size-20 rounded-full sm:-mt-[3rem] sm:size-20"
      />
      <div
        className="absolute inset-0 -mt-12 aspect-square size-20 rounded-full bg-cover bg-center bg-no-repeat opacity-0 transition-opacity duration-200 sm:size-16 sm:bg-[url('/static/bento/avatar-foreground.png')]"
        aria-hidden="true"
      />
      {statusIndicator}
    </div>
    <DecorativeBadges />
  </div>
))


const DiscordLayout = memo<{
  statusIndicator: React.ReactNode
  activityContent: React.ReactNode
  children?: React.ReactNode
}>(({ statusIndicator, activityContent, children }) => (
  <div data-trigger className="group/discord relative size-full overflow-hidden">
    {/* Outer “frame/glow” */}
    <div className="rounded-xl bg-gradient-to-t from-[var(--discord-frame-to)] to-[var(--discord-frame-from)] p-1">
      <div className="grid size-full grid-rows-1">
        <div
          className="rounded-t-xl bg-[url('/static/bento/discord-banner.png')] bg-cover bg-center bg-no-repeat"
          style={{
            minHeight: 100,
            height: 100,
            /* soft scrim so text/icons stay legible in both themes */
            backgroundBlendMode: 'multiply',
            backgroundColor: 'var(--discord-banner-scrim)',
          }}
        />
      </div>

      {/* Card body */}
      <div className="rounded-b-xl bg-gradient-to-t from-[var(--discord-body-from)] to-[var(--discord-body-to)] flex flex-col gap-3 p-3">
        <AvatarSection statusIndicator={statusIndicator} />
        <UserInfo />
        {/* Status box */}
        <div className="rounded p-3" style={{ background: 'var(--discord-panel)' }}>
          {activityContent}
        </div>
        {/* Anything after status box */}
        {children}
      </div>
    </div>
  </div>
))


const ActivityDisplay = memo<{
  activity: Activity | null
  elapsedTime: string
}>(({ activity, elapsedTime }) => {
  // Resolve asset URLs like Discord does

  const [fallbackIcon, setFallbackIcon] = useState<string | null>(null)

  useEffect(() => {
    setFallbackIcon(null)
    const appId = activity?.application_id
    const hasAssets = !!activity?.assets && (activity.assets.large_image || activity.assets.small_image)
    if (!appId || hasAssets) return
    let cancel = false
      ; (async () => {
        const url = await getAppIconURL(String(appId))
        if (!cancel) setFallbackIcon(url)
      })()
    return () => { cancel = true }
  }, [activity?.application_id, activity?.assets?.large_image, activity?.assets?.small_image])


  const resolveAsset = useCallback(
    (id?: string | null, app?: string | null) => {
      if (!id) return null
      if (id.startsWith('mp:external/')) {
        return `https://media.discordapp.net/${id.replace('mp:', '')}`
      }
      if (id.startsWith('spotify:')) {
        const hash = id.split(':')[1]
        return `https://i.scdn.co/image/${hash}`
      }
      if (app) return `https://cdn.discordapp.com/app-assets/${app}/${id}.png`
      return null
    },
    [],
  )

  const large = useMemo(
    () => resolveAsset(activity?.assets?.large_image, activity?.application_id ?? null),
    [activity?.assets?.large_image, activity?.application_id, resolveAsset],
  )
  const small = useMemo(
    () => resolveAsset(activity?.assets?.small_image, activity?.application_id ?? null),
    [activity?.assets?.small_image, activity?.application_id, resolveAsset],
  )

  // If no rich activity, keep the simple placeholder inside the status box
  if (!activity) {
    return (
      <div className="flex size-full items-center gap-x-2 sm:gap-x-3">
        <div className="relative aspect-square h-full max-h-12 shrink-0 sm:max-h-16">
          <div
            style={{ backgroundImage: `url('/static/bento/bento-discord-futon.svg')` }}
            className="absolute inset-0 bg-contain bg-center bg-no-repeat opacity-60"
          />
        </div>
        <div className="flex flex-1 flex-col gap-y-1 py-1">
          <div className="mb-0.5 line-clamp-1 text-xs leading-none">No status</div>
          <div className="text-muted-foreground line-clamp-2 text-[11px] leading-none">
            I'm probably sleeping...
          </div>
          <div className="text-muted-foreground line-clamp-1 text-[11px] leading-none">Zzzzz</div>
          <div className="text-muted-foreground text-[11px] leading-none">∞:00 elapsed</div>
        </div>
      </div>
    )
  }

  return (
    <div className="">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-medium leading-none">Playing</div>
        <div className="text-muted-foreground -mr-1 select-none px-2 text-xl leading-none">⋯</div>
      </div>

      {/* Body */}
      <div className="flex items-center gap-3">
        {/* Large app image */}
        <div className="relative h-[60px] w-[60px] rounded-md bg-black/10">
          {(large || fallbackIcon) && (
            <img
              src={large ?? fallbackIcon!}
              width={60}
              height={60}
              className="h-[60px] w-[60px] rounded-md object-cover" />
          )}
          {/* Small overlay icon */}
          {small && (
            <div className="absolute -bottom-2 -left-2 rounded-full border-2 border-white/80 shadow-sm">
              <img
                src={small}
                alt="App Icon"
                width={24}
                height={24}
                className="h-6 w-6 rounded-full object-cover"
              />
            </div>
          )}
        </div>

        {/* Details */}
        <div className="min-w-0 flex-1">
          {activity.name && (
            <div className="truncate text-sm font-semibold leading-tight">
              {activity.name}
            </div>
          )}
          {activity.details && (
            <div className="mt-0.5 truncate text-xs leading-none text-muted-foreground">
              {activity.details}
            </div>
          )}
          {activity.state && (
            <div className="mt-0.5 truncate text-xs leading-none text-muted-foreground">
              {activity.state}
            </div>
          )}

          {/* Elapsed time (green) */}
          {elapsedTime && (
            <div className="mt-2 text-[11px] font-medium leading-none text-green tabular-nums">
              {elapsedTime}
            </div>
          )}
        </div>
      </div>
    </div>
  )
})


const LoadingSkeleton = memo(() => (
  <DiscordLayout
    statusIndicator={
      <Skeleton className="ring-muted absolute right-1 bottom-1 size-4 rounded-full ring-6" />
    }
    activityContent={<Skeleton className="h-full w-full" />}
  />
))

/* =======================
   NEW: helpers for more activities + spotify
   We DO NOT change existing behavior; we only add optional renderers.
   ======================= */

const AdditionalActivities = memo<{
  profile: BuiltDiscordProfile | null
  mainActivity: Activity | null
}>(({ profile, mainActivity }) => {
  if (!profile?.activities?.length) return null

  // Exclude the already-shown main activity (match by name/details/state where possible)
  const others = profile.activities
    .map((a) => a.activity)
    .filter((a) => a.type !== 4) // ignore custom status here
    .filter((a) => {
      if (!mainActivity) return true
      return !(
        a.name === mainActivity.name &&
        a.details === mainActivity.details &&
        a.state === mainActivity.state
      )
    })
    .slice(0, 3) // show up to 3 extras to keep layout tidy

  if (!others.length) return null

  // return (
  //   <div className="mt-2 flex items-center gap-2">
  //     {others.map((a, idx) => {
  //       const hasSmall = a.assets?.small_image && a.application_id
  //       const hasLarge = a.assets?.large_image && a.application_id
  //       const src = hasSmall
  //         ? `https://cdn.discordapp.com/app-assets/${a.application_id}/${a.assets!.small_image}.png`
  //         : hasLarge
  //           ? `https://cdn.discordapp.com/app-assets/${a.application_id}/${a.assets!.large_image}.png`
  //           : '/static/bento/bento-discord-futon.svg'

  //       return (
  //         <div key={idx} className="flex items-center gap-1.5">
  //           <img
  //             src={src}
  //             alt={a.name ?? 'Activity'}
  //             className="size-6 rounded-sm grayscale sepia-50"
  //           />
  //           <span className="text-muted-foreground text-[11px] leading-none line-clamp-1">
  //             {a.name ?? 'Activity'}
  //           </span>
  //         </div>
  //       )
  //     })}
  //   </div>
  // )
})

/** NEW: Spotify card UI matching the screenshot + live progress via timestamps */
const SpotifyNowPlayingCard = memo<{
  profile: BuiltDiscordProfile | null
  onForceRefresh?: () => void
}>(({ profile, onForceRefresh }) => {
  const sp = profile?.spotify
  if (!sp) return null

  // Drive progress from timestamps so it animates without a refetch
  const startAt = profile?.spotify?.timestamps.start ?? 0
  const endAt = profile?.spotify?.timestamps.end ?? Date.now() + 720000 // default to 1 hour if no end time
  const [now, setNow] = useState<number>(startAt) // deterministic on SSR

  useEffect(() => {
    // tick every second on the client
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // use startAt for the first pass to avoid SSR/client drift
  const duration = Math.max(0, endAt - startAt)
  const elapsed = Math.min(duration, Math.max(0, (now ?? startAt) - startAt))
  const pct = duration > 0 ? elapsed / duration : 0
  const width = `${Math.round(pct * 100)}%`

  const fmt = (ms: number) => {
    const sTotal = Math.floor(ms / 1000)
    const m = Math.floor((sTotal % 3600) / 60)
    const s = sTotal % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }


  useEffect(() => {
    if (!profile?.spotify) return

    const endAt = profile.spotify.timestamps.end
    const delay = endAt - Date.now()

    if (delay <= 0) {
      // Track already past end: trigger an immediate revalidate once
      onForceRefresh?.()
      return
    }

    const t = setTimeout(() => {
      onForceRefresh?.() // force SWR to fetch the next track right when this one ends
    }, delay + 250) // tiny buffer to avoid edge timing issues

    return () => clearTimeout(t)
  }, [profile?.spotify?.timestamps.end, onForceRefresh])

  return (
    <div className="rounded-xl bg-white/30 p-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] backdrop-blur-md">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FaSpotify className="opacity-80" />
          <span className="tracking-tight">Listening to Spotify</span>
        </div>
        <div className="text-muted-foreground -mr-1 select-none px-2 text-xl leading-none">⋯</div>
      </div>

      {/* Body */}
      <div className="flex items-center gap-3">
        {/* Album art */}
        <img
          src={sp.album_art_url}
          alt={`${sp.album} cover`}
          className="size-14 rounded-md object-cover"
        />

        {/* Track info + progress */}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold leading-tight">{sp.song}</div>
          <div className="text-muted-foreground truncate text-xs">{sp.artist}</div>

          <div className="mt-2 flex items-center gap-2">
            <span className="text-muted-foreground text-[11px] tabular-nums">{fmt(elapsed)}</span>
            <div className="relative h-[3px] flex-1 rounded-full bg-black/15">
              <div className="absolute inset-y-0 left-0 rounded-full bg-black/60" style={{ width }} />
            </div>
            <span className="text-muted-foreground text-[11px] tabular-nums">{fmt(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  )
},
)

/* =======================
   Component
   ======================= */

const DiscordPresence = () => {
  // NEW: tick that bumps on every successful refresh to force a re-render
  const [refreshTick, setRefreshTick] = useState(0)
  const lastResponseRef = useRef<LanyardResponse['data'] | null>(null)

  const { data: lanyard, isLoading, error, mutate } = useLanyard({
    userId: DISCORD_USER_ID,
  })

  // Manually revalidate on an interval so the UI stays fresh even when hidden.
  useEffect(() => {
    const id = setInterval(() => {
      void mutate()
    }, 10_000)

    return () => clearInterval(id)
  }, [mutate])

  useEffect(() => {
    if (!lanyard?.data) return
    if (lastResponseRef.current === lanyard.data) {
      return
    }
    lastResponseRef.current = lanyard.data
    setRefreshTick((tick) => tick + 1)
  }, [lanyard?.data])

  const mainActivity = useMemo(() => {
    if (!lanyard?.data?.activities) return null
    return (
      lanyard.data.activities.find(
        (activity: Activity) => activity.type === 0 && !!activity.assets,
      ) || null
    )
  }, [lanyard?.data?.activities])

  const [elapsedTime, setElapsedTime] = useState('')
  const updateElapsedTime = useCallback(() => {
    if (mainActivity?.timestamps?.start) {
      setElapsedTime(getElapsedTime(mainActivity.timestamps.start))
    }
  }, [mainActivity?.timestamps?.start])

  useEffect(() => {
    if (!mainActivity?.timestamps?.start) {
      setElapsedTime('')
      return
    }
    updateElapsedTime()
    const intervalId = setInterval(updateElapsedTime, 1000)
    return () => clearInterval(intervalId)
  }, [mainActivity?.timestamps?.start, updateElapsedTime])

  /* NEW: build enriched profile (user, all activities, spotify progress, etc.) */
  const [profile, setProfile] = useState<BuiltDiscordProfile | null>(null)
  useEffect(() => {
    let mounted = true
      ; (async () => {
        if (!lanyard?.data) {
          if (mounted) setProfile(null)
          return
        }
        try {
          const enriched = await buildDiscordProfile(lanyard.data as any, {
            optimized: true,
          } as any)
          if (mounted) setProfile(enriched)
        } catch (e) {
          if (mounted) setProfile(null)
        }
      })()
    return () => {
      mounted = false
    }
    // NEW: re-build on every successful refresh as well
  }, [lanyard?.data, refreshTick])

  if (isLoading) {
    return <LoadingSkeleton />
  }

  if (error || !lanyard?.data) {
    return null
  }

  // print lanyard data to console
  console.log('Lanyard Data:', lanyard.data)
  if (profile) console.log('Enriched Discord Profile:', profile)

  const { discord_status } = lanyard.data

  return (
    <DiscordLayout
      statusIndicator={<StatusIndicator status={discord_status} />}
      activityContent={
        <ActivityDisplay activity={mainActivity} elapsedTime={elapsedTime} />
      }
    >
      {/* New child after status box */}
      <SpotifyNowPlayingCard
        key={profile?.spotify?.track_id ?? 'no-track'}
        profile={profile}
        onForceRefresh={() => mutate()}
      />
      <AdditionalActivities profile={profile} mainActivity={mainActivity} />
    </DiscordLayout>
  )
}

export default memo(DiscordPresence)
