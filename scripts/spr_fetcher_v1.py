"""
DeFi Prime Rate (SPR) Fetcher Module

This module fetches top stablecoin pools by TVL from DeFiLlama,
processes the data, and saves it to a SQLite database for analysis.
"""

import requests
import pandas as pd
import sqlite3
import json
import time
import os
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple

from config import (
    API_ENDPOINTS, DEFAULT_DB_FILENAME, DEFAULT_FETCH_DAYS, 
    RATE_LIMIT_DELAY, ROLLING_WINDOW_SIZES, DEFAULT_JSON_FILENAME,
    DEFAULT_JSON_DATA_FILENAME, DEFAULT_JSON_METADATA_FILENAME
)
from utils import (
    fetch_pool_chart_data, purge_database, safe_api_request,
    validate_dataframe
)


def fetch_top_stablecoin_pools_by_tvl(limit: int = 100) -> List[Dict[str, Any]]:
    """
    Fetch the top stablecoin pools by TVL from DeFiLlama yields API.
    
    Args:
        limit: Number of top pools to fetch
        
    Returns:
        List of pool dictionaries sorted by TVL
    """
    try:
        print(f"Fetching top {limit} stablecoin pools by TVL...")
        response = safe_api_request(API_ENDPOINTS['defi_llama_yields'])
        
        if response and response.status_code == 200:
            data = response.json()
            
            # Filter for stablecoin pools only, excluding Merkl (yield farming) and 0% APY pools
            stablecoin_pools = []
            merkl_pools_excluded = 0
            zero_apy_pools_excluded = 0
            
            for pool in data['data']:
                if (pool.get('tvlUsd') is not None and pool['tvlUsd'] > 0 and 
                    pool.get('stablecoin') == True):
                    if pool.get('project') == 'merkl':
                        merkl_pools_excluded += 1
                    elif pool.get('apy', 0) == 0:
                        zero_apy_pools_excluded += 1
                    else:
                        stablecoin_pools.append(pool)
            
            if merkl_pools_excluded > 0:
                print(f"Excluded {merkl_pools_excluded} Merkl yield farming pools")
            if zero_apy_pools_excluded > 0:
                print(f"Excluded {zero_apy_pools_excluded} pools with 0% APY")
            
            stablecoin_pools.sort(key=lambda x: x['tvlUsd'], reverse=True)
            top_pools = stablecoin_pools[:limit]
            
            print(f"Successfully fetched {len(top_pools)} stablecoin pools with highest TVL")
            return top_pools
        else:
            error_code = response.status_code if response else "No response"
            print(f"Error fetching pools: {error_code}")
            return []
    except Exception as e:
        print(f"Error fetching pools: {e}")
        return []


def merge_and_save_pool_data(pool_data: Dict[str, Dict[str, Any]], 
                           db_filename: str = DEFAULT_DB_FILENAME,
                           json_filename: str = DEFAULT_JSON_FILENAME) -> Optional[pd.DataFrame]:
    """
    Merge all pool data by date and save to both SQLite database and JSON file.
    
    Args:
        pool_data: Dictionary containing pool data
        db_filename: SQLite database filename
        json_filename: JSON filename
        
    Returns:
        Merged and cleaned DataFrame, or None if failed
    """
    merged_df = _merge_pool_dataframes(pool_data)
    if merged_df is None or merged_df.empty:
        print("No data to merge. Exiting.")
        return None

    print(f"Successfully merged data for {len(pool_data)} pools")
    
    merged_df = _clean_merged_data(merged_df)
    
    merged_df = _calculate_weighted_metrics(merged_df)
    
    # Save data to both SQLite and JSON
    _save_to_database(merged_df, pool_data, db_filename)
    _save_to_json(merged_df, pool_data, json_filename)
    
    return merged_df

