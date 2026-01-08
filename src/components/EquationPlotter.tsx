import { create, all } from 'mathjs'
import { useEffect, useMemo, useRef } from 'react'

export type PlotMode = 'line' | 'slope' | 'surface'

export interface EquationPlotProps {
  /** Left title label, e.g. "Example 6:" */
  title?: string
  /** Display equation (rendered as LaTeX), e.g. "y = C*e^{-2x}" */
  equation?: string
  /** Small chip next to equation, e.g. "C = 1 shown" */
  description?: string

  /**
   * Expression to evaluate (mathjs), e.g. "C * exp(-2 * x)"
   * For slope fields/surfaces, you may reference both x and y.
   */
  expression?: string

  params?: Record<string, number>
  fn?: (x: number) => number

  mode?: PlotMode
  xRange?: [number, number]
  yRange?: [number, number] // used for slope fields & surfaces
  xSampleRange?: [number, number] // optional evaluation range (defaults to padded xRange)
  ySampleRange?: [number, number] // optional evaluation range for slope/surface
  samplePadding?: number // fraction of range width to evaluate beyond the visible range
  samples?: number
  gridSize?: number // slope field & surface density
  segmentLength?: number // slope field segment length in data units
  xLabel?: string
  yLabel?: string
  zLabel?: string
  zRange?: [number, number]
  className?: string
  color?: string
}

const math = create(all, {})
const plotlyLoader = import('plotly.js-dist-min')

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const clampSamples = (value?: number) => {
  if (!value || Number.isNaN(value)) return 240
  return clamp(Math.round(value), 40, 1200)
}

const defaultRanges = {
  x: [-6, 6] as [number, number],
  y: [-4, 4] as [number, number],
}

const expandRange = (range: [number, number], padding = 0.35): [number, number] => {
  const [start, end] = range
  const span = end - start
  if (span <= 0) return range
  const pad = span * padding
  return [start - pad, end + pad]
}

const buildLineData = (
  evaluator: ((x: number) => number) | undefined,
  xRange: [number, number],
  samples: number,
  color: string,
) => {
  if (!evaluator) return []
  const [start, end] = xRange
  const step = (end - start) / samples

  const x: number[] = []
  const y: number[] = []

  for (let i = 0; i <= samples; i++) {
    const xVal = start + step * i
    let yVal: number
    try {
      yVal = evaluator(xVal)
    } catch {
      continue
    }
    if (!Number.isFinite(yVal)) continue
    x.push(xVal)
    y.push(yVal)
  }

  if (x.length === 0) return []

  return [
    {
      x,
      y,
      type: 'scatter' as const,
      mode: 'lines',
      line: { color, width: 3 },
      hovertemplate: 'x=%{x:.3f}<br>y=%{y:.3f}<extra></extra>',
      name: 'y(x)',
    },
  ]
}

const buildSlopeFieldData = (
  evaluator: ((x: number, y: number) => number) | undefined,
  xRange: [number, number],
  yRange: [number, number],
  gridSize: number,
  segmentLength: number,
  color: string,
) => {
  if (!evaluator) return []

  const [x0, x1] = xRange
  const [y0, y1] = yRange
  const dx = (x1 - x0) / gridSize
  const dy = (y1 - y0) / gridSize
  const scale = segmentLength || Math.min(dx, dy) * 0.55

  const xs: number[] = []
  const ys: number[] = []

  for (let i = 0; i <= gridSize; i++) {
    for (let j = 0; j <= gridSize; j++) {
      const x = x0 + dx * i
      const y = y0 + dy * j
      let slope: number

      try {
        slope = evaluator(x, y)
      } catch {
        continue
      }
      if (!Number.isFinite(slope)) continue

      const norm = 1 / Math.sqrt(1 + slope * slope)
      const segDx = scale * norm
      const segDy = scale * slope * norm

      xs.push(x - segDx, x + segDx, NaN)
      ys.push(y - segDy, y + segDy, NaN)
    }
  }

  if (xs.length === 0) return []

  return [
    {
      x: xs,
      y: ys,
      type: 'scattergl' as const,
      mode: 'lines',
      line: { color, width: 2 },
      hoverinfo: 'skip',
      name: 'slope field',
    },
  ]
}

