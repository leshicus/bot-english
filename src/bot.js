// @flow
import TelegramBot from 'node-telegram-bot-api';
import textBlocks from './test/text-blocks.json';
// const lessonsObj = {
//   '1': require('./test/1.json'),
//   '2': require('./test/2.json'),
// };
import { Mongo } from './mongo';
import lessons from './test/lessons.json';
import { log, shuffle } from './utils';
import type { Query, Message } from './types';
import { User, type Users } from './user';

const WORDS_IN_ROW = 3;
const CONTINUE = 'Дальше';
const DELETE = 'Удалить';
const EN = '<b>АНГ</b>: ';
const RU = '<b>РУС</b>: ';
const ANS = '<b>ОТВ</b>: ';

export class Bot {
  bot: TelegramBot;
  users: Users;
  mongo: Mongo;
  lessons: Object;

  constructor(token: string) {
    this.bot = new TelegramBot(token, { polling: true });
    this.users = {};

    this.mongo = new Mongo();

    (async () => {
      try {
        this.lessons = await this.mongo.getLessons();
        console.log('Загружено: ', this.lessons ? this.lessons.length : 0);
      } catch (e) {
        console.log('error 38:', e);
      }
    })();

    // console.log('this.mongo', this.mongo.lessons.findOne({ id: 1 }));
  }

  onStart = (msg: Message, match: Array<string>) => {
    console.log('onStart');

    const { from: { id, first_name, username, language_code } } = msg;

    this.registerUser(msg);

    this.bot.sendMessage(
      id,
      `Привет, ${first_name}!\nЭто бот для тренировки английских предложений. Вот доступные темы: `,
    );

    if (this.lessons && this.lessons.length) {
      this.showContents(id);
    } else {
      this.bot.sendMessage(id, `База с уроками не загружена. Загружаю...`);

      (async () => {
        this.lessons = await this.mongo.getLessons();
        console.log('Загружено: ', this.lessons.length);
        this.bot.sendMessage(id, `Загружено: ${this.lessons.length} уроков.`);
      })();
    }
  };

  registerUser(msg: Message) {
    console.log('registerUser');

    const { chat: { id }, from: { first_name, username, language_code } } = msg;

    if (this.users[id]) {
      return this.users[id];
    } else {
      const user = new User(id, first_name, username, language_code);
      this.users[id] = user;

      return user;
    }
  }

  showContents(chatId: number) {
    console.log('showContents');

    const topics =
      `<b>Темы</b>` +
      lessons.reduce((acc, topic) => {
        acc += `\n<b>${topic.title}</b>\n`;
        acc += topic.lessons.reduce((ac, lesson) => {
          ac += `/${lesson.id} ${lesson.title} \n`;

          return ac;
        }, '');

        return acc;
      }, '');

    this.bot.sendMessage(chatId, topics, { parse_mode: 'HTML' });
  }

  onStartLesson = (msg: Message, match: Array<string>) => {
    console.log('onStartLesson', msg, match);

    // if (this.mongo) console.log('this.mongo.lessons', this.mongo.lessons);

    const { chat: { id: chatId } } = msg;
    const lessonId = +match[0].slice(1);

    let user = this.users[chatId];

    if (!user) user = this.registerUser(msg);

    this.showSentences(chatId, 0, lessonId);
  };

  async showSentences(chatId: number, sentenceId: number, lessonId?: number) {
    console.log('showSentences', sentenceId, lessonId);

    let user = this.users[String(chatId)];
    let sentences;

    const allLessons = this.lessons;
    console.log('allLessons', allLessons);

    if (lessonId) {
      sentences = allLessons[lessonId];
    } else if (user.lesson.id != undefined) {
      sentences = allLessons[String(user.lesson.id)];
    }

    if (sentences) {
      const rus = sentences[sentenceId].rus;
      const eng = sentences[sentenceId].eng;

      this.users[String(chatId)].lesson = {
        id: lessonId ? lessonId : user.lesson.id,
        sentenceId: sentenceId,
        rus: this.processRussianSentence(rus),
        eng: eng.replace(/\./g, '').split(' '),
        engButtons: shuffle(eng.toLowerCase().replace(/\./g, '').split(' ')),
        engText: [],
      };
    }

    this.showSentence(chatId);
  }

  processRussianSentence(str: string): Array<string> {
    while (str.indexOf('[') !== -1) {
      const start = str.indexOf('[');
      const end = str.indexOf(']') + 1;
      const block = str.slice(start, end);

      const arrBlock = block.split('|');
      const replacement =
        arrBlock[0].slice(1) +
        ' (' +
        arrBlock[arrBlock.length - 1].slice(0, -1) +
        ')';

      str = str.replace(block, replacement);
    }

    return str.replace(/\./g, '').split(' ');
  }

