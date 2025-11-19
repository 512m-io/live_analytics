# Stablecoin Prime Rate Analytics

Python utilities, JSON exports, and embeddable Plotly widgets that power the Stablecoin Prime Rate section of [512m.io/analytics](https://512m.io/analytics). The tooling ingests the top TVL-weighted stablecoin pools from DeFiLlama, computes the Stablecoin Prime Rate (SPR), publishes the data to GitHub Pages, and keeps downstream consumers (Squarespace embeds + Telegram alerts) in sync.

---

## Overview

- Fetch the top stablecoin pools via the DeFiLlama yields API and calculate a TVL-weighted prime rate (`scripts/spr_fetcher_v1.py`).
- Store clean history in both SQLite (`data/defi_prime_rate.db`) and JSON (`data/pool_data.json`, `data/pool_metadata.json`) for publishing.
- Serve drop-in Plotly widgets (`scripts/plotly_spr.js`, `scripts/plotly_pool_contributions.js`) that hydrate Squarespace with the hosted JSON.
- Ship opt-in Telegram notifications (`notifications/telegram_bot.py`) summarizing the daily SPR move.

The repo is optimized for GitHub Pages hosting: committing the refreshed `data/` artifacts automatically updates the live experience embedded on https://512m-io.github.io/live_analytics (and, by extension, https://512m.io/analytics).

---

## Architecture at a Glance

1. **Ingestion & Processing**  
   `scripts/spr_fetcher_v1.py` purges the local DB, downloads pool-level chart data, merges it into a uniform index, and computes `weighted_apy` plus a 14-day moving average.

2. **Data Products**  
   - SQLite tables (`pool_data`, `pool_metadata`) for internal analysis.  
   - JSON exports designed for static hosting (`pool_data.json`, `pool_metadata.json`) with embedded metadata about export timeframes.

3. **Front-End Delivery**  
   `scripts/plotly_spr.js` and `scripts/plotly_pool_contributions.js` fetch the JSON directly from GitHub Pages, render Plotly charts in Squarespace, and hydrate statistics blocks beneath each chart. Lightweight HTML wrappers live in `pages/` for quick manual previews.

4. **Notifications**  
   `notifications/telegram_bot.py` reads the JSON locally (or from a downstream clone), computes day-over-day deltas, and posts formatted updates through Telegram Bot API credentials.

5. **Static Assets & Screenshots**  
   `public/512m_logo.png` is used as a watermark inside Plotly charts, and `charts/` stores the latest PNG exports for documentation or social sharing.

---

## Repository Layout

| Path | Purpose |
|------|---------|
| `scripts/` | Core Python + JS utilities: config, helpers, data fetcher, and Plotly embeds. |
| `data/` | Generated artifacts (SQLite DB + JSON) consumed by GitHub Pages and automations. |
| `pages/` | Minimal HTML stubs that load the Plotly bundles for local preview/testing. |
| `public/` | Static assets (currently the 512M watermark). |
| `charts/` | Snapshot PNG charts generated from the analytics pipeline. |
| `notifications/` | Telegram bot for daily Stablecoin Prime Rate digests. |
| `requirements.txt` | Python dependencies for the data pipeline. |

---

## Setup

### Prerequisites

- Python 3.10+
- A GitHub Pages branch (or any static host) for serving `data/*.json` and the `scripts/*.js` bundles.
- (Optional) Telegram Bot API token and chat ID for notifications.

### Installation

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Environment variables (`.env` is supported when available):

```
TELEGRAM_BOT_TOKEN=xxxxxxxxxxxxxxxxxxxx
TELEGRAM_CHAT_ID=123456789
```

The fetcher only requires public APIs today, so no Polygon/Coingecko keys are necessary unless you extend the pipeline.

---

## Usage

### 1. Refresh the Stablecoin Prime Rate dataset

```bash
python scripts/spr_fetcher_v1.py
```

What happens:

- Purges `data/defi_prime_rate.db`.
- Pulls ~360 days of history for the top 100 stablecoin pools (filters non-stable, 0% APY, and Merkl pools).
- Merges APY + TVL data, computes `weighted_apy` and `ma_apy_14d`.
- Saves the normalized dataset to SQLite and JSON, writing helpful export metadata along the way.
- Prints summary stats (pool counts, date ranges, latest SPR, etc.).

Commit and push the updated `data/` folder to refresh https://512m-io.github.io/live_analytics and, consequently, the live Squarespace embeds.

### 2. Preview the interactive charts locally

```bash
# From repo root
python -m http.server 8000
# Navigate to http://localhost:8000/pages/spr.html
```

Both HTML files simply load the self-contained Plotly bundles from `scripts/`. Update `CONFIG.dataUrl` / `metadataUrl` in each JS file if you host the JSON elsewhere.

### 3. Send the Telegram digest (optional)

```bash
python notifications/telegram_bot.py
```

The bot:

- Reads the latest JSON exports from `data/`.
- Computes daily changes in `weighted_apy` and `ma_apy_14d`.
- Posts a formatted HTML message (with emojis and direct links to `512m.io/analytics`) into the configured chat.  
Schedule it via cron/GitHub Actions once satisfied locally.

---

## Configuration

Centralized in `scripts/config.py`:

- `API_ENDPOINTS` – DeFiLlama + CoinGecko URLs.  
- `DEFAULT_FETCH_DAYS`, `RATE_LIMIT_DELAY`, `ROLLING_WINDOW_SIZES` – control ingestion scope and smoothing windows.  
- `SPECIFIC_POOL_IDS`, `POOL_NAMES`, `DISPLAY_POOL_NAMES` – quick mappings for featured pools in downstream charts.  
- `DEFAULT_LOGO_PATH` / alpha – watermark settings used by the Plotly bundles.

Adjusting these constants keeps the rest of the pipeline untouched.

---

## Data Schema

### SQLite (`data/defi_prime_rate.db`)

- `pool_data`  
  - Indexed by `date`.  
  - Contains paired columns `apy_<pool_id>` and `tvlUsd_<pool_id>` for every pool retained after cleaning.  
  - Includes computed columns `weighted_apy` and `ma_apy_14d`.

- `pool_metadata`  
  - `pool_id`, `name`, `current_tvl`, `current_apy`, `chain`, `project`, `symbol`, `last_updated`.

### JSON Exports

- `pool_data.json`  
  ```
  {
    "pool_data": {
      "2024-05-01": {
        "apy_<pool_id>": 12.3,
        "tvlUsd_<pool_id>": 1.2e8,
        "weighted_apy": 9.87,
        "ma_apy_14d": 9.54,
        …
      },
      …
    },
    "export_info": {
      "export_timestamp": "...",
      "date_range": { "start": "...", "end": "..." },
      "total_data_points": 360
    }
  }
  ```

- `pool_metadata.json` mirrors the SQLite metadata and adds its own `export_info`.

These schemas are consumed verbatim by the hosted Plotly charts, so keep backward compatibility in mind when making changes.

---

## Extending the System

- **Add/remove pools:** tweak the filters inside `fetch_top_stablecoin_pools_by_tvl` or seed `SPECIFIC_POOL_IDS` for guaranteed coverage.  
- **Change smoothing windows:** edit `ROLLING_WINDOW_SIZES` in `config.py`.  
- **New embeds:** clone an existing Plotly bundle, update the copy’s `CONFIG` URLs, and drop it into a new Squarespace block.  
- **More alerts:** reuse `notifications/telegram_bot.py` as a template for Slack/email handlers.

---

## License

Research & educational use only. See repository history for attribution and updates.