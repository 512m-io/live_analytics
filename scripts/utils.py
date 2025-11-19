"""
Utility functions for DeFi Prime Rate analysis project.

This module contains common functionality used across multiple modules
to eliminate code duplication and improve maintainability.
"""

import sqlite3
import requests
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple
import time
import os

from config import (
    API_ENDPOINTS, DEFAULT_DB_FILENAME,
    RATE_LIMIT_DELAY, RATE_LIMIT_RETRY_DELAY, COINGECKO_FREE_TIER_DELAY
)

def fetch_pool_chart_data(pool_id: str, pool_name: str = None, 
                         days: int = 360) -> Optional[pd.DataFrame]:
    """
    Fetch historical chart data for a specific pool from DeFiLlama API.
    
    Args:
        pool_id: Pool ID from DeFiLlama
        pool_name: Pool name for logging (optional)
        days: Number of days of historical data to fetch
        
    Returns:
        DataFrame with historical APY and TVL data, or None if failed
    """
    display_name = pool_name or pool_id
    
    try:
        print(f"Fetching data for {display_name}...")
        url = f"{API_ENDPOINTS['defi_llama_chart']}{pool_id}"
        response = requests.get(url)
        
        if response.status_code == 429:
            print(f"Rate limited for {display_name}, waiting {RATE_LIMIT_RETRY_DELAY} seconds...")
            time.sleep(RATE_LIMIT_RETRY_DELAY)
            response = requests.get(url)
        
        if response.status_code == 200:
            data = response.json()
            
            if isinstance(data, dict) and 'data' in data:
                data = data['data']
            
            if isinstance(data, list) and len(data) > 0:
                df = pd.DataFrame(data)
                
                if 'timestamp' in df.columns:
                    df = _process_timestamp_column(df, display_name)
                    if df is None:
                        return None
                    
                    cutoff_date = datetime.now() - timedelta(days=days)
                    df = df[df.index >= cutoff_date]
                    
                    print(f"Successfully fetched {len(df)} data points for {display_name}")
                    return df
                else:
                    print(f"No timestamp found in data for {display_name}")
                    return None
            else:
                print(f"Unexpected data format for {display_name}")
                return None
        else:
            print(f"Error fetching chart data for {display_name}: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"Error fetching chart data for {display_name}: {e}")
        return None


def _process_timestamp_column(df: pd.DataFrame, pool_name: str) -> Optional[pd.DataFrame]:
    """
    Process timestamp column and set as index.
    
    Args:
        df: DataFrame with timestamp column
        pool_name: Pool name for error logging
        
    Returns:
        Processed DataFrame or None if failed
    """
    try:
        df['date'] = pd.to_datetime(df['timestamp'], unit='s')
    except (ValueError, TypeError):
        try:
            df['date'] = pd.to_datetime(df['timestamp'])
        except (ValueError, TypeError):
            print(f"Could not parse timestamp format for pool {pool_name}")
            return None
    
    df.set_index('date', inplace=True)
    
    if df.index.tz is not None:
        df.index = df.index.tz_localize(None)
    
    return df


def load_data_from_db(db_filename: str = DEFAULT_DB_FILENAME) -> Tuple[Optional[pd.DataFrame], Optional[pd.DataFrame]]:
    """
    Load data from SQLite database.
    
    Args:
        db_filename: SQLite database filename
        
    Returns:
        Tuple of (merged_df, metadata_df) or (None, None) if failed
    """
    try:
        print(f"Loading data from {db_filename}...")
        conn = sqlite3.connect(db_filename)
        
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        print(f"Tables in database: {[table[0] for table in tables]}")
        
        try:
            merged_df = pd.read_sql('SELECT * FROM pool_data', conn, index_col='index')
        except:
            try:
                merged_df = pd.read_sql('SELECT * FROM pool_data', conn)
                if len(merged_df.columns) > 0:
                    first_col = merged_df.columns[0]
                    if 'date' in first_col.lower() or 'time' in first_col.lower():
                        merged_df.set_index(first_col, inplace=True)
                    else:
                        merged_df.set_index(first_col, inplace=True)
            except Exception as e:
                print(f"Error reading pool_data table: {e}")
                cursor.execute("PRAGMA table_info(pool_data);")
                columns = cursor.fetchall()
                print("Pool_data table structure:")
                for col in columns:
                    print(f"  {col[1]} ({col[2]})")
                return None, None
        
        if not isinstance(merged_df.index, pd.DatetimeIndex):
            try:
                merged_df.index = pd.to_datetime(merged_df.index)
            except:
                print("Warning: Could not convert index to datetime")
        
        try:
            metadata_df = pd.read_sql('SELECT * FROM pool_metadata', conn)
        except Exception as e:
            print(f"Error reading pool_metadata table: {e}")
            metadata_df = pd.DataFrame()
        
        conn.close()
        
        print(f"Successfully loaded data for {len(metadata_df)} pools")
        return merged_df, metadata_df
        
    except Exception as e:
        print(f"Error loading data from database: {e}")
        return None, None


def format_date_axis(ax: plt.Axes, interval: int = 2) -> None:
    """
    Format x-axis dates consistently across plots.
    
    Args:
        ax: matplotlib axis object
        interval: interval for date ticks (in weeks)
    """
    ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))
    ax.xaxis.set_major_locator(mdates.WeekdayLocator(interval=interval))
    plt.setp(ax.xaxis.get_majorticklabels(), rotation=45, ha='right')

