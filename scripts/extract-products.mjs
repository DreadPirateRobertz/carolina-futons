#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';

const INPUT = process.argv[2];
const OUTPUT = process.argv[3] || '/tmp/products-clean.json';

let raw = readFileSync(INPUT, 'utf8');
// Clean control characters
raw = raw.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ' ');
const parsed = JSON.parse(raw);
const text = Array.isArray(parsed) ? parsed[0].text : parsed.text;
const jsonStart = text.indexOf('{');
let jsonStr = text.substring(jsonStart);
const data = JSON.parse(jsonStr);
writeFileSync(OUTPUT, JSON.stringify(data));
console.log('Products:', data.products.length);
console.log('Total:', data.totalResults);