const buildSurfaceData = (
  evaluator: ((x: number, y: number) => number) | undefined,
  xRange: [number, number],
  yRange: [number, number],
  gridSize: number,
) => {
  if (!evaluator) return []

  const [x0, x1] = xRange
  const [y0, y1] = yRange
  const xs = Array.from({ length: gridSize + 1 }, (_, i) => x0 + ((x1 - x0) * i) / gridSize)
  const ys = Array.from({ length: gridSize + 1 }, (_, i) => y0 + ((y1 - y0) * i) / gridSize)
  const z: (number | null)[][] = []

  for (const y of ys) {
    const row: (number | null)[] = []
    for (const x of xs) {
      try {
        const val = evaluator(x, y)
        row.push(Number.isFinite(val) ? val : null)
      } catch {
        row.push(null)
      }
    }
    z.push(row)
  }

  const hasAny = z.some((row) => row.some((val) => val !== null))
  if (!hasAny) return []

  return [
    {
      type: 'surface' as const,
      x: xs,
      y: ys,
      z,
      colorscale: 'Teal',
      showscale: false,
      hovertemplate: 'x=%{x:.3f}<br>y=%{y:.3f}<br>z=%{z:.3f}<extra></extra>',
      opacity: 0.9,
    },
  ]
}

/**
 * EquationPlot
 *
 * Usage:
 * <EquationPlot
 *   title="Example 6:"
 *   equation="y = C*e^{-2x}"
 *   description="C = 1 shown"
 *   expression="C * exp(-2 * x)"
 *   params={{ C: 1 }}
 *   xRange={[0, 3]}
 *   samples={240}
 * />
 */
