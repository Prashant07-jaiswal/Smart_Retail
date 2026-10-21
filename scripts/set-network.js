/**
 * One command to point the whole Smart Retail Platform at a given network
 * IP address: regenerates the shared HTTPS certificate for that IP, then
 * rewrites frontend/.env and backend/.env so every service uses it.
 *
 * Usage:
 *   node set-network.js <ip-address>            (HTTPS — camera works everywhere)
 *   node set-network.js <ip-address> --http     (plain HTTP — camera will NOT
 *                                                 work on any non-localhost
 *                                                 device; browsers block it)
 *   node set-network.js localhost               (reset back to local-only dev)
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--'));
const useHttp = args.includes('--http');

if (!target) {
  console.error('Usage: node set-network.js <ip-address> [--http]');
  console.error('Example: node set-network.js 192.168.1.50');
  process.exit(1);
}

const isLocalhost = target === 'localhost';
const isValidIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(target);
if (!isLocalhost && !isValidIp) {
  console.error(`"${target}" doesn't look like a valid IPv4 address (e.g. 192.168.1.50) or "localhost".`);
  process.exit(1);
}

const useHttps = !useHttp && !isLocalhost;
const protocol = useHttps ? 'https' : 'http';
const root = path.join(__dirname, '..');

if (useHttps) {
  console.log(`Generating HTTPS certificate for ${target} ...`);
  try {
    execFileSync(process.execPath, [path.join(__dirname, 'generate-certs.js'), target], { stdio: 'inherit' });
  } catch (err) {
    console.error('\nCould not generate the certificate. Did you run "npm install" inside the scripts/ folder first?');
    process.exit(1);
  }
}

function upsertEnvLines(envPath, examplePath, updates) {
  let lines = [];
  if (fs.existsSync(envPath)) {
    lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  } else if (fs.existsSync(examplePath)) {
    lines = fs.readFileSync(examplePath, 'utf8').split(/\r?\n/);
  }

  for (const [key, value] of Object.entries(updates)) {
    const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
    const line = `${key}=${value}`;
    if (idx >= 0) lines[idx] = line;
    else lines.push(line);
  }

  fs.writeFileSync(envPath, lines.filter((l) => l.trim() !== '').join('\n') + '\n');
}

upsertEnvLines(path.join(root, 'frontend', '.env'), path.join(root, 'frontend', '.env.example'), {
  VITE_API_URL: `${protocol}://${target}:5000/api`,
  VITE_SOCKET_URL: `${protocol}://${target}:5000`,
  VITE_AI_URL: `${protocol}://${target}:8000`,
  VITE_USE_HTTPS: String(useHttps),
});

upsertEnvLines(path.join(root, 'backend', '.env'), path.join(root, 'backend', '.env.example'), {
  FRONTEND_URL: `${protocol}://${target}:5173`,
  USE_HTTPS: String(useHttps),
});

console.log('');
console.log(`Project configured for ${protocol}://${target}`);
console.log('');
console.log('Now start each service (in separate terminals):');
console.log('');
console.log('  cd backend && npm start');
if (useHttps) {
  console.log('  cd ai-service && venv\\Scripts\\activate && uvicorn main:app --host 0.0.0.0 --port 8000 --ssl-keyfile ../certs/key.pem --ssl-certfile ../certs/cert.pem');
} else {
  console.log('  cd ai-service && venv\\Scripts\\activate && uvicorn main:app --host 0.0.0.0 --port 8000');
}
console.log('  cd frontend && npm run dev -- --host 0.0.0.0');
console.log('');
console.log(`Then open: ${protocol}://${target}:5173`);
if (useHttps) {
  console.log('');
  console.log('Each device will show a one-time "not secure" browser warning for the');
  console.log('self-signed certificate — click "Advanced -> Proceed" once per device.');
  console.log('This is expected and does not affect functionality, including the camera.');
}
