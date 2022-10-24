import algosdk, { Account } from 'algosdk'
import { algodClient } from './init'
import { waitForTransaction, transferAsset } from './transactions'

export async function optInApplication(sender: Account, appId: number): Promise<any> {
  const suggestedParams = await algodClient.getTransactionParams().do()
  const txn = algosdk.makeApplicationOptInTxn(sender.addr, suggestedParams, appId)

  const signedTxn = txn.signTxn(sender.sk)
  const txId = txn.txID().toString()

  const xtx = await algodClient.sendRawTransaction(signedTxn).do()

  await waitForTransaction(txId)
  return xtx
}

export async function optInAsset(sender: Account, assetId: number): Promise<any> {
  return await transferAsset(sender, sender.addr, assetId, 0)
}
