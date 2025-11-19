/**
 * Self-Contained Chain Contribution Pie Chart
 *
 * This single file contains everything needed:
 * - Plotly.js library (loaded from CDN)
 * - Data fetching from GitHub Pages
 * - Chart rendering with exact matplotlib styling
 *
 * Shows SPR contribution breakdown by blockchain as a pie chart
 */

(function() {
    'use strict';

    const CONFIG = {
        metadataUrl: 'https://512m-io.github.io/live_analytics/data/pool_metadata.json',
        logoUrl: 'https://512m-io.github.io/live_analytics/public/512m_logo.png'
    };

    const THEME_PALETTE = ['#f7f3ec', '#ede4da', '#b9a58f', '#574c40', '#36312a'];

    const PIE_COLORS = [
        '#2E86AB', '#A23B72', '#F18F01', '#C73E1D', '#8E44AD',
        '#16A085', '#F39C12', '#2C3E50', '#E74C3C', '#3498DB',
        '#1ABC9C', '#F1C40F', '#9B59B6', '#34495E', '#E67E22',
        '#95A5A6', '#D35400', '#27AE60', '#2980B9', '#8E44AD'
    ];

    function loadPlotly(callback) {
        if (typeof Plotly !== 'undefined') {
            callback();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.plot.ly/plotly-2.26.0.min.js';
        script.onload = callback;
        script.onerror = () => {
            showError('Failed to load charting library');
        };
        document.head.appendChild(script);
    }

    async function loadData() {
        try {
            const metadataResponse = await fetchWithRetry(CONFIG.metadataUrl);
            const metadata = metadataResponse.pool_metadata;

            return { metadata };

        } catch (error) {
            showError(`Data loading failed: ${error.message}`);
            return null;
        }
    }

    async function fetchWithRetry(url, maxRetries = 3, delay = 1000) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return await response.json();
            } catch (error) {
                if (i === maxRetries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    function calculateChainContributions(metadata) {
        try {
            const chainContributions = {};
            let totalContribution = 0;

            metadata.forEach(pool => {
                const chain = pool.chain;
                const tvl = pool.current_tvl || 0;
                const apy = pool.current_apy || 0;

                const contribution = tvl * apy;

                if (!chainContributions[chain]) {
                    chainContributions[chain] = {
                        chain: chain,
                        totalContribution: 0,
                        totalTVL: 0,
                        poolCount: 0,
                        avgAPY: 0,
                        pools: []
                    };
                }

                chainContributions[chain].totalContribution += contribution;
                chainContributions[chain].totalTVL += tvl;
                chainContributions[chain].poolCount += 1;
                chainContributions[chain].pools.push({
                    name: pool.name,
                    project: pool.project,
                    symbol: pool.symbol,
                    tvl: tvl,
                    apy: apy
                });

                totalContribution += contribution;
            });

            const contributions = Object.values(chainContributions)
                .filter(chain => chain.totalContribution > 0)
                .map(chain => ({
                    chain: chain.chain,
                    contribution: chain.totalContribution,
                    percentage: (chain.totalContribution / totalContribution) * 100,
                    totalTVL: chain.totalTVL,
                    poolCount: chain.poolCount,
                    avgAPY: chain.totalContribution / chain.totalTVL,
                    pools: chain.pools
                }))
                .sort((a, b) => b.contribution - a.contribution);

            return { contributions, totalContribution };

        } catch (error) {
            throw error;
        }
    }

    function createChart(data) {
        try {
            if (!data || !data.metadata) {
                showError('No data available to display');
                return;
            }

            const { metadata } = data;
            const result = calculateChainContributions(metadata);

            if (!result || !result.contributions || result.contributions.length === 0) {
                showError('No valid chain data found for chart');
                return;
            }

            const { contributions } = result;

            const chains = contributions.map(c => c.chain);
            const values = contributions.map(c => c.contribution);
            const percentages = contributions.map(c => c.percentage);

            const textInfo = contributions.map(c =>
                `${c.chain}<br>${c.percentage.toFixed(1)}%`
            );

            const hoverText = contributions.map(c =>
                `<b>${c.chain}</b><br>` +
                `Contribution: ${c.contribution.toLocaleString()}<br>` +
                `Percentage: ${c.percentage.toFixed(1)}%<br>` +
                `TVL: $${(c.totalTVL / 1000000000).toFixed(1)}B<br>` +
                `Pools: ${c.poolCount}`
            );

            const trace = {
                labels: chains,
                values: values,
                type: 'pie',
                name: 'Chain Contributions',
                marker: {
                    colors: PIE_COLORS.slice(0, chains.length),
                    line: {
                        color: THEME_PALETTE[0],
                        width: 2
                    }
                },
                text: textInfo,
                textposition: 'inside',
                textinfo: 'text',
                hovertext: hoverText,
                hoverinfo: 'text'
            };

            const layout = {
                title: {
                    text: 'SPR Contribution by Blockchain',
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
                margin: { l: 50, r: 50, t: 80, b: 80 },
                showlegend: true,
                legend: {
                    font: { size: 9, family: 'serif' },
                    bgcolor: 'rgba(247,243,236,0.8)',
                    bordercolor: 'rgba(0,0,0,0.2)',
                    borderwidth: 1,
                    orientation: 'v',
                    x: 1.02,
                    y: 0.5,
                    xanchor: 'left',
                    yanchor: 'middle'
                },
                hovermode: 'closest',
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
                modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d'],
                displaylogo: false,
                toImageButtonOptions: {
                    format: 'png',
                    filename: 'spr_chain_contributions_pie_chart',
                    height: 600,
                    width: 1200,
                    scale: 1
                }
            };

            Plotly.newPlot('chain-contributions-chart', [trace], layout, config);

            updateStats(contributions);

        } catch (error) {
            showError(`Chart creation failed: ${error.message}`);
        }
    }

    function updateStats(contributions) {
        const totalChains = contributions.length;
        const topChain = contributions[0];
        const topChainTVL = (topChain.totalTVL / 1000000000).toFixed(1);
        const topChainPercentage = topChain.percentage.toFixed(1);

        const statsContainer = document.getElementById('chain-contributions-stats');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div style="text-align: center; margin-top: 20px; font-family: serif;">
                    <div style="background: rgba(247,243,236,0.9); padding: 15px; border-radius: 8px; border: 1px solid #ddd; display: inline-block;">
                        <div style="font-size: 14px; font-weight: bold; margin-bottom: 8px; color: #333;">Chain Contributions Summary</div>
                        <div style="font-size: 12px; margin-bottom: 5px;">
                            <strong>Total Blockchains:</strong> ${totalChains}
                        </div>
                        <div style="font-size: 12px; margin-bottom: 5px;">
                            <strong>Leading Chain:</strong> ${topChain.chain} (${topChainPercentage}%)
                        </div>
                        <div style="font-size: 10px; color: #999;">
                            Based on TVL-weighted APY contributions • Updates every 4 hours
                        </div>
                    </div>
                </div>
            `;
        }
    }

    function showError(message) {
        const container = document.getElementById('chain-contributions-chart');
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

    async function initializeChart() {

        const containerHtml = `
            <div id="chain-contributions-container" style="width: 100%; max-width: 1200px; margin: 20px auto; padding: 0 15px;">
                <div id="chain-contributions-chart" style="width: 100%; height: 600px; border: 1px solid #eee; border-radius: 8px;"></div>
                <div id="chain-contributions-stats"></div>
            </div>
        `;

        let targetContainer = document.getElementById('chain-contributions-main');
        if (!targetContainer) {
            targetContainer = document.createElement('div');
            targetContainer.id = 'chain-contributions-main';
            document.body.appendChild(targetContainer);
        }

        targetContainer.innerHTML = containerHtml;

        loadPlotly(async () => {
            const data = await loadData();
            if (data) {
                createChart(data);
            }
        });
    }

    function setupAutoRefresh() {
        setInterval(() => {
            initializeChart();
        }, 4 * 60 * 60 * 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initializeChart();
            setupAutoRefresh();
        });
    } else {
        initializeChart();
        setupAutoRefresh();
    }

    window.ChainContributionsChart = {
        initialize: initializeChart,
        refresh: initializeChart,
        config: CONFIG
    };

})();