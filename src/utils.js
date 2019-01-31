//@flow
import { type Word } from './types';
//  msg:
//  { message_id: 31,
//   from:
//   { id: 456709166,
//     is_bot: false,
//     first_name: 'Alex',
//     username: 'leshicus',
//     language_code: 'en' },
//  chat:
//   { id: 456709166,
//     first_name: 'Alex',
//     username: 'leshicus',
//     type: 'private'
//   },
//  date: 1546357253,
//  text: '/echo 123',
//  entities: [ { offset: 0, length: 5, type: 'bot_command' } ]
//  }

// match:
// [ '/echo 123', '123', index: 0, input: '/echo 123' ]

export const log = (
  ...args: Array<number | string | Array<string> | Object | void>
) => {
  // if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
  console.log.apply(null, args);
  // }
};

export const shuffle = (a: Array<string>) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    //$FlowIgnore
    [ a[i], a[j] ] = [ a[j], a[i] ];
  }
  return a;
};

export const processRussianSentence = (
  str: string,
): { rus: string, words: Array<Word> } => {
  const words = [];

  while (str.indexOf('[') !== -1) {
    str = str.replace(/\!|\,|\.|[\\?]/g, '');

    const start = str.indexOf('[');
    const end = str.indexOf(']') + 1;
    const block = str.slice(start, end);

    const arrBlock = block.split('|');
    const rusWord = arrBlock[0].slice(1);
    const engWord = arrBlock[arrBlock.length - 1].slice(0, -1);
    const replacement = rusWord;
    words.push({ rus: rusWord, eng: engWord });

    str = str.replace(block, replacement);
  }

  return {
    rus: str.replace(/\./g, ''),
    words,
  };
};

export const divideSentenceByDot = (str: string): Array<string> => {
  const arr = str
    .split('.')
    .map(sent => sent.trim())
    .filter(sent => sent !== '');
  return arr;
};

export const markupText = (str: string) => {
  return str.replace(/\(/g, '(<i>').replace(/\)/g, '</i>)');
  // .replace(`${EN}:`, `<b>${EN}:</b>`)
  // .replace(`${RU}:`, `<b>${RU}:</b>`);
};

export const sortByLength = (arr: Array<string>): Array<string> => {
  return arr.sort((a, b) => {
    if (a.length > b.length) return -1;
    else if (a.length < b.length) return 1;
    else return 0;
  });
};
