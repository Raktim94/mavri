/* eslint-disable no-undef */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { execSync } = require('child_process');

const dbName = process.argv[2];
if (!dbName) {
  console.error('Usage: node scripts/remove-db.js <db-file>');
  process.exit(1);
}

execSync(`docker exec backend rm -f /data/${dbName}`, { stdio: 'inherit' });
