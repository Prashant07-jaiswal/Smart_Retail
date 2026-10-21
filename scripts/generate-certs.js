/**
 * Generates a self-signed TLS certificate valid for a given IP address (or
 * hostname), shared by the backend, AI service, and frontend dev server.
 *
 * This exists because browsers only allow camera access (getUserMedia) on a
 * "secure context" — https://, or http://localhost specifically — never
 * plain http://<some-ip>. There is no way around this with plain HTTP.
 *
 * Usage: node generate-certs.js <ip-or-hostname>
 */
const fs = require('fs');
const path = require('path');
const selfsigned = require('selfsigned');

const target = process.argv[2];
if (!target) {
  console.error('Usage: node generate-certs.js <ip-or-hostname>');
  process.exit(1);
}

const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(target);

const altNames = [
  { type: 2, value: 'localhost' }, // DNS
  { type: 7, ip: '127.0.0.1' }, // IP
];
if (isIp) {
  altNames.push({ type: 7, ip: target });
} else {
  altNames.push({ type: 2, value: target });
}

const pems = selfsigned.generate([{ name: 'commonName', value: target }], {
  days: 365,
  keySize: 2048,
  extensions: [{ name: 'subjectAltName', altNames }],
});

const certsDir = path.join(__dirname, '..', 'certs');
fs.mkdirSync(certsDir, { recursive: true });
fs.writeFileSync(path.join(certsDir, 'cert.pem'), pems.cert);
fs.writeFileSync(path.join(certsDir, 'key.pem'), pems.private);

console.log(`Certificate generated for "${target}" -> ${certsDir}`);
console.log('This is self-signed, so every device will show a one-time "not secure"');
console.log('browser warning — click "Advanced -> Proceed" once per device. That is');
console.log('expected and does not affect camera access once you proceed.');
