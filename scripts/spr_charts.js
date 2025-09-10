/**
 * SPR (Stablecoin Prime Rate) Charts Module
 * 
 * This module creates visualizations for DeFi Prime Rate data including:
 * - Weighted APY trends (daily vs 14-day moving average)
 * - Pool contributions (bar chart and cumulative)
 * - Pool contributions over time (stacked area chart)
 */

const SPRCharts = (function() {
    'use strict';
    
    // Configuration URLs - Update these to match your data location
    const CONFIG = {
        dataUrl: 'https://512m-io.github.io/live_analytics/data/pool_data.json',
        metadataUrl: 'https://512m-io.github.io/live_analytics/data/pool_metadata.json',
        logoUrl: 'https://512m-io.github.io/live_analytics/512m_logo.png'
    };
    
    /**
     * Create weighted APY trends chart
     * Shows daily weighted APY vs 14-day moving average
     */
    async function createWeightedAPYTrends(containerId) {
        PlotlyCommon.showLoading(containerId);
        
        try {
            const response = await PlotlyCommon.fetchWithRetry(CONFIG.dataUrl);
            const poolData = response.pool_data;
            const extracted = PlotlyCommon.extractDataArrays(poolData);
            
            // Filter out null values
            const validIndices = extracted.data.weighted_apy
                .map((val, idx) => val !== null ? idx : null)
                .filter(idx => idx !== null);
            
            const dates = validIndices.map(i => extracted.dates[i]);
            const dailyAPY = validIndices.map(i => extracted.data.weighted_apy[i]);
            const maAPY = validIndices.map(i => extracted.data.ma_apy_14d[i]);
            
            const traces = [
                {
                    x: dates,
                    y: dailyAPY,
                    type: 'scatter',
                    mode: 'lines',
                    name: 'Daily Weighted APY',
                    line: {
                        color: PlotlyCommon.THEME_PALETTE[2],
                        width: 1.5
                    },
                    opacity: 0.6,
                    hovertemplate: '<b>Daily Weighted APY</b><br>' +
                                  'Date: %{x|%Y-%m-%d}<br>' +
                                  'APY: %{y:.4f}%<br>' +
                                  '<extra></extra>'
                },
                {
                    x: dates,
                    y: maAPY,
                    type: 'scatter',
                    mode: 'lines',
                    name: '14-Day Moving Average',
                    line: {
                        color: PlotlyCommon.THEME_PALETTE[3],
                        width: 2.5
                    },
                    hovertemplate: '<b>14-Day Moving Average</b><br>' +
                                  'Date: %{x|%Y-%m-%d}<br>' +
                                  'APY: %{y:.4f}%<br>' +
                                  '<extra></extra>'
                }
            ];
            
            const layout = {
                ...PlotlyCommon.getBaseLayout('Stablecoin Prime Rate: Daily vs 14-Day Moving Average'),
                xaxis: {
                    ...PlotlyCommon.getAxisStyle('Date'),
                    ...PlotlyCommon.getDateFormat()
                },
                yaxis: PlotlyCommon.getAxisStyle('SPR APY (%)'),
                hovermode: 'x unified',
                images: [PlotlyCommon.getLogoImage(CONFIG.logoUrl)]
            };
            
            Plotly.newPlot(containerId, traces, layout, PlotlyCommon.getConfig());
            
        } catch (error) {
            PlotlyCommon.showError(containerId, 'Failed to load weighted APY trends');
            console.error('Weighted APY trends error:', error);
        }
    }
    
    /**
     * Create pool contributions chart
     * Shows top 15 pools by contribution and cumulative contribution
     */
    async function createPoolContributions(containerId) {
        PlotlyCommon.showLoading(containerId);
        
        try {
            const [dataResponse, metadataResponse] = await Promise.all([
                PlotlyCommon.fetchWithRetry(CONFIG.dataUrl),
                PlotlyCommon.fetchWithRetry(CONFIG.metadataUrl)
            ]);
            
            const poolData = dataResponse.pool_data;
            const metadata = metadataResponse.pool_metadata;
            
            // Get the latest date
            const dates = Object.keys(poolData).sort();
            const latestDate = dates[dates.length - 1];
            const latestData = poolData[latestDate];
            
            // Calculate contributions
            const contributions = calculatePoolContributions(latestData, metadata);
            
            // Sort by contribution and take top 15
            contributions.sort((a, b) => b.contribution - a.contribution);
            const top15 = contributions.slice(0, 15);
            
            // Create two subplots
            const fig = {
                data: [
                    // Bar chart
                    {
                        x: top15.map((_, i) => i),
                        y: top15.map(p => p.contribution),
                        type: 'bar',
                        name: 'Contribution',
                        marker: {
                            color: top15.map((_, i) => PlotlyCommon.MUTED_BLUES[i % PlotlyCommon.MUTED_BLUES.length]),
                            opacity: 0.8
                        },
                        text: top15.map(p => p.displayName),
                        hovertemplate: '<b>%{text}</b><br>' +
                                      'Contribution: %{y:.2f}%<br>' +
                                      '<extra></extra>',
                        xaxis: 'x',
                        yaxis: 'y'
                    },
                    // Cumulative line
                    {
                        x: contributions.map((_, i) => i + 1),
                        y: contributions.map((_, i, arr) => 
                            arr.slice(0, i + 1).reduce((sum, p) => sum + p.contribution, 0)
                        ),
                        type: 'scatter',
                        mode: 'lines+markers',
                        name: 'Cumulative',
                        line: {
                            color: PlotlyCommon.MUTED_BLUES[2],
                            width: 2
                        },
                        marker: { size: 4 },
                        hovertemplate: 'Pools: %{x}<br>' +
                                      'Cumulative: %{y:.2f}%<br>' +
                                      '<extra></extra>',
                        xaxis: 'x2',
                        yaxis: 'y2'
                    }
                ],
                layout: {
                    ...PlotlyCommon.getBaseLayout(),
                    title: {
                        text: `Pool Contributions to Weighted APY (${latestDate})`,
                        x: 0.5,
                        font: { family: 'serif', size: 14, color: '#333' }
                    },
                    grid: { rows: 1, columns: 2, pattern: 'independent' },
                    xaxis: {
                        ...PlotlyCommon.getAxisStyle('Pool'),
                        domain: [0, 0.48],
                        tickmode: 'array',
                        tickvals: top15.map((_, i) => i),
                        ticktext: top15.map(p => p.shortName),
                        tickangle: -45
                    },
                    yaxis: {
                        ...PlotlyCommon.getAxisStyle('Contribution (%)'),
                        domain: [0, 1]
                    },
                    xaxis2: {
                        ...PlotlyCommon.getAxisStyle('Number of Pools'),
                        domain: [0.52, 1]
                    },
                    yaxis2: {
                        ...PlotlyCommon.getAxisStyle('Cumulative Contribution (%)'),
                        domain: [0, 1],
                        anchor: 'x2'
                    },
                    images: [
                        { ...PlotlyCommon.getLogoImage(CONFIG.logoUrl), x: 0.24 },
                        { ...PlotlyCommon.getLogoImage(CONFIG.logoUrl), x: 0.76 }
                    ],
                    showlegend: false
                }
            };
            
            Plotly.newPlot(containerId, fig.data, fig.layout, PlotlyCommon.getConfig());
            
        } catch (error) {
            PlotlyCommon.showError(containerId, 'Failed to load pool contributions');
            console.error('Pool contributions error:', error);
        }
    }
    
    /**
     * Create pool contributions over time chart
     * Shows stacked area chart of pool contributions
     */
    async function createPoolContributionsOverTime(containerId, topN = 7) {
        PlotlyCommon.showLoading(containerId);
        
        try {
            const [dataResponse, metadataResponse] = await Promise.all([
                PlotlyCommon.fetchWithRetry(CONFIG.dataUrl),
                PlotlyCommon.fetchWithRetry(CONFIG.metadataUrl)
            ]);
            
            const poolData = dataResponse.pool_data;
            const metadata = metadataResponse.pool_metadata;
            
            // Calculate contributions over time
            const dates = Object.keys(poolData).sort();
            const contributionsOverTime = {};
            
            // Get all pool names
            const allPoolNames = new Set();
            dates.forEach(date => {
                const data = poolData[date];
                Object.keys(data).forEach(key => {
                    if (key.startsWith('apy_Pool_')) {
                        const poolNum = key.replace('apy_Pool_', '');
                        allPoolNames.add(poolNum);
                    }
                });
            });
            
            // Calculate contributions for each pool over time
            allPoolNames.forEach(poolNum => {
                contributionsOverTime[poolNum] = dates.map(date => {
                    const data = poolData[date];
                    const apyKey = `apy_Pool_${poolNum}`;
                    const tvlKey = `tvlUsd_Pool_${poolNum}`;
                    
                    if (data[apyKey] !== null && data[tvlKey] !== null && data.weighted_apy !== null) {
                        const totalTvl = Object.keys(data)
                            .filter(k => k.startsWith('tvlUsd_'))
                            .reduce((sum, k) => sum + (data[k] || 0), 0);
                        
                        if (totalTvl > 0 && data.weighted_apy > 0) {
                            return (data[apyKey] * data[tvlKey]) / (data.weighted_apy * totalTvl) * 100;
                        }
                    }
                    return 0;
                });
            });
            
            // Find top N pools by average contribution
            const avgContributions = Object.entries(contributionsOverTime)
                .map(([poolNum, contributions]) => ({
                    poolNum,
                    avgContribution: contributions.reduce((a, b) => a + b, 0) / contributions.length
                }))
                .sort((a, b) => b.avgContribution - a.avgContribution);
            
            const topPools = avgContributions.slice(0, topN);
            
            // Create stacked area chart data
            const traces = [];
            const dateObjects = dates.map(d => new Date(d));
            
            // Add top pools in reverse order (so highest contributors are at top of stack)
            topPools.reverse().forEach((pool, idx) => {
                const displayName = PlotlyCommon.DISPLAY_POOL_NAMES[pool.poolNum] || `Pool_${pool.poolNum}`;
                traces.push({
                    x: dateObjects,
                    y: contributionsOverTime[pool.poolNum],
                    type: 'scatter',
                    mode: 'lines',
                    name: `${displayName} (${pool.avgContribution.toFixed(1)}%)`,
                    stackgroup: 'one',
                    fillcolor: PlotlyCommon.MUTED_BLUES[idx % PlotlyCommon.MUTED_BLUES.length],
                    line: { width: 0.5 },
                    hovertemplate: '<b>%{fullData.name}</b><br>' +
                                  'Date: %{x|%Y-%m-%d}<br>' +
                                  'Contribution: %{y:.2f}%<br>' +
                                  '<extra></extra>'
                });
            });
            
            // Add "Other pools" category
            const otherContributions = dates.map((_, dateIdx) => {
                const topTotal = topPools.reduce((sum, pool) => 
                    sum + contributionsOverTime[pool.poolNum][dateIdx], 0
                );
                return 100 - topTotal;
            });
            
            traces.push({
                x: dateObjects,
                y: otherContributions,
                type: 'scatter',
                mode: 'lines',
                name: 'Other Pools',
                stackgroup: 'one',
                fillcolor: PlotlyCommon.THEME_PALETTE[2],
                line: { width: 0.5 },
                hovertemplate: '<b>Other Pools</b><br>' +
                              'Date: %{x|%Y-%m-%d}<br>' +
                              'Contribution: %{y:.2f}%<br>' +
                              '<extra></extra>'
            });
            
            const layout = {
                ...PlotlyCommon.getBaseLayout('Pool Contributions to Stablecoin Prime Rate Over Time'),
                xaxis: {
                    ...PlotlyCommon.getAxisStyle('Date'),
                    ...PlotlyCommon.getDateFormat()
                },
                yaxis: {
                    ...PlotlyCommon.getAxisStyle('Contribution (%)'),
                    range: [0, 100]
                },
                hovermode: 'x unified',
                images: [PlotlyCommon.getLogoImage(CONFIG.logoUrl)]
            };
            
            Plotly.newPlot(containerId, traces, layout, PlotlyCommon.getConfig());
            
        } catch (error) {
            PlotlyCommon.showError(containerId, 'Failed to load pool contributions over time');
            console.error('Pool contributions over time error:', error);
        }
    }
    
    // Helper function to calculate pool contributions
    function calculatePoolContributions(latestData, metadata) {
        const contributions = [];
        const apyCols = Object.keys(latestData).filter(k => k.startsWith('apy_'));
        const tvlCols = Object.keys(latestData).filter(k => k.startsWith('tvlUsd_'));
        
        const totalTvl = tvlCols.reduce((sum, col) => sum + (latestData[col] || 0), 0);
        const totalWeightedSum = latestData.weighted_apy * totalTvl;
        
        apyCols.forEach((apyCol, i) => {
            const tvlCol = tvlCols[i];
            if (tvlCol && latestData[apyCol] !== null && latestData[tvlCol] !== null && latestData[tvlCol] > 0) {
                const contribution = (latestData[apyCol] * latestData[tvlCol]) / totalWeightedSum * 100;
                const poolNum = apyCol.replace('apy_Pool_', '');
                
                contributions.push({
                    poolNum,
                    contribution,
                    displayName: PlotlyCommon.DISPLAY_POOL_NAMES[poolNum] || `Pool ${poolNum}`,
                    shortName: PlotlyCommon.DISPLAY_POOL_NAMES[poolNum] ? 
                        PlotlyCommon.DISPLAY_POOL_NAMES[poolNum].split(' ')[0] : `P${poolNum}`,
                    apy: latestData[apyCol],
                    tvl: latestData[tvlCol]
                });
            }
        });
        
        return contributions;
    }
    
    // Initialize all SPR charts
    function initializeAll(config = {}) {
        const {
            trendsContainerId = 'spr-trends-chart',
            contributionsContainerId = 'spr-contributions-chart',
            timeSeriesContainerId = 'spr-timeseries-chart'
        } = config;
        
        // Create all charts
        createWeightedAPYTrends(trendsContainerId);
        createPoolContributions(contributionsContainerId);
        createPoolContributionsOverTime(timeSeriesContainerId);
    }
    
    // Export public API
    return {
        createWeightedAPYTrends,
        createPoolContributions,
        createPoolContributionsOverTime,
        initializeAll,
        CONFIG
    };
})();

// Make it available globally
window.SPRCharts = SPRCharts;