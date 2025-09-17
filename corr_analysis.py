"""
Market Correlation Analysis Module

This module performs comprehensive correlation analysis between different assets
(Bitcoin, Ethereum, S&P 500) using various window sizes and creates heatmap
and time series visualizations.
"""

import os
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple
from dotenv import load_dotenv

from config import (
    API_ENDPOINTS, THEME_PALETTE, MUTED_BLUES, setup_plotting_style
)
from utils import (
    add_logo_overlay, safe_api_request, validate_dataframe, 
    print_data_summary, normalize_datetime_index, fetch_polygon_data
)

# Load environment variables
load_dotenv()


def fetch_all_market_data(days: int = 730) -> Dict[str, pd.DataFrame]:
    """
    Fetch market data for all required symbols.
    
    Args:
        days: Number of days of historical data to fetch
        
    Returns:
        Dictionary mapping symbols to DataFrames
    """
    api_key = os.getenv('POLYGON_API_KEY')
    if not api_key:
        raise ValueError("POLYGON_API_KEY environment variable not set")
    
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    print(f"Fetching data from {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")
    
    symbols = ['BTC', 'ETH', 'SPY']
    data = {}
    
    for symbol in symbols:
        df = fetch_polygon_data(symbol, start_date.strftime('%Y-%m-%d'), 
                               end_date.strftime('%Y-%m-%d'), api_key)
        if df is not None:
            data[symbol] = df
            print_data_summary(df, f"{symbol} Data")
    
    return data


def prepare_combined_dataset(data: Dict[str, pd.DataFrame]) -> Optional[pd.DataFrame]:
    """
    Prepare combined dataset with normalized timestamps.
    
    Args:
        data: Dictionary mapping symbols to DataFrames
        
    Returns:
        Combined DataFrame with all assets, or None if failed
    """
    if len(data) < 3:
        print("Insufficient data for analysis")
        return None
    
    print(f"\n=== Normalizing Timestamps ===")
    
    # Normalize all timestamps to remove time components
    normalized_data = {}
    for symbol, df in data.items():
        df_norm = normalize_datetime_index(df)
        normalized_data[symbol] = df_norm
        print(f"{symbol} first 5 dates: {df_norm.index[:5]}")
    
    # Find common date range
    common_start = max(df.index.min() for df in normalized_data.values())
    common_end = min(df.index.max() for df in normalized_data.values())
    
    print(f"\n=== Common Date Range ===")
    print(f"Common start: {common_start}")
    print(f"Common end: {common_end}")
    
    # Filter all datasets to common date range and combine
    combined_df = pd.DataFrame(index=normalized_data['BTC'][common_start:common_end].index)
    
    for symbol, df in normalized_data.items():
        filtered_df = df[common_start:common_end]
        combined_df[symbol] = filtered_df['close']
    
    # Remove any rows with missing values (non-trading days) instead of forward-filling
    # This ensures we only work with common trading days across all assets
    combined_df = combined_df.dropna()
    
    print_data_summary(combined_df, "Combined Dataset")
    print(f"Note: Removed {len(combined_df.index) - len(combined_df.dropna().index)} non-trading days")
    return combined_df


def calculate_correlation_matrices(returns: pd.DataFrame, windows: List[int], 
                                 plot_days: int = 360) -> Dict[str, np.ndarray]:
    """
    Calculate rolling correlation matrices for different window sizes.
    
    Args:
        returns: DataFrame with returns data
        windows: List of window sizes to calculate
        plot_days: Number of recent days to include in results
        
    Returns:
        Dictionary mapping correlation types to matrices
    """
    print(f"\n=== Calculating Correlation Matrices ===")
    
    # Calculate rolling correlations for each window
    btc_spy_matrix = np.zeros((len(windows), len(returns)))
    eth_btc_matrix = np.zeros((len(windows), len(returns)))
    eth_spy_matrix = np.zeros((len(windows), len(returns)))
    
    for i, window in enumerate(windows):
        btc_spy_matrix[i] = returns['BTC'].rolling(window).corr(returns['SPY'])
        eth_btc_matrix[i] = returns['ETH'].rolling(window).corr(returns['BTC'])
        eth_spy_matrix[i] = returns['ETH'].rolling(window).corr(returns['SPY'])
    
    # Select only the last N days for plotting
    plot_start_date = returns.index[-1] - timedelta(days=plot_days)
    plot_mask = returns.index >= plot_start_date
    
    return {
        'btc_spy': btc_spy_matrix[:, plot_mask],
        'eth_btc': eth_btc_matrix[:, plot_mask],
        'eth_spy': eth_spy_matrix[:, plot_mask],
        'dates': returns.index[plot_mask]
    }


