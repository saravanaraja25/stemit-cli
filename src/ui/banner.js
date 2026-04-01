import figlet from 'figlet'
import chalk from 'chalk'

export function printBanner() {
  const text = figlet.textSync('stemit', { font: 'Standard' })
  console.log(chalk.cyan(text))
  console.log(chalk.gray('  stem separator · BPM · key · mix\n'))
}
