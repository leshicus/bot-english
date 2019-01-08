// @flow
import { config } from 'dotenv';
import { Bot } from './src/bot';
config();
const token = process.env.TELEGRAM_TOKEN;

if (token) {
  const bot = new Bot(token);
  bot.run();
} else {
  console.log('Telegram Bot Token not provided');
  process.exit(1);
}
