// @flow
import { MongoClient, ObjectId } from 'mongodb';
import { promisify } from 'util';
import fs from 'fs';
import { log, processRussianSentence, divideSentenceByDot } from './utils';
import { type LessonBasic, type Lesson, type Collection } from './types';
import { PREFIX_KESPA, PREFIX_PAIRS } from './constants';

import { config } from 'dotenv';
config();

const readFile = promisify(fs.readFile);

const MONGODB_PASSWORD = process.env.MONGODB_PASSWORD || '';
const MONGODB_HOST = process.env.MONGODB_HOST || '';
const DB = 'bot';
const COLLECTION_LESSONS = 'lessons_1';
const COLLECTION_LESSONS_LIST = 'lessonsList';
const COLLECTION_PAIRS = 'pairs';
const COLLECTION_PAIR_TOPICS = 'pairTopics';

const DEBUG_MONGO = process.env.DEBUG_MONGO;

if (!MONGODB_HOST) {
  log('MONGODB_HOST not provided');
  process.exit(1);
}

if (!MONGODB_PASSWORD) {
  log('MONGODB_PASSWORD not provided');
  process.exit(1);
}

const MONGO_URL = `mongodb+srv://alex:${MONGODB_PASSWORD}@${MONGODB_HOST}/${DB}?retryWrites=true`;

export class Mongo {
  lessons: Collection = {
    total: 0,
    data: [],
  };
  lessonsList: Collection = {
    total: 0,
    data: [],
  };
  pairs: Collection = {
    total: 0,
    data: [],
  };
  pairTopics: Collection = {
    total: 0,
    data: [],
  };

  constructor() {
    try {
      this.loadLessons();
      this.loadLessonsList();
      this.loadPairs();
      this.loadPairTopics();

      // this.runSideEffects();
    } catch (error) {
      log(error);
    }
  }

  loadLessons = () => {
    return this.loadCollection(
      COLLECTION_LESSONS,
      this.lessons,
      require('./test/lessons.json'),
      { lesson: 1 },
    );
  };

  loadLessonsList = () => {
    return this.loadCollection(
      COLLECTION_LESSONS_LIST,
      this.lessonsList,
      require('./test/lessonsList.json'),
    );
  };

  loadPairs = () => {
    return this.loadCollection(
      COLLECTION_PAIRS,
      this.pairs,
      require('./test/pairs.json'),
      { topicId: 1 },
    );
  };

  loadPairTopics = () => {
    return this.loadCollection(
      COLLECTION_PAIR_TOPICS,
      this.pairTopics,
      require('./test/pairTopics.json'),
    );
  };

  async getClient() {
    try {
      return MongoClient.connect(MONGO_URL, {
        useNewUrlParser: true,
      });
    } catch (error) {
      log(error);
    }
  }

  async getCollection(collectionName: string, sortCondition?: Object) {
    log('getCollection', collectionName);

    try {
      const client = await this.getClient();
      if (client) {
        const connector = await client.db().collection(collectionName);
        let collection = null;

        if (sortCondition) {
          collection = await connector.find({}).sort(sortCondition).toArray();
        } else {
          collection = await connector.find({}).toArray();
        }

        client.close();

        return await collection;
      } else {
        return Promise.resolve([]);
      }
    } catch (error) {
      log(error);
      return Promise.resolve([]);
    }
  }

  runSideEffects() {
    //this.copyRussian('lessons_1547657622954', 'rus_3');
    // for (let i = 0; i < 20; i++) {
    //   const newRus = processRussianSentence(lessons[i].rus);
    //   console.log(newRus);
    // }
    // this.processRussianSentence(lessons, 'lessons_final');
    // this.copyCollection('lessons_1', 'lessons_2');
    // this.makeNewLessonsTable(lessons, 'lessons_devided');
    // this.deleteCollection('lessons_devided');
    // this.updateLessons();
  }

  async updateLessons() {
    const newLessonId = 55;
    const startId = 1448;
    const endId = 1457;

    try {
      const client = await this.getClient();
      if (client) {
        const { matchedCount } = await client
          .db()
          .collection('lessons_1')
          .updateMany(
            { old_id: { $gte: startId, $lte: endId } },
            { $set: { lesson: newLessonId } },
          );
        console.log('matchedCount', matchedCount);
        client.close();
      }
    } catch (error) {
      log(error);
    }
  }

