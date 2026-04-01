import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs-extra'

/**
 * Convert a WAV file to MP3 using ffmpeg.
 * @param {string} inputWav  - source WAV path
 * @param {string} outputMp3 - destination MP3 path (defaults to same name with .mp3)
 * @returns {Promise<string>} outputMp3 path
 */
export async function wavToMp3(inputWav, outputMp3) {
  if (!outputMp3) {
    outputMp3 = inputWav.replace(/\.wav$/i, '.mp3')
  }
  await fs.ensureDir(path.dirname(outputMp3))

  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputWav,
      '-q:a', '0',
      '-map', 'a',
      '-y',
      outputMp3,
    ]

    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] })

    proc.on('error', (err) => reject(new Error(`ffmpeg error: ${err.message}`)))

    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg exited with code ${code}`))
      resolve(outputMp3)
    })
  })
}
