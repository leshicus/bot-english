// @flow
import TelegramBot from 'node-telegram-bot-api';
import { Mongo } from './mongo';
import {
  sortByLength,
  log,
  shuffle,
  processRussianSentence,
  markupText,
} from './utils';
import type { Query, Message } from './types';
import { User } from './user';
import {
  type UsersType,
  type Lesson,
  type KeyboardButton,
  type KeyboardRow,
  type Keyboard,
  type Markup,
} from './types';
import { MSG_MAX_LEN } from './constants';

const WORDS_IN_ROW = 4;
const CHARS_IN_ROW = 10;

// const CONTINUE = 'Дальше';
// const CONTINUE = '→';
const CONTINUE = '⇨';
// const DELETE = 'Удалить';
const DELETE = '⌫';
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
  users: UsersType;
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

  onStart = (msg: Message, match: Array<string>) => {
    log('onStart');

    const { from: { id, first_name, username, language_code } } = msg;

    this.registerUser(msg);
    this.deleteLastKeyboard(id);

    this.sendMessage(
      id,
      `Привет, ${first_name}!\nЭто бот для тренировки английских предложений.\nДоступные темы: /contents`,
    );
  };

  onShowContents = (msg: Message, match: Array<string>) => {
    log('onShowContents');

    const { from: { id } } = msg;

    this.deleteLastKeyboard(id);

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

      this.sendMessage(chatId, topics);
    } else {
      this.sendMessage(chatId, 'Темы не загружены');
    }
  }

  onStartLesson = (msg: Message, match: Array<string>) => {
    log('onStartLesson', match);

    const { chat: { id: chatId } } = msg;

    this.deleteLastKeyboard(chatId);

    const lessonId = +match[0].slice(1);

    this.registerUser(msg);

    this.showNextSentence(chatId, 0, lessonId);
  };

  onStartLessonFromNumber = (msg: Message, match: Array<string>) => {
    log('onStartLessonFromNumber', match);

    const { chat: { id: chatId } } = msg;

    this.deleteLastKeyboard(chatId);

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
      const engWithoutPunctuationMarks = eng.replace(/\!|\,|\.|[\\?]/g, '');

      this.users[chatId].lesson = {
        id: lessonId,
        sentenceId: sentenceNum + 1,
        rus: rus,
        eng: eng,
        engButtons: sortByLength(
          shuffle(engWithoutPunctuationMarks.toLowerCase().split(' ')),
        ),
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

  async showSentenceToUser(
    chatId: number,
    sentenceNum: number,
    sentencesInLesson: Array<Lesson>,
  ) {
    log('showSentenceToUser');

    const user = this.users[chatId];

    const inline_keyboard = this.makeAnswerKeyboard(chatId);

    const paging = this.formatPaging(sentenceNum, user.lesson.id);
    const text = markupText(
      `${paging}\n${RU}` + user.getRusString() + user.getWords() + `\n${EN}`,
    );

    const message_id = await this.sendMessage(chatId, text, inline_keyboard);
    if (message_id) {
      this.users[chatId].lastMessageId = message_id;
    }
  }

  removeLastWord(chatId: number) {
    const user = this.users[chatId];
    let { lesson: { engText, engButtons } } = user;

    if (engText.length) {
      user.lesson.engText = engText.slice(0, -1);
      user.lesson.engButtons.push(engText[engText.length - 1]);
    }
  }

  makeAnswerKeyboard(chatId: number) {
    log('makeAnswerKeyboard');

    const user = this.users[chatId];
    let { lesson: { engButtons, engText } } = user;

    let answerKeyboard: Keyboard = [];
    let row: KeyboardRow = [];

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
        row.push(DELETE_BUTTON, CONTINUE_BUTTON);
        answerKeyboard.push(row);
      }
    });

    // answerKeyboard.push([ DELETE_BUTTON, CONTINUE_BUTTON ]);

    return answerKeyboard;
  }

  async sendMessage(id: number, msg: string, inline_keyboard?: Keyboard) {
    log('sendMessage');

    if (msg.length > TG_MAX_LENGTH) {
      log(MSG_MAX_LEN, TG_MAX_LENGTH);
    }

    const markup: Markup = { parse_mode: 'HTML' };
    if (inline_keyboard) {
      markup['reply_markup'] = {
        inline_keyboard,
      };
    }

    try {
      const resp = await this.bot.sendMessage(
        id,
        msg.substr(0, TG_MAX_LENGTH),
        markup,
      );

      if (resp) {
        return resp.message_id;
      } else {
        return Promise.reject(
          this.errorText('sendMessage', 'resp=', resp),
        ).catch(() => {});
      }
    } catch (error) {
      console.log(error);
    }
  }

  async editMessageText(
    query: Query,
    text: string,
    inline_keyboard?: Keyboard,
  ) {
    log('editMessageText');

    const { message: { chat: { id: chatId }, message_id } } = query;

    const markup: Markup = { parse_mode: 'HTML' };
    if (inline_keyboard) {
      markup['reply_markup'] = {
        inline_keyboard,
      };
    }

    try {
      const resp = await this.bot.editMessageText(text, {
        message_id,
        chat_id: chatId,
        ...markup,
      });

      if (resp) {
        return resp.message_id;
      } else {
        return Promise.reject(
          this.errorText('editMessageText', 'resp=', resp),
        ).catch(() => {});
      }
    } catch (error) {
      const { response: { request: { path } } } = error;
      log(
        'try-catch error:',
        error.name,
        error.message,
        path.split('/').splice(-1),
      );
    }
  }

  async deleteLastKeyboard(chatId: number) {
    log('deleteLastKeyboard');
    const user = this.users[chatId];

    if (user) {
      const lastMessageId = this.users[chatId].lastMessageId;

      if (lastMessageId) {
        try {
          const resp = await this.bot.editMessageReplyMarkup(null, {
            chat_id: chatId,
            message_id: lastMessageId,
          });

          if (resp) {
            return resp.message_id;
          } else {
            return Promise.reject(
              this.errorText('deleteLastKeyboard', 'resp=', resp),
            ).catch(() => {});
          }
        } catch (error) {
          const { response: { request: { path } } } = error;
          log(
            'try-catch error:',
            error.name,
            error.message,
            path.split('/').splice(-1),
          );
        }
      } else {
        return Promise.reject(
          this.errorText('deleteLastKeyboard', 'lastMessageId=', lastMessageId),
        ).catch(() => {});
      }
    } else {
      return Promise.reject(
        this.errorText('deleteLastKeyboard', 'user=', user),
      ).catch(() => {});
    }
  }

  errorText(where: string, ...params: Array<string | number | void | Object>) {
    return `Error in *${where}*, ${JSON.stringify(params)}`;
  }

  onCallbackQuery = async (query: Query) => {
    log('onCallbackQuery');

    const {
      message: { chat: { id: chatId }, message_id, text } = {},
      data,
    } = query;
    const user = this.users[chatId];
    const { lesson: { engButtons, engText } } = user;
    const { i: idxToRemove, w: word } = JSON.parse(data);

    if (!user) {
      this.sendMessage(
        chatId,
        'Что-то пошло не так, начните тему или урок заново, нажав "/номер_номер"',
      );
      //! это после перезапуска сервера не находит юзера.
      //! нужно посмотреть историю сообщений, и взять оттуда номер последненго урока и номер предложения.
      return;
    }

    const lessonId = user.lesson.id;
    const sentencesInLesson = this.getSentencesInLesson(lessonId);
    const paging = this.formatPaging(
      user.lesson.sentenceId - 1,
      user.lesson.id,
    );

    if (word === CONTINUE) {
      const sentenceNum = user.lesson.sentenceId - 1;
      await this.deleteLastKeyboard(chatId);
      this.showNextSentence(chatId, sentenceNum + 1, user.lesson.id);
    } else if (word === DELETE) {
      if (engText.length) {
        user.lesson.engText = engText.slice(0, -1);
      } else return;

      const text = markupText(
        `${paging}\n${RU}` +
          user.getRusString() +
          user.getWords() +
          `\n${EN}` +
          user.getEngTextString(),
      );

      const answerKeyboard = this.makeAnswerKeyboard(chatId);
      this.editMessageText(query, text, answerKeyboard);
    } else {
      if (engButtons.length) {
        user.lesson.engText.push(engButtons[idxToRemove]);
      }

      let text = markupText(
        `${paging}\n${RU}` +
          user.getRusString() +
          user.getWords() +
          `\n${EN}` +
          user.getEngTextString(),
      );

      // show answer
      if (engText.length === engButtons.length) {
        text += `\n${ANS}` + user.getEngString();
      }

      const answerKeyboard = this.makeAnswerKeyboard(chatId);
      this.editMessageText(query, text, answerKeyboard);
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
