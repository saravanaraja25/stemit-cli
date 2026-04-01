import boxen from 'boxen'
import chalk from 'chalk'

/**
 * Print the final summary panel.
 * @param {{ bpm?: number, key?: string, stems: string[], output: string }} result
 */
export function printSummary({ bpm, key, stems, output }) {
  const lines = [
    chalk.bold.cyan('stemit — done!'),
    '',
  ]

  if (bpm !== undefined) {
    lines.push(`${chalk.gray('BPM  ')} ${chalk.yellow(Math.round(bpm))}`)
  }
  if (key) {
    lines.push(`${chalk.gray('Key  ')} ${chalk.yellow(key)}`)
  }

  lines.push('')
  lines.push(chalk.gray('Stems:'))
  for (const s of stems) {
    lines.push(`  ${chalk.green('✔')} ${s}`)
  }

  lines.push('')
  lines.push(`${chalk.gray('Output dir')}  ${chalk.white(output)}`)

  console.log(
    boxen(lines.join('\n'), {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan',
    })
  )
}
