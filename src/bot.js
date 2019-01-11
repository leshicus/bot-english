// @flow

import TelegramBot from 'node-telegram-bot-api';
import { Mongo } from './mongo';
import { log, shuffle, processRussianSentence, markupText } from './utils';
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
  lessons: Array<Object>;
  lessonsList: Array<Object>;

  constructor(token: string) {
    this.bot = new TelegramBot(token, { polling: false });

    this.users = {};

    this.mongo = new Mongo();
  }

  onStart = (msg: Message, match: Array<string>) => {
    log('onStart');

    const { from: { id, first_name, username, language_code } } = msg;

    this.registerUser(msg);

    this.bot.sendMessage(
      id,
      `Привет, ${first_name}!\nЭто бот для тренировки английских предложений. Вот доступные темы: `,
    );

    if (
      this.mongo.lessons &&
      this.mongo.lessons.length &&
      this.mongo.lessonsList &&
      this.mongo.lessonsList.length
    ) {
      this.showContents(id);
    } else {
      this.bot.sendMessage(id, `База с уроками не загружена. Загружаю...`);

      (async () => {
        try {
          const lessons = await this.mongo.loadLessons();
          const lessonsList = await this.mongo.loadLessonsList();

          this.bot.sendMessage(id, `Загружено: ${lessonsList.length} тем.`);
          this.bot.sendMessage(id, `Загружено: ${lessons.length} уроков.`);

          if (
            this.mongo.lessons &&
            this.mongo.lessons.length &&
            this.mongo.lessonsList &&
            this.mongo.lessonsList.length
          ) {
            this.showContents(id);
          }
        } catch (error) {
          console.log(error);
        }
      })();
    }
  };

  registerUser(msg: Message) {
    log('registerUser');

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
    log('showContents');

    if (this.mongo.lessonsList && this.mongo.lessonsList.length) {
      const topics =
        `<b>Темы</b>` +
        this.mongo.lessonsList.reduce((acc, topic) => {
          acc += `\n<b>${topic.title}</b>\n`;

          if (topic.lessons && topic.lessons.length) {
            acc += topic.lessons.reduce((ac, lesson) => {
              ac += `/${lesson.id} ${lesson.title} \n`;

              return ac;
            }, '');
          }

          return acc;
        }, '');

      this.bot.sendMessage(chatId, topics, { parse_mode: 'HTML' });
    } else {
      this.bot.sendMessage(chatId, 'Темы не загружены', { parse_mode: 'HTML' });
    }
  }

  onStartLesson = (msg: Message, match: Array<string>) => {
    log('onStartLesson', msg, match);

    const { chat: { id: chatId } } = msg;
    const lessonNum = +match[0].slice(1);

    let user = this.users[chatId];

    if (!user) user = this.registerUser(msg);

    this.showSentences(chatId, 0, lessonNum);
  };

  showSentences(chatId: number, sentenceId: number, lessonNum?: number) {
    log('showSentences. sentenceId=', sentenceId, 'lessonNum=', lessonNum);

    if (!this.mongo.lessons || !this.mongo.lessons.length) {
      log('Не загружены уроки');
      return;
    }

    if (lessonNum !== undefined && lessonNum > this.mongo.lessons.length - 1) {
      log(
        `Номер урока ${lessonNum} больше допустимого значения: ${this.mongo
          .lessons.length - 1}`,
      );
      return;
    }

    let user = this.users[String(chatId)];
    let sentences;

    if (lessonNum !== undefined) {
      sentences = this.mongo.lessons[lessonNum - 1];
    } else if (user.lesson.id != undefined) {
      sentences = this.mongo.lessons[user.lesson.id];
    }

    if (sentences && sentences[sentenceId]) {
      const rus = sentences[sentenceId].rus;
      const eng = sentences[sentenceId].eng;

      this.users[String(chatId)].lesson = {
        id: lessonNum ? lessonNum + 1 : user.lesson.id,
        sentenceId: sentenceId,
        rus: processRussianSentence(rus),
        eng: eng.replace(/\./g, '').split(' '),
        engButtons: shuffle(eng.toLowerCase().replace(/\./g, '').split(' ')),
        engText: [],
      };
    }

    this.showSentence(chatId);
  }

  showSentence(chatId: number) {
    log('showSentence');

    const user = this.users[String(chatId)];

    const inline_keyboard = this.makeAnswerKeyboard(chatId);

    this.bot.sendMessage(
      chatId,
      markupText(`${RU}` + user.getRusString() + `\n${EN}`),
      {
        reply_markup: {
          inline_keyboard,
        },
        parse_mode: 'HTML',
      },
    );
  }

  removePressedButton(chatId: number, idxToRemove?: number) {
    log('removePressedButton', idxToRemove);

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
    log('makeAnswerKeyboard');

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

  onCallbackQuery = (query: Query) => {
    log('onCallbackQuery', query);

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
        markupText(
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
        log(answerKeyboard);
        this.bot.editMessageText(
          markupText(
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
          markupText(
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
    log('onMessage', msg);
  };

  run() {
    this.bot.onText(/\/start/, this.onStart);
    this.bot.onText(/^\/\d+$/, this.onStartLesson);
    this.bot.on('message', this.onMessage);
    this.bot.on('callback_query', this.onCallbackQuery);
  }
}
