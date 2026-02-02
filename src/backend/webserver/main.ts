import cors from 'cors';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { APP_CONFIG } from './config';
import { initControllers } from './controllers';
import { initDatabaseController } from './controllers/database';

const port = Number(process.env.PORT) || Number(APP_CONFIG.PORT);
const server = process.env.DEV_SERVER_URL || APP_CONFIG.DEV_SERVER_URL;
const feServer = process.env.FE_SERVER_URL || APP_CONFIG.FE_SERVER_URL;
const host = process.env.NODE_ENV === 'docker' ? 'localhost' : server;

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(
  cors({
    origin: feServer,
    credentials: true
  })
);

const getVersion = () => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../', 'package.json'), 'utf8'));
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
};

const main = async () => {
  initDatabaseController(app);
  initControllers(app);

  app.listen(port, server, () => {
    console.log(`Server listening at http://${host}:${port}`);
  });
  // app.get('*', (_req: Request, res: Response) => {
  //   res.sendFile(path.join(distPath, 'index.html'));
  // });
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });
  app.get('/api/version', (_req: Request, res: Response) => {
    res.json({ version: getVersion() });
  });
};

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
