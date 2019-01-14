// @flow
import { Bot } from './src/bot';
import { runWebServer } from './src/koa';

process.env.NTBA_FIX_319 = '1';

const token = process.env.TELEGRAM_TOKEN;

if (token) {
  try {
    const bot = new Bot(token);
    bot.run();

    runWebServer(bot);
  } catch (e) {
    console.log(e);
  }
} else {
  console.log('Telegram Bot Token not provided');
  process.exit(1);
}
