import algosdk, { Account } from 'algosdk'
import { algodClient } from '../../utils/init'
import { waitForTransaction } from '../../utils/transactions'
import path from 'path'
import fs from 'fs'

export async function createDummyApp(sender: Account): Promise<number> {

  const approvalFilePath = path.join(__dirname, 'dummy-approval.teal')
  const approvalData = fs.readFileSync(approvalFilePath)
  const approvalResponse = await algodClient.compile(approvalData).do()
  const approval = new Uint8Array(Buffer.from(approvalResponse.result, 'base64'))

  const clearStateFilePath = path.join(__dirname, 'dummy-clear.teal')
  const clearStateData = fs.readFileSync(clearStateFilePath)
  const clearStateResponse = await algodClient.compile(clearStateData).do()
  const clearState = new Uint8Array(Buffer.from(clearStateResponse.result, 'base64'))

  const suggestedParams = await algodClient.getTransactionParams().do()
  const txn = algosdk.makeApplicationCreateTxnFromObject({
    from: sender.addr,
    onComplete: algosdk.OnApplicationComplete.NoOpOC,
    approvalProgram: approval,
    clearProgram: clearState,
    appArgs: [],
    numGlobalByteSlices: 0,
    numGlobalInts: 0,
    numLocalByteSlices: 0,
    numLocalInts: 0,
    suggestedParams,
  })

  const signedTxn = txn.signTxn(sender.sk)

  const tx = await algodClient.sendRawTransaction(signedTxn).do()

  const response = await waitForTransaction(tx.txId)
  if (!response.applicationIndex || response.applicationIndex === 0) {
    throw Error('Invalid response')
  }

  return response.applicationIndex
}
