//@flow
import type { Word, Lesson, Context } from './types';

export class User {
  id: number;
  username: string;
  first_name: string;
  language_code: string | void;
  lesson: Lesson;
  lastMessageId: number | void;
  context: Array<Context> = [];

  constructor(
    id: number,
    first_name: string,
    username: string,
    language_code?: string,
  ) {
    this.id = id;
    this.username = username;
    this.first_name = first_name;
    this.language_code = language_code;
    this.lesson = {
      id: 1,
      sentenceId: 1,
      rus: '',
      eng: '',
      engForCheck: '',
      engText: [],
      engButtons: [],
      words: [],
    };
  }

  getRusString(): string {
    // if (this.lesson.rus) {
    //   if (Array.isArray(this.lesson.rus)) {
    //     return this.lesson.rus.join(' ');
    //   } else {
    //     this.lesson.rus;
    //   }
    // } else return '';
    return this.lesson.rus || '';
  }

  getEngString(): string {
    // if (this.lesson.eng) return this.lesson.eng.join(' ');
    // else return '';
    return this.lesson.eng || '';
  }

  getWords(): string {
    if (this.lesson.words && this.lesson.words.length) {
      return this.lesson.words.reduce((acc, obj) => {
        return acc + '\n      ' + '<b>' + obj.rus + ' - ' + obj.eng + '</b>';
      }, '\n<i>Словарик:</i>');
    } else return '';
  }

  getEngTextString(): string {
    if (this.lesson.engText) return this.lesson.engText.join(' ');
    else return '';
  }

  getEngButtonsString(): string {
    if (this.lesson.engButtons) return this.lesson.engButtons.join(' ');
    else return '';
  }
}
