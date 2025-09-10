/**
 * yoUSD Correlation Analysis Charts Module
 * 
 * This module analyzes the correlation between yoUSD APY and the DeFi Prime Rate,
 * creating comprehensive visualizations including:
 * - Time series comparison
 * - Rolling correlation
 * - Rolling beta
 * - Scatter plot with trend line
 */

const YoUSDCharts = (function() {
    'use strict';
    
    // Configuration
    const CONFIG = {
        poolDataUrl: 'https://512m-io.github.io/live_analytics/data/pool_data.json',
        yoUSDPoolId: '1994cc35-a2b9-434e-b197-df6742fb5d81',
        yoUSDApiUrl: 'https://yields.llama.fi/chart/',
        logoUrl: 'https://512m-io.github.io/live_analytics/512m_logo.png'
    };
    
    /**
     * Fetch yoUSD pool data from DeFiLlama
     */
    async function fetchYoUSDData(days = 360) {
        const url = `${CONFIG.yoUSDApiUrl}${CONFIG.yoUSDPoolId}`;
        const response = await PlotlyCommon.fetchWithRetry(url);
        
        if (!response || !response.data || !response.data.length) {
            throw new Error('No yoUSD data available');
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
     * Create comprehensive 4-panel correlation analysis
     */
    async function createCorrelationAnalysis(containerId) {
        PlotlyCommon.showLoading(containerId);
        
        try {
            // Fetch both datasets
            const [sprResponse, yoUSDData] = await Promise.all([
                PlotlyCommon.fetchWithRetry(CONFIG.poolDataUrl),
                fetchYoUSDData(360)
            ]);
            
            const poolData = sprResponse.pool_data;
            const sprData = PlotlyCommon.extractDataArrays(poolData);
            
            // Align data by dates
            const alignedData = alignDatasets(sprData, yoUSDData);
            
            if (alignedData.dates.length < 30) {
                throw new Error('Insufficient data for correlation analysis');
            }
            
            // Calculate rolling metrics
            const rollingCorr = PlotlyCommon.rollingCorrelation(
                alignedData.yoUSD_apy, 
                alignedData.weighted_apy, 
                30
            );
            const rollingBeta = calculateRollingBeta(
                alignedData.yoUSD_apy, 
                alignedData.weighted_apy, 
                30
            );
            
            // Calculate trend line
            const trendData = calculateTrendLine(alignedData.weighted_apy, alignedData.yoUSD_apy);
            
            // Create subplots
            const fig = {
                data: [
                    // Time series comparison (top left)
                    {
                        x: alignedData.dates,
                        y: alignedData.yoUSD_apy,
                        type: 'scatter',
                        mode: 'lines',
                        name: 'yoUSD APY',
                        line: { color: PlotlyCommon.THEME_PALETTE[2], width: 1.5 },
                        opacity: 0.8,
                        xaxis: 'x',
                        yaxis: 'y'
                    },
                    {
                        x: alignedData.dates,
                        y: alignedData.weighted_apy,
                        type: 'scatter',
                        mode: 'lines',
                        name: 'SPR APY',
                        line: { color: PlotlyCommon.THEME_PALETTE[3], width: 2.5 },
                        xaxis: 'x',
                        yaxis: 'y'
                    },
                    // Scatter plot with trend line (top right)
                    {
                        x: alignedData.weighted_apy,
                        y: alignedData.yoUSD_apy,
                        type: 'scatter',
                        mode: 'markers',
                        name: 'Daily Values',
                        marker: { 
                            color: PlotlyCommon.THEME_PALETTE[2], 
                            size: 6,
                            opacity: 0.6 
                        },
                        xaxis: 'x2',
                        yaxis: 'y2'
                    },
                    {
                        x: trendData.x,
                        y: trendData.y,
                        type: 'scatter',
                        mode: 'lines',
                        name: `Trend: y = ${trendData.slope.toFixed(3)}x + ${trendData.intercept.toFixed(3)}`,
                        line: { 
                            color: PlotlyCommon.THEME_PALETTE[3], 
                            width: 2,
                            dash: 'dash'
                        },
                        xaxis: 'x2',
                        yaxis: 'y2'
                    },
                    // Rolling correlation (bottom left)
                    {
                        x: alignedData.dates,
                        y: rollingCorr,
                        type: 'scatter',
                        mode: 'lines',
                        name: '30-Day Correlation',
                        line: { color: PlotlyCommon.THEME_PALETTE[4], width: 2 },
                        xaxis: 'x3',
                        yaxis: 'y3'
                    },
                    // Rolling beta (bottom right)
                    {
                        x: alignedData.dates,
                        y: rollingBeta,
                        type: 'scatter',
                        mode: 'lines',
                        name: '30-Day Beta',
                        line: { color: PlotlyCommon.THEME_PALETTE[4], width: 2 },
                        xaxis: 'x4',
                        yaxis: 'y4'
                    },
                    // Add zero line for beta
                    {
                        x: alignedData.dates,
                        y: alignedData.dates.map(() => 0),
                        type: 'scatter',
                        mode: 'lines',
                        line: { color: 'black', width: 1, opacity: 0.3 },
                        showlegend: false,
                        xaxis: 'x4',
                        yaxis: 'y4'
                    }
                ],
                layout: {
                    ...PlotlyCommon.getBaseLayout(),
                    title: {
                        text: 'yoUSD vs Stablecoin Prime Rate - Comprehensive Analysis',
                        x: 0.5,
                        font: { family: 'serif', size: 16, color: '#333' }
                    },
                    grid: { 
                        rows: 2, 
                        columns: 2, 
                        pattern: 'independent',
                        subplots: [['xy', 'x2y2'], ['x3y3', 'x4y4']]
                    },
                    // Top left - Time series
                    xaxis: {
                        ...PlotlyCommon.getAxisStyle('Date'),
                        ...PlotlyCommon.getDateFormat(),
                        domain: [0, 0.48]
                    },
                    yaxis: {
                        ...PlotlyCommon.getAxisStyle('APY (%)'),
                        domain: [0.52, 1]
                    },
                    // Top right - Scatter
                    xaxis2: {
                        ...PlotlyCommon.getAxisStyle('Stablecoin Prime Rate (%)'),
                        domain: [0.52, 1]
                    },
                    yaxis2: {
                        ...PlotlyCommon.getAxisStyle('yoUSD APY (%)'),
                        domain: [0.52, 1],
                        anchor: 'x2'
                    },
                    // Bottom left - Correlation
                    xaxis3: {
                        ...PlotlyCommon.getAxisStyle('Date'),
                        ...PlotlyCommon.getDateFormat(),
                        domain: [0, 0.48]
                    },
                    yaxis3: {
                        ...PlotlyCommon.getAxisStyle('Correlation'),
                        domain: [0, 0.48],
                        anchor: 'x3'
                    },
                    // Bottom right - Beta
                    xaxis4: {
                        ...PlotlyCommon.getAxisStyle('Date'),
                        ...PlotlyCommon.getDateFormat(),
                        domain: [0.52, 1]
                    },
                    yaxis4: {
                        ...PlotlyCommon.getAxisStyle('Beta'),
                        domain: [0, 0.48],
                        anchor: 'x4'
                    },
                    annotations: [
                        {
                            text: 'yoUSD APY vs SPR Over Time',
                            xref: 'paper',
                            yref: 'paper',
                            x: 0.24,
                            y: 0.98,
                            showarrow: false,
                            font: { size: 12, family: 'serif' }
                        },
                        {
                            text: 'Daily Values Scatter Plot',
                            xref: 'paper',
                            yref: 'paper',
                            x: 0.76,
                            y: 0.98,
                            showarrow: false,
                            font: { size: 12, family: 'serif' }
                        },
                        {
                            text: '30-Day Rolling Correlation',
                            xref: 'paper',
                            yref: 'paper',
                            x: 0.24,
                            y: 0.48,
                            showarrow: false,
                            font: { size: 12, family: 'serif' }
                        },
                        {
                            text: '30-Day Rolling Beta',
                            xref: 'paper',
                            yref: 'paper',
                            x: 0.76,
                            y: 0.48,
                            showarrow: false,
                            font: { size: 12, family: 'serif' }
                        },
                        {
                            text: `R² = ${trendData.rSquared.toFixed(3)}`,
                            xref: 'x2',
                            yref: 'y2',
                            x: Math.min(...alignedData.weighted_apy) + 
                               (Math.max(...alignedData.weighted_apy) - Math.min(...alignedData.weighted_apy)) * 0.1,
                            y: Math.max(...alignedData.yoUSD_apy) - 
                               (Math.max(...alignedData.yoUSD_apy) - Math.min(...alignedData.yoUSD_apy)) * 0.1,
                            showarrow: false,
                            font: { size: 10, family: 'serif' }
                        }
                    ],
                    images: [
                        { ...PlotlyCommon.getLogoImage(CONFIG.logoUrl), x: 0.24, y: 0.76, sizex: 0.2, sizey: 0.2, opacity: 0.04 },
                        { ...PlotlyCommon.getLogoImage(CONFIG.logoUrl), x: 0.76, y: 0.76, sizex: 0.2, sizey: 0.2, opacity: 0.04 },
                        { ...PlotlyCommon.getLogoImage(CONFIG.logoUrl), x: 0.24, y: 0.24, sizex: 0.2, sizey: 0.2, opacity: 0.04 },
                        { ...PlotlyCommon.getLogoImage(CONFIG.logoUrl), x: 0.76, y: 0.24, sizex: 0.2, sizey: 0.2, opacity: 0.04 }
                    ]
                }
            };
            
            const config = {
                ...PlotlyCommon.getConfig(),
                toImageButtonOptions: {
                    ...PlotlyCommon.getConfig().toImageButtonOptions,
                    filename: 'yousd_vs_spr_analysis',
                    height: 800,
                    width: 1400
                }
            };
            
            Plotly.newPlot(containerId, fig.data, fig.layout, config);
            
            // Display summary statistics
            displaySummaryStats(containerId, alignedData, trendData, rollingCorr, rollingBeta);
            
        } catch (error) {
            PlotlyCommon.showError(containerId, 'Failed to load correlation analysis');
            console.error('yoUSD correlation analysis error:', error);
        }
    }
    
    // Helper function to align datasets by date
    function alignDatasets(sprData, yoUSDData) {
        const result = {
            dates: [],
            weighted_apy: [],
            yoUSD_apy: []
        };
        
        // Create date maps for faster lookup
        const sprMap = new Map();
        sprData.dates.forEach((date, idx) => {
            const dateStr = date.toISOString().split('T')[0];
            if (sprData.data.weighted_apy[idx] !== null) {
                sprMap.set(dateStr, sprData.data.weighted_apy[idx]);
            }
        });
        
        // Align data
        yoUSDData.forEach(item => {
            const dateStr = item.date.toISOString().split('T')[0];
            if (sprMap.has(dateStr)) {
                result.dates.push(item.date);
                result.weighted_apy.push(sprMap.get(dateStr));
                result.yoUSD_apy.push(item.apy);
            }
        });
        
        return result;
    }
    
    // Calculate rolling beta
    function calculateRollingBeta(dependent, independent, window) {
        const result = [];
        
        for (let i = 0; i < dependent.length; i++) {
            if (i < window - 1) {
                result.push(null);
            } else {
                const depWindow = dependent.slice(i - window + 1, i + 1);
                const indepWindow = independent.slice(i - window + 1, i + 1);
                
                // Calculate returns
                const depReturns = [];
                const indepReturns = [];
                for (let j = 1; j < depWindow.length; j++) {
                    depReturns.push((depWindow[j] - depWindow[j-1]) / depWindow[j-1]);
                    indepReturns.push((indepWindow[j] - indepWindow[j-1]) / indepWindow[j-1]);
                }
                
                // Calculate beta
                const covariance = calculateCovariance(depReturns, indepReturns);
                const variance = calculateVariance(indepReturns);
                
                result.push(variance > 0 ? covariance / variance : null);
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
        
        return cov / (n - 1);
    }
    
    // Calculate variance
    function calculateVariance(x) {
        const n = x.length;
        const mean = x.reduce((a, b) => a + b, 0) / n;
        
        let variance = 0;
        for (let i = 0; i < n; i++) {
            variance += Math.pow(x[i] - mean, 2);
        }
        
        return variance / (n - 1);
    }
    
    // Calculate trend line
    function calculateTrendLine(x, y) {
        const n = x.length;
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
        const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        // Calculate R-squared
        const yMean = sumY / n;
        const ssTotal = y.reduce((total, yi) => total + Math.pow(yi - yMean, 2), 0);
        const ssResidual = y.reduce((total, yi, i) => 
            total + Math.pow(yi - (slope * x[i] + intercept), 2), 0
        );
        const rSquared = 1 - (ssResidual / ssTotal);
        
        // Generate trend line points
        const xMin = Math.min(...x);
        const xMax = Math.max(...x);
        const trendX = [xMin, xMax];
        const trendY = trendX.map(xi => slope * xi + intercept);
        
        return {
            x: trendX,
            y: trendY,
            slope,
            intercept,
            rSquared
        };
    }
    
    // Display summary statistics
    function displaySummaryStats(containerId, alignedData, trendData, rollingCorr, rollingBeta) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        // Calculate overall correlation
        const overallCorr = PlotlyCommon.calculateCorrelation(
            alignedData.weighted_apy, 
            alignedData.yoUSD_apy
        );
        
        // Get current values
        const lastIdx = alignedData.dates.length - 1;
        const currentCorr = rollingCorr[lastIdx];
        const currentBeta = rollingBeta[lastIdx];
        
        // Calculate means
        const meanCorr = rollingCorr.filter(v => v !== null).reduce((a, b) => a + b, 0) / 
                        rollingCorr.filter(v => v !== null).length;
        const meanBeta = rollingBeta.filter(v => v !== null).reduce((a, b) => a + b, 0) / 
                        rollingBeta.filter(v => v !== null).length;
        
        const statsHtml = `
            <div style="margin-top: 20px; padding: 15px; background: ${PlotlyCommon.THEME_PALETTE[0]}; 
                        border: 1px solid #ddd; border-radius: 8px; font-family: serif;">
                <h4 style="margin: 0 0 10px 0; color: #333;">Summary Statistics</h4>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                    <div>
                        <strong>Overall Correlation:</strong> ${overallCorr.toFixed(3)}<br>
                        <strong>Current 30-day Correlation:</strong> ${currentCorr ? currentCorr.toFixed(3) : 'N/A'}<br>
                        <strong>Mean 30-day Correlation:</strong> ${meanCorr.toFixed(3)}
                    </div>
                    <div>
                        <strong>Current 30-day Beta:</strong> ${currentBeta ? currentBeta.toFixed(3) : 'N/A'}<br>
                        <strong>Mean 30-day Beta:</strong> ${meanBeta.toFixed(3)}<br>
                        <strong>R-squared:</strong> ${trendData.rSquared.toFixed(3)}
                    </div>
                    <div>
                        <strong>Trend Line:</strong> y = ${trendData.slope.toFixed(3)}x + ${trendData.intercept.toFixed(3)}<br>
                        <strong>Data Points:</strong> ${alignedData.dates.length}<br>
                        <strong>Date Range:</strong> ${alignedData.dates[0].toLocaleDateString()} - ${alignedData.dates[lastIdx].toLocaleDateString()}
                    </div>
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
        const { containerId = 'yousd-correlation-chart' } = config;
        createCorrelationAnalysis(containerId);
    }
    
    // Export public API
    return {
        createCorrelationAnalysis,
        initialize,
        CONFIG
    };
})();

// Make it available globally
window.YoUSDCharts = YoUSDCharts;