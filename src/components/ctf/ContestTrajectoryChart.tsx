import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Payload } from 'recharts/types/component/DefaultTooltipContent'

interface TrajectoryPoint {
  index: number
  label: string
  rank: number
  weight: number
  title: string
  dateLabel: string
  count: number
}

interface ContestTrajectoryChartProps {
  data: TrajectoryPoint[]
}

const tooltipFormatter = (value: number, name: string) => {
  if (name === 'Avg Rank') {
    return [`#${Number(value).toFixed(1)}`, name]
  }
  if (name === 'Avg Weight') {
    return [`${Number(value).toFixed(1)}`, name]
  }
  return [value, name]
}

const tooltipLabelFormatter = (
  _label: string,
  payload: readonly Payload<number, string>[],
) => {
  const entry = payload?.[0]?.payload as TrajectoryPoint | undefined
  return entry?.dateLabel ?? _label
}

const ContestTrajectoryChart = ({ data }: ContestTrajectoryChartProps) => {
  if (!data.length) {
    return (
      <div className="flex h-44 items-center justify-center rounded-2xl border border-dashed border-border/60 bg-background/80 text-sm text-muted-foreground">
        No ranked finishes logged yet.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={230}>
      <LineChart
        data={data}
        margin={{
          top: 20,
          right: 32,
          left: 12,
          bottom: 12,
        }}
      >
        <CartesianGrid strokeDasharray="4 6" stroke="var(--border)" opacity={0.55} />
        <XAxis
          dataKey="label"
          tickMargin={8}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
        />
        <YAxis
          yAxisId="rank"
          dataKey="rank"
          domain={['dataMin', 'dataMax']}
          allowDecimals={false}
          width={48}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
        />
        <YAxis
          yAxisId="weight"
          orientation="right"
          width={48}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
          domain={['auto', 'auto']}
        />
        <Tooltip
          formatter={tooltipFormatter}
          labelFormatter={tooltipLabelFormatter}
          contentStyle={{
            borderRadius: '0.75rem',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--background)',
            color: 'var(--foreground)',
            boxShadow: '0 20px 40px -32px rgba(15,23,42,0.55)',
          }}
        />
        <Line
          yAxisId="rank"
          type="monotone"
          dataKey="rank"
          name="Avg Rank"
          stroke="color-mix(in srgb, var(--accent) 65%, black 35%)"
          strokeWidth={2.6}
          dot={{ r: 4, stroke: 'color-mix(in srgb, var(--accent) 65%, black 35%)', strokeWidth: 1.4, fill: 'var(--background)' }}
          activeDot={{ r: 6 }}
        />
        <Line
          yAxisId="weight"
          type="monotone"
          dataKey="weight"
          name="Avg Weight"
          stroke="color-mix(in srgb, var(--primary) 40%, white 60%)"
          strokeWidth={1.8}
          dot={{ r: 3, stroke: 'color-mix(in srgb, var(--primary) 40%, white 60%)', strokeWidth: 1, fill: 'var(--background)' }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export default ContestTrajectoryChart