def _merge_pool_dataframes(pool_data: Dict[str, Dict[str, Any]]) -> Optional[pd.DataFrame]:
    """Merge individual pool dataframes into a single dataframe."""
    print("Merging pool data...")
    merged_df = None
    
    for pool_id, pool_info in pool_data.items():
        df = pool_info['data']
        pool_name = pool_info['name']
        
        df = df.copy()
        df.index = pd.to_datetime(df.index).date
        df.index.name = 'date'
        
        numeric_cols = ['apy', 'tvlUsd']
        available_cols = [col for col in numeric_cols if col in df.columns]
        
        if len(available_cols) == 2:
            df_subset = df[available_cols].copy()
            
            if len(df_subset) != len(df_subset.groupby(df_subset.index).size()):
                df_subset = df_subset.groupby(df_subset.index).mean()
            
            df_subset = df_subset.rename(columns={
                'apy': f'apy_{pool_id}',
                'tvlUsd': f'tvlUsd_{pool_id}'
            })
            
            if merged_df is None:
                merged_df = df_subset
            else:
                merged_df = pd.merge(merged_df, df_subset, left_index=True, right_index=True, how='outer')
                
    return merged_df



def _clean_merged_data(merged_df: pd.DataFrame) -> pd.DataFrame:
    """
    Clean merged data by removing NaN values and incomplete pools.
    
    Args:
        merged_df: Merged DataFrame to clean
        
    Returns:
        Cleaned DataFrame
    """
    print("Cleaning data by removing NaN values...")
    
    # Drop columns that are all NaN (pools with no data)
    initial_cols = len(merged_df.columns)
    merged_df = merged_df.dropna(axis=1, how='all')
    dropped_cols = initial_cols - len(merged_df.columns)
    if dropped_cols > 0:
        print(f"Dropped {dropped_cols} columns with all NaN values")
    
    initial_rows = len(merged_df)
    merged_df = merged_df.dropna(axis=0, how='all')
    dropped_rows = initial_rows - len(merged_df)
    if dropped_rows > 0:
        print(f"Dropped {dropped_rows} rows with all NaN values")
    
    apy_cols = [col for col in merged_df.columns if col.startswith('apy_')]
    tvl_cols = [col for col in merged_df.columns if col.startswith('tvlUsd_')]
    
    pools_to_drop = []
    for i, apy_col in enumerate(apy_cols):
        if i < len(tvl_cols):
            tvl_col = tvl_cols[i]
            if merged_df[apy_col].isna().all() or merged_df[tvl_col].isna().all():
                pools_to_drop.extend([apy_col, tvl_col])
    
    if pools_to_drop:
        merged_df = merged_df.drop(columns=pools_to_drop)
        print(f"Dropped {len(pools_to_drop)//2} pools with incomplete data")
    
    print(f"Final dataset: {len(merged_df)} rows, {len(merged_df.columns)} columns")
    return merged_df


def _calculate_weighted_metrics(merged_df: pd.DataFrame) -> pd.DataFrame:
    """
    Calculate weighted average APY and moving averages.
    
    Args:
        merged_df: DataFrame with pool data
        
    Returns:
        DataFrame with calculated metrics
    """
    print("Calculating weighted average APY...")
    apy_cols = [col for col in merged_df.columns if col.startswith('apy_')]
    tvl_cols = [col for col in merged_df.columns if col.startswith('tvlUsd_')]
    
    merged_df['weighted_apy'] = 0
    total_tvl = merged_df[tvl_cols].sum(axis=1)
    
    for i in range(len(apy_cols)):
        apy_col = apy_cols[i]
        tvl_col = tvl_cols[i]
        merged_df['weighted_apy'] += merged_df[apy_col].fillna(0) * merged_df[tvl_col].fillna(0)
    
    merged_df['weighted_apy'] = merged_df['weighted_apy'] / total_tvl.replace(0, 1)
    
    # Calculate moving averages
    window_size = ROLLING_WINDOW_SIZES['short']
    merged_df['ma_apy_14d'] = merged_df['weighted_apy'].rolling(window=window_size, min_periods=1).mean()
    
    return merged_df


