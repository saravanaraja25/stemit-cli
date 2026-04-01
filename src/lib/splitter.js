import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

// Stems produced by each model. Falls back to 4-stem list for unknown models.
export const MODEL_STEMS = {
  htdemucs:      ['vocals', 'drums', 'bass', 'other'],
  htdemucs_ft:   ['vocals', 'drums', 'bass', 'other'],
  htdemucs_6s:   ['vocals', 'drums', 'bass', 'guitar', 'piano', 'other'],
  mdx:           ['vocals', 'drums', 'bass', 'other'],
  mdx_extra:     ['vocals', 'drums', 'bass', 'other'],
  mdx_extra_q:   ['vocals', 'drums', 'bass', 'other'],
}

const DEFAULT_STEMS = ['vocals', 'drums', 'bass', 'other']

// All possible stems across all models (for CLI validation)
export const ALL_STEMS = ['vocals', 'drums', 'bass', 'guitar', 'piano', 'other']

/**
 * Run demucs to separate stems from inputFile.
 * @param {string} inputFile    - path to WAV/MP3
 * @param {string} outputDir    - root output directory
 * @param {string} model        - demucs model name (e.g. 'htdemucs_ft')
 * @param {function} onProgress - called with (chunk: number, total: number, pct: number)
 * @param {string} pythonPath   - path to python binary (defaults to system python3)
 * @returns {Promise<{stemsDir: string, stems: string[]}>}
 */
export function splitStems(
  inputFile,
  outputDir,
  model = 'htdemucs_ft',
  onProgress = () => {},
  pythonPath = 'python3'
) {
  return new Promise((resolve, reject) => {
    const args = ['-m', 'demucs', '-n', model, '--out', outputDir, inputFile]
    const proc = spawn(pythonPath, args, {
      env: { ...process.env, TORCHAUDIO_BACKEND: 'soundfile' },
    })

    const stderrLines = []
    let chunkIndex = 0
    let totalChunks = 0

    proc.stderr.on('data', (buf) => {
      const text = buf.toString()
      stderrLines.push(text)

      // Detect "Separated track … (N chunks)" to know total segments
      // demucs logs e.g.: "Separated track song (4 chunks)"
      const totalMatch = text.match(/\((\d+)\s+chunks?\)/i)
      if (totalMatch) {
        totalChunks = parseInt(totalMatch[1], 10)
      }

      // Each new tqdm bar starting from 0% signals a new chunk
      const zeroMatch = text.match(/^\s*0%\|/)
      if (zeroMatch && totalChunks > 0) {
        chunkIndex++
      }

      // Parse percentage from tqdm-style output:  87%|████...
      const pctMatch = text.match(/\b(\d{1,3})%\|/)
      if (pctMatch) {
        const pct = parseInt(pctMatch[1], 10)
        const effectiveChunk = Math.max(chunkIndex, 1)
        const effectiveTotal = Math.max(totalChunks, 1)
        onProgress(effectiveChunk, effectiveTotal, pct)
      }
    })

    proc.on('error', (err) => reject(new Error(`Failed to start demucs: ${err.message}`)))

    proc.on('close', (code) => {
      if (code !== 0) {
        const detail = stderrLines.join('').trim().split('\n').slice(-10).join('\n')
        return reject(
          new Error(`demucs exited with code ${code}\n\ndemucs output:\n${detail}`)
        )
      }

      // Resolve stems directory: <outputDir>/<model>/<songname>/
      const songName = path.basename(inputFile, path.extname(inputFile))
      const stemsDir = path.join(outputDir, model, songName)

      if (!fs.existsSync(stemsDir)) {
        return reject(new Error(`Expected stems dir not found: ${stemsDir}`))
      }

      // Use the known stem list for this model, or discover from actual files
      const expectedStems = MODEL_STEMS[model] ?? DEFAULT_STEMS
      const stems = expectedStems
        .map((s) => path.join(stemsDir, `${s}.wav`))
        .filter((p) => fs.existsSync(p))
      resolve({ stemsDir, stems })
    })
  })
}

