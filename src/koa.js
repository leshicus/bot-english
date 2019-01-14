// @flow
import Koa from 'koa';
import Router from 'koa-router';

const PORT = process.env.PORT || '8080';

const formatJson = json => JSON.stringify(json, null, 2);
const makeResp = arr => {
  return {
    len: arr.length,
    response: arr,
  };
};

export const runWebServer = (bot: any) => {
  const app = new Koa(bot);

  const router = new Router();

  router
    .get('/lessons', async (ctx, next) => {
      const lessons = await bot.getLessons();
      ctx.body = formatJson(makeResp(lessons));
    })
    .get('/lessonsList', async (ctx, next) => {
      const lessonsList = await bot.getLessonsList();
      ctx.body = formatJson(makeResp(lessonsList));
    });

  app.use(router.routes());

  app.listen(PORT);
  console.log(`listen: ${PORT}`);
};
