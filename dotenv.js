const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
  path: path.resolve(process.cwd(), '.env'),
});
if (process.env.ENV_PATH) {
  dotenv.config({
    path: path.resolve(process.cwd(), process.env.ENV_PATH),
  });
}
dotenv.config();
