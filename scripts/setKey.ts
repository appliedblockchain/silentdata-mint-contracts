import fs from 'fs/promises'
import path from 'path'
import algosdk from 'algosdk'
import { setKey } from '../operations/deploy-app'

type Output = {
  timestamp?: number
  algodClient?: {
    server: string
    port: string
    token: string
  }
  creator?: {
    address: string
  }
  enclavePublicKey?: string
  appId?: number
}

const output = {} as Output

const getEnvVar = (name: string, defaultValue?: string) => {
  const value = process.env[name]
  if (value !== undefined) {
    return value
  }

  if (defaultValue !== undefined) {
    return defaultValue
  }

  throw new Error(`Environment variable ${name} not set`)
}

const getCreator = async (): Promise<algosdk.Account> => {
  const creatorMnemonic = getEnvVar('CREATOR_MNEMONIC', '')

  if (!creatorMnemonic) {
    throw new Error(`Environment variable CREATOR_MNEMONIC not set.`)
  }

  const creator = algosdk.mnemonicToSecretKey(creatorMnemonic)

  output.creator = {
    address: creator.addr,
  }

  return creator
}

const getEnclavePublicKey = (): Uint8Array => {
  const enclavePublicKeyHex = getEnvVar('ENCLAVE_PUBLIC_KEY')
  const enclavePublicKey = new Uint8Array(Buffer.from(enclavePublicKeyHex, 'hex'))

  output.enclavePublicKey = Buffer.from(enclavePublicKey).toString('hex')
  return enclavePublicKey
}

// Main function
;(async () => {
  output.timestamp = Date.now()

  const creator = await getCreator()
  const enclavePublicKey = getEnclavePublicKey()
  const appId = parseInt(getEnvVar('SILENTDATA_MINT_APP_ID'))
  output.appId = appId

  const isDryRun = process.argv.includes('--dry-run')
  if (isDryRun) {
    console.log(`This is a dry-run, not creating & setting up the application`)
  } else {
    console.log(`Creating the application`)
    await setKey(creator, appId, enclavePublicKey)
  }

  // Write the result to a log file
  const outputDir = path.join(__dirname, `./logs`)
  await fs.mkdir(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, `./key_${output.timestamp}${isDryRun ? '_dry-run' : ''}.json`)
  await fs.writeFile(outputPath, JSON.stringify(output))

  console.log(`Writing to: ${outputPath}`)
  console.log(output)
})()
