import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideAccess, passwordFromBasicAuth, safeEqual } from '../lib/auth';

const basic = (userPass: string) => `Basic ${Buffer.from(userPass, 'utf8').toString('base64')}`;

test('safeEqual compares exactly, including length and multi-byte characters', () => {
  assert.equal(safeEqual('hunter2', 'hunter2'), true);
  assert.equal(safeEqual('hunter2', 'hunter3'), false);
  assert.equal(safeEqual('hunter2', 'hunter22'), false);
  assert.equal(safeEqual('', ''), true);
  assert.equal(safeEqual('🏆', '🏆'), true);
  assert.equal(safeEqual('🏆', '🥇'), false);
});

test('passwordFromBasicAuth takes everything after the first colon', () => {
  assert.equal(passwordFromBasicAuth(basic('any:secret')), 'secret');
  assert.equal(passwordFromBasicAuth(basic(':secret')), 'secret');
  assert.equal(passwordFromBasicAuth(basic('user:pa:ss')), 'pa:ss');
  assert.equal(passwordFromBasicAuth(basic('user:pässwörd🏆')), 'pässwörd🏆');
  assert.equal(passwordFromBasicAuth(`basic ${Buffer.from('u:p').toString('base64')}`), 'p');
});

test('passwordFromBasicAuth rejects missing or malformed headers', () => {
  assert.equal(passwordFromBasicAuth(null), null);
  assert.equal(passwordFromBasicAuth(''), null);
  assert.equal(passwordFromBasicAuth('Bearer abc'), null);
  assert.equal(passwordFromBasicAuth(basic('no-colon')), null);
  assert.equal(passwordFromBasicAuth('Basic !!!not-base64!!!'), null);
});

test('with a password set, only the right password is allowed', () => {
  const base = { password: 'secret', onVercel: true };
  assert.equal(decideAccess({ ...base, authorization: basic('x:secret') }), 'allow');
  assert.equal(decideAccess({ ...base, authorization: basic('x:wrong') }), 'challenge');
  assert.equal(decideAccess({ ...base, authorization: null }), 'challenge');
  assert.equal(decideAccess({ ...base, onVercel: false, authorization: null }), 'challenge');
});

test('without a password: open locally, locked on Vercel', () => {
  assert.equal(decideAccess({ password: undefined, onVercel: false, authorization: null }), 'allow');
  assert.equal(decideAccess({ password: '', onVercel: false, authorization: null }), 'allow');
  assert.equal(decideAccess({ password: undefined, onVercel: true, authorization: basic('x:anything') }), 'misconfigured');
  assert.equal(decideAccess({ password: '', onVercel: true, authorization: null }), 'misconfigured');
});