def _save_to_database(merged_df: pd.DataFrame, pool_data: Dict[str, Dict[str, Any]],
                     db_filename: str) -> None:
    """
    Save merged data and metadata to SQLite database.

    Args:
        merged_df: Merged DataFrame to save
        pool_data: Original pool data for metadata
        db_filename: Database filename
    """
    print(f"Saving data to SQLite database: {db_filename}")

    # Create directory if it doesn't exist
    db_dir = os.path.dirname(db_filename)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)
        print(f"Created directory: {db_dir}")

    conn = sqlite3.connect(db_filename)
    
    # Ensure we're starting with a clean slate
    cursor = conn.cursor()
    cursor.execute("DROP TABLE IF EXISTS pool_data")
    cursor.execute("DROP TABLE IF EXISTS pool_metadata")
    
    # Save main data
    merged_df.to_sql('pool_data', conn, if_exists='replace', index=True)
    
    # Save pool metadata (only for pools in final dataset)
    pool_metadata = _create_pool_metadata(merged_df, pool_data)
    metadata_df = pd.DataFrame(pool_metadata)
    metadata_df.to_sql('pool_metadata', conn, if_exists='replace', index=False)
    
    # Final cleanup
    cursor.execute("VACUUM")
    conn.commit()
    conn.close()
    
    print(f"Data successfully saved to {db_filename}")
    print(f"Final dataset contains {len(pool_metadata)} pools with valid data")


def _save_to_json(merged_df: pd.DataFrame, pool_data: Dict[str, Dict[str, Any]],
                  json_filename: str) -> None:
    """
    Save merged data and metadata to JSON file.

    Args:
        merged_df: Merged DataFrame to save
        pool_data: Original pool data for metadata
        json_filename: JSON filename
    """
    print(f"Saving data to JSON files...")

    # Create directory if it doesn't exist
    json_dir = os.path.dirname(DEFAULT_JSON_DATA_FILENAME)
    if json_dir and not os.path.exists(json_dir):
        os.makedirs(json_dir, exist_ok=True)
        print(f"Created directory: {json_dir}")

    # Prepare pool_data for JSON export
    pool_data_for_json = {}
    
    # Convert DataFrame to dictionary with date strings as keys
    for date in merged_df.index:
        date_str = str(date)
        pool_data_for_json[date_str] = {}
        
        for col in merged_df.columns:
            value = merged_df.loc[date, col]
            # Handle NaN values - convert to None for JSON compatibility
            if pd.isna(value):
                pool_data_for_json[date_str][col] = None
            else:
                pool_data_for_json[date_str][col] = float(value)
    
    # Create pool metadata (same as for SQLite)
    pool_metadata = _create_pool_metadata(merged_df, pool_data)
    
    # Save pool data to separate file
    pool_data_filename = DEFAULT_JSON_DATA_FILENAME
    pool_data_export = {
        'pool_data': pool_data_for_json,
        'export_info': {
            'export_timestamp': datetime.now().isoformat(),
            'date_range': {
                'start': str(merged_df.index.min()),
                'end': str(merged_df.index.max())
            },
            'total_data_points': len(merged_df)
        }
    }
    
    with open(pool_data_filename, 'w') as f:
        json.dump(pool_data_export, f, indent=2, default=str)
    
    # Save pool metadata to separate file
    pool_metadata_filename = DEFAULT_JSON_METADATA_FILENAME
    pool_metadata_export = {
        'pool_metadata': pool_metadata,
        'export_info': {
            'export_timestamp': datetime.now().isoformat(),
            'total_pools': len(pool_metadata)
        }
    }
    
    with open(pool_metadata_filename, 'w') as f:
        json.dump(pool_metadata_export, f, indent=2, default=str)
    
    print(f"Data successfully saved to:")
    print(f"  - {pool_data_filename}")
    print(f"  - {pool_metadata_filename}")
    print(f"JSON export contains {len(pool_metadata)} pools with valid data")


