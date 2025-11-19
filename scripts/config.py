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

# Export commonly used items
__all__ = [
    'API_ENDPOINTS',
    'DEFAULT_DB_FILENAME',
    'DEFAULT_JSON_FILENAME',
    'DEFAULT_JSON_DATA_FILENAME',
    'DEFAULT_JSON_METADATA_FILENAME',
    'SPECIFIC_POOL_IDS',
    'POOL_NAMES',
    'DEFAULT_FETCH_DAYS',
    'RATE_LIMIT_DELAY',
    'RATE_LIMIT_RETRY_DELAY',
    'ROLLING_WINDOW_SIZES',
    'DISPLAY_POOL_NAMES',
]