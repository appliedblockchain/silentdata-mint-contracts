import algosdk, { Account } from 'algosdk'
import { PendingTxnResponse, waitForTransaction } from '../../utils/transactions'
import { getGenesisAccounts } from '../setup'
import { algodClient } from '../../utils/init'

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

const FUNDING_AMOUNT = 100000000

export async function fundAccount(address: string, amount: number = FUNDING_AMOUNT): Promise<PendingTxnResponse> {
  const fundingAccounts = await getGenesisAccounts()
  const fundingAccount = fundingAccounts[Math.floor(Math.random() * fundingAccounts.length)]
  return payAccount(fundingAccount, address, amount)
}

const accountList = []

export async function getTemporaryAccount(): Promise<Account> {
  if (accountList.length === 0) {
    for (let i = 0; i < 16; i++) {
      accountList.push(algosdk.generateAccount())
    }

    const genesisAccounts = await getGenesisAccounts()
    const suggestedParams = await algodClient.getTransactionParams().do()

    const txns = []
    for (let i = 0; i < accountList.length; i++) {
      const fundingAccount = genesisAccounts[i % genesisAccounts.length]
      txns.push(
        algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          from: fundingAccount.addr,
          to: accountList[i].addr,
          amount: FUNDING_AMOUNT,
          suggestedParams: suggestedParams,
        }),
      )
    }

    algosdk.assignGroupID(txns)
    const signedTxns = []
    for (let i = 0; i < txns.length; i++) {
      signedTxns.push(txns[i].signTxn(genesisAccounts[i % genesisAccounts.length].sk))
    }

    const tx = await algodClient.sendRawTransaction(signedTxns).do()

    waitForTransaction(tx.txId)
  }

  return accountList.pop()
}

export async function createAccount(privateKey: Uint8Array): Promise<Account> {
  const mnemonic = algosdk.secretKeyToMnemonic(privateKey)
  const account = algosdk.mnemonicToSecretKey(mnemonic)
  const genesisAccounts = await getGenesisAccounts()
  const suggestedParams = await algodClient.getTransactionParams().do()

  const fundingAccount = genesisAccounts[0]
  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: fundingAccount.addr,
    to: account.addr,
    amount: FUNDING_AMOUNT,
    suggestedParams: suggestedParams,
  })

  const signedTxn = txn.signTxn(genesisAccounts[0].sk)

  const tx = await algodClient.sendRawTransaction([signedTxn]).do()

  waitForTransaction(tx.txId)
  return account
}
