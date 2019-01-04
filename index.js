// @flow
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const { start, startLesson, onCallbackQuery, message } = require('./src/botCommands');

const token = process.env.TELEGRAM_TOKEN;

if (!token) throw new Error('Telegram Bot Token not provided');

const bot = new TelegramBot(token, { polling: true });

// const keyboard = {
//   keyboard: [
//     [
//       { text: 'Sample text' },
//       { text: 'Second sample', callback_data: 'COMMAND_TEMPLATE1' },
//     ],
//     [ 'Keyboard' ],
//     [ "I'm robot" ],
//   ],
// };

// /\/start (.+)/
bot.onText(/\/start/, (msg, match) => start(bot, msg, match));

bot.onText(/^\/\d+$/, (msg, match) => startLesson(bot, msg, match));

bot.on('message', msg => onMessage(bot, msg));

bot.on('callback_query', query => onCallbackQuery(bot, query));

// bot.removeReplyListener(replyListenerId);

// bot.editMessageText('Выберете шаблон',{
//   chat_id: chat.id,
//   message_id:message_id,
//   reply_markup: {
//       inline_keyboard
//   }
// })