  removePressedButton(chatId: number, idxToRemove?: number) {
    console.log('removePressedButton', idxToRemove);

    const user = this.users[String(chatId)];
    let { lesson: { engText, engButtons } } = user;

    if (idxToRemove != undefined && engButtons.length) {
      user.lesson.engButtons = engButtons.filter(
        (item, idx) => idx !== idxToRemove,
      );
      user.lesson.engText.push(engButtons[idxToRemove]);
    }
  }

  removeLastWord(chatId: number) {
    const user = this.users[String(chatId)];
    let { lesson: { engText, engButtons } } = user;

    if (engText.length) {
      user.lesson.engText = engText.slice(0, -1);
      user.lesson.engButtons.push(engText[engText.length - 1]);
    }
  }

  makeAnswerKeyboard(chatId: number) {
    console.log('makeAnswerKeyboard');

    const user = this.users[String(chatId)];
    let { lesson: { engButtons, engText } } = user;

    let answerKeyboard = [];
    let row = [];

    if (engButtons.length) {
      engButtons.forEach((word, idx) => {
        if (row.length === WORDS_IN_ROW) {
          answerKeyboard.push(row);
          row = [];
        }

        if (row.length < WORDS_IN_ROW) {
          row.push({
            text: word,
            callback_data: JSON.stringify({
              w: word,
              i: idx,
            }),
          });
        }

        // последний ряд, может быть не заполнен
        if (engButtons && idx === engButtons.length - 1) {
          answerKeyboard.push(row);
        }
      });

      if (engText.length)
        answerKeyboard.push([
          {
            text: DELETE,
            callback_data: JSON.stringify({
              w: DELETE,
            }),
          },
        ]);
    } else {
      answerKeyboard.push([
        {
          text: CONTINUE,
          callback_data: JSON.stringify({
            w: CONTINUE,
          }),
        },
      ]);
    }

    return answerKeyboard;
  }

  showSentence(chatId: number) {
    console.log('showSentence');
    const user = this.users[String(chatId)];

    const inline_keyboard = this.makeAnswerKeyboard(chatId);

    this.bot.sendMessage(
      chatId,
      this.markupText(`${RU}` + user.getRusString() + `\n${EN}`),
      {
        reply_markup: {
          inline_keyboard,
        },
        parse_mode: 'HTML',
      },
    );
  }

  markupText(str: string) {
    return str.replace(/\(/g, '(<i>').replace(/\)/g, '</i>)');
    // .replace(`${EN}:`, `<b>${EN}:</b>`)
    // .replace(`${RU}:`, `<b>${RU}:</b>`);
  }

  onCallbackQuery = (query: Query) => {
    console.log('onCallbackQuery', query);

    const {
      message: { chat: { id: chatId }, message_id, text } = {},
      data,
    } = query;
    const user = this.users[String(chatId)];

    const { i: idxToRemove, w: word } = JSON.parse(data);

    if (word === CONTINUE) {
      this.showSentences(chatId, user.lesson.sentenceId + 1);
    } else if (word === DELETE) {
      this.removeLastWord(chatId);

      const answerKeyboard = this.makeAnswerKeyboard(chatId);

      this.bot.editMessageText(
        this.markupText(
          `${RU}` + user.getRusString() + `\n${EN}` + user.getEngTextString(),
        ),
        {
          message_id,
          chat_id: chatId,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: answerKeyboard,
          },
        },
      );
    } else {
      this.removePressedButton(chatId, idxToRemove);

      const { lesson: { engButtons } } = user;

      if (engButtons && !engButtons.length) {
        // no buttons left, add 'continue'
        const answerKeyboard = this.makeAnswerKeyboard(chatId);
        console.log(answerKeyboard);
        this.bot.editMessageText(
          this.markupText(
            `${RU}` + user.getRusString() + `\n${EN}` + user.getEngTextString(),
          ) +
            `\n${ANS}` +
            user.getEngString(),
          {
            message_id,
            chat_id: chatId,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: answerKeyboard,
            },
          },
        );
      } else {
        // buttons still exist
        const answerKeyboard = this.makeAnswerKeyboard(chatId);

        this.bot.editMessageText(
          this.markupText(
            `${RU}` + user.getRusString() + `\n${EN}` + user.getEngTextString(),
          ),
          {
            message_id,
            chat_id: chatId,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: answerKeyboard,
            },
          },
        );
      }
    }
  };

  onMessage = (msg: Message) => {
    console.log('onMessage', msg);
  };

  run() {
    this.bot.onText(/\/start/, this.onStart);
    this.bot.onText(/^\/\d+$/, this.onStartLesson);
    this.bot.on('message', this.onMessage);
    this.bot.on('callback_query', this.onCallbackQuery);
  }
}
