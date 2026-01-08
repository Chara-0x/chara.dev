declare module 'react-plotly.js' {
  import type { ComponentType } from 'react'
  import type { Layout, Config, Data, Plotly } from 'plotly.js-dist-min'

  export interface PlotParams {
    data: Data[]
    layout?: Partial<Layout>
    config?: Partial<Config>
    useResizeHandler?: boolean
    style?: Partial<CSSStyleDeclaration>
    onInitialized?: (figure: { data: Data[]; layout: Layout; frames?: any }, graphDiv: any) => void
    onUpdate?: (figure: { data: Data[]; layout: Layout; frames?: any }, graphDiv: any) => void
  }

  const Plot: ComponentType<PlotParams>
  export default Plot

  export function factory(plotly: Plotly): ComponentType<PlotParams>
}
