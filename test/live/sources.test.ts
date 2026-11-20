// Every excerpt of docs/sources.md against the live page it quotes, word for word.
//
//   NOONSIGHT_LIVE_SOURCES=1 npm run test:live
//
// It reads each page as Anthropic serves it: the Markdown of a documentation page (its URL with
// `.md`), and the text of an engineering article's HTML. Links keep their text and drop their
// target, and runs of white space count as one space, on both sides; nothing else is changed. It
// sends no prompt and needs no login, only the network.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readSources } from '../docs-lib.js';

const enabled = process.env.NOONSIGHT_LIVE_SOURCES === '1';

/** The page as plain text: Markdown links reduced to their text, HTML tags and entities removed. */
export function pageText(body: string, html: boolean): string {
  let t = body;
  if (html) {
    t = t
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&#x27;|&#39;|&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ');
  }
  return normalize(t.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'));
}

export const normalize = (s: string): string => s.replace(/\s+/g, ' ').trim();

for (const source of enabled ? readSources() : []) {
  test(`live, sources: ${source.id} still says what docs/sources.md quotes`, async () => {
    const html = !/\/docs\//.test(source.url);
    const url = html ? source.url : `${source.url}.md`;
    const response = await fetch(url, { redirect: 'follow' });
    assert.equal(response.status, 200, `${url} answered ${response.status}`);
    const page = pageText(await response.text(), html);
    const missing = source.excerpts.map(normalize).filter((e) => !page.includes(normalize(e.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'))));
    assert.deepEqual(missing, [], `${source.id}: excerpts no longer on ${url}`);
  });
}

test('live, sources: off unless NOONSIGHT_LIVE_SOURCES=1', { skip: enabled }, () => {});
