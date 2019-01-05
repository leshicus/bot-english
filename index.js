// @flow
import { config } from 'dotenv';
import { Bot } from './src/bot';
config();
const token = process.env.TELEGRAM_TOKEN;

if (!token) throw new Error('Telegram Bot Token not provided');

const bot = new Bot(token);
bot.run();
