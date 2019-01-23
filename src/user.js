//@flow
import { type Word, type UserType, type Lesson } from './types';

export class User<UserType> {
  id: number;
  username: string;
  first_name: string;
  language_code: string | void;
  lesson: Lesson = {
    id: 1,
    sentenceId: 1,
    rus: '',
    eng: [],
    engText: [],
    engButtons: [],
    words: [],
  };

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
  }

  getRusString() {
    // if (this.lesson.rus) {
    //   if (Array.isArray(this.lesson.rus)) {
    //     return this.lesson.rus.join(' ');
    //   } else {
    //     this.lesson.rus;
    //   }
    // } else return '';
    return this.lesson.rus || '';
  }

  getEngString() {
    if (this.lesson.eng) return this.lesson.eng.join(' ');
    else return '';
  }

  getWords() {
    if (this.lesson.words && this.lesson.words.length) {
      return this.lesson.words.reduce((acc, obj) => {
        return '\n' + '■ <i>' + obj.rus + ' - ' + obj.eng + '</i>';
      }, '');
    } else return '';
  }

  getEngTextString() {
    if (this.lesson.engText) return this.lesson.engText.join(' ');
    else return '';
  }

  getEngButtonsString() {
    if (this.lesson.engButtons) return this.lesson.engButtons.join(' ');
    else return '';
  }
}
