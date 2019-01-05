//@flow
import { TelegramBot } from 'node-telegram-bot-api';
import textBlocks from './test/text-blocks.json';
const lessonsObj = {
  '1': require('./test/1.json'),
  '2': require('./test/2.json'),
};
import lessons from './test/lessons.json';
import { log } from './utils';

const lesson = {
  id: 1,
  sentenceId: 0,
  rus: '',
  eng: [],
  bot: null,
  chatId: null,
};

const start = (bot: typeof TelegramBot, msg: Object, match: Array<string>) => {
  log(msg);

  lesson.bot = bot;
  lesson.chatId = msg.chat.id;

  bot.sendMessage(
    msg.chat.id,
    `Привет, ${msg.from
      .first_name}!\nЭто бот для тренировки английских предложений. Вот доступные темы: `,
  );

  showContents(bot, msg.chat.id);
};

const showContents = (bot, chatId) => {
  const topics =
    `<b>Темы</b>` +
    lessons.reduce((acc, topic) => {
      acc += `\n <b>${topic.title}</b>\n`;
      acc += topic.lessons.reduce((ac, lesson) => {
        ac += `/${lesson.id} ${lesson.title} \n`;

        return ac;
      }, '');

      return acc;
    }, '');

  bot.sendMessage(chatId, topics, { parse_mode: 'HTML' });
};

// [ '/60', index: 0, input: '/60' ]
const startLesson = (
  bot: typeof TelegramBot,
  msg: Object,
  match: Array<string>,
) => {
  const { chat: { id: chatId } } = msg;
  const lessonId = +match[0].slice(1);
  const sentences = lessonsObj[lessonId];

  lesson.id = lessonId;
  lesson.sentenceId = 0;
  lesson.rus = sentences[0].rus;
  lesson.eng = sentences[0].eng.slice(0, -1).split(' ');

  showSentences({ bot, chatId, sentenceId: 0, lessonId });
};

const makeAnswerKeyboard = (lessonId, sentenceId, idxToRemove = '') => {
  const sentences = lessonsObj[lessonId];
  const sentenceEng = sentences[sentenceId].eng;
  let sentenceArray = sentenceEng.slice(0, -1).split(' ');

  // console.log('sentenceArray before', sentenceArray);

  const arrIdxToRemove = idxToRemove.split(',');

  // console.log('sentenceArray after', sentenceArray);
  let answerKeyboard = [];
  let row = [];
  console.log('arrIdxToRemove', arrIdxToRemove);
  sentenceArray.forEach((word, idx) => {
    if (
      (row.length === 3 || idx === sentenceArray.length) &&
      !arrIdxToRemove.includes(idx)
    ) {
      answerKeyboard.push(row);
      row = [];
    }
    row.push({
      text: word,
      callback_data: JSON.stringify({
        w: word,
        i: idxToRemove.length ? idxToRemove + ',' + idx : String(idx),
        l: lessonId,
        s: sentenceId,
      }),
    });
    if (idx === sentenceArray.length - 1 && !arrIdxToRemove.includes(idx)) {
      answerKeyboard.push(row);
    }
  });

  return answerKeyboard;
};

const showSentences = async ({
  bot,
  chatId,
  sentenceId,
  lessonId,
  answerId,
  questionId,
  replyId,
}: {
  bot: typeof TelegramBot,
  chatId: number,
  sentenceId: number,
  lessonId: number,
  answerId?: number,
  questionId?: number,
  replyId?: number,
}) => {
  const sentences = lessonsObj[lessonId];
  const sentenceRus = sentences[sentenceId].rus;

  const inline_keyboard = makeAnswerKeyboard(lessonId, sentenceId);
  console.log('inline_keyboard', inline_keyboard);
  const questionMsg = await bot.sendMessage(
    chatId,
    '<b>RU:</b> ' + sentenceRus + '\n<b>EN:</b>',
    {
      reply_markup: {
        inline_keyboard,
      },
      parse_mode: 'HTML',
    },
  );
};

const onCallbackQuery = (bot: typeof TelegramBot, query: Object) => {
  const {
    message: { chat: { id: chatId }, message_id, text } = {},
    data,
  } = query;
  console.log('query', query);

  const { l: lessonId, s: sentenceId, i: idxToRemove, w: word } = JSON.parse(
    data,
  );
  console.log(lessonId, sentenceId, idxToRemove);

  const answerKeyboard = makeAnswerKeyboard(lessonId, sentenceId, idxToRemove);
  console.log('answerKeyboard', answerKeyboard);
  bot.editMessageText(text + ' ' + word, {
    chat_id: chatId,
    message_id,
    reply_markup: {
      inline_keyboard: answerKeyboard,
    },
  });

  // bot.answerCallbackQuery({
  //   callback_query_id: query.id,
  //   text: 'text from answerCallbackQuery',
  // });
};

const onMessage = (bot: typeof TelegramBot, msg: Object) => {
  console.log('onMessage', msg);
};

module.exports = {
  start,
  startLesson,
  onCallbackQuery,
  onMessage,
};
