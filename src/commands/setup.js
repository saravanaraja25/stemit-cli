import { execSync, spawnSync } from 'child_process'
import path from 'path'
import fs from 'fs-extra'
import which from 'which'
import chalk from 'chalk'
import os from 'os'

const VENV_DIR = path.join(os.homedir(), '.stemit', 'venv')
const VENV_PYTHON =
  process.platform === 'win32'
    ? path.join(VENV_DIR, 'Scripts', 'python.exe')
    : path.join(VENV_DIR, 'bin', 'python3')
const VENV_PIP =
  process.platform === 'win32'
    ? path.join(VENV_DIR, 'Scripts', 'pip.exe')
    : path.join(VENV_DIR, 'bin', 'pip3')

const FFMPEG_INSTALL = {
  darwin: 'brew install ffmpeg',
  linux:  'sudo apt install ffmpeg  (or your distro package manager)',
  win32:  'winget install ffmpeg  (or https://ffmpeg.org/download.html)',
}

/**
 * Ensure all system + Python dependencies are ready.
 * Creates ~/.stemit/venv and auto-installs demucs into it if needed.
 * @returns {Promise<{ pythonPath: string }>}
 */
export async function checkDependencies() {
  const errors = []

  // ── ffmpeg ──────────────────────────────────────────────────────────────────
  try {
    await which('ffmpeg')
  } catch {
    const hint = FFMPEG_INSTALL[process.platform] ?? 'https://ffmpeg.org/download.html'
    errors.push(`ffmpeg not found.\n  Install: ${hint}`)
  }

  // ── python3 / python (Windows uses "python") ─────────────────────────────────
  let systemPython = null
  try {
    // Try python3 first (macOS/Linux), fall back to python (Windows / some Linux)
    for (const cmd of ['python3', 'python']) {
      try {
        await which(cmd)
        systemPython = cmd
        break
      } catch {
        // try next
      }
    }

    if (!systemPython) throw new Error('not found')

    const versionOutput = execSync(`${systemPython} --version`, { encoding: 'utf8' }).trim()
    const match = versionOutput.match(/Python (\d+)\.(\d+)/)
    if (!match) {
      errors.push('Could not parse Python version.')
    } else {
      const [, major, minor] = match.map(Number)
      if (major < 3 || (major === 3 && minor < 9)) {
        errors.push(
          `Python 3.9+ required, found ${versionOutput}.\n  Upgrade: https://www.python.org/downloads/`
        )
      }
    }
  } catch {
    errors.push('Python not found.\n  Install Python 3.9+: https://www.python.org/downloads/')
  }

  if (errors.length > 0) {
    console.error(chalk.red('\n✖ Missing dependencies:\n'))
    errors.forEach((e) => console.error(chalk.red(`  • ${e}\n`)))
    process.exit(1)
  }

  // ── venv + demucs (auto-managed) ─────────────────────────────────────────
  const pythonPath = await ensureDemucsVenv(systemPython)
  return { pythonPath }
}

async function ensureDemucsVenv(systemPython) {
  // Create venv if it doesn't exist yet
  if (!fs.existsSync(VENV_PYTHON)) {
    console.log(chalk.cyan('\n  Creating Python venv at ~/.stemit/venv …'))
    await fs.ensureDir(path.dirname(VENV_DIR))

    const create = spawnSync(systemPython, ['-m', 'venv', VENV_DIR], { encoding: 'utf8' })
    if (create.status !== 0) {
      console.error(chalk.red(`\n  Failed to create venv:\n${create.stderr}`))
      process.exit(1)
    }
    console.log(chalk.green('  ✔ venv created'))
  }

  // Install demucs if not already present in the venv
  const demucsCheck = spawnSync(VENV_PYTHON, ['-m', 'demucs', '--help'], {
    encoding: 'utf8',
    stdio: 'pipe',
  })

  if (demucsCheck.status !== 0) {
    console.log(chalk.cyan('  Installing demucs (one-time setup, may take a minute) …'))
    const install = spawnSync(VENV_PIP, ['install', 'demucs', 'soundfile', 'torchcodec'], {
      encoding: 'utf8',
      stdio: 'inherit',
    })
    if (install.status !== 0) {
      console.error(chalk.red(
        '\n  Failed to install demucs. Try manually:\n' +
        '    pip install demucs soundfile torchcodec'
      ))
      process.exit(1)
    }
    console.log(chalk.green('  ✔ demucs installed'))
  }

  return VENV_PYTHON
}