export default function EquationPlot(props: EquationPlotProps) {
  const {
    title,
    equation,
    description,
    expression,
    params = {},
    fn,
    mode = 'line',
    xRange = defaultRanges.x,
    yRange = defaultRanges.y,
    samples,
    gridSize = 18,
    segmentLength,
    xLabel = 'x',
    yLabel = 'y',
    zLabel = 'z',
    xSampleRange,
    ySampleRange,
    samplePadding = 0.35,
    zRange,
    className = '',
    color = '#0ea5e9',
  } = props

  // --- LaTeX rendering (KaTeX) ---
  // This dynamically imports katex if you have it installed:
  //   npm i katex
  // and include its CSS globally once (recommended):
  //   import 'katex/dist/katex.min.css'
  const latexHtml = useMemo(() => {
    if (!equation) return null
    // If katex isn't installed, just fall back to plain text.
    // (We avoid throwing to keep the component robust.)
    return { __html: '' } as { __html: string }
  }, [equation])

  useEffect(() => {
    let cancelled = false
    if (!equation) return
    ;(async () => {
      try {
        const { default: katex } = await import('katex')
        if (cancelled) return
        const html = katex.renderToString(equation, {
          throwOnError: false,
          displayMode: false,
          strict: 'ignore',
        })
        // store via DOM write (simple & avoids adding state)
        const el = document.querySelector('[data-equation-latex="1"]') as HTMLSpanElement | null
        if (el) el.innerHTML = html
      } catch {
        // no katex: fallback to plain text (handled in render)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [equation])

  const compiled = useMemo(() => {
    if (!expression) return undefined
    try {
      return math.compile(expression)
    } catch (error) {
      console.error('[EquationPlot] Failed to compile expression:', error)
      return undefined
    }
  }, [expression])

  const lineEvaluator = useMemo(() => {
    if (typeof fn === 'function') return fn
    if (!compiled) return undefined
    return (x: number) => compiled.evaluate({ x, ...params })
  }, [compiled, fn, params])

  const fieldEvaluator = useMemo(() => {
    if (!compiled) return undefined
    return (x: number, y: number) => compiled.evaluate({ x, y, ...params })
  }, [compiled, params])

  const data = useMemo(() => {
    const xEvalRange = xSampleRange ?? expandRange(xRange, samplePadding)
    const yEvalRange = ySampleRange ?? expandRange(yRange, samplePadding)

    switch (mode) {
      case 'slope':
        return buildSlopeFieldData(
          fieldEvaluator,
          xEvalRange,
          yEvalRange,
          clamp(gridSize, 8, 42),
          segmentLength ?? 0,
          color,
        )
      case 'surface':
        return buildSurfaceData(fieldEvaluator, xEvalRange, yEvalRange, clamp(gridSize, 10, 60))
      case 'line':
      default:
        return buildLineData(lineEvaluator, xEvalRange, clampSamples(samples), color)
    }
  }, [
    fieldEvaluator,
    lineEvaluator,
    mode,
    xRange,
    yRange,
    xSampleRange,
    ySampleRange,
    samplePadding,
    gridSize,
    segmentLength,
    samples,
    color,
  ])

  const hasData = data.length > 0

  const layout = useMemo(() => {
    const base = {
      autosize: true,
      margin: { l: 44, r: 24, t: 20, b: 44 },
      paper_bgcolor: 'rgba(255,255,255,0)',
      plot_bgcolor: 'rgba(255,255,255,0)',
      font: { family: 'var(--font-sans, Inter)', color: '#334155' },
      showlegend: false,
    }

    if (mode === 'surface') {
      return {
        ...base,
        scene: {
          xaxis: { title: xLabel, zerolinecolor: '#e2e8f0', gridcolor: '#e2e8f0', autorange: true },
          yaxis: { title: yLabel, zerolinecolor: '#e2e8f0', gridcolor: '#e2e8f0', autorange: true },
          zaxis: { title: zLabel, zerolinecolor: '#e2e8f0', gridcolor: '#e2e8f0', autorange: true },
          camera: { eye: { x: 1.35, y: 1.15, z: 0.9 } },
        },
      }
    }

    return {
      ...base,
      xaxis: {
        title: xLabel,
        // range: xRange,
        autorange: true,
        zeroline: true,
        zerolinecolor: '#e2e8f0',
        gridcolor: '#e2e8f0',
        linecolor: '#94a3b8',
        mirror: true,
      },
      yaxis: {
        title: yLabel,
        // range: yRange,
        autorange: true,
        zeroline: true,
        zerolinecolor: '#e2e8f0',
        gridcolor: '#e2e8f0',
        linecolor: '#94a3b8',
        mirror: true,
      },
    }
  }, [mode, xLabel, yLabel, zLabel, xRange, yRange, zRange])


const plotConfig = useMemo(
  () => ({
    displaylogo: false,
    responsive: true,
    scrollZoom: true,
    displayModeBar: 'hover' as const,

    // double click should autoscale (autorange)
    doubleClick: 'autosize' as const,

    // ONE single group => one toolbar row
    modeBarButtons: [
      [
        'zoom2d',
        'pan2d',
        'autoScale2d', // keep if you want the autoscale button visible
      ],
    ] as any,
  }),
  [],
)



  const plotRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    const el = plotRef.current
    if (!el) return

    if (!hasData) {
      el.innerHTML = ''
      return
    }

    plotlyLoader
      .then(({ default: Plotly }) => {
        if (cancelled || !el) return
       return Plotly.react(el, data as any, layout as any, plotConfig as any).then(() => {
          // On first render, start in autorange (autoscaled) mode instead of "home range"
          return Plotly.relayout(el, {
            'xaxis.autorange': true,
            'yaxis.autorange': true,
          })
        })      
      })
      .catch((error) => {
        console.error('[EquationPlot] Failed to render plot:', error)
      })

    return () => {
      cancelled = true
      if (!el) return
      plotlyLoader
        .then(({ default: Plotly }) => {
          Plotly.purge(el)
        })
        .catch(() => {
          /* ignore */
        })
    }
  }, [data, layout, plotConfig, hasData])

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100/60 p-5 shadow-md ring-1 ring-slate-100 backdrop-blur dark:border-slate-800 dark:from-slate-900 dark:via-slate-900/70 dark:to-slate-950/40 dark:ring-slate-900/50 ${className}`}
    >
      {/* Plotly modebar styling to match your cleaner look */}
      <style>{`
  .plotly-host .modebar {
    top: 12px !important;
    right: 12px !important;
    left: auto !important;
    bottom: auto !important;

    background: transparent !important;

    display: flex !important;
    flex-wrap: nowrap !important;       /* key: never wrap into multiple “stacks” */
    gap: 0 !important;
  }

  /* One rectangle container (small rounding) */
  .plotly-host .modebar-group {
    background: rgba(255,255,255,0.86) !important;
    border-radius: 10px !important;     /* small rounded rectangle */
    padding: 6px 6px !important;
    box-shadow: 0 8px 24px rgba(0,0,0,0.10) !important;

    display: flex !important;
    flex-wrap: nowrap !important;       /* keep icons in one row */
    align-items: center !important;
    column-gap: 2px !important;
  }

  /* Make buttons less “pill” */
  .plotly-host .modebar-btn {
    border-radius: 6px !important;
  }

  .dark .plotly-host .modebar-group {
    background: rgba(15,23,42,0.62) !important;
    box-shadow: 0 12px 30px rgba(0,0,0,0.38) !important;
  }
`}</style>


      {/* Compact header row */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {(title || equation) && (
            <div className="flex flex-wrap items-center gap-2">
              {title && (
                <span className="text-base font-semibold text-slate-900 dark:text-slate-50">
                  {title}
                </span>
              )}

              {equation ? (
                // KaTeX target. If KaTeX is not installed, we show plaintext fallback below.
                <span
                  data-equation-latex="1"
                  className="text-base font-semibold text-slate-900 dark:text-slate-50"
                  // initial content: fallback plaintext so it never flashes empty
                  dangerouslySetInnerHTML={
                    latexHtml && latexHtml.__html
                      ? latexHtml
                      : { __html: equation.replace(/</g, '&lt;').replace(/>/g, '&gt;') }
                  }
                />
              ) : null}
            </div>
          )}

          {/* {expression && (
            <code className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {mode === 'line'
                ? `y = ${expression}`
                : mode === 'surface'
                  ? `z = ${expression}`
                  : `y' = ${expression}`}
            </code>
          )} */}

          {description && (
            <span className="rounded-md bg-white/70 px-2 py-1 text-[11px] font-medium shadow-sm ring-1 ring-slate-200 dark:bg-slate-900/60 dark:ring-slate-800">
              {description}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800/70 dark:text-slate-200">
            {mode === 'line' ? 'Line' : mode === 'slope' ? 'Slope field' : '3D Surface'}
          </span>
          <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-medium text-sky-700 dark:bg-sky-900/50 dark:text-sky-200">
            x∈[{xRange[0]}, {xRange[1]}]
          </span>
          {mode !== 'surface' ? (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200">
              y∈[{yRange[0]}, {yRange[1]}]
            </span>
          ) : (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200">
              z∈[{zRange?.[0] ?? 'auto'}, {zRange?.[1] ?? 'auto'}]
            </span>
          )}
        </div>
      </div>

      {/* Plot container */}
      <div
        className={`relative ${
          mode === 'surface' ? 'h-80 w-full sm:h-96' : 'h-64 w-full sm:h-72'
        } rounded-xl border border-slate-100 bg-white/70 p-3 shadow-inner dark:border-slate-800/70 dark:bg-slate-900/70`}
      >
        {hasData ? (
          <div ref={plotRef} className="plotly-host h-full w-full rounded-lg" />
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
            Unable to plot: the expression produced no finite values over the provided range.
          </div>
        )}
      </div>
    </div>
  )
}