def purge_database(db_filename: str = DEFAULT_DB_FILENAME) -> None:
    """
    Completely purge the database before fresh data insertion.
    
    Args:
        db_filename: SQLite database filename
    """
    print(f"Purging existing database: {db_filename}")
    try:
        conn = sqlite3.connect(db_filename)
        cursor = conn.cursor()
        
        cursor.execute("DROP TABLE IF EXISTS pool_data")
        cursor.execute("DROP TABLE IF EXISTS pool_metadata")
        
        cursor.execute("VACUUM")
        
        conn.commit()
        conn.close()
        print("Database purged successfully")
    except Exception as e:
        print(f"Warning: Could not purge database: {e}")


def safe_api_request(url: str, max_retries: int = 3, is_coingecko: bool = False, api_key: str = None, params: dict = None) -> Optional[requests.Response]:
    """
    Make API request with rate limiting and retry logic.
    
    Args:
        url: API endpoint URL
        max_retries: Maximum number of retry attempts
        is_coingecko: Whether this is a CoinGecko API call (requires special handling)
        api_key: CoinGecko Pro API key if available
        params: Query parameters for the request
        
    Returns:
        Response object or None if failed
    """
    for attempt in range(max_retries):
        try:
            if is_coingecko and attempt > 0:
                extra_delay = 3 * attempt  # Progressive delay: 3s, 6s, 9s
                print(f"CoinGecko free tier delay: waiting {extra_delay} seconds...")
                time.sleep(extra_delay)
            
            headers = {}
            if api_key:
                headers['x-cg-pro-api-key'] = api_key  # CoinGecko expects lowercase header
                print(f"Making Pro API request with headers: {headers}")
            else:
                print(f"Making free tier request (no API key)")
            
            response = requests.get(url, headers=headers, params=params)
            
            print(f"Response status: {response.status_code}")
            if response.status_code != 200:
                print(f"Response text: {response.text[:200]}...")
            
            if response.status_code == 429:  # Rate limited
                wait_time = RATE_LIMIT_RETRY_DELAY * (2 ** attempt)  # Exponential backoff
                print(f"Rate limited, waiting {wait_time} seconds... (attempt {attempt + 1})")
                time.sleep(wait_time)
                continue
            
            if is_coingecko:
                time.sleep(COINGECKO_FREE_TIER_DELAY)
            
            return response
            
        except Exception as e:
            print(f"Request failed (attempt {attempt + 1}): {e}")
            if attempt < max_retries - 1:
                time.sleep(RATE_LIMIT_DELAY)
    
    return None


def validate_dataframe(df: pd.DataFrame, required_columns: list = None) -> bool:
    """
    Validate DataFrame structure and content.
    
    Args:
        df: DataFrame to validate
        required_columns: List of required column names
        
    Returns:
        True if valid, False otherwise
    """
    if df is None or df.empty:
        return False
    
    if required_columns:
        missing_cols = [col for col in required_columns if col not in df.columns]
        if missing_cols:
            print(f"Missing required columns: {missing_cols}")
            return False
    
    return True

# Export commonly used functions
__all__ = [
    'fetch_pool_chart_data', 
    'load_data_from_db',
    'format_date_axis',
    'purge_database',
    'safe_api_request',
    'validate_dataframe',
]