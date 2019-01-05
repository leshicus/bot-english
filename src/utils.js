export const log = msg => {
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

  const {
    message_id,
    from: { id: fromId, first_name, username },
    date,
    text,
    entities,
    reply_to_message,
  } = msg;

  console.log('-----------------------------');
  console.log('message_id=', message_id);
  console.log(
    'from: id=',
    fromId,
    'first_name=',
    first_name,
    ', username=',
    username,
  );
  console.log('date=', date);
  console.log('text=', text);

  if (entities && entities[0]) console.log('type=', entities[0].type);

  if (reply_to_message) {
    console.log('reply_to_message:');
    log(reply_to_message);
  }
};

export const shuffle = a => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ a[i], a[j] ] = [ a[j], a[i] ];
  }
  return a;
};