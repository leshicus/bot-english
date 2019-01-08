import { MongoClient, ObjectId } from 'mongodb';

const PASSWORD = '742298';
const DB = 'bot';
const MONGO_URL = `mongodb+srv://alex:${PASSWORD}@leshicus-wulj0.mongodb.net/${DB}?retryWrites=true`;

const COLLECTION_LESSONS = 'lessons';

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
