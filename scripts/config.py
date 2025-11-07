"""
Configuration module for DeFi Prime Rate analysis project.

This module contains all constants, API endpoints, plotting styles, and configuration
settings used across the project to ensure consistency and eliminate duplication.
"""

import logging.config
from typing import Dict, List
import matplotlib.pyplot as plt

# API Configuration
API_ENDPOINTS = {
    'defi_llama_yields': "https://yields.llama.fi/pools",
    'defi_llama_chart': "https://yields.llama.fi/chart/",
    'polygon_base': "https://api.polygon.io",
    'coingecko_base': "https://api.coingecko.com/api/v3"
}

# Database Configuration
DEFAULT_DB_FILENAME = "data/defi_prime_rate.db"
DEFAULT_JSON_FILENAME = "data/defi_prime_rate.json"
DEFAULT_JSON_DATA_FILENAME = "data/pool_data.json"
DEFAULT_JSON_METADATA_FILENAME = "data/pool_metadata.json"

# Pool Configuration
SPECIFIC_POOL_IDS = [
    "aa70268e-4b52-42bf-a116-608b370f9501",  # USDC
    "f981a304-bb6c-45b8-b0c5-fd2f515ad23a"   # USDT
]

POOL_NAMES = {
    "aa70268e-4b52-42bf-a116-608b370f9501": "USDC",
    "f981a304-bb6c-45b8-b0c5-fd2f515ad23a": "USDT"
}

# yoUSD Pool Configuration
YOUSD_POOL_ID = "1994cc35-a2b9-434e-b197-df6742fb5d81"
YOUSD_POOL_NAME = "yoUSD"

# Theme and Color Configuration
THEME_PALETTE = ['#f7f3ec', '#ede4da', '#b9a58f', '#574c40', '#36312a']

MUTED_BLUES = [
    '#2b3e50', '#3c5a77', '#4f7192', '#5f86a8', '#6f9bbd',
    '#86abc7', '#9bbad1', '#afc8da', '#c3d5e3', '#d7e2ec'
]

# Logo Configuration
DEFAULT_LOGO_PATH = "public/512m_logo.png"
DEFAULT_LOGO_ALPHA = 0.05

# Data Fetching Configuration
DEFAULT_FETCH_DAYS = 700
RATE_LIMIT_DELAY = 2.0  # Increased from 0.5 to 2.0 seconds for free tier
RATE_LIMIT_RETRY_DELAY = 5  # Increased from 2 to 5 seconds for free tier
COINGECKO_FREE_TIER_DELAY = 1.5  # Additional delay specifically for CoinGecko free tier

# Analysis Configuration
ROLLING_WINDOW_SIZES = {
    'short': 14,
    'medium': 30,
    'long': 90
}

# Display Configuration
DISPLAY_POOL_NAMES = {
    '0': 'Ethena sUSDe',
    '1': 'Maple USDC',
    '2': 'Sky sUSDS',
    '3': 'AAVE USDT',
    '4': 'Morpho Spark USDC',
    '5': 'Sky DSR DAI',
    '6': 'Usual USD0++',
    '10': 'Morpho USUALUSDC+',
    '13': 'Fluid USDC'
}

def setup_plotting_style() -> None:
    """
    Set up academic-style plotting with serif fonts and beige background.
    This function should be called once at the start of any plotting module.
    """
    plt.style.use('default')
    plt.rcParams.update({
        'font.family': 'serif',
        'font.size': 10,
        'axes.labelsize': 11,
        'axes.titlesize': 12,
        'xtick.labelsize': 9,
        'ytick.labelsize': 9,
        'legend.fontsize': 9,
        'figure.titlesize': 14,
        'lines.linewidth': 1.5,
        'axes.linewidth': 0.8,
        'grid.linewidth': 0.5,
        'grid.alpha': 0.3,
        'figure.facecolor': THEME_PALETTE[0],
        'axes.facecolor': THEME_PALETTE[0],
        'savefig.facecolor': THEME_PALETTE[0]
    })

# Export commonly used items
__all__ = [
    'API_ENDPOINTS',
    'DEFAULT_DB_FILENAME',
    'DEFAULT_JSON_FILENAME',
    'DEFAULT_JSON_DATA_FILENAME',
    'DEFAULT_JSON_METADATA_FILENAME',
    'SPECIFIC_POOL_IDS',
    'POOL_NAMES',
    'YOUSD_POOL_ID',
    'YOUSD_POOL_NAME',
    'THEME_PALETTE',
    'MUTED_BLUES',
    'DEFAULT_LOGO_PATH',
    'DEFAULT_LOGO_ALPHA',
    'DEFAULT_FETCH_DAYS',
    'RATE_LIMIT_DELAY',
    'RATE_LIMIT_RETRY_DELAY',
    'ROLLING_WINDOW_SIZES',
    'DISPLAY_POOL_NAMES',
    'setup_plotting_style'
]