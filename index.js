require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_TOKEN;

if (!token) throw new Error('Telegram Bot Token not provided');

const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/echo (.+)/, (msg, match) => {
  console.log('onText', msg, match);
  const chatId = msg.chat.id;
  const resp = match[1];

  bot.sendMessage(chatId, resp);
});

bot.on('message', msg => {
  const chatId = msg.chat.id;
  console.log('message', msg);
  bot.sendMessage(chatId, 'received');
});
