const lcjs = require('@lightningchart/lcjs')
const { createProgressiveTraceGenerator } = require('@lightningchart/xydata')
const { lightningChart, Themes, AxisTickStrategies, emptyFill, PointLineAreaSeries, synchronizeAxisIntervals } = lcjs

const exampleContainer = document.getElementById('chart') || document.body
if (exampleContainer === document.body) {
    exampleContainer.style.width = '100vw'
    exampleContainer.style.height = '100vh'
    exampleContainer.style.margin = '0px'
}

const layout = document.createElement('div')
exampleContainer.append(layout)
layout.style.width = '100%'
layout.style.height = '100%'
layout.style.display = 'grid'
layout.style.gridTemplateColumns = 'repeat(2, 1fr)'
layout.style.gridTemplateRows = 'repeat(2, 1fr)'

const lc = lightningChart({
            resourcesBaseUrl: new URL(document.head.baseURI).origin + new URL(document.head.baseURI).pathname + 'resources/',
        })
const tStart = Date.now()
const charts = new Array(4).fill(0).map((_, i) => {
    const container = document.createElement('div')
    layout.append(container)
    const chart = lc
        .ChartXY({
            container,
            defaultAxisX: {
                type: 'linear-highPrecision',
            },
            theme: Themes[new URLSearchParams(window.location.search).get('theme') || 'darkGold'] || undefined,
        })
        .setTitle(`Chart #${i + 1}`)

    chart.axisX.setTickStrategy(AxisTickStrategies.DateTime)

    for (let iS = 0; iS < 2; iS++) {
        const series = chart.addPointLineAreaSeries({ dataPattern: 'ProgressiveX' }).setAreaFillStyle(emptyFill).setName(`Series ${iS + 1}`)
        createProgressiveTraceGenerator()
            .setNumberOfPoints(100_000)
            .generate()
            .toPromise()
            .then((data) => data.map((p) => ({ x: tStart + p.x * 60_000, y: p.y })))
            .then((data) => series.appendJSON(data))
    }

    // Disable built-in cursors and replace them with manually controlled cursors in order to synchronize them across charts
    chart.setCursorMode(undefined)
    const cursor = chart.addCursor()

    return { chart, cursor }
})

// Synchronize time axes of each chart
synchronizeAxisIntervals(...charts.map((chart) => chart.chart.axisX))

const hideCursor = () => {
    charts.forEach((chart) => chart.cursor.setVisible(false))
}
const displayCursorAt = (x) => {
    charts.forEach((chart) => {
        const solveResults = chart.chart
            .getSeries()
            // NOTE: Other series types don't currently have direct API syntax to solve nearest from axis coordinate - for them, you have to first translate axis coordinate to client coordinate and then use solve nearest
            .map((series) => series.getCursorEnabled() && series instanceof PointLineAreaSeries && series.solveNearest({ x, y: 0 }))
            .filter((solve) => !!solve)
        if (solveResults.length > 0) {
            chart.cursor
                .setVisible(true)
                .setPosition(...solveResults.map((solve) => solve.cursorPosition))
                .setResultTable((rt) => rt.setContent(chart.chart.getCursorFormatting()(chart.chart, solveResults[0], solveResults)))
        } else {
            chart.cursor.setVisible(false)
        }
    })
}

charts.forEach((chart) => {
    chart.chart.seriesBackground.addEventListener('pointermove', (event) =>
        displayCursorAt(chart.chart.translateCoordinate(event, chart.chart.coordsAxis).x),
    )
    chart.chart.getSeries().forEach((series) => series.addEventListener('pointermove', (event, info) => displayCursorAt(info.x)))
    chart.chart.seriesBackground.addEventListener('pointerleave', (event) => hideCursor())
})

setTimeout(() => {
    displayCursorAt(tStart + 50000 * 60_000)
}, 1000)
