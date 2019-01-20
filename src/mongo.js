// @flow
import { MongoClient, ObjectId } from 'mongodb';
import { promisify } from 'util';
import fs from 'fs';
import { log, processRussianSentence, divideSentenceByDot } from './utils';
import { type Lesson } from './user';
import { type LessonBasic } from './types';

const readFile = promisify(fs.readFile);

const MONGODB_PASSWORD = process.env.MONGODB_PASSWORD || '';
const MONGODB_HOST = process.env.MONGODB_HOST || '';
const DB = 'bot';
const COLLECTION_LESSONS = 'lessons_1';
const COLLECTION_LESSONS_LIST = 'lessonsList';

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
  lessons: Array<Object> = [];
  lessonsList: Array<Object> = [];

  constructor() {
    this.loadData();
  }

  loadData = async () => {
    try {
      const lessons = await this.loadLessons();
      log('Загружено уроков: ', lessons ? lessons.length : 0);

      const lessonsList = await this.loadLessonsList();
      log('Загружено тем уроков: ', lessonsList ? lessonsList.length : 0);
    } catch (error) {
      log(error);
    }
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

  async getCollection(collectionName: string) {
    log('getCollection', collectionName);

    try {
      const client = await this.getClient();
      if (client) {
        const connector = await client.db().collection(collectionName);
        const collection = await connector.find({}).toArray();
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

  async loadLessons() {
    log('loadLessons');

    try {
      if (process.env.NODE_ENV === 'development' && !DEBUG_MONGO) {
        this.lessons = [
          ...require('./test/1.json'),
          ...require('./test/2.json'),
          ...require('./test/3.json'),
        ];
      } else {
        this.lessons = await this.getCollection(COLLECTION_LESSONS);

        this.runSideEffects(this.lessons);
      }
    } catch (error) {
      log(error);
    }

    return this.lessons;
  }

  runSideEffects(lessons: Array<LessonBasic>) {
    //this.copyRussian('lessons_1547657622954', 'rus_3');
    // for (let i = 0; i < 20; i++) {
    //   const newRus = processRussianSentence(lessons[i].rus);
    //   console.log(newRus);
    // }
    // this.processRussianSentence(lessons, 'lessons_final');
    // this.copyCollection('lessons_final', 'lessons_1');
    // this.makeNewLessonsTable(lessons, 'lessons_devided');
    // this.deleteCollection('lessons_devided');
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

  async loadLessonsList() {
    log('loadLessonsList');

    try {
      if (process.env.NODE_ENV === 'development' && !DEBUG_MONGO) {
        this.lessonsList = require('./test/lessonsList.json');
      } else {
        this.lessonsList = await this.getCollection(COLLECTION_LESSONS_LIST);
      }
    } catch (error) {
      log(error);
    }

    return this.lessonsList;
  }

  getNumberOfLessons = () => {
    // return this.lessons[this.lessons.length - 1].lesson;

    let prevIdx;
    return this.lessons.reduce((acc, item) => {
      if (!prevIdx || item.lesson !== prevIdx) {
        prevIdx = item.lesson;
        return Number(acc) + 1;
      } else return acc;
    }, 0);
  };

  async copyCollection(collectionName: string, newName: string) {
    console.log('copyCollection newName', newName);
    try {
      const client = await this.getClient();
      if (client) {
        const connector = await client.db().collection(collectionName);
        const dataset = await connector.find({}).toArray();

        const newDataset = dataset.map(doc => ({
          old_id: doc.id,
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
        this.lessons.forEach(async lesson => {
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
