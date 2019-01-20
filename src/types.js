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

export type Query = {
  id: string,
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

export type Message = Object;

export type Word = {| rus: string, eng: string |};

export type LessonBasic = {
  _id: number,
  old_id: number,
  lesson: number,
  rus: string,
  eng: string,
  words: Array<Word>,
};
