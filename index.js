// @flow
import { config } from 'dotenv';
import { Bot } from './src/bot';
config();
const token = process.env.TELEGRAM_TOKEN;

if (token) {
  try {
    const bot = new Bot(token);
    bot.run();
  } catch (e) {
    console.log(e);
  }
} else {
  console.log('Telegram Bot Token not provided');
  process.exit(1);
}
