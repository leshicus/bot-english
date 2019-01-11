// @flow
import { MongoClient, ObjectId } from 'mongodb';
import { promisify } from 'util';
import fs from 'fs';
import { log } from './utils';
import { config } from 'dotenv';

config();

const readFile = promisify(fs.readFile);

const MONGODB_PASSWORD = process.env.MONGODB_PASSWORD || '';
const MONGODB_HOST = process.env.MONGODB_HOST || '';
const DB = 'bot';
const COLLECTION_LESSONS = 'lessons';
const COLLECTION_LESSONS_LIST = 'lessonsList';

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
    const lessons = await this.loadLessons();
    log('Загружено уроков: ', lessons ? lessons.length : 0);

    const lessonsList = await this.loadLessonsList();
    log('Загружено тем уроков: ', lessonsList ? lessonsList.length : 0);
  };

  async getClient() {
    return MongoClient.connect(MONGO_URL, {
      useNewUrlParser: true,
    });
  }

  async getCollection(collectionName: string) {
    const client = await this.getClient();
    const connector = await client.db().collection(COLLECTION_LESSONS);
    const collection = connector.find({}).toArray();
    client.close();

    return collection;
  }

  async loadLessons() {
    if (process.env.NODE_ENV === 'development') {
      // try {
      //   for (let i = 1; i <= 3; i++) {
      //     const les = await readFile(`./src/test/${i}.json`);
      //     // console.log(this.lessons);
      //     this.lessons.push(les);
      //     log('Загружен урок: ', i);
      //   }
      // } catch (e) {
      //   console.log(e);
      // }

      this.lessons = [
        require('./test/1.json'),
        require('./test/2.json'),
        require('./test/3.json'),
      ];
    } else {
      this.lessons = await this.getCollection(COLLECTION_LESSONS);
    }

    return this.lessons;
  }

  async loadLessonsList() {
    if (process.env.NODE_ENV === 'development') {
      this.lessonsList = require('./test/lessonsList.json');
    } else {
      this.lessonsList = await this.getCollection(COLLECTION_LESSONS_LIST);
    }

    return this.lessonsList;
  }
}
