import * as fs from 'node:fs';
import { parse } from './parse.js';

try {
  const content = fs.readFileSync('/input/cases.json', 'utf8');
  const cases = JSON.parse(content);
  const results = cases.map((c: { markdown: string }) => parse(c.markdown));
  fs.writeFileSync('/output/html.json', JSON.stringify(results));
} catch (err) {
  console.error(err);
  process.exit(1);
}
