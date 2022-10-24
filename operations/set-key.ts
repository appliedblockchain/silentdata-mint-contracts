import algosdk, { Account } from 'algosdk'
import { algodClient } from '../utils/init'
import { waitForTransaction } from '../utils/transactions'

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
