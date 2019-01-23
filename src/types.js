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
  message_id: number,
  chat: Chat,
  from: From,
  date: number,
  edit_date?: number,
  text: string,
  entities?: Array<Object>,
};

export type Query = {
  id: number,
  from: From,
  message: Message,
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

export type KeyboardButton = {|
  text: string,
  callback_data: string,
|};
export type KeyboardRow = Array<KeyboardButton>;
export type Keyboard = Array<KeyboardRow>;
