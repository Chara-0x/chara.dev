declare module 'react-plotly.js/factory' {
  import type { ComponentType } from 'react'
  import type { Plotly } from 'plotly.js-dist-min'
  import type { PlotParams } from 'react-plotly.js'

  export default function createPlotlyComponent(plotly: Plotly): ComponentType<PlotParams>
}
