#!/usr/bin/env python3
"""
Telegram Bot for Daily DeFi Prime Rate Notifications

This script reads the latest DeFi analytics data from local JSON files
and sends daily notifications via Telegram with the current stablecoin prime rate,
14-day moving average, and daily changes.
"""

import os
import json
import requests
from datetime import datetime
from typing import Dict, List, Optional
import logging

# Try to load .env file if it exists (for local development)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not available (e.g., in GitHub Actions)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TelegramBot:
    def __init__(self, bot_token: str, chat_id: str):
        """Initialize Telegram bot with token and chat ID."""
        self.bot_token = bot_token
        self.chat_id = chat_id
        self.api_url = f"https://api.telegram.org/bot{bot_token}"
    
    def send_message(self, message: str, parse_mode: str = "HTML") -> bool:
        """Send a message via Telegram bot."""
        url = f"{self.api_url}/sendMessage"
        payload = {
            "chat_id": self.chat_id,
            "text": message,
            "parse_mode": parse_mode
        }
        
        try:
            response = requests.post(url, json=payload, timeout=30)
            response.raise_for_status()
            logger.info("Message sent successfully to Telegram")
            return True
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to send Telegram message: {e}")
            return False


class DataLoader:
    def __init__(self, data_dir: str = "../data"):
        """Initialize data loader with data directory path."""
        self.data_dir = data_dir
        self.pool_data_file = os.path.join(data_dir, "pool_data.json")
        self.pool_metadata_file = os.path.join(data_dir, "pool_metadata.json")
    
    def load_pool_data(self) -> Optional[Dict]:
        """Load pool data from local JSON file."""
        try:
            with open(self.pool_data_file, 'r') as f:
                data = json.load(f)
            logger.info(f"Successfully loaded pool data from {self.pool_data_file}")
            return data
        except FileNotFoundError:
            logger.error(f"Pool data file not found: {self.pool_data_file}")
            return None
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse pool data JSON: {e}")
            return None
    
    def load_pool_metadata(self) -> Optional[Dict]:
        """Load pool metadata from local JSON file."""
        try:
            with open(self.pool_metadata_file, 'r') as f:
                data = json.load(f)
            logger.info(f"Successfully loaded pool metadata from {self.pool_metadata_file}")
            return data
        except FileNotFoundError:
            logger.error(f"Pool metadata file not found: {self.pool_metadata_file}")
            return None
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse pool metadata JSON: {e}")
            return None


class AnalyticsCalculator:
    @staticmethod
    def get_sorted_dates(pool_data: Dict) -> List[str]:
        """Get sorted list of dates from pool data."""
        dates = list(pool_data['pool_data'].keys())
        dates.sort(key=lambda x: datetime.strptime(x, '%Y-%m-%d'))
        return dates
    
    @staticmethod
    def calculate_daily_stats(pool_data: Dict) -> Optional[Dict]:
        """Calculate current stats and daily changes."""
        try:
            dates = AnalyticsCalculator.get_sorted_dates(pool_data)
            if len(dates) < 2:
                logger.error("Insufficient data points for analysis")
                return None
            
            latest_date = dates[-1]
            previous_date = dates[-2]
            
            latest_data = pool_data['pool_data'][latest_date]
            previous_data = pool_data['pool_data'][previous_date]
            
            # Current metrics
            current_prime_rate = latest_data.get('weighted_apy', 0)
            current_ma_14d = latest_data.get('ma_apy_14d', 0)
            
            # Previous metrics
            previous_prime_rate = previous_data.get('weighted_apy', 0)
            previous_ma_14d = previous_data.get('ma_apy_14d', 0)
            
            # Calculate changes
            prime_rate_change = current_prime_rate - previous_prime_rate
            ma_14d_change = current_ma_14d - previous_ma_14d
            
            return {
                'date': latest_date,
                'previous_date': previous_date,
                'current_prime_rate': current_prime_rate,
                'current_ma_14d': current_ma_14d,
                'prime_rate_change': prime_rate_change,
                'ma_14d_change': ma_14d_change,
                'data_points': len(dates)
            }
            
        except Exception as e:
            logger.error(f"Error calculating daily stats: {e}")
            return None


class MessageFormatter:
    @staticmethod
    def format_change(value: float) -> str:
        """Format a change value with appropriate emoji and sign."""
        if value > 0:
            emoji = "📈"
            sign = "+"
        elif value < 0:
            emoji = "📉"
            sign = ""
        else:
            emoji = "➡️"
            sign = ""
        
        return f"{emoji} {sign}{value:.3f}%"
    
    @staticmethod
    def create_daily_message(stats: Dict, metadata: Optional[Dict] = None) -> str:
        """Create formatted daily statistics message."""
        date_obj = datetime.strptime(stats['date'], '%Y-%m-%d')
        formatted_date = date_obj.strftime('%B %d, %Y')
        
        prime_rate_change = MessageFormatter.format_change(stats['prime_rate_change'])
        ma_14d_change = MessageFormatter.format_change(stats['ma_14d_change'])
        
        # Get pool count from metadata if available
        pool_count = stats['data_points']
        if metadata and 'pool_metadata' in metadata:
            pool_count = len(metadata['pool_metadata'])
        
        message = f"""<b>🏦 DeFi Prime Rate Daily Update</b>

📊 <b>Data for {formatted_date}</b>

💰 <b>Current Prime Rate:</b> {stats['current_prime_rate']:.3f}%
📅 <b>14-Day Moving Average:</b> {stats['current_ma_14d']:.3f}%

📈 <b>Daily Changes:</b>
• Prime Rate: {prime_rate_change}
• 14-Day MA: {ma_14d_change}

🔗 Check out the full analytics on <a href="https://512m.io/analytics">512m.io/analytics</a>!

<i>Data from {pool_count} stablecoin pools</i>"""
        
        return message


def main():
    """Main function to load data, calculate stats, and send Telegram notification."""
    # Get environment variables
    bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
    chat_id = os.getenv('TELEGRAM_CHAT_ID')
    
    if not bot_token:
        logger.error("TELEGRAM_BOT_TOKEN environment variable not set")
        return False
    
    if not chat_id:
        logger.error("TELEGRAM_CHAT_ID environment variable not set")
        return False
    
    # Initialize components
    telegram_bot = TelegramBot(bot_token, chat_id)
    data_loader = DataLoader()
    
    # Load data from local files
    logger.info("Loading pool data from local files...")
    pool_data = data_loader.load_pool_data()
    if not pool_data:
        error_message = "❌ <b>Error:</b> Failed to load DeFi analytics data from local files."
        telegram_bot.send_message(error_message)
        return False
    
    # Load metadata (optional)
    pool_metadata = data_loader.load_pool_metadata()
    
    # Calculate statistics
    logger.info("Calculating daily statistics...")
    stats = AnalyticsCalculator.calculate_daily_stats(pool_data)
    if not stats:
        error_message = "❌ <b>Error:</b> Failed to calculate daily statistics. Data may be incomplete."
        telegram_bot.send_message(error_message)
        return False
    
    # Format and send message
    logger.info("Formatting and sending message...")
    message = MessageFormatter.create_daily_message(stats, pool_metadata)
    success = telegram_bot.send_message(message)
    
    if success:
        logger.info("Daily notification sent successfully!")
        return True
    else:
        logger.error("Failed to send daily notification")
        return False


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