  async processRussianSentence(
    lessons: Array<LessonBasic>,
    newTableName: string,
  ) {
    const arr = [];
    lessons.forEach((lesson, i) => {
      console.log(lesson);
      try {
        const processed = processRussianSentence(lesson.rus);

        arr.push({
          ...lesson,
          ...processed,
        });
        console.log('processes: ', i);
      } catch (error) {
        log(error);
      }
    });

    try {
      const client = await this.getClient();
      if (client) {
        client.db().collection(newTableName).insertMany(arr);

        client.close();
      }
    } catch (error) {
      log(error);
    }
  }

  async deleteCollection(collectionName: string) {
    try {
      const client = await this.getClient();
      if (client) {
        client.db().collection(collectionName).deleteMany({});

        client.close();
      }
    } catch (error) {
      log(error);
    }
  }

  makeNewLessonsTable(lessons: Array<LessonBasic>, newTableName: string) {
    (async () => {
      try {
        const client = await this.getClient();
        if (client) {
          lessons.forEach(lesson => {
            const arr = [];
            if (lesson.rus && lesson.eng) {
              const arrRus = divideSentenceByDot(lesson.rus);
              const arrEng = divideSentenceByDot(lesson.eng);

              arrRus.forEach((rus, i) => {
                arr.push({
                  old_id: lesson.old_id,
                  lesson: lesson.lesson,
                  rus: rus,
                  eng: arrEng[i],
                });
              });

              client.db().collection(newTableName).insertMany(arr);
            }
          });

          client.close();
        }
      } catch (error) {
        log(error);
      }
    })();
  }

  async loadCollection(
    collectionName: string,
    target: Collection,
    data: Array<Object>,
    sortCondition?: Object,
  ) {
    log('loadCollection', collectionName);

    try {
      console.log('DEBUG_MONGO2', DEBUG_MONGO);
      if (process.env.NODE_ENV === 'development') {
        target.data = data;
      } else {
        if (sortCondition) {
          target.data = await this.getCollection(collectionName, sortCondition);
        } else {
          target.data = await this.getCollection(collectionName);
        }
      }

      target.total = await target.data.length;
    } catch (error) {
      log(error);
    }

    log('Загружено', collectionName, target.total);

    return target;
  }

  getAmountOfTopics = (prefix: string) => {
    let prevIdx;

    if (prefix === PREFIX_KESPA) {
      return this.lessons.data.reduce((acc, item) => {
        if (!prevIdx || item.lesson !== prevIdx) {
          prevIdx = item.lesson;
          return Number(acc) + 1;
        } else return acc;
      }, 0);
    }

    if (prefix === PREFIX_PAIRS) {
      return this.pairs.data.reduce((acc, item) => {
        if (!prevIdx || item.topicId !== prevIdx) {
          prevIdx = item.topicId;
          return Number(acc) + 1;
        } else return acc;
      }, 0);
    }

    return 0;
  };

  async copyCollection(collectionName: string, newName: string) {
    console.log('copyCollection newName', newName);
    try {
      const client = await this.getClient();
      if (client) {
        const connector = await client.db().collection(collectionName);
        const dataset = await connector.find({}).toArray();

        const newDataset = dataset.map(doc => ({
          old_id: doc.old_id,
          eng: doc.eng,
          rus: doc.rus,
          lesson: doc.lesson,
          words: doc.words,
        }));

        const newConnector = await client.db().collection(newName);
        const cnt = newConnector.insertMany(newDataset);

        client.close();

        return cnt;
      }
    } catch (error) {
      log(error);
    }

    return 0;
  }

  async renameCollection(collectionName: string, newName: string) {
    console.log('renameCollection newName', newName);
    try {
      const client = await this.getClient();
      if (client) {
        client.db().collection(collectionName).rename(newName);
        // collection.renameCollection(newName);

        client.close();
      }
    } catch (error) {
      log(error);
    }
  }

  async copyRussian(collectionName: string, newFieldName: string) {
    console.log('copyRussian');
    try {
      const client = await this.getClient();
      if (client) {
        this.lessons.data.forEach(async lesson => {
          const rus = lesson.rus;
          const id = lesson.id;
          const res = await client
            .db()
            .collection(collectionName)
            .updateOne(
              { id: id },
              { $set: { [newFieldName]: rus } },
              { upsert: true },
            );
          console.log(id, res.modifiedCount);
        });

        client.close();
      }
    } catch (error) {
      log(error);
    }
  }
}
