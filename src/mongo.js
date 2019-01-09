import { MongoClient, ObjectId } from 'mongodb';
import { config } from 'dotenv';
config();

const MONGODB_PASSWORD = process.env.MONGODB_PASSWORD;
const MONGODB_HOST = process.env.MONGODB_HOST;
const DB = 'bot';

const COLLECTION_LESSONS = 'lessons';

if (!MONGODB_HOST) {
  console.log('MONGODB_HOST not provided');
  process.exit(1);
}

if (!MONGODB_PASSWORD) {
  console.log('MONGODB_PASSWORD not provided');
  process.exit(1);
}

const MONGO_URL = `mongodb+srv://alex:${MONGODB_PASSWORD}@${MONGODB_HOST}/${DB}?retryWrites=true`;

export class Mongo {
  // constructor() {
  //   (async () => {
  //     try {
  //       this.client = await MongoClient.connect(MONGO_URL, {
  //         useNewUrlParser: true,
  //       });

  //       // this.lessonsConnector = this.client.db().collection(COLLECTION_LESSONS);

  //       // this.lessons = () => this.lessonsConnector.find();
  //       // console.log('lessons', await Object.keys(this.lessons).length);
  //       // this.client.close();
  //       // console.log(this);
  //     } catch (e) {
  //       console.log(e);
  //     }
  //   })();
  // }

  async getLessons() {
    // try {
    const client = await MongoClient.connect(MONGO_URL, {
      useNewUrlParser: true,
    });
    const lessonsConnector = await client.db().collection(COLLECTION_LESSONS);

    const lessons = lessonsConnector.find({}).toArray();
    // client.close();
    return lessons;
    // } catch (e) {
    // console.log(e);
    // }

    // return lessonsConnector.findOne({ id: 1 });
  }

  prepare(o) {
    console.log(o);
    o._id = o._id.toString();
    return o;
  }
}
