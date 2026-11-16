import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse } from './parse.js';

try {
  const inputDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
  const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

  const content = fs.readFileSync(path.join(inputDir, 'cases.json'), 'utf8');
  const cases = JSON.parse(content);
  const results = new Array(cases.length);
  for (let i = 0; i < cases.length; i++) {
    results[i] = parse(cases[i].markdown);
  }
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(path.join(outputDir, 'html.json'), JSON.stringify(results));
} catch (err) {
  console.error(err);
  process.exit(1);
}
