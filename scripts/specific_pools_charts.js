/**
 * Specific Pools Charts Module
 * 
 * This module fetches and analyzes data for specific DeFi pools (USDC and USDT),
 * creating visualizations comparing:
 * - 7-day moving average APY trends
 * - Ethereum price movements
 */

const SpecificPoolsCharts = (function() {
    'use strict';
    
    // Configuration
    const CONFIG = {
        poolIds: {
            USDC: 'aa70268e-4b52-42bf-a116-608b370f9501',
            USDT: 'f981a304-bb6c-45b8-b0c5-fd2f515ad23a'
        },
        poolNames: {
            'aa70268e-4b52-42bf-a116-608b370f9501': 'USDC',
            'f981a304-bb6c-45b8-b0c5-fd2f515ad23a': 'USDT'
        },
        defiLlamaUrl: 'https://yields.llama.fi/chart/',
        polygonApiKey: '', // Set this via initialize() or update directly
        logoUrl: 'https://512m-io.github.io/live_analytics/512m_logo.png',
        defaultDays: 700
    };
    
    /**
     * Fetch pool data from DeFiLlama
     */
    async function fetchPoolData(poolId, days = CONFIG.defaultDays) {
        const url = `${CONFIG.defiLlamaUrl}${poolId}`;
        const response = await PlotlyCommon.fetchWithRetry(url);
        
        if (!response || !response.data || !response.data.length) {
            throw new Error(`No data available for pool ${poolId}`);
        }
        
        // Process data - convert to date/value pairs
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);
        
        const processedData = response.data
            .filter(item => new Date(item.timestamp) >= startDate)
            .map(item => ({
                date: new Date(item.timestamp),
                apy: item.apy || 0,
                tvl: item.tvlUsd || 0
            }))
            .sort((a, b) => a.date - b.date);
        
        return processedData;
    }
    
    /**
     * Fetch Ethereum price data from Polygon.io
     */
    async function fetchEthereumPrice(startDate, endDate, apiKey) {
        if (!apiKey) {
            throw new Error('Polygon API key is required for Ethereum price data');
        }
        
        const symbol = 'X:ETHUSD';
        const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/1/day/${startDate}/${endDate}?adjusted=true&sort=asc&apiKey=${apiKey}`;
        
        const response = await PlotlyCommon.fetchWithRetry(url);
        
        if (!response || response.status !== 'OK' || !response.results) {
            throw new Error('Failed to fetch Ethereum price data');
        }
        
        return response.results.map(item => ({
            date: new Date(item.t),
            close: item.c,
            open: item.o,
            high: item.h,
            low: item.l,
            volume: item.v
        }));
    }
    
    /**
     * Create pool APY trends and Ethereum price chart
     */
    async function createPoolAPYTrends(containerId, apiKey) {
        PlotlyCommon.showLoading(containerId);
        
        try {
            // Fetch pool data for both USDC and USDT
            const [usdcData, usdtData] = await Promise.all([
                fetchPoolData(CONFIG.poolIds.USDC, CONFIG.defaultDays),
                fetchPoolData(CONFIG.poolIds.USDT, CONFIG.defaultDays)
            ]);
            
            // Calculate 7-day moving averages
            const usdcMA = calculateMovingAverage(usdcData, 7);
            const usdtMA = calculateMovingAverage(usdtData, 7);
            
            // Try to fetch Ethereum price if API key is available
            let ethData = null;
            if (apiKey || CONFIG.polygonApiKey) {
                try {
                    const endDate = new Date();
                    const startDate = new Date();
                    startDate.setDate(endDate.getDate() - CONFIG.defaultDays);
                    
                    ethData = await fetchEthereumPrice(
                        startDate.toISOString().split('T')[0],
                        endDate.toISOString().split('T')[0],
                        apiKey || CONFIG.polygonApiKey
                    );
                } catch (error) {
                    console.error('Failed to fetch Ethereum price:', error);
                }
            }
            
            // Create traces
            const traces = [
                // USDC 7-day MA
                {
                    x: usdcMA.dates,
                    y: usdcMA.values,
                    type: 'scatter',
                    mode: 'lines',
                    name: 'USDC',
                    line: { 
                        color: PlotlyCommon.MUTED_BLUES[0], 
                        width: 2 
                    },
                    opacity: 0.8,
                    hovertemplate: '<b>USDC</b><br>Date: %{x|%Y-%m-%d}<br>APY: %{y:.4f}%<extra></extra>',
                    xaxis: 'x',
                    yaxis: 'y'
                },
                // USDT 7-day MA
                {
                    x: usdtMA.dates,
                    y: usdtMA.values,
                    type: 'scatter',
                    mode: 'lines',
                    name: 'USDT',
                    line: { 
                        color: PlotlyCommon.MUTED_BLUES[2], 
                        width: 2 
                    },
                    opacity: 0.8,
                    hovertemplate: '<b>USDT</b><br>Date: %{x|%Y-%m-%d}<br>APY: %{y:.4f}%<extra></extra>',
                    xaxis: 'x',
                    yaxis: 'y'
                }
            ];
            
            // Add Ethereum price if available
            if (ethData && ethData.length > 0) {
                traces.push({
                    x: ethData.map(d => d.date),
                    y: ethData.map(d => d.close),
                    type: 'scatter',
                    mode: 'lines',
                    name: 'ETH Price',
                    line: { 
                        color: PlotlyCommon.THEME_PALETTE[3], 
                        width: 2 
                    },
                    opacity: 0.8,
                    hovertemplate: '<b>ETH Price</b><br>Date: %{x|%Y-%m-%d}<br>Price: $%{y:,.2f}<extra></extra>',
                    xaxis: 'x2',
                    yaxis: 'y2'
                });
            }
            
            // Create layout
            const hasEthData = ethData && ethData.length > 0;
            const layout = {
                ...PlotlyCommon.getBaseLayout(),
                title: {
                    text: 'AAVE V3 Pool APY Analysis',
                    x: 0.5,
                    font: { family: 'serif', size: 16, color: '#333' }
                },
                grid: hasEthData ? { 
                    rows: 2, 
                    columns: 1, 
                    pattern: 'independent',
                    subplots: [['xy'], ['x2y2']]
                } : undefined,
                // First subplot - APY trends
                xaxis: {
                    ...PlotlyCommon.getAxisStyle(hasEthData ? '' : 'Date'),
                    ...PlotlyCommon.getDateFormat(),
                    domain: hasEthData ? [0, 1] : undefined
                },
                yaxis: {
                    ...PlotlyCommon.getAxisStyle('APY (%)'),
                    domain: hasEthData ? [0.52, 1] : undefined,
                    title: { 
                        text: '7-Day Moving Average APY on AAVE V3', 
                        font: { family: 'serif', size: 11 } 
                    }
                },
                annotations: []
            };
            
            // Add second subplot if ETH data is available
            if (hasEthData) {
                layout.xaxis2 = {
                    ...PlotlyCommon.getAxisStyle('Date'),
                    ...PlotlyCommon.getDateFormat(),
                    domain: [0, 1]
                };
                layout.yaxis2 = {
                    ...PlotlyCommon.getAxisStyle('Price (USD)'),
                    domain: [0, 0.48],
                    anchor: 'x2',
                    title: { 
                        text: 'Ethereum Price (USD)', 
                        font: { family: 'serif', size: 11 } 
                    }
                };
                
                layout.annotations = [
                    {
                        text: '7-Day Moving Average APY',
                        xref: 'paper',
                        yref: 'paper',
                        x: 0.5,
                        y: 0.98,
                        showarrow: false,
                        font: { size: 12, family: 'serif' }
                    },
                    {
                        text: 'Ethereum Price',
                        xref: 'paper',
                        yref: 'paper',
                        x: 0.5,
                        y: 0.48,
                        showarrow: false,
                        font: { size: 12, family: 'serif' }
                    }
                ];
                
                layout.images = [
                    { ...PlotlyCommon.getLogoImage(CONFIG.logoUrl), y: 0.76, sizex: 0.2, sizey: 0.15, opacity: 0.05 },
                    { ...PlotlyCommon.getLogoImage(CONFIG.logoUrl), y: 0.24, sizex: 0.2, sizey: 0.15, opacity: 0.05 }
                ];
            } else {
                layout.images = [PlotlyCommon.getLogoImage(CONFIG.logoUrl)];
                
                // Add note about missing ETH data
                if (!apiKey && !CONFIG.polygonApiKey) {
                    layout.annotations.push({
                        text: 'Note: Ethereum price data requires a Polygon API key',
                        xref: 'paper',
                        yref: 'paper',
                        x: 0.5,
                        y: -0.15,
                        showarrow: false,
                        font: { size: 10, family: 'serif', color: '#666' }
                    });
                }
            }
            
            const config = {
                ...PlotlyCommon.getConfig(),
                toImageButtonOptions: {
                    ...PlotlyCommon.getConfig().toImageButtonOptions,
                    filename: 'aave_pool_apy_analysis',
                    height: hasEthData ? 800 : 600
                }
            };
            
            Plotly.newPlot(containerId, traces, layout, config);
            
            // Display summary statistics
            displayPoolStats(containerId, usdcData, usdtData, ethData);
            
        } catch (error) {
            PlotlyCommon.showError(containerId, 'Failed to load pool APY trends');
            console.error('Pool APY trends error:', error);
        }
    }
    
    // Calculate moving average
    function calculateMovingAverage(data, window) {
        const values = data.map(d => d.apy);
        const maValues = PlotlyCommon.movingAverage(values, window);
        
        return {
            dates: data.map(d => d.date),
            values: maValues
        };
    }
    
    // Display summary statistics
    function displayPoolStats(containerId, usdcData, usdtData, ethData) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        // Calculate statistics
        const usdcCurrent = usdcData[usdcData.length - 1];
        const usdtCurrent = usdtData[usdtData.length - 1];
        
        const usdcApyValues = usdcData.map(d => d.apy);
        const usdtApyValues = usdtData.map(d => d.apy);
        
        const usdcMean = usdcApyValues.reduce((a, b) => a + b, 0) / usdcApyValues.length;
        const usdtMean = usdtApyValues.reduce((a, b) => a + b, 0) / usdtApyValues.length;
        
        let ethStats = '';
        if (ethData && ethData.length > 0) {
            const ethCurrent = ethData[ethData.length - 1];
            const ethStart = ethData[0];
            const ethChange = ((ethCurrent.close - ethStart.close) / ethStart.close) * 100;
            
            ethStats = `
                <div>
                    <strong>Ethereum Price:</strong><br>
                    Current: $${ethCurrent.close.toFixed(2)}<br>
                    Period Change: ${ethChange > 0 ? '+' : ''}${ethChange.toFixed(2)}%<br>
                    Period High: $${Math.max(...ethData.map(d => d.high)).toFixed(2)}
                </div>
            `;
        }
        
        const statsHtml = `
            <div style="margin-top: 20px; padding: 15px; background: ${PlotlyCommon.THEME_PALETTE[0]}; 
                        border: 1px solid #ddd; border-radius: 8px; font-family: serif;">
                <h4 style="margin: 0 0 10px 0; color: #333;">Pool Statistics</h4>
                <div style="display: grid; grid-template-columns: repeat(${ethData ? 3 : 2}, 1fr); gap: 15px;">
                    <div>
                        <strong>USDC Pool:</strong><br>
                        Current APY: ${usdcCurrent.apy.toFixed(4)}%<br>
                        Mean APY: ${usdcMean.toFixed(4)}%<br>
                        Current TVL: ${PlotlyCommon.formatTVL(usdcCurrent.tvl)}
                    </div>
                    <div>
                        <strong>USDT Pool:</strong><br>
                        Current APY: ${usdtCurrent.apy.toFixed(4)}%<br>
                        Mean APY: ${usdtMean.toFixed(4)}%<br>
                        Current TVL: ${PlotlyCommon.formatTVL(usdtCurrent.tvl)}
                    </div>
                    ${ethStats}
                </div>
                <div style="margin-top: 10px; font-size: 11px; color: #666;">
                    Data Period: ${usdcData[0].date.toLocaleDateString()} - ${usdcCurrent.date.toLocaleDateString()} 
                    (${usdcData.length} days)
                </div>
            </div>
        `;
        
        // Insert stats after the chart
        const statsDiv = document.createElement('div');
        statsDiv.innerHTML = statsHtml;
        container.appendChild(statsDiv);
    }
    
    // Initialize
    function initialize(config = {}) {
        const { 
            containerId = 'specific-pools-chart',
            apiKey 
        } = config;
        
        if (apiKey) {
            CONFIG.polygonApiKey = apiKey;
        }
        
        createPoolAPYTrends(containerId, apiKey);
    }
    
    // Export public API
    return {
        createPoolAPYTrends,
        initialize,
        CONFIG
    };
})();

// Make it available globally
window.SpecificPoolsCharts = SpecificPoolsCharts;