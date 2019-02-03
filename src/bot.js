// @flow
import TelegramBot from 'node-telegram-bot-api';
import { Mongo } from './mongo';
import {
  sortByLength,
  log,
  shuffle,
  truncate,
  processRussianSentence,
} from './utils';
import type { Query, Message } from './types';
import { User } from './user';
import {
  type Lesson,
  type KeyboardButton,
  type KeyboardRow,
  type Keyboard,
  type Markup,
} from './types';
import {
  MSG_MAX_LEN,
  PREFIX_KESPA,
  PREFIX_PAIRS,
  TOPIC_IS_EMPTY,
  COMMAND_NOT_FOUND,
  AVAILABLE_COMMANDS,
  WORDS_IN_ROW,
  CONTINUE,
  DELETE,
  SHOW_ANSWER,
  EN,
  RU,
  ANS,
  TRANSLATE,
  CORRECT,
  WRONG,
  TG_MAX_LENGTH,
} from './constants';

const DEBUG_MONGO = process.env.DEBUG_MONGO;

export class Bot {
  bot: TelegramBot;
  users: { [number]: User };
  mongo: Mongo;

  constructor(token: string) {
    this.bot = new TelegramBot(token, { polling: true });

    this.users = {};

    this.mongo = new Mongo();
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
      `Привет, ${first_name}!\nЭто бот для тренировки английских предложений.`,
    );
    this.showCommandsHelpMessage(id);
  };

  onShowContents = (msg: Message, match: Array<string>) => {
    log('onShowContents');

    const { from: { id } } = msg;

    this.deleteLastKeyboard(id);

    if (this.mongo.lessons.total && this.mongo.lessonsList.total) {
      this.showContents(id);
    } else {
      this.sendMessage(id, `База с уроками не загружена. Загружаю...🤨`);

      (async () => {
        try {
          const lessons = await this.mongo.loadLessons();
          const lessonsList = await this.mongo.loadLessonsList();

          this.sendMessage(id, `Загружено: ${lessonsList.total} тем 😀`);
          this.sendMessage(id, `Загружено: ${lessons.total} уроков 😀`);

          if (this.mongo.lessons.total && this.mongo.lessonsList.total) {
            this.showContents(id);
          } else {
            this.sendMessage(id, `Не получилось загрузить уроки 😕`);
          }
        } catch (error) {
          console.log(error);
        }
      })();
    }
  };

  onShowPairs = (msg: Message, match: Array<string>) => {
    log('onShowPairs');

    const { from: { id } } = msg;

    this.deleteLastKeyboard(id);

    if (this.mongo.pairs.total && this.mongo.pairTopics.total) {
      this.showPairsContent(id);
    } else {
      this.sendMessage(id, `База с парами не загружена. Загружаю...🤨`);

      (async () => {
        try {
          let pairs = [];
          let pairTopics = [];

          if (!this.mongo.pairs.total) {
            pairs = await this.mongo.loadPairs();
            this.sendMessage(id, `Загружено: ${pairs.total} пар 😀`);
          }
          if (!this.mongo.pairTopics.total) {
            pairTopics = await this.mongo.loadPairTopics();
            this.sendMessage(id, `Загружено: ${pairTopics.total} тем пар 😀`);
          }

          if (this.mongo.pairs.total && this.mongo.pairTopics.total) {
            this.showPairsContent(id);
          } else {
            this.sendMessage(id, `Не получилось загрузить пары 😕`);
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

  showPairs(chatId: number) {}

  showPairsContent(chatId: number) {
    log('showPairsContent');

    let topics =
      `<b>Темы</b>` +
      this.mongo.pairTopics.data.reduce((acc, topic) => {
        acc += `\n/p${topic.id} ${topic.name}`;

        return acc;
      }, '');

    this.sendMessage(chatId, topics);
  }

  showContents(chatId: number) {
    log('showContents');

    let topics =
      `<b>Темы</b>` +
      this.mongo.lessonsList.data.reduce((acc, topic) => {
        acc += `\n<b>${topic.title}</b>\n`;

        if (topic.lessons && topic.lessons.length) {
          acc += topic.lessons.reduce((ac, lesson) => {
            const length = this.getSentencesInLesson(+lesson.id, PREFIX_KESPA)
              .length;

            ac += `/k${lesson.id} ${lesson.title} (${length}) \n`;

            return ac;
          }, '');
        }

        return acc;
      }, '');

    this.sendMessage(chatId, topics);
  }

  onStartLesson = (msg: Message, match: Array<string>) => {
    log('onStartLesson', match);

    const { chat: { id: chatId } } = msg;

    this.deleteLastKeyboard(chatId);

    const prefix = match[0].slice(1, 2);
    const lessonId = +match[0].slice(2);

    this.registerUser(msg);

    this.showNextSentence(chatId, 0, lessonId, prefix);
  };

  onStartLessonFromNumber = (msg: Message, match: Array<string>) => {
    log('onStartLessonFromNumber', match);

    const { chat: { id: chatId } } = msg;

    this.deleteLastKeyboard(chatId);

    const arr = match[0].slice(2).split('_');
    const prefix = match[0].slice(1, 2);
    const lessonId = +arr[0];
    const sentenceId = +arr[1] || 1;
    let sentenceNum = sentenceId - 1;

    this.registerUser(msg);

    // if (this.mongo.lessons && this.mongo.lessons.length) {
    const lessonsLength = this.getSentencesInLesson(lessonId, prefix).length;

    if (lessonsLength <= sentenceNum) {
      sentenceNum = lessonsLength - 1;
    }

    this.showNextSentence(chatId, sentenceNum, lessonId, prefix);
    // }
  };

  getSentencesInLesson(lessonId: number, prefix: string): Array<Object> {
    log('getSentencesInLesson', lessonId, prefix);
    if (prefix === PREFIX_KESPA) {
      // $FlowFixMe
      return this.mongo.lessons.data.filter(
        lesson => lesson.lesson === lessonId,
      );
    }

    if (prefix === PREFIX_PAIRS) {
      // $FlowFixMe
      return this.mongo.pairs.data.filter(pair => pair.topicId === lessonId);
    }

    return [];
  }

  getPairsInTopic(topicId: number): Array<Object> {
    // $FlowFixMe
    return this.mongo.pairs.data.filter(pair => pair.topicId === topicId);
  }

  checkLessonLoaded(prefix: string) {
    if (prefix === PREFIX_KESPA) {
      return this.mongo.lessons.total;
    }

    if (prefix === PREFIX_PAIRS) {
      return this.mongo.pairs.total;
    }

    return false;
  }

  showNextSentence(
    chatId: number,
    sentenceNum: number,
    lessonId: number,
    prefix: string,
  ) {
    log('showNextSentence. sentenceNum=', sentenceNum, 'lessonId=', lessonId);

    if (!this.checkLessonLoaded(prefix)) return;

    const getAmountOfTopics = this.mongo.getAmountOfTopics(prefix);
    if (lessonId > getAmountOfTopics) {
      log(
        `Номер урока ${lessonId} больше допустимого значения: ${getAmountOfTopics}`,
      );
      return;
    }

    let sentencesInLesson = this.getSentencesInLesson(lessonId, prefix);
    if (!sentencesInLesson) {
      this.sendMessage(chatId, TOPIC_IS_EMPTY);
      return;
    }

    // * закончились предложения в уроке - перейдем на след. урок
    if (sentenceNum > sentencesInLesson.length - 1) {
      // * закончились уроки - начнем сначала
      if (lessonId >= getAmountOfTopics) {
        lessonId = 1;
      } else {
        lessonId++;
      }

      sentenceNum = 0;
      sentencesInLesson = this.getSentencesInLesson(lessonId, prefix);
    }

    if (sentencesInLesson && sentencesInLesson[sentenceNum]) {
      const rus = sentencesInLesson[sentenceNum].rus;
      const eng = sentencesInLesson[sentenceNum].eng;
      const words = sentencesInLesson[sentenceNum].words;
      const engWithoutPunctuationMarks = eng
        .replace(/\!|\,|\.|[\\?|\:|\;|\-]/g, '')
        .toLowerCase();

      this.users[chatId].lesson = {
        id: lessonId,
        sentenceId: sentenceNum + 1,
        rus: rus,
        eng: eng,
        engForCheck: engWithoutPunctuationMarks,
        engButtons: sortByLength(
          shuffle(engWithoutPunctuationMarks.split(' ')),
        ),
        engText: [],
        words: words,
      };
    }

    this.showSentenceToUser(chatId, sentenceNum, sentencesInLesson, prefix);
  }

  formatPaging(sentenceNum: number, lessonId: number, prefix: string) {
    const sentencesInLesson = this.getSentencesInLesson(lessonId, prefix);
    // return `<i>Тема: ${lessonId}, [${sentenceNum +
    // 1} из ${sentencesInLesson.length}]</i>`;F
    const topicName = truncate(this.mongo.getTopicName(lessonId, prefix), 20);

    return `<i>Тема: ${lessonId} "${topicName}" [${sentenceNum +
      1} из ${sentencesInLesson.length}]</i>`;
  }

  async showSentenceToUser(
    chatId: number,
    sentenceNum: number,
    sentencesInLesson: Array<Lesson>,
    prefix: string,
  ) {
    log('showSentenceToUser');

    const user = this.users[chatId];

    const inline_keyboard = this.makeAnswerKeyboard(chatId, prefix);

    const paging = this.formatPaging(sentenceNum, user.lesson.id, prefix);
    const text =
      `${paging}` +
      user.getWords() +
      `\n${TRANSLATE}\n${RU} ` +
      '<b>' +
      user.getRusString() +
      '</b>' +
      `\n${EN} `;

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

  makeAnswerKeyboard(chatId: number, prefix: string) {
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
          callback_data: `${word}|${prefix}|${idx}`,
        });
      }

      // последний ряд, может быть не заполнен
      if (engButtons && idx === engButtons.length - 1) {
        answerKeyboard.push(row);
      }
    });

    const answerButton = this.getActionButton(SHOW_ANSWER, prefix);
    const deleteButton = this.getActionButton(DELETE, prefix);
    const continueButton = this.getActionButton(CONTINUE, prefix);

    answerKeyboard.push([ answerButton, deleteButton, continueButton ]);

    return answerKeyboard;
  }

  getActionButton(buttonName: string, prefix: string) {
    return {
      text: buttonName,
      callback_data: `${buttonName}|${prefix}`,
    };
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

  async onPressContinueButton(chatId: number, prefix: string) {
    const user = this.users[chatId];
    const nextSentenceNum = user.lesson.sentenceId;

    await this.deleteLastKeyboard(chatId);
    this.showNextSentence(chatId, nextSentenceNum, user.lesson.id, prefix);
  }

  onCallbackQuery = async (query: Query) => {
    log('onCallbackQuery');

    const {
      message: { chat: { id: chatId }, message_id, text } = {},
      data,
    } = query;
    const user = this.users[chatId];

    if (!user) {
      this.sendMessage(
        chatId,
        'Что-то пошло не так, начните тему или урок заново, нажав "/номер_номер"',
      );
      //! это после перезапуска сервера не находит юзера.
      //! нужно посмотреть историю сообщений, и взять оттуда номер последненго урока и номер предложения.
      return;
    }

    const { lesson: { engButtons, engText, engForCheck, eng } } = user;
    const [ word, prefix, idxWord ] = data.split('|');
    const lessonId = user.lesson.id;
    const sentencesInLesson = this.getSentencesInLesson(lessonId, prefix);
    const paging = this.formatPaging(
      user.lesson.sentenceId - 1,
      user.lesson.id,
      prefix,
    );

    if (word === CONTINUE) {
      this.onPressContinueButton(chatId, prefix);
    } else if (word === SHOW_ANSWER) {
      let text =
        `${paging}` +
        user.getWords() +
        `\n${TRANSLATE}\n${RU} ` +
        '<b>' +
        user.getRusString() +
        '</b>' +
        `\n${EN} ` +
        '<b>' +
        user.getEngTextString() +
        '</b>' +
        `\n${ANS} ` +
        '<b>' +
        user.getEngString() +
        '</b>';

      const answerKeyboard = this.makeAnswerKeyboard(chatId, prefix);
      this.editMessageText(query, text, answerKeyboard);
    } else if (word === DELETE) {
      if (engText.length) {
        user.lesson.engText = engText.slice(0, -1);
      } else return;

      const text =
        `${paging}` +
        user.getWords() +
        `\n${TRANSLATE}\n${RU} ` +
        '<b>' +
        user.getRusString() +
        '</b>' +
        `\n${EN} ` +
        '<b>' +
        user.getEngTextString() +
        '</b>';

      const answerKeyboard = this.makeAnswerKeyboard(chatId, prefix);
      this.editMessageText(query, text, answerKeyboard);
    } else {
      if (engButtons.length) {
        user.lesson.engText.push(engButtons[Number(idxWord)]);
      }

      let text =
        `${paging}` +
        user.getWords() +
        `\n${TRANSLATE}\n${RU} ` +
        '<b>' +
        user.getRusString() +
        '</b>' +
        `\n${EN} ` +
        '<b>' +
        user.getEngTextString() +
        '</b>';

      // show answer
      if (engText.length === engButtons.length) {
        if (engForCheck === user.getEngTextString()) {
          text += ` ${CORRECT}`;
        } else {
          text += ` ${WRONG}` + `\n${ANS} ` + eng;
        }
      }

      const answerKeyboard = this.makeAnswerKeyboard(chatId, prefix);
      const result = await this.editMessageText(query, text, answerKeyboard);

      if (result && engForCheck === user.getEngTextString()) {
        this.onPressContinueButton(chatId, prefix);
      }
    }
  };

  showCommandsHelpMessage(chatId: number) {
    this.sendMessage(
      chatId,
      `<b>${AVAILABLE_COMMANDS}:</b>` +
        '\n/k - список уроков' +
        '\n/kN - переход к уроку номер "N"' +
        '\n/kN_M - переход к уроку номер "N", предложение номер "M"' +
        '\n/p - список тем' +
        '\n/pN - тема номер "N"' +
        '\n/pN_M - тема номер "N", пример номер "M"',
    );
  }

  onMessage = (msg: Message) => {
    log('onMessage', msg);

    // const { chat: { id: chatId }, text } = msg;

    // this.sendMessage(chatId, COMMAND_NOT_FOUND);
    // this.showCommandsHelpMessage(chatId);
  };

  run() {
    this.bot.onText(/\/start$/, this.onStart);
    this.bot.onText(/\/k$/, this.onShowContents);
    this.bot.onText(/\/p$/, this.onShowPairs);
    // this.bot.onText(
    //   `/^\/(${PREFIX_KESPA}|${PREFIX_PAIRS})\d+$/`,
    //   // () => {},
    //   this.onStartLesson,
    // );
    this.bot.onText(/^\/(k|p)\d+$/, this.onStartLesson);
    this.bot.onText(/^\/k\d+_\d+$/, this.onStartLessonFromNumber);
    this.bot.on('message', this.onMessage);
    this.bot.on('callback_query', this.onCallbackQuery);
  }
}
