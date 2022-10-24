import algosdk, { Account, LogicSigAccount } from 'algosdk'
import { algodClient } from '../utils/init'
import { createOptInAssetTxn, waitForTransaction, isAccount, signTransaction } from '../utils/transactions'
import { getConfigNumber } from '../utils/config-util'
import { getAssetFromAssetLogicSigAccount } from './asset-lsig'

export async function claimAsset(
  appId: number,
  sender: Account | LogicSigAccount,
  assetLogicSigAccount: LogicSigAccount,
): Promise<void> {
  const senderAddress = isAccount(sender) ? sender.addr : sender.address()
  const suggestedParams = await algodClient.getTransactionParams().do()
  suggestedParams.flatFee = true
  suggestedParams.fee = 0

  const asset = await getAssetFromAssetLogicSigAccount(assetLogicSigAccount, appId)

  const ownerOptInTxn = await createOptInAssetTxn(senderAddress, asset.index as number, suggestedParams)

  // Pay the fees for both of these transactions and two internal asset transfer transactions
  suggestedParams.fee = 4 * getConfigNumber('MINIMUM_TRANSACTION_FEE')
  const claimTxn = algosdk.makeApplicationNoOpTxnFromObject({
    from: senderAddress,
    suggestedParams,
    appIndex: appId,
    appArgs: [new Uint8Array(Buffer.from('claim'))],
    accounts: [assetLogicSigAccount.address()],
    foreignAssets: [asset.index as number],
  })

  algosdk.assignGroupID([ownerOptInTxn, claimTxn])
  const signedOwnerOptInTxn = signTransaction(sender, ownerOptInTxn)
  const signedClaimTxn = signTransaction(sender, claimTxn)

  const tx = await algodClient.sendRawTransaction([signedOwnerOptInTxn, signedClaimTxn]).do()
  await waitForTransaction(tx.txId)
}
