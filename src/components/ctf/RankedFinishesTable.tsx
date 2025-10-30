import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  Flag,
} from 'lucide-react'

type SortKey = 'rank' | 'title' | 'date' | 'teams' | 'weight'
type SortDirection = 'asc' | 'desc'

interface RankedFinish {
  id: number
  rank: number
  weight: number | null
  participants: number | null
  title: string
  ctftimeUrl?: string
  logo?: string
  startDateISO: string
  startLabel: string
}

interface RankedFinishesTableProps {
  entries: RankedFinish[]
  accentColor?: string
}

const sortComparators: Record<SortKey, (a: RankedFinish, b: RankedFinish) => number> = {
  rank: (a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank
    const weightA = a.weight ?? -Infinity
    const weightB = b.weight ?? -Infinity
    if (weightA !== weightB) return weightB - weightA
    return new Date(a.startDateISO).getTime() - new Date(b.startDateISO).getTime()
  },
  weight: (a, b) => {
    const weightA = a.weight ?? -Infinity
    const weightB = b.weight ?? -Infinity
    if (weightA === weightB) return sortComparators.rank(a, b)
    return weightA - weightB
  },
  title: (a, b) => a.title.localeCompare(b.title),
  date: (a, b) =>
    new Date(a.startDateISO).getTime() - new Date(b.startDateISO).getTime(),
  teams: (a, b) => {
    const teamsA = a.participants ?? -Infinity
    const teamsB = b.participants ?? -Infinity
    if (teamsA === teamsB) return sortComparators.rank(a, b)
    return teamsA - teamsB
  },
}

const RankedFinishesTable = ({ entries }: RankedFinishesTableProps) => {
  const [sortKey, setSortKey] = useState<SortKey>('weight')
  const [direction, setDirection] = useState<SortDirection>('desc')

  const defaultDirection: Record<SortKey, SortDirection> = {
    rank: 'asc',
    title: 'asc',
    date: 'asc',
    teams: 'asc',
    weight: 'desc',
  }

  const sortedEntries = useMemo(() => {
    const comparator = sortComparators[sortKey]
    const multiplier = direction === 'asc' ? 1 : -1
    return [...entries].sort((a, b) => multiplier * comparator(a, b))
  }, [entries, sortKey, direction])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setDirection(defaultDirection[key])
  }

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="size-3.5 opacity-40" aria-hidden="true" />
    }
    return direction === 'asc' ? (
      <ArrowUp className="size-3.5" aria-hidden="true" />
    ) : (
      <ArrowDown className="size-3.5" aria-hidden="true" />
    )
  }

  return (
    <div className="overflow-x-auto rounded-3xl border border-border/60 bg-background/75 shadow-[0_18px_45px_-25px_rgba(15,23,42,0.35)]">
      <table className="min-w-full divide-y divide-border/70 text-sm">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3 text-left font-semibold uppercase tracking-[0.2em]">
              <button
                type="button"
                onClick={() => handleSort('rank')}
                className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground transition hover:text-foreground"
              >
                Rank
                {renderSortIcon('rank')}
              </button>
            </th>
            <th scope="col" className="px-4 py-3 text-left font-semibold uppercase tracking-[0.2em]">
              <button
                type="button"
                onClick={() => handleSort('title')}
                className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground transition hover:text-foreground"
              >
                Event
                {renderSortIcon('title')}
              </button>
            </th>
            <th scope="col" className="px-4 py-3 text-left font-semibold uppercase tracking-[0.2em]">
              <button
                type="button"
                onClick={() => handleSort('date')}
                className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground transition hover:text-foreground"
              >
                Date
                {renderSortIcon('date')}
              </button>
            </th>
            <th scope="col" className="px-4 py-3 text-left font-semibold uppercase tracking-[0.2em]">
              <button
                type="button"
                onClick={() => handleSort('teams')}
                className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground transition hover:text-foreground"
              >
                Teams
                {renderSortIcon('teams')}
              </button>
            </th>
            <th scope="col" className="px-4 py-3 text-left font-semibold uppercase tracking-[0.2em]">
              <button
                type="button"
                onClick={() => handleSort('weight')}
                className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground transition hover:text-foreground"
              >
                Weight
                {renderSortIcon('weight')}
              </button>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {sortedEntries.map((entry) => (
            <tr key={entry.id} className="hover:bg-primary/5 transition">
              <td className="px-4 py-4 font-semibold text-foreground">#{entry.rank}</td>
              <td className="px-4 py-4">
                <div className="flex items-center gap-3">
                  {entry.logo ? (
                    <img
                      src={entry.logo}
                      alt={`${entry.title} logo`}
                      loading="lazy"
                      className="size-10 shrink-0 rounded-xl bg-background object-contain"
                    />
                  ) : (
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/50 text-muted-foreground">
                      <Flag className="size-4" aria-hidden="true" />
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <span className="font-medium leading-tight">{entry.title}</span>
                    {entry.ctftimeUrl && (
                      <a
                        href={entry.ctftimeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary transition hover:text-primary/80"
                      >
                        View on CTFtime
                        <ArrowUpRight className="size-3" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-4 py-4 text-muted-foreground">
                {entry.startLabel}
              </td>
              <td className="px-4 py-4 text-muted-foreground">
                {entry.participants && entry.participants > 0 ? entry.participants : '—'}
              </td>
              <td className="px-4 py-4 text-muted-foreground">
                {entry.weight !== null && entry.weight !== undefined ? entry.weight.toFixed(1) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default RankedFinishesTable