def _create_pool_metadata(merged_df: pd.DataFrame, 
                         pool_data: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Create metadata for pools that made it into the final dataset.
    
    Args:
        merged_df: Final merged DataFrame
        pool_data: Original pool data
        
    Returns:
        List of pool metadata dictionaries
    """
    pool_metadata = []
    final_pool_ids = set()

    # Extract pool IDs from column names
    for col in merged_df.columns:
        if col.startswith('apy_'):
            pool_id = col[4:]  # Remove 'apy_' prefix
            final_pool_ids.add(pool_id)

    for pool_id, pool_info in pool_data.items():
        if pool_id in final_pool_ids:
            pool_metadata.append({
                'pool_id': pool_id,
                'name': pool_info['name'],
                'current_tvl': pool_info['current_tvl'],
                'current_apy': pool_info['current_apy'],
                'chain': pool_info.get('chain', 'Unknown'),
                'project': pool_info.get('project', 'Unknown'),
                'symbol': pool_info.get('symbol', 'Unknown'),
                'last_updated': datetime.now().isoformat()
            })

    return pool_metadata


def fetch_and_process_pools(limit: int = 100, days: int = DEFAULT_FETCH_DAYS) -> Dict[str, Dict[str, Any]]:
    """
    Fetch and process data for top stablecoin pools.
    
    Args:
        limit: Number of top pools to fetch
        days: Number of days of historical data to fetch
        
    Returns:
        Dictionary containing processed pool data
    """
    top_pools = fetch_top_stablecoin_pools_by_tvl(limit)
    
    if not top_pools:
        print("No pools fetched. Exiting.")
        return {}
    
    print("\nTop 10 pools by TVL:")
    for i, pool in enumerate(top_pools[:10]):
        tvl = pool['tvlUsd']
        apy = pool.get('apy', 0)
        name = pool.get('name', 'Unknown')
        print(f"{i+1}. {name} - TVL: ${tvl:,.0f} - APY: {apy:.2f}%")
    
    print(f"\nFetching historical data for {len(top_pools)} pools...")
    pool_data = {}
    
    for i, pool in enumerate(top_pools):
        pool_id = pool['pool']
        pool_name = pool.get('name', f'Pool_{i}')
        
        df = fetch_pool_chart_data(pool_id, pool_name, days)
        if validate_dataframe(df):
            symbol = pool.get('symbol', 'Unknown')
            if isinstance(symbol, list):
                symbol = ', '.join(symbol)
            
            pool_data[pool_id] = {
                'data': df,
                'name': pool_name,
                'current_tvl': pool['tvlUsd'],
                'current_apy': pool.get('apy', 0),
                'chain': pool.get('chain', 'Unknown'),
                'project': pool.get('project', 'Unknown'),
                'symbol': symbol
            }
        
        time.sleep(RATE_LIMIT_DELAY)
    
    return pool_data


def print_summary_statistics(merged_df: pd.DataFrame, pool_data: Dict[str, Dict[str, Any]]) -> None:
    """
    Print comprehensive summary statistics for the dataset.
    
    Args:
        merged_df: Merged DataFrame with all pool data
        pool_data: Original pool data dictionary
    """
    print("\n=== Summary Statistics ===")
    print(f"Database contains data for {len(pool_data)} pools")
    print(f"Date range: {merged_df.index.min()} to {merged_df.index.max()}")
    print(f"Total data points: {len(merged_df)}")
    
    # Verify data freshness
    latest_date = merged_df.index.max()
    current_date = datetime.now().date()
    days_old = (current_date - latest_date).days
    print(f"Latest data date: {latest_date} (data is {days_old} days old)")
    
    if 'weighted_apy' in merged_df.columns:
        current_apy = merged_df['weighted_apy'].iloc[-1]
        mean_apy = merged_df['weighted_apy'].mean()
        print(f"Current DeFi Prime Rate: {current_apy:.4f}%")
        print(f"Mean DeFi Prime Rate: {mean_apy:.4f}%")
    
    print(f"\nData has been exported to:")
    print(f"  - SQLite: {DEFAULT_DB_FILENAME}")
    print(f"  - JSON Data: {DEFAULT_JSON_DATA_FILENAME}")
    print(f"  - JSON Metadata: {DEFAULT_JSON_METADATA_FILENAME}")
    print(f"All old data has been purged to prevent stale information.")


def main() -> None:
    """
    Main function to fetch, process, and save DeFi Prime Rate data.
    """
    # Purge existing database to ensure fresh data
    print("\n=== Purging existing database ===")
    purge_database()
    
    # Fetch and process pools
    print("\n=== Fetching top 100 stablecoin pools by TVL ===")
    pool_data = fetch_and_process_pools(limit=100, days=360)
    
    if not pool_data:
        print("No pool data fetched successfully. Exiting.")
        return
    
    # Merge and save data to database
    merged_df = merge_and_save_pool_data(pool_data)
    
    if merged_df is None:
        print("Failed to merge and save data. Exiting.")
        return
    
    # Print summary statistics
    print_summary_statistics(merged_df, pool_data)


if __name__ == "__main__":
    main()
