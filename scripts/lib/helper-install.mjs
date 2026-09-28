import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'

/**
 * The native notch app ships as a prebuilt release asset of this repository.
 * The plugin downloads it once per helper version into its own data directory,
 * so installing the plugin is the whole setup.
 */
// Must match a published `helper-v<version>` release (see README).
export const HELPER_VERSION = JSON.parse(readFileSync(new URL('./helper-version.json', import.meta.url), 'utf8')).version
export const RELEASES = 'https://github.com/aa2246740/claude-bot-notch/releases/download'

const run = promisify(execFile)

export function assetName(version = HELPER_VERSION, arch = process.arch) {
  return `bot-notch-${version}-macos-${arch}.tar.gz`
}

export function installedHelper(dir, version = HELPER_VERSION) {
  const root = join(dir, 'helper', version)
  return { root, bin: join(root, 'bot-notch') }
}

/** `<sha256>  <file>` lines, as written by `shasum -a 256`. */
export function parseSums(text) {
  const sums = new Map()
  for (const line of String(text).split('\n')) {
    const match = /^([0-9a-f]{64})\s+\*?(.+)$/.exec(line.trim())
    if (match) sums.set(match[2].trim(), match[1])
  }
  return sums
}

async function download(url, fetchImpl) {
  const response = await fetchImpl(url, { redirect: 'follow', signal: AbortSignal.timeout(120_000) })
  if (!response.ok) throw new Error(`download ${url}: HTTP ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

/**
 * Resolve the helper executable: an explicit path wins; otherwise the installed
 * copy, downloading and verifying it first when missing. Returns '' where no
 * helper exists (not macOS, unsupported CPU, offline): the plugin then only
 * tracks state and never holds a permission prompt.
 */
export async function ensureHelper({ dir, env = process.env, platform = process.platform, arch = process.arch,
  version = HELPER_VERSION, base = RELEASES, fetchImpl = fetch, log = () => {} }) {
  const explicit = env.CLAUDE_PLUGIN_OPTION_HELPER_PATH || env.BOT_NOTCH_HELPER || ''
  if (explicit) return existsSync(explicit) ? explicit : (log(`configured helper does not exist: ${explicit}`), '')
  if (platform !== 'darwin') return ''
  if (arch !== 'arm64') { log(`no prebuilt helper for macOS ${arch}`); return '' }
  const target = installedHelper(dir, version)
  if (existsSync(target.bin)) return target.bin

  const name = assetName(version, arch)
  const release = `${base}/helper-v${version}`
  log(`installing helper ${version} from ${release}`)
  const [archive, sums] = await Promise.all([download(`${release}/${name}`, fetchImpl), download(`${release}/SHA256SUMS`, fetchImpl)])
  const expected = parseSums(sums.toString('utf8')).get(name)
  const actual = createHash('sha256').update(archive).digest('hex')
  if (!expected || expected !== actual) throw new Error(`helper checksum mismatch for ${name}`)

  const stage = `${target.root}.${process.pid}.tmp`
  rmSync(stage, { recursive: true, force: true })
  mkdirSync(stage, { recursive: true, mode: 0o700 })
  const tarball = join(stage, name)
  writeFileSync(tarball, archive)
  // The archive holds bot-notch and BotNotch_BotNotch.bundle at its top level.
  await run('tar', ['-xzf', tarball, '-C', stage])
  rmSync(tarball)
  if (!existsSync(join(stage, 'bot-notch'))) throw new Error(`${name} does not contain bot-notch`)
  rmSync(target.root, { recursive: true, force: true })
  mkdirSync(join(dir, 'helper'), { recursive: true, mode: 0o700 })
  renameSync(stage, target.root)
  log(`helper ${version} installed`)
  return target.bin
}
