/* eslint-disable no-undef */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { execSync } = require('child_process');

const destPath = process.argv[2];
if (!destPath) {
  console.error('Usage: node scripts/backup-data.js <destination-path>');
  process.exit(1);
}

try {
  execSync(`docker cp backend:/data ${destPath}`, { stdio: 'inherit' });
  console.log(`Data copied to ${destPath}`);
} catch (err) {
  console.error('Error copying data:', err.message);
  process.exit(1);
}
