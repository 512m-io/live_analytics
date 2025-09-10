/**
 * Self-Contained Stablecoin Prime Rate Chart for Squarespace
 * 
 * This single file contains everything needed:
 * - Plotly.js library (loaded from CDN)
 * - Data fetching from GitHub Pages
 * - Chart rendering with exact matplotlib styling
 * 
 * Usage: Just paste this entire script into a Squarespace Code Block
 */

(function() {
    'use strict';
    
    // Configuration - Update these URLs after setting up GitHub Pages
    const CONFIG = {
        dataUrl: 'https://512m-io.github.io/live_analytics/data/pool_data.json',
        metadataUrl: 'https://512m-io.github.io/live_analytics/data/pool_metadata.json',
        logoUrl: 'https://512m-io.github.io/live_analytics/512m_logo.png'
    };

    // Theme colors matching your matplotlib design
    const THEME_PALETTE = ['#f7f3ec', '#ede4da', '#b9a58f', '#574c40', '#36312a'];

    // Check if Plotly is already loaded, if not load it
    function loadPlotly(callback) {
        if (typeof Plotly !== 'undefined') {
            callback();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.plot.ly/plotly-2.26.0.min.js';
        script.onload = callback;
        script.onerror = () => {
            console.error('Failed to load Plotly.js');
            showError('Failed to load charting library');
        };
        document.head.appendChild(script);
    }

    // Load data from GitHub Pages
    async function loadData() {
        try {
            console.log('🔄 Loading Stablecoin Prime Rate data...');
            const response = await fetch(CONFIG.dataUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const jsonData = await response.json();
            const poolData = jsonData.pool_data;
            
            // Convert to sorted array format
            const dates = Object.keys(poolData).sort();
            const data = dates.map(date => ({
                date: new Date(date),
                weighted_apy: poolData[date].weighted_apy,
                ma_apy_14d: poolData[date].ma_apy_14d
            })).filter(row => row.weighted_apy !== null && row.ma_apy_14d !== null);
            
            console.log(`✅ Loaded ${data.length} data points from ${dates[0]} to ${dates[dates.length-1]}`);
            return data;
            
        } catch (error) {
            console.error('❌ Error loading data:', error);
            showError(`Data loading failed: ${error.message}`);
            return null;
        }
    }

    // Create the interactive chart with exact matplotlib styling
    function createChart(data) {
        if (!data || data.length === 0) {
            showError('No data available to display');
            return;
        }

        const dates = data.map(d => d.date);
        const dailyAPY = data.map(d => d.weighted_apy);
        const movingAvg = data.map(d => d.ma_apy_14d);

        // Chart traces - matching exact matplotlib style
        const traces = [
            {
                x: dates,
                y: dailyAPY,
                type: 'scatter',
                mode: 'lines',
                name: 'Daily Weighted APY',
                line: {
                    color: THEME_PALETTE[2], // '#b9a58f'
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
                y: movingAvg,
                type: 'scatter',
                mode: 'lines',
                name: '14-Day Moving Average',
                line: {
                    color: THEME_PALETTE[3], // '#574c40'
                    width: 2.5
                },
                hovertemplate: '<b>14-Day Moving Average</b><br>' +
                              'Date: %{x|%Y-%m-%d}<br>' +
                              'APY: %{y:.4f}%<br>' +
                              '<extra></extra>'
            }
        ];

        // Layout - exact matplotlib styling
        const layout = {
            title: {
                text: 'Stablecoin Prime Rate: Daily vs 14-Day Moving Average',
                x: 0.5,
                font: { family: 'serif', size: 14, color: '#333' }
            },
            xaxis: {
                title: { text: 'Date', font: { family: 'serif', size: 11 } },
                showgrid: true,
                gridwidth: 0.5,
                gridcolor: 'rgba(0,0,0,0.3)',
                tickfont: { size: 9, family: 'serif' },
                showline: true,
                linewidth: 0.8,
                linecolor: '#333'
            },
            yaxis: {
                title: { text: 'SPR APY (%)', font: { family: 'serif', size: 11 } },
                showgrid: true,
                gridwidth: 0.5,
                gridcolor: 'rgba(0,0,0,0.3)',
                tickfont: { size: 9, family: 'serif' },
                showline: true,
                linewidth: 0.8,
                linecolor: '#333'
            },
            plot_bgcolor: THEME_PALETTE[0], // '#f7f3ec'
            paper_bgcolor: THEME_PALETTE[0],
            font: {
                family: 'serif',
                size: 10,
                color: '#333'
            },
            legend: {
                font: { size: 9, family: 'serif' },
                bgcolor: 'rgba(247,243,236,0.8)',
                bordercolor: 'rgba(0,0,0,0.2)',
                borderwidth: 1
            },
            margin: { l: 80, r: 50, t: 80, b: 80 },
            hovermode: 'x unified',
            
            // Logo watermark
            images: [{
                source: CONFIG.logoUrl,
                xref: "paper",
                yref: "paper", 
                x: 0.5,
                y: 0.5,
                sizex: 0.25,
                sizey: 0.25,
                xanchor: "center",
                yanchor: "middle",
                opacity: 0.05,
                layer: "below"
            }]
        };

        const config = {
            responsive: true,
            displayModeBar: true,
            modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'autoScale2d', 'resetScale2d'],
            displaylogo: false,
            toImageButtonOptions: {
                format: 'png',
                filename: 'stablecoin_prime_rate_chart',
                height: 600,
                width: 1200,
                scale: 1
            }
        };

        // Create the chart
        Plotly.newPlot('defi-chart', traces, layout, config);

        // Add statistics below chart
        updateStats(data);
        
        console.log('✅ Chart rendered successfully');
    }

    // Update statistics display
    function updateStats(data) {
        const latestData = data[data.length - 1];
        const previousData = data[data.length - 2];
        
        const currentAPY = latestData.weighted_apy;
        const currentMA = latestData.ma_apy_14d;
        const apyChange = previousData ? (currentAPY - previousData.weighted_apy) : 0;
        
        const changeColor = apyChange >= 0 ? '#28a745' : '#dc3545';
        const changeSymbol = apyChange >= 0 ? '↗' : '↘';
        
        const statsHtml = `
            <div style="text-align: center; margin-top: 20px; font-family: serif;">
                <div style="background: rgba(247,243,236,0.9); padding: 15px; border-radius: 8px; border: 1px solid #ddd; display: inline-block;">
                    <div style="font-size: 14px; font-weight: bold; margin-bottom: 8px; color: #333;">Latest Stablecoin Prime Rate</div>
                    <div style="font-size: 18px; margin-bottom: 5px;">
                        <span style="color: ${THEME_PALETTE[3]}; font-weight: bold;">${currentAPY.toFixed(4)}%</span>
                        <span style="color: ${changeColor}; font-size: 12px; margin-left: 8px;">
                            ${changeSymbol} ${Math.abs(apyChange).toFixed(4)}%
                        </span>
                    </div>
                    <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
                        14-Day MA: <strong>${currentMA.toFixed(4)}%</strong>
                    </div>
                    <div style="font-size: 10px; color: #999;">
                        Last Updated: ${latestData.date.toLocaleDateString('en-US', { 
                            year: 'numeric', month: 'short', day: 'numeric' 
                        })} • Updates every 4 hours
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('defi-chart-stats').innerHTML = statsHtml;
    }

    // Show error message
    function showError(message) {
        const errorHtml = `
            <div style="text-align: center; padding: 40px; color: #dc3545; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px;">
                <div style="font-size: 16px; margin-bottom: 10px;">⚠️ Chart Unavailable</div>
                <div style="font-size: 12px;">${message}</div>
                <div style="font-size: 10px; margin-top: 10px; color: #6c757d;">
                    Please check back later or contact support if this persists.
                </div>
            </div>
        `;
        document.getElementById('defi-chart-container').innerHTML = errorHtml;
    }

    // Main initialization function
    async function initializeChart() {
        console.log('🚀 Initializing Stablecoin Prime Rate Chart...');

        // Create container HTML
        const containerHtml = `
            <div id="defi-chart-container" style="width: 100%; max-width: 1200px; margin: 20px auto; padding: 0 15px;">
                <div id="defi-chart" style="width: 100%; height: 600px; border: 1px solid #eee; border-radius: 8px;"></div>
                <div id="defi-chart-stats"></div>
            </div>
        `;

        // Find target container or create one
        let targetContainer = document.getElementById('defi-prime-rate-chart');
        if (!targetContainer) {
            targetContainer = document.createElement('div');
            targetContainer.id = 'defi-prime-rate-chart';
            document.body.appendChild(targetContainer);
        }
        
        targetContainer.innerHTML = containerHtml;

        // Load Plotly and create chart
        loadPlotly(async () => {
            const data = await loadData();
            if (data) {
                createChart(data);
            }
        });
    }

    // Auto-refresh function
    function setupAutoRefresh() {
        // Refresh every 4 hours (4 * 60 * 60 * 1000 ms)
        setInterval(() => {
            console.log('🔄 Auto-refreshing chart data...');
            initializeChart();
        }, 4 * 60 * 60 * 1000);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initializeChart();
            setupAutoRefresh();
        });
    } else {
        initializeChart();
        setupAutoRefresh();
    }

    // Expose refresh function globally for manual refresh
    window.refreshDeFiChart = initializeChart;

})();
