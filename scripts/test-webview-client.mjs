import assert from 'node:assert/strict';
import { createWebViewClient } from '../src/platform/webview-client.js';

const listeners = new Set(),
  sent = [],
  notifications = [];
const webview = {
  addEventListener(name, listener) {
    assert.equal(name, 'message');
    listeners.add(listener);
  },
  removeEventListener(name, listener) {
    listeners.delete(listener);
  },
  postMessage(message) {
    sent.push(message);
  },
};
const deliver = (data) => {
  for (const listener of listeners) listener({ data });
};
const client = createWebViewClient({
  webview,
  receive(message) {
    if (!message.refresh) return false;
    notifications.push(message.refresh);
    return true;
  },
});
const first = client.request('saveProject', { project: { id: 'p' } });
const second = client.request('init');
assert.notEqual(sent[0].id, sent[1].id);
deliver({ refresh: 'latest' });
deliver({ id: sent[1].id, ok: true, data: { mode: 'editor' } });
deliver({ id: 'unknown', ok: true, data: 'ignored' });
deliver({ id: sent[0].id, ok: true, data: { saved: true } });
assert.deepEqual(await second, { mode: 'editor' });
assert.deepEqual(await first, { saved: true });
assert.deepEqual(notifications, ['latest']);
const rejected = client.request('saveProject');
deliver({ id: sent.at(-1).id, ok: false, error: 'save failed' });
await assert.rejects(rejected, /save failed/);
const closing = client.request('init');
const closed = assert.rejects(closing, /Windows/);
client.dispose();
await closed;
assert.equal(listeners.size, 0);
await assert.rejects(client.request('init'), /Windows/);
client.dispose();
const unavailable = createWebViewClient({ webview: null, missingMessage: 'unavailable' });
await assert.rejects(unavailable.request('init'), /unavailable/);
unavailable.dispose();
const broken = createWebViewClient({
  webview: {
    ...webview,
    postMessage() {
      throw Error('transport failed');
    },
  },
});
await assert.rejects(broken.request('init'), /transport failed/);
broken.dispose();
console.log(
  'PASS: concurrent/out-of-order replies, notifications, errors, missing transport and disposal.',
);
