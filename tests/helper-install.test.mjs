import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assetName, ensureHelper, installedHelper, parseSums } from '../scripts/lib/helper-install.mjs'

function release(t, { corrupt = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'bot-notch-release-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const content = join(root, 'content')
  mkdirSync(join(content, 'BotNotch_BotNotch.bundle'), { recursive: true })
  writeFileSync(join(content, 'bot-notch'), '#!/bin/sh\n', { mode: 0o755 })
  const name = assetName('9.9.9', 'arm64')
  execFileSync('tar', ['-czf', join(root, name), '-C', content, 'bot-notch', 'BotNotch_BotNotch.bundle'])
  const archive = readFileSync(join(root, name))
  const sum = corrupt ? '0'.repeat(64) : createHash('sha256').update(archive).digest('hex')
  const requests = []
  const fetchImpl = async url => {
    requests.push(url)
    const body = url.endsWith('/SHA256SUMS') ? Buffer.from(`${sum}  ${name}\n`) : url.endsWith(name) ? archive : undefined
    return body ? new Response(body) : new Response('missing', { status: 404 })
  }
  const dir = join(root, 'home')
  return { dir, fetchImpl, requests, options: { dir, env: {}, platform: 'darwin', arch: 'arm64', version: '9.9.9', base: 'https://example.test/dl', fetchImpl } }
}

test('downloads, verifies and unpacks the notch app once per version', async t => {
  const r = release(t)
  const bin = await ensureHelper(r.options)
  assert.equal(bin, installedHelper(r.dir, '9.9.9').bin)
  assert.ok(existsSync(bin))
  assert.ok(existsSync(join(r.dir, 'helper', '9.9.9', 'BotNotch_BotNotch.bundle')))
  assert.deepEqual(r.requests.sort(), [
    'https://example.test/dl/helper-v9.9.9/SHA256SUMS',
    'https://example.test/dl/helper-v9.9.9/bot-notch-9.9.9-macos-arm64.tar.gz'])
  assert.equal(await ensureHelper(r.options), bin)
  assert.equal(r.requests.length, 2, 'already installed: no second download')
})

test('a checksum mismatch installs nothing', async t => {
  const r = release(t, { corrupt: true })
  await assert.rejects(ensureHelper(r.options), /checksum mismatch/)
  assert.equal(existsSync(installedHelper(r.dir, '9.9.9').root), false)
})

test('explicit path wins; other platforms and CPUs get no helper', async t => {
  const r = release(t)
  assert.equal(await ensureHelper({ ...r.options, env: { CLAUDE_PLUGIN_OPTION_HELPER_PATH: '/nope/bot-notch' } }), '')
  const own = join(r.dir, 'own-build')
  mkdirSync(r.dir, { recursive: true }); writeFileSync(own, '')
  assert.equal(await ensureHelper({ ...r.options, env: { CLAUDE_PLUGIN_OPTION_HELPER_PATH: own } }), own)
  assert.equal(await ensureHelper({ ...r.options, platform: 'linux' }), '')
  assert.equal(await ensureHelper({ ...r.options, arch: 'x64' }), '')
  assert.equal(r.requests.length, 0)
})

test('parses shasum output', () => {
  const sums = parseSums(`${'a'.repeat(64)}  one.tar.gz\n${'b'.repeat(64)} *two.tar.gz\nnoise\n`)
  assert.equal(sums.get('one.tar.gz'), 'a'.repeat(64))
  assert.equal(sums.get('two.tar.gz'), 'b'.repeat(64))
})
