// @flow
import TelegramBot from 'node-telegram-bot-api';
import { Mongo } from './mongo';
import {
  log,
  logMsg,
  shuffle,
  processRussianSentence,
  markupText,
} from './utils';
import type { Query, Message } from './types';
import { User, type Users } from './user';
import { type Lesson } from './user';
import { MSG_MAX_LEN } from './constants';

const WORDS_IN_ROW = 3;
const CONTINUE = 'Дальше';
const DELETE = 'Удалить';
const EN = '<b>АНГ</b>: ';
const RU = '<b>РУС</b>: ';
const ANS = '<b>ОТВ</b>: ';
const TG_MAX_LENGTH = 4096; // telegram msg max length

const DEBUG_MONGO = process.env.DEBUG_MONGO;

const DELETE_BUTTON = {
  text: DELETE,
  callback_data: JSON.stringify({
    w: DELETE,
  }),
};
const CONTINUE_BUTTON = {
  text: CONTINUE,
  callback_data: JSON.stringify({
    w: CONTINUE,
  }),
};

export class Bot {
  bot: TelegramBot;
  users: Users;
  mongo: Mongo;
  lessons: Array<Object>;
  lessonsList: Array<Object>;

  constructor(token: string) {
    this.bot = new TelegramBot(token, { polling: true });

    this.users = {};

    this.mongo = new Mongo();

    // this.mongo.copyCollection('lessons');
  }

  getLessons = () => {
    return this.mongo.lessons;
  };

  getLessonsList = () => {
    return this.mongo.lessonsList;
  };

  getUsersData = () => {
    return this.users;
  };

  sendMessage(id: number, msg: string, options?: Object) {
    if (msg.length > TG_MAX_LENGTH) {
      log(MSG_MAX_LEN, TG_MAX_LENGTH);
    }

    this.bot.sendMessage(id, msg.substr(0, TG_MAX_LENGTH), options);
  }

  onStart = (msg: Message, match: Array<string>) => {
    log('onStart');

    const { from: { id, first_name, username, language_code } } = msg;

    this.registerUser(msg);

    this.sendMessage(
      id,
      `Привет, ${first_name}!\nЭто бот для тренировки английских предложений.\nДоступные темы: /contents`,
    );
  };

