import assert from 'node:assert/strict';
import { test } from 'node:test';
import { connectMcp } from './mcp-client.mjs';

const server = source => connectMcp([process.execPath, '-e', source]);

test('receives the final response before a server exits', { timeout: 2000 }, async () => {
  const client = server(`process.stdin.once('data', data => {
    const { id } = JSON.parse(data);
    process.stdout.write(JSON.stringify({ id, result: 'done' }) + '\\n', () => process.exit(0));
  });`);
  try { assert.equal(await client.request('test', {}), 'done'); }
  finally { client.close(); }
});

test('close rejects pending and future requests immediately', { timeout: 2000 }, async () => {
  const client = server('process.stdin.resume()');
  const pending = assert.rejects(client.request('test', {}), /client closed/);
  client.close();
  await pending;
  await assert.rejects(client.request('after-close', {}), /client closed/);
  client.close(); // repeated cleanup is safe
});

test('malformed stdout rejects all pending requests and future requests', { timeout: 2000 }, async () => {
  const client = server(`process.stdin.once('data', () => console.log('not JSON'));`);
  const first = assert.rejects(client.request('one', {}), /Non-JSON stdout/);
  const second = assert.rejects(client.request('two', {}), /Non-JSON stdout/);
  try {
    await Promise.all([first, second]);
    await assert.rejects(client.request('later', {}), /Non-JSON stdout/);
  } finally { client.close(); }
});

test('spawn failure rejects requests without an unhandled pipe error', { timeout: 2000 }, async () => {
  const client = connectMcp(['/this-executable-does-not-exist']);
  try {
    await assert.rejects(client.request('test', {}), /ENOENT/);
    await assert.rejects(client.request('later', {}), /ENOENT/);
  } finally { client.close(); }
});

test('JSON-RPC errors reject only the matching request', { timeout: 2000 }, async () => {
  const client = server(`process.stdin.once('data', data => {
    const { id } = JSON.parse(data);
    console.log(JSON.stringify({ id, error: { code: -32601, message: 'missing' } }));
  });`);
  try { await assert.rejects(client.request('missing', {}), /-32601/); }
  finally { client.close(); }
});
