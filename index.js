// @flow
import { Bot } from './src/bot';
import { runWebServer } from './src/koa';

process.env.NTBA_FIX_319 = '1';
let token;

if (process.env.NODE_ENV === 'development') {
  token = process.env.TELEGRAM_TEST_TOKEN;
} else {
  token = process.env.TELEGRAM_TOKEN;
}

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
