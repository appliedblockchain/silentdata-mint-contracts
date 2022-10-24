import fs from 'fs/promises'
import path from 'path'
import algosdk from 'algosdk'
import config from 'config'
import { createMintApp, ProofCertificateSchema } from '../operations/deploy-app'
import { getTemporaryAccount } from '../tests/utils/account'

type Output = {
  timestamp?: number
  algodClient?: {
    server: string
    port: string
    token: string
  }
  creator?: {
    address: string
    isGenerated: boolean
    mnemonic?: string
  }
  enclavePublicKey?: string
  appId?: number
  programHash?: string
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
  const generateAccount = getEnvVar('GENERATE_CREATOR_ACCOUNT', 'false')

  if (!creatorMnemonic && generateAccount !== 'true') {
    throw new Error(
      `Environment variable CREATOR_MNEMONIC not set.\nPlease set it or use:\nexport GENERATE_CREATOR_ACCOUNT=true\nto generate a creator account for testing.`,
    )
  }

  if (creatorMnemonic && generateAccount === 'true') {
    throw new Error(`Environment variable CREATOR_MNEMONIC is set but GENERATE_CREATOR_ACCOUNT is enabled.`)
  }

  let creator: algosdk.Account
  if (creatorMnemonic) {
    creator = algosdk.mnemonicToSecretKey(creatorMnemonic)
  } else {
    creator = await getTemporaryAccount()
  }

  output.creator = {
    address: creator.addr,
    isGenerated: !creatorMnemonic,
    mnemonic: creatorMnemonic ? undefined : algosdk.secretKeyToMnemonic(creator.sk),
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

  const schema: ProofCertificateSchema = {
    check_hash: 'byte-slice',
    id: 'byte-slice',
    lsig_pkey: 'byte-slice',
    initiator_pkey: 'byte-slice',
    asset_id: 'byte-slice',
    timestamp: 'int',
    risk_score: 'int',
    value: 'int',
    currency_code: 'byte-slice',
    interest_rate: 'int',
    funding_date: 'int',
    due_date: 'int',
  }
  const checkHashHex = config.get('INVOICE_CHECK_HASH') as string

  const isDryRun = process.argv.includes('--dry-run')
  if (isDryRun) {
    console.log(`This is a dry-run, not creating & setting up the application`)
  } else {
    console.log(`Creating & setting up the application`)

    const { appId, programHash } = await createMintApp(creator, enclavePublicKey, checkHashHex, schema)
    output.appId = appId
    output.programHash = Buffer.from(programHash).toString('hex')
  }

  // Write the result to a log file
  const outputDir = path.join(__dirname, `./logs`)
  await fs.mkdir(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, `./deployment_${output.timestamp}${isDryRun ? '_dry-run' : ''}.json`)
  await fs.writeFile(outputPath, JSON.stringify(output))

  console.log(`Writing to: ${outputPath}`)
  console.log(output)
})()
