import fs from 'fs';
import path from 'path';

const src = path.resolve('src/webserver/package.json');
const dest = path.resolve('dist-be/server/package.json');

fs.copyFileSync(src, dest);
console.log('Copied webserver package.json → dist-be/server');