  onShowContents = (msg: Message, match: Array<string>) => {
    log('onShowContents');

    const { from: { id } } = msg;

    if (
      this.mongo.lessons &&
      this.mongo.lessons.length &&
      this.mongo.lessonsList &&
      this.mongo.lessonsList.length
    ) {
      this.showContents(id);
    } else {
      this.sendMessage(id, `База с уроками не загружена. Загружаю...`);

      (async () => {
        try {
          const lessons = await this.mongo.loadLessons();
          const lessonsList = await this.mongo.loadLessonsList();

          this.sendMessage(id, `Загружено: ${lessonsList.length} тем.`);
          this.sendMessage(id, `Загружено: ${lessons.length} уроков.`);

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

    const { from: { id, first_name, username, language_code } } = msg;

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
      let topics =
        `<b>Темы</b>` +
        this.mongo.lessonsList.reduce((acc, topic) => {
          acc += `\n<b>${topic.title}</b>\n`;

          if (topic.lessons && topic.lessons.length) {
            acc += topic.lessons.reduce((ac, lesson) => {
              const length = this.getSentencesInLesson(+lesson.id).length;

              ac += `/${lesson.id} ${lesson.title} (${length}) \n`;

              return ac;
            }, '');
          }

          return acc;
        }, '');

      topics += `\n<b>Помощь</b>\nЧтобы начать определенную тему нажмите "\/номерТемы"
Чтобы начать тему с определенного предложения нажмите "\/номер_номер"`;

      this.sendMessage(chatId, topics, { parse_mode: 'HTML' });
    } else {
      this.sendMessage(chatId, 'Темы не загружены', { parse_mode: 'HTML' });
    }
  }

  onStartLesson = (msg: Message, match: Array<string>) => {
    log('onStartLesson', match);

    const { chat: { id: chatId } } = msg;
    const lessonId = +match[0].slice(1);

    this.registerUser(msg);

    this.showNextSentence(chatId, 0, lessonId);
  };

  onStartLessonFromNumber = (msg: Message, match: Array<string>) => {
    log('onStartLessonFromNumber', match);

    const { chat: { id: chatId } } = msg;
    const arr = match[0].slice(1).split('_');
    const lessonId = +arr[0];
    const sentenceId = +arr[1] || 1;
    let sentenceNum = sentenceId - 1;

    this.registerUser(msg);

    if (this.mongo.lessons && this.mongo.lessons.length) {
      const lessonsLength = this.getSentencesInLesson(lessonId).length;

      if (lessonsLength <= sentenceNum) {
        sentenceNum = lessonsLength - 1;
      }

      this.showNextSentence(chatId, sentenceNum, lessonId);
    }
  };

  getSentencesInLesson(lessonId: number) {
    return this.mongo.lessons.filter(lesson => lesson.lesson === lessonId);
  }

  showNextSentence(chatId: number, sentenceNum: number, lessonId: number) {
    log('showNextSentence. sentenceNum=', sentenceNum, 'lessonId=', lessonId);

    if (!this.mongo.lessons || !this.mongo.lessons.length) {
      log('Не загружены уроки');
      return;
    }

    const numberOfLessons = this.mongo.getNumberOfLessons();

    if (lessonId > numberOfLessons) {
      log(
        `Номер урока ${lessonId} больше допустимого значения: ${numberOfLessons}`,
      );
      return;
    }

    let sentencesInLesson = this.getSentencesInLesson(lessonId);

    // * закончились предложения в уроке - перейдем на след. урок
    if (sentenceNum > sentencesInLesson.length - 1) {
      // * закончились уроки - начнем сначала
      if (lessonId >= numberOfLessons) {
        lessonId = 1;
      } else {
        lessonId++;
      }

      sentenceNum = 0;
      sentencesInLesson = this.getSentencesInLesson(lessonId);
    }

    if (sentencesInLesson && sentencesInLesson[sentenceNum]) {
      const rus = sentencesInLesson[sentenceNum].rus;
      const eng = sentencesInLesson[sentenceNum].eng;
      const words = sentencesInLesson[sentenceNum].words;

      this.users[String(chatId)].lesson = {
        id: lessonId,
        sentenceId: sentenceNum + 1,
        rus: rus,
        // rus: processRussianSentence(rus),
        eng: eng.replace(/\./g, '').split(' '),
        engButtons: shuffle(eng.toLowerCase().replace(/\./g, '').split(' ')),
        engText: [],
        words: words,
      };
    }

    this.showSentenceToUser(chatId, sentenceNum, sentencesInLesson);
  }

  formatPaging(sentenceNum: number, lessonId: number) {
    const sentencesInLesson = this.getSentencesInLesson(lessonId);
    return `Тема: ${lessonId}, урок: ${sentenceNum +
      1}/${sentencesInLesson.length}`;
  }

  showSentenceToUser(
    chatId: number,
    sentenceNum: number,
    sentencesInLesson: Array<Lesson>,
  ) {
    log('showSentenceToUser');

    const user = this.users[String(chatId)];

    const inline_keyboard = this.makeAnswerKeyboard(chatId);

    const paging = this.formatPaging(sentenceNum, user.lesson.id);
    const text = markupText(
      `${paging}\n${RU}` + user.getRusString() + user.getWords() + `\n${EN}`,
    );

    this.sendMessage(chatId, text, {
      reply_markup: {
        inline_keyboard,
      },
      parse_mode: 'HTML',
    });
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
        answerKeyboard.push([ DELETE_BUTTON, CONTINUE_BUTTON ]);
      else {
        answerKeyboard.push([ CONTINUE_BUTTON ]);
      }
    } else {
      answerKeyboard.push([ DELETE_BUTTON, CONTINUE_BUTTON ]);
    }

    return answerKeyboard;
  }

  onCallbackQuery = (query: Query) => {
    log('onCallbackQuery');

    const {
      message: { chat: { id: chatId }, message_id, text } = {},
      data,
    } = query;
    const user = this.users[String(chatId)];

    const { i: idxToRemove, w: word } = JSON.parse(data);

    const lessonId = user.lesson.id;
    const sentencesInLesson = this.getSentencesInLesson(lessonId);
    const paging = this.formatPaging(
      user.lesson.sentenceId - 1,
      user.lesson.id,
    );

    if (word === CONTINUE) {
      const sentenceNum = user.lesson.sentenceId - 1;

      (async () => {
        try {
          const {
            message_id: editedMesId,
          } = await this.bot.editMessageReplyMarkup(null, {
            chat_id: chatId,
            message_id,
          });

          if (editedMesId) {
            this.showNextSentence(chatId, sentenceNum + 1, user.lesson.id);
          }
        } catch (e) {
          log(e);
        }
      })();
    } else if (word === DELETE) {
      this.removeLastWord(chatId);

      const answerKeyboard = this.makeAnswerKeyboard(chatId);

      const text = markupText(
        `${paging}\n${RU}` +
          user.getRusString() +
          user.getWords() +
          `\n${EN}` +
          user.getEngTextString(),
      );

      this.bot.editMessageText(text, {
        message_id,
        chat_id: chatId,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: answerKeyboard,
        },
      });
    } else {
      this.removePressedButton(chatId, idxToRemove);

      const { lesson: { engButtons } } = user;

      if (engButtons && !engButtons.length) {
        // no buttons left, add 'continue'
        const answerKeyboard = this.makeAnswerKeyboard(chatId);

        const text =
          markupText(
            `${paging}\n${RU}` +
              user.getRusString() +
              user.getWords() +
              `\n${EN}` +
              user.getEngTextString(),
          ) +
          `\n${ANS}` +
          user.getEngString();
        this.bot.editMessageText(text, {
          message_id,
          chat_id: chatId,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: answerKeyboard,
          },
        });
      } else {
        // buttons still exist
        const answerKeyboard = this.makeAnswerKeyboard(chatId);

        const text = markupText(
          `${paging}\n${RU}` +
            user.getRusString() +
            user.getWords() +
            `\n${EN}` +
            user.getEngTextString(),
        );
        this.bot.editMessageText(text, {
          message_id,
          chat_id: chatId,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: answerKeyboard,
          },
        });
      }
    }
  };

  onMessage = (msg: Message) => {
    log('onMessage');
  };

  run() {
    this.bot.onText(/\/start/, this.onStart);
    this.bot.onText(/\/contents/, this.onShowContents);
    this.bot.onText(/^\/\d+$/, this.onStartLesson);
    this.bot.onText(/^\/\d+_\d+$/, this.onStartLessonFromNumber);
    this.bot.on('message', this.onMessage);
    this.bot.on('callback_query', this.onCallbackQuery);
  }
}
