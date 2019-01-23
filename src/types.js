// @flow

type From = {
  id: number,
  is_bot: boolean,
  first_name: string,
  username: string,
  language_code?: string,
};

type Chat = {
  id: number,
  first_name: string,
  username: string,
  type: string,
};

export type Message = {
  chat: { id: number },
  from: From,
};

export type Query = {
  id: number,
  from: From,
  message: {
    message_id: number,
    from: From,
    chat: Chat,
    date: number,
    edit_date: number,
    text: string,
  },
  chat_instance: string,
  data: string,
};

export type Word = { rus: string, eng: string };

export type LessonBasic = {
  _id: number,
  old_id: number,
  lesson: number,
  rus: string,
  eng: string,
  words: Array<Word>,
};

export type Lesson = {
  id: number,
  sentenceId: number,
  rus: string,
  eng: Array<string>,
  engText: Array<string>,
  engButtons: Array<string>,
  words: Array<Word>,
};

export type UserType = {
  id: number,
  username: string,
  first_name: string,
  language_code?: string,
  lesson: Lesson,
  +getRusString: () => string,
  +getWords: () => string,
  +getEngTextString: () => string,
  +getEngString: () => string,
};

export type UsersType = {
  [number]: UserType,
};
