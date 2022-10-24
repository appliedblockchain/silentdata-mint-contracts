import config from 'config'

export function getConfigNumber(name: string): number {
  if (!config.has(name)) {
    throw new Error(name + ' not configured!')
  }
  return config.get(name) as number
}
