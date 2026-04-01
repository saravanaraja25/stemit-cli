import cliProgress from 'cli-progress'
import chalk from 'chalk'

let multibar = null

export function getMultibar() {
  if (!multibar) {
    multibar = new cliProgress.MultiBar(
      {
        clearOnComplete: false,
        hideCursor: true,
        format:
          chalk.cyan('{bar}') +
          ' {percentage}%  {label}',
      },
      cliProgress.Presets.shades_classic
    )
  }
  return multibar
}

/**
 * Create a new progress bar.
 * @param {string} label
 * @param {number} total
 */
export function createBar(label, total = 100) {
  const mb = getMultibar()
  return mb.create(total, 0, { label })
}

export function stopAll() {
  if (multibar) {
    multibar.stop()
    multibar = null
  }
}
