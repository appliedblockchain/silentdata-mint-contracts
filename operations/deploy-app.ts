import algosdk, { Account } from 'algosdk'
import { algodClient } from '../utils/init'
import { waitForTransaction } from '../utils/transactions'
import { fullyCompileContractFromFile } from '../utils/compile-contract'

export async function getContracts(): Promise<{
  approval: Uint8Array
  clearState: Uint8Array
  programHash: Uint8Array
}> {
  const { program: approval, programHash } = await fullyCompileContractFromFile('mint-approval.teal')
  const { program: clearState } = await fullyCompileContractFromFile('mint-clear.teal')

  return { approval, clearState, programHash }
}

export type ProofCertificateParamType = 'int' | 'byte-slice'
export type ProofCertificateSchema = { [paramName: string]: ProofCertificateParamType }

function getAppArgs(signingKey: Uint8Array, checkHashHex: string, schema: ProofCertificateSchema) {
  // First two arguments are the signingKey and the proofType
  const checkHash = Uint8Array.from(Buffer.from(checkHashHex, 'hex'))
  const args = [signingKey, checkHash, algosdk.encodeUint64(Object.entries(schema).length)]

  for (const [paramName, paramType] of Object.entries(schema)) {
    // Prefix the param name with 'i' for integer types and 'b' for byte slice types
    if (paramType !== 'int' && paramType !== 'byte-slice') {
      throw new Error(`Unexpected type of schema param: ${paramType}`)
    }

    const arg = (paramType === 'int' ? 'i' : 'b') + paramName
    args.push(new Uint8Array(Buffer.from(arg)))
  }

  return args
}

export type AppMetadata = {
  appId: number
  programHash: Uint8Array
}

export async function createMintApp(
  sender: Account,
  signingKey: Uint8Array,
  checkHashHex: string,
  schema: ProofCertificateSchema,
): Promise<AppMetadata> {
  const { approval, clearState, programHash } = await getContracts()

  const appArgs = getAppArgs(signingKey, checkHashHex, schema)

  // Need to put each parameter in local storage of asset LogicSig
  // Need one extra int for the 'asa_id' (ID of minted asset)
  const numLocalInts = Object.values(schema).filter((t) => t === 'int').length + 1
  const numLocalByteSlices = Object.values(schema).filter((t) => t === 'byte-slice').length

  // Need one int for the number of parameters + the number of parameters in the schema
  const numGlobalInts = 1 + Object.values(schema).length

  // Need two byte slices for the signingKey and check hash
  const numGlobalByteSlices = 2

  const suggestedParams = await algodClient.getTransactionParams().do()
  const txn = algosdk.makeApplicationCreateTxnFromObject({
    from: sender.addr,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    approvalProgram: approval,
    clearProgram: clearState,
    appArgs,
    numGlobalByteSlices,
    numGlobalInts,
    numLocalByteSlices,
    numLocalInts,
    suggestedParams: suggestedParams,
  })

  const signedTxn = txn.signTxn(sender.sk)

  const tx = await algodClient.sendRawTransaction(signedTxn).do()

  const response = await waitForTransaction(tx.txId)
  if (!response.applicationIndex || response.applicationIndex === 0) {
    throw Error('Invalid response')
  }

  return {
    appId: response.applicationIndex,
    programHash,
  }
}

export async function setKey(sender: Account, appId: number, signingKey: Uint8Array): Promise<void> {
  const suggestedParams = await algodClient.getTransactionParams().do()

  const txn = await algosdk.makeApplicationNoOpTxnFromObject({
    from: sender.addr,
    suggestedParams: suggestedParams,
    appIndex: appId,
    appArgs: [new Uint8Array(Buffer.from('set_key')), signingKey],
  })

  const signedTxn = txn.signTxn(sender.sk)

  const tx = await algodClient.sendRawTransaction(signedTxn).do()

  await waitForTransaction(tx.txId)
}
