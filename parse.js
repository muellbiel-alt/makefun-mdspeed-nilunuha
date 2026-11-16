import { Marked } from './vendor/marked/marked.esm.js';

const markedInstance = new Marked();

export function parse(markdown) {
  return markedInstance.parse(markdown);
}
