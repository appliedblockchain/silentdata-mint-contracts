import algosdk, { Account, SuggestedParams, Transaction, LogicSigAccount } from 'algosdk'
import { randomBytes } from 'crypto'
import { algodClient } from '../utils/init'

export class PendingTxnResponse {
  poolError: string
  txn: any
  applicationIndex?: number
  assetIndex?: number
  closeRewards?: number
  closingAmount?: number
  confirmedRound?: number
  globalStateDelta?: any
  localStateDelta?: any
  receiverRewards?: number
  senderRewards?: number
  innerTxns: any[]

  constructor(response: Record<string, any>) {
    this.poolError = response['pool-error']
    this.txn = response['txn']

    this.applicationIndex = response['application-index']
    this.assetIndex = response['asset-index']
    this.closeRewards = response['close-rewards']
    this.closingAmount = response['closing-amount']
    this.confirmedRound = response['confirmed-round']
    this.globalStateDelta = response['global-state-delta']
    this.localStateDelta = response['local-state-delta']
    this.receiverRewards = response['receiver-rewards']
    this.senderRewards = response['sender-rewards']

    this.innerTxns = response['inner-txns']
  }
}

const wait = (ms) => new Promise((res) => setTimeout(res, ms))

export async function waitForTransaction(txID: string, timeout = 10): Promise<PendingTxnResponse> {
  let lastStatus = await algodClient.status().do()
  let lastRound = lastStatus['last-round']
  const startRound = lastRound

  while (lastRound < startRound + timeout) {
    let pending_txn
    let attempts = 0
    while (attempts < 5) {
      try {
        pending_txn = await algodClient.pendingTransactionInformation(txID).do()
        break
      } catch (e) {
        const errorMsg = e.response?.body?.message
        console.log(errorMsg || e)
        await wait(1000 * (attempts + 1))
        attempts += 1
      }
    }

    if (pending_txn['confirmed-round'] > 0) {
      return new PendingTxnResponse(pending_txn)
    }

    if (pending_txn['pool-error']) {
      throw Error('Pool error: ' + pending_txn['pool-error'])
    }

    lastStatus = await algodClient.statusAfterBlock(lastRound + 1).do()

    lastRound += 1
  }

  throw Error(`Transaction ${txID} not confirmed after ${timeout} rounds`)
}

export function createFundTxn(
  appId: number,
  senderAddress: string,
  suggestedParams: SuggestedParams,
): algosdk.Transaction {
  return algosdk.makeApplicationNoOpTxnFromObject({
    from: senderAddress,
    appIndex: appId,
    appArgs: [new Uint8Array(Buffer.from('fund'))],
    suggestedParams: suggestedParams,
    note: new Uint8Array(randomBytes(32)),
  })
}

export async function transferAsset(sender: Account, toAddress: string, assetId: number, value = 1): Promise<string> {
  const params = await algodClient.getTransactionParams().do()

  const txn = await createTransferAssetTxn(sender.addr, toAddress, assetId, value, params)

  const signedTxn = txn.signTxn(sender.sk)
  const txId = txn.txID().toString()

  await algodClient.sendRawTransaction(signedTxn).do()

  await waitForTransaction(txId)

  return txId
}

export async function createTransferAssetTxn(
  fromAddress: string,
  toAddress: string,
  assetId: number,
  amount: number,
  params: SuggestedParams,
  overrides = {},
): Promise<Transaction> {
  const txnObj = {
    from: fromAddress,
    to: toAddress,
    assetIndex: assetId,
    amount,
    suggestedParams: {
      ...params,
    },
  }

  Object.keys(overrides).forEach((k) => {
    txnObj[k] = overrides[k]
  })

  return algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject(txnObj)
}

export async function createOptInAssetTxn(
  address: string,
  assetId: number,
  params: SuggestedParams,
  overrides = {},
): Promise<Transaction> {
  return createTransferAssetTxn(address, address, assetId, 0, params, overrides)
}

export async function payAccount(sender: Account, to: string, amount: number): Promise<PendingTxnResponse> {
  const suggestedParams = await algodClient.getTransactionParams().do()
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: sender.addr,
    to: to,
    amount: amount,
    suggestedParams: suggestedParams,
  })
  const signedTxn = txn.signTxn(sender.sk)

  const tx = await algodClient.sendRawTransaction(signedTxn).do()
  return waitForTransaction(tx.txId)
}

export function isAccount(obj: any): obj is Account {
  return obj.addr !== undefined
}

export function signTransaction(sender: Account | LogicSigAccount, txn: Transaction): Uint8Array {
  if (isAccount(sender)) {
    return txn.signTxn(sender.sk)
  } else {
    return algosdk.signLogicSigTransaction(txn, sender.lsig).blob
  }
}
