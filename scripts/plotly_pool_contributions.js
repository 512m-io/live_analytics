/**
 * Self-Contained Pool Contributions Over Time Chart
 * 
 * This single file contains everything needed:
 * - Plotly.js library (loaded from CDN)
 * - Data fetching from GitHub Pages
 * - Chart rendering with exact matplotlib styling
 * 
 * Shows pool contributions to stablecoin prime rate over time as a stacked area chart
 */

(function() {
    'use strict';
    
    // Configuration URLs
    const CONFIG = {
        dataUrl: 'https://512m-io.github.io/live_analytics/data/pool_data.json',
        metadataUrl: 'https://512m-io.github.io/live_analytics/data/pool_metadata.json',
        logoUrl: 'https://512m-io.github.io/live_analytics/512m_logo.png'
    };

    // Theme colors matching Python matplotlib style
    const THEME_PALETTE = ['#f7f3ec', '#ede4da', '#b9a58f', '#574c40', '#36312a'];
    
    const MUTED_BLUES = [
        '#2b3e50', '#3c5a77', '#4f7192', '#5f86a8', '#6f9bbd',
        '#86abc7', '#9bbad1', '#afc8da', '#c3d5e3', '#d7e2ec'
    ];
    
    // Display names for pools
    const DISPLAY_POOL_NAMES = {
        '0': 'Ethena sUSDe',
        '1': 'Maple USDC',
        '2': 'Sky sUSDS',
        '3': 'AAVE USDT',
        '4': 'Morpho Spark USDC',
        '5': 'Sky DSR DAI',
        '6': 'Usual USD0++',
        '10': 'Morpho USUALUSDC+',
        '13': 'Fluid USDC'
    };

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
            console.log('🔄 Loading Pool Contributions Over Time data...');
            const [dataResponse, metadataResponse] = await Promise.all([
                fetchWithRetry(CONFIG.dataUrl),
                fetchWithRetry(CONFIG.metadataUrl)
            ]);
            
            const poolData = dataResponse.pool_data;
            const metadata = metadataResponse.pool_metadata;
            
            console.log('✅ Loaded pool data over time');
            return { poolData, metadata };
            
        } catch (error) {
            console.error('❌ Error loading data:', error);
            showError(`Data loading failed: ${error.message}`);
            return null;
        }
    }

    // Data fetching with retry logic
    async function fetchWithRetry(url, maxRetries = 3, delay = 1000) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return await response.json();
            } catch (error) {
                console.error(`Fetch attempt ${i + 1} failed:`, error);
                if (i === maxRetries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    // Calculate pool contributions over time
    function calculateContributionsOverTime(poolData, topN = 7) {
        try {
            console.log('🔄 Calculating pool contributions...');
            
            // Calculate contributions over time
            const dates = Object.keys(poolData).sort();
            console.log(`Processing ${dates.length} dates`);
            
            if (dates.length === 0) {
                throw new Error('No dates found in pool data');
            }
            
            const contributionsOverTime = {};
            
            // Get all pool names
            const allPoolNames = new Set();
            dates.forEach(date => {
                const data = poolData[date];
                if (data) {
                    Object.keys(data).forEach(key => {
                        if (key.startsWith('apy_Pool_')) {
                            const poolNum = key.replace('apy_Pool_', '');
                            allPoolNames.add(poolNum);
                        }
                    });
                }
            });
            
            console.log(`Found ${allPoolNames.size} pools:`, Array.from(allPoolNames));
            
            if (allPoolNames.size === 0) {
                throw new Error('No pools found in data');
            }
            
            // Calculate contributions for each pool over time
            allPoolNames.forEach(poolNum => {
                contributionsOverTime[poolNum] = dates.map(date => {
                    const data = poolData[date];
                    if (!data) return 0;
                    
                    const apyKey = `apy_Pool_${poolNum}`;
                    const tvlKey = `tvlUsd_Pool_${poolNum}`;
                    
                    if (data[apyKey] !== null && data[tvlKey] !== null && data.weighted_apy !== null) {
                        const totalTvl = Object.keys(data)
                            .filter(k => k.startsWith('tvlUsd_'))
                            .reduce((sum, k) => sum + (data[k] || 0), 0);
                        
                        if (totalTvl > 0 && data.weighted_apy > 0) {
                            const contribution = (data[apyKey] * data[tvlKey]) / (data.weighted_apy * totalTvl) * 100;
                            return isNaN(contribution) ? 0 : contribution;
                        }
                    }
                    return 0;
                });
            });
            
            // Find top N pools by average contribution
            const avgContributions = Object.entries(contributionsOverTime)
                .map(([poolNum, contributions]) => {
                    const validContributions = contributions.filter(c => !isNaN(c) && isFinite(c));
                    const avgContribution = validContributions.length > 0 
                        ? validContributions.reduce((a, b) => a + b, 0) / validContributions.length 
                        : 0;
                    return {
                        poolNum,
                        avgContribution: isNaN(avgContribution) ? 0 : avgContribution
                    };
                })
                .filter(pool => pool.avgContribution > 0)
                .sort((a, b) => b.avgContribution - a.avgContribution);
            
            const topPools = avgContributions.slice(0, topN);
            
            console.log(`✅ Calculated contributions for top ${topPools.length} pools`);
            return { dates, contributionsOverTime, topPools };
            
        } catch (error) {
            console.error('❌ Error calculating contributions:', error);
            throw error;
        }
    }

    // Create the pool contributions over time stacked area chart
    function createChart(data) {
        try {
            if (!data || !data.poolData) {
                showError('No data available to display');
                return;
            }

            const { poolData, metadata } = data;
            const result = calculateContributionsOverTime(poolData, 7);
            
            if (!result || !result.topPools || result.topPools.length === 0) {
                showError('No valid pool data found for chart');
                return;
            }
            
            const { dates, contributionsOverTime, topPools } = result;

        // Create stacked area chart data
        const traces = [];
        const dateObjects = dates.map(d => new Date(d));
        
        // Add top pools in reverse order (so highest contributors are at top of stack)
        topPools.reverse().forEach((pool, idx) => {
            const displayName = DISPLAY_POOL_NAMES[pool.poolNum] || `Pool_${pool.poolNum}`;
            traces.push({
                x: dateObjects,
                y: contributionsOverTime[pool.poolNum],
                type: 'scatter',
                mode: 'lines',
                name: `${displayName} (${pool.avgContribution.toFixed(1)}%)`,
                stackgroup: 'one',
                fillcolor: MUTED_BLUES[idx % MUTED_BLUES.length],
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
            fillcolor: THEME_PALETTE[2],
            line: { width: 0.5 },
            hovertemplate: '<b>Other Pools</b><br>' +
                          'Date: %{x|%Y-%m-%d}<br>' +
                          'Contribution: %{y:.2f}%<br>' +
                          '<extra></extra>'
        });

        const layout = {
            title: {
                text: 'Pool Contributions to Stablecoin Prime Rate Over Time',
                x: 0.5,
                font: { family: 'serif', size: 16, color: '#333' }
            },
            plot_bgcolor: THEME_PALETTE[0],
            paper_bgcolor: THEME_PALETTE[0],
            font: {
                family: 'serif',
                size: 10,
                color: '#333'
            },
            margin: { l: 80, r: 50, t: 80, b: 80 },
            showlegend: false,
            xaxis: {
                title: { text: 'Date', font: { family: 'serif', size: 11 } },
                showgrid: true,
                gridwidth: 0.5,
                gridcolor: 'rgba(0,0,0,0.3)',
                tickfont: { size: 9, family: 'serif' },
                showline: true,
                linewidth: 0.8,
                linecolor: '#333',
                tickformat: '%Y-%m-%d',
                tickangle: -45
            },
            yaxis: {
                title: { text: 'Contribution (%)', font: { family: 'serif', size: 11 } },
                showgrid: true,
                gridwidth: 0.5,
                gridcolor: 'rgba(0,0,0,0.3)',
                tickfont: { size: 9, family: 'serif' },
                showline: true,
                linewidth: 0.8,
                linecolor: '#333',
                range: [0, 100]
            },
            hovermode: 'x unified',
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
                filename: 'pool_contributions_over_time_chart',
                height: 600,
                width: 1200,
                scale: 1
            }
        };

            // Create the chart
            Plotly.newPlot('pool-contributions-chart', traces, layout, config);

            // Add statistics below chart
            updateStats(topPools, dates);
            
            console.log('✅ Pool Contributions Over Time chart rendered successfully');
        } catch (error) {
            console.error('❌ Error creating chart:', error);
            showError(`Chart creation failed: ${error.message}`);
        }
    }

    // Update statistics display
    function updateStats(topPools, dates) {
        const totalPools = topPools.length;
        const topContributor = topPools[topPools.length - 1]; // Since we reversed the array
        const latestDate = dates[dates.length - 1];
        
        const statsContainer = document.getElementById('pool-contributions-stats');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div style="text-align: center; margin-top: 20px; font-family: serif;">
                    <div style="background: rgba(247,243,236,0.9); padding: 15px; border-radius: 8px; border: 1px solid #ddd; display: inline-block;">
                        <div style="font-size: 14px; font-weight: bold; margin-bottom: 8px; color: #333;">Pool Contributions Over Time Summary</div>
                        <div style="font-size: 12px; margin-bottom: 5px;">
                            <strong>Top Contributor:</strong> ${DISPLAY_POOL_NAMES[topContributor.poolNum] || `Pool ${topContributor.poolNum}`} (${topContributor.avgContribution.toFixed(2)}% avg)
                        </div>
                        <div style="font-size: 10px; color: #999;">
                            Data through: ${latestDate} • Updates every 4 hours
                        </div>
                    </div>
                </div>
            `;
        }
    }


    // Show error message
    function showError(message) {
        const container = document.getElementById('pool-contributions-chart');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #dc3545; background: #f8f9fa; 
                            border: 1px solid #dee2e6; border-radius: 8px; font-family: serif;">
                    <div style="font-size: 16px; margin-bottom: 10px;">⚠️ Chart Error</div>
                    <div style="font-size: 12px;">${message}</div>
                    <div style="font-size: 10px; margin-top: 10px; color: #6c757d;">
                        Please check the console for more details.
                    </div>
                </div>
            `;
        }
    }

    // Main initialization function
    async function initializeChart() {
        console.log('🚀 Initializing Pool Contributions Over Time Chart...');

        // Create container HTML
        const containerHtml = `
            <div id="pool-contributions-container" style="width: 100%; max-width: 1200px; margin: 20px auto; padding: 0 15px;">
                <div id="pool-contributions-chart" style="width: 100%; height: 600px; border: 1px solid #eee; border-radius: 8px;"></div>
                <div id="pool-contributions-stats"></div>
            </div>
        `;

        // Find target container or create one
        let targetContainer = document.getElementById('pool-contributions-main');
        if (!targetContainer) {
            targetContainer = document.createElement('div');
            targetContainer.id = 'pool-contributions-main';
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
        // Refresh every 4 hours
        setInterval(() => {
            console.log('🔄 Auto-refreshing Pool Contributions Over Time data...');
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

    // Expose functions globally for manual control
    window.PoolContributionsChart = {
        initialize: initializeChart,
        refresh: initializeChart,
        config: CONFIG
    };

})();
