import fs from 'fs'
import decode from 'audio-decode'

// Init essentia WASM once at module load — avoids 1-2s penalty per call
let _essentia = null

async function getEssentia() {
  if (_essentia) return _essentia
  const { Essentia, EssentiaWASM } = await import('essentia.js')
  _essentia = new Essentia(EssentiaWASM)
  return _essentia
}

/**
 * Analyze BPM and musical key of an audio file.
 * @param {string} filePath - path to WAV or MP3
 * @returns {Promise<{ bpm: number, key: string }>}
 */
export async function analyzeAudio(filePath) {
  const essentia = await getEssentia()

  const buffer = fs.readFileSync(filePath)
  // audio-decode returns an AudioBuffer-like object
  const audio = await decode(buffer)
  // Use mono channel 0
  const channelData = audio.getChannelData(0)
  const data = essentia.arrayToVector(channelData)

  const { bpm } = essentia.PercivalBpmEstimator(data)
  const { key, scale } = essentia.KeyExtractor(data)

  return {
    bpm,
    key: `${key} ${scale}`,
  }
}
