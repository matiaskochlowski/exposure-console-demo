import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { generateFindings } from '../src/shared/generate.js';

const findings = generateFindings();
const json = JSON.stringify(findings);
mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/findings.json', json);
const kib = (n: number) => `${(n / 1024).toFixed(0)} KiB`;
console.log(
  `findings.json: ${findings.length} rows, ${kib(json.length)} raw, ${kib(gzipSync(json).length)} gzip`,
);
