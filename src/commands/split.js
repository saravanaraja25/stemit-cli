import { Command } from 'commander'
import path from 'path'
import chalk from 'chalk'
import ora from 'ora'

import { checkDependencies } from './setup.js'
import { resolveInput } from '../lib/downloader.js'
import { splitStems, ALL_STEMS, MODEL_STEMS } from '../lib/splitter.js'
import { mixStems } from '../lib/mixer.js'
import { analyzeAudio } from '../lib/analyzer.js'
import { wavToMp3 } from '../lib/converter.js'
import { printBanner } from '../ui/banner.js'
import { createBar, stopAll } from '../ui/progress.js'
import { printSummary } from '../ui/summary.js'

const VALID_FORMATS = ['wav', 'mp3']

// Known models listed for help text
const MODEL_LIST = Object.keys(MODEL_STEMS).join('|')

const program = new Command()

program
  .name('stemit')
  .description('Separate audio into stems, analyze BPM & key, mute/solo tracks')
  .version('1.0.0')

program
  .command('split <input>')
  .description('Split audio into stems (URL or local file)')
  .option('--model <name>', `demucs model (${MODEL_LIST})`, 'htdemucs_ft')
  .option('--out <dir>', 'output directory', './stemit-output')
  .option('--mute <stem>', `mute a stem (${ALL_STEMS.join('|')})`)
  .option('--solo <stem>', `keep only one stem (${ALL_STEMS.join('|')})`)
  .option('--format <fmt>', `output format (${VALID_FORMATS.join('|')})`, 'wav')
  .option('--no-analyze', 'skip BPM/key analysis')
  .action(async (input, opts) => {
    printBanner()

    // Validate options
    if (opts.mute && !ALL_STEMS.includes(opts.mute)) {
      console.error(chalk.red(`Invalid --mute value. Choose from: ${ALL_STEMS.join(', ')}`))
      process.exit(1)
    }
    if (opts.solo && !ALL_STEMS.includes(opts.solo)) {
      console.error(chalk.red(`Invalid --solo value. Choose from: ${ALL_STEMS.join(', ')}`))
      process.exit(1)
    }
    if (opts.mute && opts.solo) {
      console.error(chalk.red('Cannot use --mute and --solo together.'))
      process.exit(1)
    }
    if (!VALID_FORMATS.includes(opts.format)) {
      console.error(chalk.red(`Invalid --format. Choose from: ${VALID_FORMATS.join(', ')}`))
      process.exit(1)
    }

    // 1. Check system deps (auto-installs demucs into ~/.stemit/venv)
    const setupSpinner = ora('Checking dependencies…').start()
    let pythonPath
    try {
      ;({ pythonPath } = await checkDependencies())
      setupSpinner.succeed('Dependencies OK')
    } catch (err) {
      setupSpinner.fail('Dependency check failed')
      console.error(chalk.red(err.message))
      process.exit(1)
    }

    // 2. Resolve input (download if URL)
    const resolveSpinner = ora('Resolving input…').start()
    let audioFile
    try {
      audioFile = await resolveInput(input, path.join(opts.out, '.tmp'))
      resolveSpinner.succeed(`Input: ${path.basename(audioFile)}`)
    } catch (err) {
      resolveSpinner.fail('Failed to resolve input')
      console.error(chalk.red(err.message))
      process.exit(1)
    }

    // 3. Split stems via demucs
    const modelStems = MODEL_STEMS[opts.model] ?? ['vocals', 'drums', 'bass', 'other']
    console.log(
      chalk.cyan(`\nSeparating stems…`) +
      chalk.gray(` (model: ${opts.model} → ${modelStems.join(', ')})`)
    )
    const splitBar = createBar('chunk 1  ', 100)

    let stemsDir, stemFiles
    try {
      const result = await splitStems(
        audioFile,
        opts.out,
        opts.model,
        (chunk, total, pct) => {
          const label = total > 1 ? `chunk ${chunk}/${total}` : 'demucs    '
          splitBar.update(pct, { label })
        },
        pythonPath
      )
      stemsDir = result.stemsDir
      stemFiles = result.stems  // actual paths from the model, not hardcoded
      splitBar.update(100)
      stopAll()
      console.log(chalk.green(`✔ Stems separated  (${stemFiles.length} tracks)`))
    } catch (err) {
      stopAll()
      console.error(chalk.red(`\nStem separation failed: ${err.message}`))
      process.exit(1)
    }

    // 4. Mix (mute/solo) if requested
    let primaryFile = stemFiles.find((f) => f.endsWith('vocals.wav')) ?? stemFiles[0]

    if (opts.mute || opts.solo) {
      const mixSpinner = ora('Mixing stems…').start()
      const mixLabel = opts.solo ? `solo-${opts.solo}` : `mute-${opts.mute}`
      const mixOut = path.join(stemsDir, `${mixLabel}.wav`)
      try {
        await mixStems(stemsDir, mixOut, { mute: opts.mute, solo: opts.solo, availableStems: modelStems })
        primaryFile = mixOut
        mixSpinner.succeed(`Mixed output: ${path.basename(mixOut)}`)
      } catch (err) {
        mixSpinner.fail('Mixing failed')
        console.error(chalk.red(err.message))
        process.exit(1)
      }
    }

    // 5. Convert to MP3 if requested
    let finalFiles = [...stemFiles]

    if (opts.format === 'mp3') {
      const convertSpinner = ora('Converting to MP3…').start()
      try {
        const converted = await Promise.all(stemFiles.map((f) => wavToMp3(f)))
        if (opts.mute || opts.solo) {
          primaryFile = await wavToMp3(primaryFile)
        }
        finalFiles = converted
        convertSpinner.succeed('Converted to MP3')
      } catch (err) {
        convertSpinner.fail('Conversion failed')
        console.error(chalk.red(err.message))
        process.exit(1)
      }
    }

    // 6. Analyze BPM + key
    let bpm, key
    if (opts.analyze !== false) {
      const analyzeSpinner = ora('Analyzing BPM & key…').start()
      try {
        const result = await analyzeAudio(primaryFile)
        bpm = result.bpm
        key = result.key
        analyzeSpinner.succeed(`BPM: ${Math.round(bpm)}  Key: ${key}`)
      } catch (err) {
        analyzeSpinner.warn(`Analysis skipped: ${err.message}`)
      }
    }

    // 7. Print summary
    printSummary({
      bpm,
      key,
      stems: finalFiles.map((f) => path.relative(process.cwd(), f)),
      output: path.resolve(opts.out),
    })
  })

program.parse()