def create_correlation_heatmaps(correlation_data: Dict[str, Any], windows: List[int]) -> None:
    """
    Create correlation heatmap visualizations.
    
    Args:
        correlation_data: Dictionary containing correlation matrices and dates
        windows: List of window sizes used
    """
    setup_plotting_style()
    
    btc_spy_matrix = correlation_data['btc_spy']
    eth_btc_matrix = correlation_data['eth_btc']
    eth_spy_matrix = correlation_data['eth_spy']
    dates = correlation_data['dates']
    
    if len(dates) == 0:
        print("Error: No dates for plotting. Exiting.")
        return
    
    # Convert dates to numeric values for plotting
    date_nums = np.array([d.toordinal() for d in dates])
    
    # Calculate axis formatting indices
    date_indices, window_indices = _calculate_axis_indices(dates, windows)
    
    # Create heatmap figure
    fig, (ax1, ax2, ax3) = plt.subplots(1, 3, figsize=(18, 5))
    
    # Create heatmaps
    _create_single_heatmap(ax1, btc_spy_matrix, date_nums, windows, 
                          date_indices, window_indices, dates, 'Bitcoin-SPY Correlation')
    _create_single_heatmap(ax2, eth_spy_matrix, date_nums, windows,
                          date_indices, window_indices, dates, 'Ethereum-SPY Correlation')
    _create_single_heatmap(ax3, eth_btc_matrix, date_nums, windows,
                          date_indices, window_indices, dates, 'Ethereum-Bitcoin Correlation')
    
    # Add logo overlays
    for ax in [ax1, ax2, ax3]:
        add_logo_overlay(ax)
    
    plt.tight_layout()
    plt.show()


