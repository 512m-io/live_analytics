/**
 * Market Correlation Analysis Charts Module
 * 
 * This module performs comprehensive correlation analysis between different assets
 * (Bitcoin, Ethereum, S&P 500) and creates:
 * - Correlation heatmaps
 * - Beta line plots
 */

const CorrAnalysisCharts = (function() {
    'use strict';
    
    // Configuration
    const CONFIG = {
        polygonApiKey: '', // Set this via initialize() or update directly
        logoUrl: 'https://512m-io.github.io/live_analytics/512m_logo.png',
        symbols: {
            BTC: 'X:BTCUSD',
            ETH: 'X:ETHUSD',
            SPY: 'SPY'
        },
        defaultDays: 730
    };
    
    /**
     * Fetch market data from Polygon.io
     */
    async function fetchMarketData(symbol, startDate, endDate, apiKey) {
        const mappedSymbol = CONFIG.symbols[symbol] || symbol;
        const url = `https://api.polygon.io/v2/aggs/ticker/${mappedSymbol}/range/1/day/${startDate}/${endDate}?adjusted=true&sort=asc&apiKey=${apiKey}`;
        
        const response = await PlotlyCommon.fetchWithRetry(url);
        
        if (!response || response.status !== 'OK' || !response.results) {
            throw new Error(`Failed to fetch data for ${symbol}`);
        }
        
        return response.results.map(item => ({
            date: new Date(item.t),
            open: item.o,
            high: item.h,
            low: item.l,
            close: item.c,
            volume: item.v
        }));
    }
    
    /**
     * Create correlation heatmaps
     */
    async function createCorrelationHeatmaps(containerId, apiKey) {
        PlotlyCommon.showLoading(containerId);
        
        try {
            if (!apiKey && !CONFIG.polygonApiKey) {
                throw new Error('Polygon API key is required');
            }
            
            const key = apiKey || CONFIG.polygonApiKey;
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - CONFIG.defaultDays);
            
            // Fetch all market data
            const [btcData, ethData, spyData] = await Promise.all([
                fetchMarketData('BTC', startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0], key),
                fetchMarketData('ETH', startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0], key),
                fetchMarketData('SPY', startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0], key)
            ]);
            
            // Align data by dates
            const alignedData = alignMarketData({ BTC: btcData, ETH: ethData, SPY: spyData });
            
            // Calculate returns
            const returns = calculateReturns(alignedData);
            
            // Define window sizes
            const windows = Array.from({length: 12}, (_, i) => 14 + i * 14); // 14 to 168 days
            
            // Calculate rolling correlations for last 360 days
            const plotDays = 360;
            const plotStartIdx = Math.max(0, returns.dates.length - plotDays);
            const plotData = {
                dates: returns.dates.slice(plotStartIdx),
                btc_spy: [],
                eth_spy: [],
                eth_btc: []
            };
            
            // Calculate correlation matrices for each window
            windows.forEach(window => {
                const btcSpyCorr = [];
                const ethSpyCorr = [];
                const ethBtcCorr = [];
                
                for (let i = plotStartIdx; i < returns.dates.length; i++) {
                    if (i >= window - 1) {
                        const btcWindow = returns.BTC.slice(i - window + 1, i + 1);
                        const ethWindow = returns.ETH.slice(i - window + 1, i + 1);
                        const spyWindow = returns.SPY.slice(i - window + 1, i + 1);
                        
                        btcSpyCorr.push(PlotlyCommon.calculateCorrelation(btcWindow, spyWindow));
                        ethSpyCorr.push(PlotlyCommon.calculateCorrelation(ethWindow, spyWindow));
                        ethBtcCorr.push(PlotlyCommon.calculateCorrelation(ethWindow, btcWindow));
                    } else {
                        btcSpyCorr.push(null);
                        ethSpyCorr.push(null);
                        ethBtcCorr.push(null);
                    }
                }
                
                plotData.btc_spy.push(btcSpyCorr);
                plotData.eth_spy.push(ethSpyCorr);
                plotData.eth_btc.push(ethBtcCorr);
            });
            
            // Create heatmaps
            const traces = [
                // Bitcoin-SPY heatmap
                {
                    z: plotData.btc_spy,
                    x: plotData.dates,
                    y: windows,
                    type: 'heatmap',
                    colorscale: 'RdBu',
                    zmin: -1,
                    zmax: 1,
                    colorbar: {
                        title: 'Correlation',
                        titleside: 'right',
                        x: 0.32
                    },
                    name: 'BTC-SPY',
                    hovertemplate: 'Date: %{x|%Y-%m-%d}<br>Window: %{y} days<br>Correlation: %{z:.3f}<extra></extra>',
                    xaxis: 'x',
                    yaxis: 'y'
                },
                // Ethereum-SPY heatmap
                {
                    z: plotData.eth_spy,
                    x: plotData.dates,
                    y: windows,
                    type: 'heatmap',
                    colorscale: 'RdBu',
                    zmin: -1,
                    zmax: 1,
                    colorbar: {
                        title: 'Correlation',
                        titleside: 'right',
                        x: 0.66
                    },
                    name: 'ETH-SPY',
                    hovertemplate: 'Date: %{x|%Y-%m-%d}<br>Window: %{y} days<br>Correlation: %{z:.3f}<extra></extra>',
                    xaxis: 'x2',
                    yaxis: 'y2'
                },
                // Ethereum-Bitcoin heatmap
                {
                    z: plotData.eth_btc,
                    x: plotData.dates,
                    y: windows,
                    type: 'heatmap',
                    colorscale: 'RdBu',
                    zmin: -1,
                    zmax: 1,
                    colorbar: {
                        title: 'Correlation',
                        titleside: 'right',
                        x: 1.0
                    },
                    name: 'ETH-BTC',
                    hovertemplate: 'Date: %{x|%Y-%m-%d}<br>Window: %{y} days<br>Correlation: %{z:.3f}<extra></extra>',
                    xaxis: 'x3',
                    yaxis: 'y3'
                }
            ];
            
            const layout = {
                ...PlotlyCommon.getBaseLayout('Market Correlation Analysis - Rolling Windows'),
                grid: { 
                    rows: 1, 
                    columns: 3, 
                    pattern: 'independent',
                    subplots: [['xy', 'x2y2', 'x3y3']]
                },
                // Bitcoin-SPY
                xaxis: {
                    ...PlotlyCommon.getAxisStyle('Date'),
                    domain: [0, 0.31],
                    tickformat: '%m-%d',
                    tickangle: -45,
                    nticks: 5
                },
                yaxis: {
                    ...PlotlyCommon.getAxisStyle('Window Size (days)'),
                    domain: [0, 0.9]
                },
                // Ethereum-SPY
                xaxis2: {
                    ...PlotlyCommon.getAxisStyle('Date'),
                    domain: [0.34, 0.65],
                    tickformat: '%m-%d',
                    tickangle: -45,
                    nticks: 5
                },
                yaxis2: {
                    ...PlotlyCommon.getAxisStyle('Window Size (days)'),
                    domain: [0, 0.9],
                    anchor: 'x2'
                },
                // Ethereum-Bitcoin
                xaxis3: {
                    ...PlotlyCommon.getAxisStyle('Date'),
                    domain: [0.68, 0.99],
                    tickformat: '%m-%d',
                    tickangle: -45,
                    nticks: 5
                },
                yaxis3: {
                    ...PlotlyCommon.getAxisStyle('Window Size (days)'),
                    domain: [0, 0.9],
                    anchor: 'x3'
                },
                annotations: [
                    {
                        text: 'Bitcoin-SPY Correlation',
                        xref: 'paper',
                        yref: 'paper',
                        x: 0.155,
                        y: 0.98,
                        showarrow: false,
                        font: { size: 12, family: 'serif' }
                    },
                    {
                        text: 'Ethereum-SPY Correlation',
                        xref: 'paper',
                        yref: 'paper',
                        x: 0.495,
                        y: 0.98,
                        showarrow: false,
                        font: { size: 12, family: 'serif' }
                    },
                    {
                        text: 'Ethereum-Bitcoin Correlation',
                        xref: 'paper',
                        yref: 'paper',
                        x: 0.835,
                        y: 0.98,
                        showarrow: false,
                        font: { size: 12, family: 'serif' }
                    }
                ],
                images: [
                    { ...PlotlyCommon.getLogoImage(CONFIG.logoUrl), x: 0.155, sizex: 0.15, sizey: 0.15, opacity: 0.05 },
                    { ...PlotlyCommon.getLogoImage(CONFIG.logoUrl), x: 0.495, sizex: 0.15, sizey: 0.15, opacity: 0.05 },
                    { ...PlotlyCommon.getLogoImage(CONFIG.logoUrl), x: 0.835, sizex: 0.15, sizey: 0.15, opacity: 0.05 }
                ]
            };
            
            const config = {
                ...PlotlyCommon.getConfig(),
                toImageButtonOptions: {
                    ...PlotlyCommon.getConfig().toImageButtonOptions,
                    filename: 'market_correlation_heatmaps',
                    height: 500,
                    width: 1400
                }
            };
            
            Plotly.newPlot(containerId, traces, layout, config);
            
        } catch (error) {
            PlotlyCommon.showError(containerId, 'Failed to load correlation heatmaps. Please check your API key.');
            console.error('Correlation heatmaps error:', error);
        }
    }
    
    /**
     * Create beta line plots
     */
    async function createBetaLinePlots(containerId, apiKey) {
        PlotlyCommon.showLoading(containerId);
        
        try {
            if (!apiKey && !CONFIG.polygonApiKey) {
                throw new Error('Polygon API key is required');
            }
            
            const key = apiKey || CONFIG.polygonApiKey;
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - CONFIG.defaultDays);
            
            // Fetch all market data
            const [btcData, ethData, spyData] = await Promise.all([
                fetchMarketData('BTC', startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0], key),
                fetchMarketData('ETH', startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0], key),
                fetchMarketData('SPY', startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0], key)
            ]);
            
            // Align data by dates
            const alignedData = alignMarketData({ BTC: btcData, ETH: ethData, SPY: spyData });
            
            // Calculate returns
            const returns = calculateReturns(alignedData);
            
            // Calculate beta series
            const betaData = {
                dates: returns.dates,
                btc_spy_30d: calculateBeta(returns.BTC, returns.SPY, 30),
                btc_spy_90d: calculateBeta(returns.BTC, returns.SPY, 90),
                btc_spy_180d: calculateBeta(returns.BTC, returns.SPY, 180),
                eth_spy_30d: calculateBeta(returns.ETH, returns.SPY, 30),
                eth_spy_90d: calculateBeta(returns.ETH, returns.SPY, 90),
                eth_spy_180d: calculateBeta(returns.ETH, returns.SPY, 180),
                eth_btc_30d: calculateBeta(returns.ETH, returns.BTC, 30),
                eth_btc_90d: calculateBeta(returns.ETH, returns.BTC, 90),
                eth_btc_180d: calculateBeta(returns.ETH, returns.BTC, 180)
            };
            
            const traces = [
                // Bitcoin-SPY betas
                {
                    x: betaData.dates,
                    y: betaData.btc_spy_30d,
                    type: 'scatter',
                    mode: 'lines',
                    name: '30-day',
                    line: { color: PlotlyCommon.MUTED_BLUES[0], width: 2 },
                    opacity: 0.3,
                    legendgroup: 'btc-spy',
                    xaxis: 'x',
                    yaxis: 'y'
                },
                {
                    x: betaData.dates,
                    y: betaData.btc_spy_90d,
                    type: 'scatter',
                    mode: 'lines',
                    name: '90-day',
                    line: { color: PlotlyCommon.MUTED_BLUES[2], width: 2 },
                    opacity: 0.6,
                    legendgroup: 'btc-spy',
                    xaxis: 'x',
                    yaxis: 'y'
                },
                {
                    x: betaData.dates,
                    y: betaData.btc_spy_180d,
                    type: 'scatter',
                    mode: 'lines',
                    name: '180-day',
                    line: { color: PlotlyCommon.MUTED_BLUES[1], width: 2 },
                    legendgroup: 'btc-spy',
                    xaxis: 'x',
                    yaxis: 'y'
                },
                // Ethereum-SPY betas
                {
                    x: betaData.dates,
                    y: betaData.eth_spy_30d,
                    type: 'scatter',
                    mode: 'lines',
                    name: '30-day',
                    line: { color: PlotlyCommon.MUTED_BLUES[0], width: 2 },
                    opacity: 0.3,
                    showlegend: false,
                    xaxis: 'x2',
                    yaxis: 'y2'
                },
                {
                    x: betaData.dates,
                    y: betaData.eth_spy_90d,
                    type: 'scatter',
                    mode: 'lines',
                    name: '90-day',
                    line: { color: PlotlyCommon.MUTED_BLUES[2], width: 2 },
                    opacity: 0.6,
                    showlegend: false,
                    xaxis: 'x2',
                    yaxis: 'y2'
                },
                {
                    x: betaData.dates,
                    y: betaData.eth_spy_180d,
                    type: 'scatter',
                    mode: 'lines',
                    name: '180-day',
                    line: { color: PlotlyCommon.MUTED_BLUES[1], width: 2 },
                    showlegend: false,
                    xaxis: 'x2',
                    yaxis: 'y2'
                },
                // Ethereum-Bitcoin betas
                {
                    x: betaData.dates,
                    y: betaData.eth_btc_30d,
                    type: 'scatter',
                    mode: 'lines',
                    name: '30-day',
                    line: { color: PlotlyCommon.MUTED_BLUES[0], width: 2 },
                    opacity: 0.3,
                    showlegend: false,
                    xaxis: 'x3',
                    yaxis: 'y3'
                },
                {
                    x: betaData.dates,
                    y: betaData.eth_btc_90d,
                    type: 'scatter',
                    mode: 'lines',
                    name: '90-day',
                    line: { color: PlotlyCommon.MUTED_BLUES[2], width: 2 },
                    opacity: 0.6,
                    showlegend: false,
                    xaxis: 'x3',
                    yaxis: 'y3'
                },
                {
                    x: betaData.dates,
                    y: betaData.eth_btc_180d,
                    type: 'scatter',
                    mode: 'lines',
                    name: '180-day',
                    line: { color: PlotlyCommon.MUTED_BLUES[1], width: 2 },
                    showlegend: false,
                    xaxis: 'x3',
                    yaxis: 'y3'
                },
                // Reference lines
                {
                    x: betaData.dates,
                    y: betaData.dates.map(() => 0),
                    type: 'scatter',
                    mode: 'lines',
                    line: { color: PlotlyCommon.THEME_PALETTE[3], width: 1, dash: 'dash' },
                    showlegend: false,
                    xaxis: 'x',
                    yaxis: 'y'
                },
                {
                    x: betaData.dates,
                    y: betaData.dates.map(() => 1),
                    type: 'scatter',
                    mode: 'lines',
                    name: 'Beta = 1',
                    line: { color: PlotlyCommon.THEME_PALETTE[2], width: 1, dash: 'dot' },
                    opacity: 0.5,
                    xaxis: 'x',
                    yaxis: 'y'
                },
                // Add reference lines for other subplots
                ...['x2', 'x3'].flatMap(xaxis => [
                    {
                        x: betaData.dates,
                        y: betaData.dates.map(() => 0),
                        type: 'scatter',
                        mode: 'lines',
                        line: { color: PlotlyCommon.THEME_PALETTE[3], width: 1, dash: 'dash' },
                        showlegend: false,
                        xaxis,
                        yaxis: xaxis.replace('x', 'y')
                    },
                    {
                        x: betaData.dates,
                        y: betaData.dates.map(() => 1),
                        type: 'scatter',
                        mode: 'lines',
                        line: { color: PlotlyCommon.THEME_PALETTE[2], width: 1, dash: 'dot' },
                        opacity: 0.5,
                        showlegend: false,
                        xaxis,
                        yaxis: xaxis.replace('x', 'y')
                    }
                ])
            ];
            
            const layout = {
                ...PlotlyCommon.getBaseLayout('Market Beta Analysis'),
                grid: { 
                    rows: 3, 
                    columns: 1, 
                    pattern: 'independent',
                    subplots: [['xy'], ['x2y2'], ['x3y3']]
                },
                xaxis: {
                    ...PlotlyCommon.getAxisStyle(''),
                    ...PlotlyCommon.getDateFormat(),
                    domain: [0, 1]
                },
                yaxis: {
                    ...PlotlyCommon.getAxisStyle('Beta Coefficient'),
                    domain: [0.7, 1],
                    title: { text: 'Bitcoin-SPY Beta', font: { family: 'serif', size: 11 } }
                },
                xaxis2: {
                    ...PlotlyCommon.getAxisStyle(''),
                    ...PlotlyCommon.getDateFormat(),
                    domain: [0, 1]
                },
                yaxis2: {
                    ...PlotlyCommon.getAxisStyle('Beta Coefficient'),
                    domain: [0.35, 0.65],
                    anchor: 'x2',
                    title: { text: 'Ethereum-SPY Beta', font: { family: 'serif', size: 11 } }
                },
                xaxis3: {
                    ...PlotlyCommon.getAxisStyle('Date'),
                    ...PlotlyCommon.getDateFormat(),
                    domain: [0, 1]
                },
                yaxis3: {
                    ...PlotlyCommon.getAxisStyle('Beta Coefficient'),
                    domain: [0, 0.3],
                    anchor: 'x3',
                    title: { text: 'Ethereum-Bitcoin Beta', font: { family: 'serif', size: 11 } }
                },
                images: [
                    { ...PlotlyCommon.getLogoImage(CONFIG.logoUrl), y: 0.85, sizex: 0.2, sizey: 0.1, opacity: 0.05 },
                    { ...PlotlyCommon.getLogoImage(CONFIG.logoUrl), y: 0.5, sizex: 0.2, sizey: 0.1, opacity: 0.05 },
                    { ...PlotlyCommon.getLogoImage(CONFIG.logoUrl), y: 0.15, sizex: 0.2, sizey: 0.1, opacity: 0.05 }
                ]
            };
            
            const config = {
                ...PlotlyCommon.getConfig(),
                toImageButtonOptions: {
                    ...PlotlyCommon.getConfig().toImageButtonOptions,
                    filename: 'market_beta_analysis',
                    height: 900
                }
            };
            
            Plotly.newPlot(containerId, traces, layout, config);
            
        } catch (error) {
            PlotlyCommon.showError(containerId, 'Failed to load beta plots. Please check your API key.');
            console.error('Beta plots error:', error);
        }
    }
    
    // Helper function to align market data
    function alignMarketData(data) {
        // Create date maps
        const dateMaps = {};
        Object.keys(data).forEach(symbol => {
            dateMaps[symbol] = new Map();
            data[symbol].forEach(item => {
                const dateStr = item.date.toISOString().split('T')[0];
                dateMaps[symbol].set(dateStr, item);
            });
        });
        
        // Find common dates
        const allDates = new Set();
        Object.values(dateMaps).forEach(map => {
            map.forEach((_, date) => allDates.add(date));
        });
        
        const commonDates = Array.from(allDates).filter(date => 
            Object.values(dateMaps).every(map => map.has(date))
        ).sort();
        
        // Create aligned dataset
        const result = {
            dates: [],
            BTC: [],
            ETH: [],
            SPY: []
        };
        
        commonDates.forEach(dateStr => {
            result.dates.push(new Date(dateStr));
            result.BTC.push(dateMaps.BTC.get(dateStr).close);
            result.ETH.push(dateMaps.ETH.get(dateStr).close);
            result.SPY.push(dateMaps.SPY.get(dateStr).close);
        });
        
        return result;
    }
    
    // Calculate returns
    function calculateReturns(data) {
        const returns = {
            dates: data.dates.slice(1),
            BTC: [],
            ETH: [],
            SPY: []
        };
        
        for (let i = 1; i < data.dates.length; i++) {
            returns.BTC.push((data.BTC[i] - data.BTC[i-1]) / data.BTC[i-1]);
            returns.ETH.push((data.ETH[i] - data.ETH[i-1]) / data.ETH[i-1]);
            returns.SPY.push((data.SPY[i] - data.SPY[i-1]) / data.SPY[i-1]);
        }
        
        return returns;
    }
    
    // Calculate beta
    function calculateBeta(dependent, independent, window) {
        const result = [];
        
        for (let i = 0; i < dependent.length; i++) {
            if (i < window - 1) {
                result.push(null);
            } else {
                const depWindow = dependent.slice(i - window + 1, i + 1);
                const indepWindow = independent.slice(i - window + 1, i + 1);
                
                const covariance = calculateCovariance(depWindow, indepWindow);
                const variance = calculateVariance(indepWindow);
                
                result.push(variance > 1e-10 ? covariance / variance : null);
            }
        }
        
        return result;
    }
    
    // Calculate covariance
    function calculateCovariance(x, y) {
        const n = x.length;
        const meanX = x.reduce((a, b) => a + b, 0) / n;
        const meanY = y.reduce((a, b) => a + b, 0) / n;
        
        let cov = 0;
        for (let i = 0; i < n; i++) {
            cov += (x[i] - meanX) * (y[i] - meanY);
        }
        
        return cov / n;
    }
    
    // Calculate variance
    function calculateVariance(x) {
        const n = x.length;
        const mean = x.reduce((a, b) => a + b, 0) / n;
        
        let variance = 0;
        for (let i = 0; i < n; i++) {
            variance += Math.pow(x[i] - mean, 2);
        }
        
        return variance / n;
    }
    
    // Initialize all charts
    function initializeAll(config = {}) {
        const {
            heatmapContainerId = 'correlation-heatmap-chart',
            betaContainerId = 'beta-line-chart',
            apiKey
        } = config;
        
        if (apiKey) {
            CONFIG.polygonApiKey = apiKey;
        }
        
        createCorrelationHeatmaps(heatmapContainerId, apiKey);
        createBetaLinePlots(betaContainerId, apiKey);
    }
    
    // Export public API
    return {
        createCorrelationHeatmaps,
        createBetaLinePlots,
        initializeAll,
        CONFIG
    };
})();

// Make it available globally
window.CorrAnalysisCharts = CorrAnalysisCharts;