// src/lib/appIconCatalog.ts
type AppRec = { id: string; icon?: string | null }
let cache: Promise<Map<string, AppRec>> | null = null

export async function loadAppCatalog(path = '/update/applications.json') {
  if (!cache) {
    cache = (async () => {
      const r = await fetch(path, { cache: 'force-cache' })
      const json = await r.json()
      const arr: any[] = Array.isArray(json) ? json : (json.applications ?? [])
      const map = new Map<string, AppRec>()
      for (const a of arr) if (a?.id) map.set(String(a.id), { id: String(a.id), icon: a.icon ?? null })
      return map
    })()
  }
  return cache
}

export async function getAppIconURL(appId: string, size = 256) {
  const map = await loadAppCatalog()
  const rec = map.get(String(appId))
  return rec?.icon
    ? `https://cdn.discordapp.com/app-icons/${appId}/${rec.icon}.png?size=${size}&keep_aspect_ratio=false`
    : null
}