def _calculate_axis_indices(dates: pd.DatetimeIndex, windows: List[int]) -> Tuple[List[int], List[int]]:
    """Calculate indices for axis formatting."""
    # Date indices
    n_dates = min(5, len(dates))
    if n_dates > 1:
        step = max(1, len(dates) // (n_dates - 1))
        date_indices = list(range(0, len(dates), step))
        if len(date_indices) < n_dates:
            date_indices.append(len(dates) - 1)
    else:
        date_indices = [0]
    
    # Window indices
    n_windows = min(5, len(windows))
    if n_windows > 1:
        window_step = max(1, len(windows) // (n_windows - 1))
        window_indices = list(range(0, len(windows), window_step))
        if len(window_indices) < n_windows:
            window_indices.append(len(windows) - 1)
    else:
        window_indices = [0]
    
    return date_indices, window_indices


def _create_single_heatmap(ax: plt.Axes, matrix: np.ndarray, date_nums: np.ndarray, 
                          windows: List[int], date_indices: List[int], 
                          window_indices: List[int], dates: pd.DatetimeIndex, title: str) -> None:
    """Create a single correlation heatmap."""
    im = ax.imshow(matrix, cmap='Pastel1', aspect='auto', 
                   extent=[date_nums[0], date_nums[-1], windows[0], windows[-1]], 
                   origin='lower')
    
    ax.set_xlabel('Date')
    ax.set_ylabel('Window Size (days)')
    ax.set_title(title)
    
    # Format axes
    ax.set_xticks([date_nums[i] for i in date_indices])
    ax.set_xticklabels([dates[i].strftime('%m-%d') for i in date_indices], rotation=45)
    ax.set_yticks([windows[i] for i in window_indices])
    
    # Add colorbar
    cbar = plt.colorbar(im, ax=ax, shrink=0.8)
    cbar.set_label('Correlation')


def create_beta_line_plots(returns: pd.DataFrame) -> None:
    """
    Create line plots showing beta coefficients over time.
    
    Args:
        returns: DataFrame with returns data
    """
    setup_plotting_style()
    
    fig, (ax1, ax2, ax3) = plt.subplots(3, 1, figsize=(12, 10))
    
    _plot_beta_for_pair(ax1, returns, 'BTC', 'SPY', 'Bitcoin-SPY Beta')
    _plot_beta_for_pair(ax2, returns, 'ETH', 'SPY', 'Ethereum-SPY Beta')
    _plot_beta_for_pair(ax3, returns, 'ETH', 'BTC', 'Ethereum-Bitcoin Beta')
    
    # Format x-axis dates for all subplots
    for ax in [ax1, ax2, ax3]:
        ax.xaxis.set_major_formatter(plt.matplotlib.dates.DateFormatter('%Y-%m'))
        ax.xaxis.set_major_locator(plt.matplotlib.dates.MonthLocator(interval=2))
        plt.setp(ax.xaxis.get_majorticklabels(), rotation=45, ha='right')
        add_logo_overlay(ax)
    
    plt.tight_layout()
    plt.show()

def _plot_beta_for_pair(ax: plt.Axes, returns: pd.DataFrame, dependent: str, independent: str, title: str) -> None:
    """Calculate and plot beta series for a given asset pair."""
    beta_30d = calculate_rolling_beta(returns[dependent], returns[independent], window=30)
    beta_90d = calculate_rolling_beta(returns[dependent], returns[independent], window=90)
    beta_180d = calculate_rolling_beta(returns[dependent], returns[independent], window=180)
    
    _plot_beta_series(ax, beta_30d, beta_90d, beta_180d, title)



def _plot_beta_series(ax: plt.Axes, beta_30d: pd.Series, beta_90d: pd.Series, beta_180d: pd.Series, title: str) -> None:
    """Plot beta series for a specific asset pair."""
    ax.plot(beta_30d.index, beta_30d, label='30-day', linewidth=2, color=MUTED_BLUES[0], alpha=0.2)
    ax.plot(beta_90d.index, beta_90d, label='90-day', linewidth=2, color=MUTED_BLUES[2], alpha=0.6)
    ax.plot(beta_180d.index, beta_180d, label='180-day', linewidth=2, color=MUTED_BLUES[1])
    ax.axhline(y=0, color=THEME_PALETTE[3], linestyle='--', alpha=0.7, linewidth=1)
    ax.axhline(y=1, color=THEME_PALETTE[2], linestyle=':', alpha=0.5, linewidth=1, label='Beta = 1')
    
    ax.set_title(title)
    ax.set_xlabel('Date')
    ax.set_ylabel('Beta Coefficient')
    ax.legend()
    ax.grid(True, alpha=0.3)


def main() -> None:
    """
    Main function to perform comprehensive correlation analysis.
    """
    try:
        # Step 1: Fetch market data for BTC, ETH, and SPY
        print("=== Market Correlation Analysis ===")
        data = fetch_all_market_data(days=730)
        
        if not data:
            print("Failed to fetch market data. Exiting.")
            return
        
        # Step 2: Prepare a combined dataset with a common date range
        combined_df = prepare_combined_dataset(data)
        
        if combined_df is None:
            print("Failed to prepare combined dataset. Exiting.")
            return
        
        # Step 3: Calculate daily returns
        returns = combined_df.pct_change().dropna()
        print_data_summary(returns, "Returns Data")
        
        if returns.empty:
            print("No returns data available. Exiting.")
            return
        
        # Step 4: Define analysis parameters
        windows = list(range(14, 181, 14))  # From 14 to 180 days, step 14
        
        # Step 5: Calculate rolling correlation matrices
        correlation_data = calculate_correlation_matrices(returns, windows, plot_days=360)
        
        # Step 6: Create and display visualizations
        print("\n=== Creating Correlation Heatmaps ===")
        create_correlation_heatmaps(correlation_data, windows)
        
        print("\n=== Creating Beta Line Plots ===")
        create_beta_line_plots(returns)
        
        print("Correlation analysis completed!")
        
    except Exception as e:
        print(f"Error in main analysis: {e}")
        raise



if __name__ == "__main__":
    main()
