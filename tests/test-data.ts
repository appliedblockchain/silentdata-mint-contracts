import nacl from 'tweetnacl'
import cbor from 'cbor'
import algosdk, { LogicSigAccount, Account } from 'algosdk'
import config from 'config'
import { ProofCertificateSchema } from '../operations/deploy-app'
import { createMintApp } from '../operations/deploy-app'
import { getTemporaryAccount, fundAccount } from './utils/account'

export function getTestEnclaveKeys(): nacl.SignKeyPair {
  // Generate a ed25519 key-pair for the enclave keys
  // Seed is arbirary (not using random seed for reproduciblity)
  const seed = new Uint8Array(Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'))
  return nacl.sign.keyPair.fromSeed(seed)
}

export function getTestSilentdataAssetId(): Uint8Array {
  // The SILENTDATA asset ID would be generated in the enclave from a hash of reproducible private data supplied by the initiator
  const silentdataAssetIdHex = 'f3186dc2a5fb61baf41f629c256107e7' // Aribtrary hex string
  return Uint8Array.from(Buffer.from(silentdataAssetIdHex, 'hex'))
}

export function getTestSchema(): ProofCertificateSchema {
  return {
    check_hash: 'byte-slice',
    id: 'byte-slice',
    lsig_pkey: 'byte-slice',
    initiator_pkey: 'byte-slice',
    asset_id: 'byte-slice',
    timestamp: 'int',
  }
}

export function getTestCertificateData(
  checkHashHex: string,
  assetLogicSigAccount: LogicSigAccount,
  initiator: Account,
  silentdataAssetId: Uint8Array,
): { certificateData: any; certificateDataCBOR: Uint8Array } {
  // Certificate that would be created in the enclave
  // Timestamp is arbitrary
  const certificateData = {
    check_hash: Uint8Array.from(Buffer.from(checkHashHex, 'hex')),
    id: '123e4567-e89b-12d3-a456-426614174000',
    lsig_pkey: new Uint8Array(algosdk.decodeAddress(assetLogicSigAccount.address()).publicKey),
    initiator_pkey: new Uint8Array(algosdk.decodeAddress(initiator.addr).publicKey),
    asset_id: new Uint8Array(silentdataAssetId),
    timestamp: 1652287366,
  }
  const certificateDataCBOR = new Uint8Array(cbor.encode(certificateData))

  return { certificateData, certificateDataCBOR }
}

export function getCertificateDataSignature(
  programHash: Uint8Array,
  certificateDataCBOR: Uint8Array,
  enclaveKeys: nacl.SignKeyPair,
): Uint8Array {
  const toSign = Buffer.concat([Buffer.from('ProgData'), Buffer.from(programHash), Buffer.from(certificateDataCBOR)])
  return new Uint8Array(nacl.sign.detached(toSign, enclaveKeys.secretKey))
}

export async function createTestMintApp(
  params: {
    creator?: Account
    enclaveKeys?: nacl.SignKeyPair
    schema?: ProofCertificateSchema
    checkHashHex?: string
  } = {},
): Promise<{
  appId: number
  programHash: Uint8Array
  creator: Account
  enclaveKeys: nacl.SignKeyPair
  schema: ProofCertificateSchema
  checkHashHex: string
}> {
  const defaultParams = {
    creator: undefined,
    enclaveKeys: getTestEnclaveKeys(),
    schema: getTestSchema(),
    checkHashHex: config.get('INVOICE_CHECK_HASH') as string,
  }

  const { creator: testCreator, enclaveKeys, schema, checkHashHex } = { ...defaultParams, ...params }

  let creator = testCreator
  if (!creator) {
    creator = await getTemporaryAccount()
    fundAccount(creator.addr)
  }

  const { appId, programHash } = await createMintApp(creator, enclaveKeys.publicKey, checkHashHex, schema)
  return {
    appId,
    programHash,
    creator,
    enclaveKeys,
    schema,
    checkHashHex,
  }
}
