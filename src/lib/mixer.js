import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs-extra'

const DEFAULT_STEMS = ['vocals', 'drums', 'bass', 'other']

/**
 * Mix stems according to mute/solo options.
 *
 * @param {string} stemsDir   - directory containing stem WAV files
 * @param {string} outputFile - path for the mixed output WAV
 * @param {{ mute?: string, solo?: string, availableStems?: string[] }} options
 * @returns {Promise<string>} outputFile path
 */
export async function mixStems(stemsDir, outputFile, { mute, solo, availableStems } = {}) {
  await fs.ensureDir(path.dirname(outputFile))

  const stemSet = availableStems ?? DEFAULT_STEMS
  let stemsToKeep

  if (solo) {
    stemsToKeep = [solo]
  } else if (mute) {
    stemsToKeep = stemSet.filter((s) => s !== mute)
  } else {
    stemsToKeep = [...stemSet]
  }

  const stemPaths = stemsToKeep.map((s) => path.join(stemsDir, `${s}.wav`))

  for (const p of stemPaths) {
    if (!fs.existsSync(p)) {
      throw new Error(`Stem file not found: ${p}`)
    }
  }

  if (stemPaths.length === 1) {
    // Solo mode — simple copy, no ffmpeg amix needed
    await fs.copy(stemPaths[0], outputFile)
    return outputFile
  }

  return new Promise((resolve, reject) => {
    const inputs = stemPaths.flatMap((p) => ['-i', p])
    const filter = `amix=inputs=${stemPaths.length}:duration=longest:normalize=0`

    const args = [
      ...inputs,
      '-filter_complex', filter,
      '-y',
      outputFile,
    ]

    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] })

    proc.on('error', (err) => reject(new Error(`ffmpeg error: ${err.message}`)))

    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg exited with code ${code}`))
      resolve(outputFile)
    })
  })
}
