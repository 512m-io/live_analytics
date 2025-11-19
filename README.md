# 512m Analytics

A comprehensive analytics platform for DeFi data visualization and Prime Rate analysis, featuring automated data fetching and interactive web-based charts.

## Overview

This project fetches data from DeFiLlama and other sources to:
- Calculate a weighted DeFi Prime Rate based on top stablecoin pools by TVL
- Generate interactive web-based visualizations with Plotly.js
- Create pie charts showing protocol and blockchain contributions
- Automate chart generation and image storage via GitHub Actions
- Provide real-time analytics through a static website

## Project Structure

### Core Data Fetching

- **`scripts/spr_fetcher_v1.py`** - Main data fetcher that calculates the DeFi Prime Rate
- **`scripts/config.py`** - Centralized configuration with constants and API endpoints
- **`scripts/utils.py`** - Common utility functions for data processing

### Interactive Visualization Scripts

- **`scripts/plotly_spr.js`** - Main SPR (Stablecoin Prime Rate) time-series visualization
- **`scripts/plotly_pool_contributions.js`** - Pool contribution analysis charts
- **`scripts/plotly_protocol_contributions.js`** - Protocol contribution pie chart
- **`scripts/plotly_chain_contributions.js`** - Blockchain contribution pie chart

### Data Files

- **`data/pool_data.json`** - Historical pool APY and TVL data
- **`data/pool_metadata.json`** - Pool metadata with current values
- **`data/defi_prime_rate.db`** - SQLite database with historical data
- **`charts/`** - Directory for storing generated chart images

### GitHub Actions

- **`.github/workflows/fetch-data.yml`** - Automated data fetching and chart generation
- **`.github/workflows/generate-charts.yml`** - Separate action for chart image generation

## Setup

### Prerequisites

- Python 3.8+
- Polygon.io API key (for Ethereum price data)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Create a `.env` file with your API key:
   ```
   POLYGON_API_KEY=your_polygon_api_key_here
   ```

### Dependencies

- `requests` - API calls
- `pandas` - Data manipulation
- `numpy` - Numerical computations
- `python-dotenv` - Environment variable management

## Usage

### 1. Fetch DeFi Prime Rate Data

```bash
python scripts/spr_fetcher_v1.py
```

This will:
- Fetch top stablecoin pools by TVL from DeFiLlama
- Calculate weighted average APY (the "DeFi Prime Rate")
- Save data to JSON and SQLite formats
- Generate pool metadata with current values

### 2. Interactive Web Visualizations

The project provides interactive web-based charts that can be viewed at:
- **SPR Analysis**: Live Prime Rate time-series data
- **Pool Contributions**: Individual pool contribution analysis
- **Protocol Contributions**: Pie chart breakdown by DeFi protocol
- **Chain Contributions**: Pie chart breakdown by blockchain

### 3. Automated Chart Generation

Charts are automatically generated via GitHub Actions:
- **Data Fetching**: Runs every 4 hours to update data
- **Image Generation**: Creates PNG files of all charts
- **Commit & Push**: Saves both data and chart images to repository

## Key Features

### Data Sources
- **DeFiLlama**: Pool APY and TVL data
- **Polygon.io**: Ethereum and traditional market price data

### Visualization Types
- **Time-series charts**: SPR historical trends with moving averages
- **Contribution analysis**: Pool, protocol, and chain breakdowns
- **Pie charts**: Interactive protocol and blockchain contributions
- **Academic styling**: Serif fonts, consistent color theming, logo overlays

### Automation Features
- **Scheduled updates**: Data refreshes every 4 hours
- **Chart image generation**: Automatic PNG export
- **Git integration**: Commits changes with timestamps
- **Error handling**: Retry logic and graceful failures

## Data Sources
- **DeFiLlama**: Pool APY and TVL data
- **Polygon.io**: Ethereum and traditional market price data

## Configuration

### Customizing Analysis Parameters

Edit `scripts/config.py` to modify:
- Pool selection criteria
- API endpoints
- Data processing parameters

## GitHub Actions

### Automated Workflow Chain

The project uses a two-step automated workflow:

#### 1. Data Fetching Workflow (`.github/workflows/fetch-data.yml`)
- **Triggers**: Every 4 hours via cron, or manual dispatch
- **Purpose**: Fetches fresh DeFi data from APIs
- **Steps**:
  1. Runs Python scripts to fetch latest pool data
  2. Updates JSON files and SQLite database
  3. Commits and pushes data changes
- **Output**: Fresh data in `data/` directory

#### 2. Chart Generation Workflow (`.github/workflows/generate-charts.yml`)
- **Triggers**: Automatically after successful data fetching completion, or manual dispatch
- **Purpose**: Generates PNG images of all interactive charts
- **Steps**:
  1. Sets up Node.js and Puppeteer environment
  2. Visits live chart pages and downloads PNG versions
  3. Commits and pushes chart image updates
- **Output**: Updated chart images in `charts/` directory

### Generated Chart Images

All charts are automatically saved as PNG files in the `charts/` directory:
- `spr_chart.png` - Main SPR time-series visualization
- `pool_contributions.png` - Pool contribution analysis
- `protocol_contributions.png` - Protocol pie chart
- `chain_contributions.png` - Blockchain pie chart

## Data Format

### JSON Structure
- `pool_data.json`: Historical time-series data with dates, APYs, and TVL
- `pool_metadata.json`: Current pool information with names, chains, and projects

### Database
- `defi_prime_rate.db`: SQLite database with all historical records

## Contributing

When adding new features:
1. Use the existing `scripts/config.py` for constants
2. Add reusable functions to `scripts/utils.py`
3. Follow the established JavaScript patterns for visualizations
4. Include comprehensive error handling
5. Test chart generation before committing

## Notes

- All timestamps are normalized to handle timezone differences
- Rate limiting is implemented for API calls
- The database is purged and refreshed on each run to ensure data freshness

## License

This project is for research and educational purposes.