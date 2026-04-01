import youtubedl from 'youtube-dl-exec'
import fs from 'fs-extra'
import path from 'path'

const URL_REGEX = /^https?:\/\//

/**
 * Resolve input to a local WAV file path.
 * If input is a URL, download audio as WAV via yt-dlp.
 * If input is a local path, use it directly.
 *
 * @param {string} input  - URL or local file path
 * @param {string} tmpDir - directory to place downloaded files
 * @returns {Promise<string>} resolved path to the audio file
 */
export async function resolveInput(input, tmpDir = 'tmp') {
  await fs.ensureDir(tmpDir)

  if (URL_REGEX.test(input)) {
    return downloadUrl(input, tmpDir)
  }

  const resolved = path.resolve(input)
  if (!fs.existsSync(resolved)) {
    throw new Error(`File not found: ${resolved}`)
  }
  return resolved
}

async function downloadUrl(url, tmpDir) {
  const outputTemplate = path.join(tmpDir, '%(title)s.%(ext)s')

  await youtubedl(url, {
    extractAudio: true,
    audioFormat: 'wav',
    output: outputTemplate,
    noCheckCertificates: true,
    noWarnings: true,
  })

  // Find the downloaded wav file
  const files = (await fs.readdir(tmpDir)).filter((f) => f.endsWith('.wav'))
  if (files.length === 0) {
    throw new Error('Download succeeded but no WAV file found in tmp dir.')
  }

  // Return the most recently modified wav
  const sorted = files
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(tmpDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)

  return path.resolve(path.join(tmpDir, sorted[0].name))
}
