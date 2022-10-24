import algosdk, { Account, LogicSigAccount } from 'algosdk'
import { algodClient } from '../utils/init'
import { waitForTransaction, createFundTxn, isAccount, signTransaction } from '../utils/transactions'
import { getConfigNumber } from '../utils/config-util'
import { getMinimumApplicationOptInBalance, getRequiredFundsToReachBalance } from '../utils/minimum-balance'

export async function mintAsset(
  appId: number,
  sender: Account | LogicSigAccount,
  signature: Uint8Array,
  certificateData: Uint8Array,
  assetLogicSigAccount: LogicSigAccount,
): Promise<void> {
  const senderAddress = isAccount(sender) ? sender.addr : sender.address()

  // Pay the application so it reaches the minimum balance required
  const appAddress = algosdk.getApplicationAddress(appId)
  const mintingCost = getConfigNumber('OPT_IN_ASSET_MINIMUM_BALANCE')
  const requiredFunds = await getRequiredFundsToReachBalance(appAddress, mintingCost)
  const suggestedParams = await algodClient.getTransactionParams().do()
  suggestedParams.flatFee = true
  suggestedParams.fee = 0
  const minBalanceTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: senderAddress,
    to: appAddress,
    amount: requiredFunds,
    suggestedParams,
  })

  const minimumBalance = await getMinimumApplicationOptInBalance(appId)
  const requiredAppFunds = await getRequiredFundsToReachBalance(assetLogicSigAccount.address(), minimumBalance)
  const minAppBalanceTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: senderAddress,
    to: assetLogicSigAccount.address(),
    amount: requiredAppFunds,
    suggestedParams: suggestedParams,
  })

  const optInAppTxn = await algosdk.makeApplicationOptInTxn(assetLogicSigAccount.address(), suggestedParams, appId)

  // Pay the fees for this transaction and one internal asset creation transaction
  const mintParams = await algodClient.getTransactionParams().do()
  mintParams.flatFee = true
  mintParams.fee = getConfigNumber('MINIMUM_TRANSACTION_FEE') * 17

  // Create the minting transaction
  const mintTxn = algosdk.makeApplicationNoOpTxnFromObject({
    from: senderAddress,
    suggestedParams: mintParams,
    appIndex: appId,
    appArgs: [new Uint8Array(Buffer.from('mint')), signature, certificateData],
    accounts: [assetLogicSigAccount.address()],
  })

  // Create dummy "fund" transactions to pool call cost limits
  const nFundTransactions = 12
  const fundTxns = []
  for (let i = 0; i < nFundTransactions; i++) {
    fundTxns.push(createFundTxn(appId, senderAddress, suggestedParams))
  }

  algosdk.assignGroupID([minBalanceTxn, minAppBalanceTxn, optInAppTxn, mintTxn, ...fundTxns])

  // Sign the transactions
  const signedMinBalanceTxn = signTransaction(sender, minBalanceTxn)
  const signedMinAppBalanceTxn = signTransaction(sender, minAppBalanceTxn)
  const signedOptInAppTxn = algosdk.signLogicSigTransaction(optInAppTxn, assetLogicSigAccount)
  const signedMintTxn = signTransaction(sender, mintTxn)
  const signedFundTxns = []
  for (const fundTxn of fundTxns) {
    signedFundTxns.push(signTransaction(sender, fundTxn))
  }

  const tx = await algodClient
    .sendRawTransaction([
      signedMinBalanceTxn,
      signedMinAppBalanceTxn,
      signedOptInAppTxn.blob,
      signedMintTxn,
      ...signedFundTxns,
    ])
    .do()
  await waitForTransaction(tx.txId)
}
