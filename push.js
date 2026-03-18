const { execSync } = require('child_process');
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

try {
  console.log('Running prisma db push...');
  const output = execSync('npx prisma db push --accept-data-loss', { 
    env: { ...process.env }
  });
  console.log('Success.');
} catch (e) {
  const fs = require('fs');
  fs.writeFileSync('error.log', e.stdout ? e.stdout.toString() : '');
  fs.appendFileSync('error.log', '\nSTDERR:\n' + (e.stderr ? e.stderr.toString() : ''));
  console.error('Failed:', e.message);
}
