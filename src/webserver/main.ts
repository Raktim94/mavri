import express from 'express';
import { APP_CONFIG } from './config';
import { initDatabaseController } from './controllers/database';
import { getDistPath } from './utils/functions';

const port = Number(process.env.PORT) || Number(APP_CONFIG.PORT);
const server = process.env.DEV_SERVER_URL || APP_CONFIG.DEV_SERVER_URL;
const distPath = getDistPath();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static(distPath));

const main = async () => {
  initDatabaseController(app);
  app.listen(port, server, () => {
    console.log(`Server listening on http://${server}:${port}`);
  });
};

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
