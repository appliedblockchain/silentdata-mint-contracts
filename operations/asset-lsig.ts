import algosdk, { Account, LogicSigAccount, modelsv2 } from 'algosdk'
import { algodClient } from '../utils/init'
import {
  PendingTxnResponse,
  createOptInAssetTxn,
  waitForTransaction,
  isAccount,
  signTransaction,
} from '../utils/transactions'
import { compile } from '../utils/compile-contract'
import { getLocalStateValue } from '../utils/state'
import { getConfigNumber } from '../utils/config-util'
import { getRequiredFundsToReachBalance, getMinimumApplicationOptInBalance } from '../utils/minimum-balance'

export async function getAssetLogicSigAccount(silentdataAssetId: Uint8Array, appId: number): Promise<LogicSigAccount> {
  const config = {
    SILENTDATA_ASSET_ID: Buffer.from(silentdataAssetId).toString('hex'),
    MINTING_APP_ID_BYTES: Buffer.from(algosdk.encodeUint64(appId)).toString('hex'),
  }
  const compiled = await compile('asset.template.teal', '', config)
  const program = new Uint8Array(Buffer.from(compiled.result, 'base64'))
  const args = []
  return new algosdk.LogicSigAccount(program, args)
}

async function isAssetLogicSigOptedIntoAsset(assetLogicSigAccount: LogicSigAccount, assetId: number): Promise<boolean> {
  // Check if already opted into this assetID ATTN can't do this on-chain as
  // `asset_holding_get` is only available in Application mode (not Signature
  // mode as is the case for a LogicSig account)
  const accountInfo = await algodClient.accountInformation(assetLogicSigAccount.address()).do()

  const asset = accountInfo['assets'].find((a) => a['asset-id'] === assetId)
  return asset as boolean
}

async function isAssetLogicSigOptedIntoApplication(
  assetLogicSigAccount: LogicSigAccount,
  appId: number,
): Promise<boolean> {
  // Check if already opted into this appID ATTN can't do this on-chain as
  // `app_opted_in` is only available in Application mode (not Signature
  // mode as is the case for a LogicSig account)
  const accountInfo = await algodClient.accountInformation(assetLogicSigAccount.address()).do()

  const app = accountInfo['apps-local-state'].find((a) => a['id'] === appId)
  return app as boolean
}

export async function getAssetFromAssetLogicSigAccount(
  assetLogicSigAccount: LogicSigAccount,
  appId: number,
): Promise<modelsv2.Asset> {
  const asaId = await getLocalStateValue(assetLogicSigAccount.address(), appId, 'asa_id', false)
  if (typeof asaId !== 'number') {
    throw new Error(`Got 'asa_id' from local storage of assetLogicSigAccount that wasn't a number`)
  }

  const asset = await algodClient.getAssetByID(asaId as number).do()
  if (asset === undefined) {
    throw new Error(
      `Asset corresponding to LogicSigAccount with address ${assetLogicSigAccount.address()} hasn't been minted by app with ID ${appId}`,
    )
  }

  // Response from algod uses kebab-case & encodes byte arrays in base64
  // modelsv2.Asset uses camelCase & stores byte arrays as Uint8Array
  const response = {
    index: asset.index,
    params: {},
  }
  for (const [keyKebab, value] of Object.entries(asset.params)) {
    const keyCamel = keyKebab.replace(/-./g, (x) => x[1].toUpperCase())

    // Response encodes byte arrays as base64 string
    let decodedValue = value
    if (['metadataHash', 'nameB64', 'unitNameB64', 'urlB64'].includes(keyCamel)) {
      decodedValue = new Uint8Array(Buffer.from(value as string, 'base64'))
    }

    response.params[keyCamel] = decodedValue
  }

  return response as modelsv2.Asset
}

export async function optAssetLogicSigAccountIntoOwnAsset(
  assetLogicSigAccount: LogicSigAccount,
  appId: number,
  feePayer: Account | LogicSigAccount,
): Promise<PendingTxnResponse> {
  const asset = await getAssetFromAssetLogicSigAccount(assetLogicSigAccount, appId)
  const assetId = asset.index as number

  return optAssetLogicSigAccountIntoAsset(assetLogicSigAccount, appId, assetId, feePayer)
}

export async function optAssetLogicSigAccountIntoAsset(
  assetLogicSigAccount: LogicSigAccount,
  appId: number,
  assetId: number,
  feePayer: Account | LogicSigAccount,
): Promise<PendingTxnResponse> {
  if (await isAssetLogicSigOptedIntoAsset(assetLogicSigAccount, assetId)) {
    throw new Error(`Already opted into asset with ID ${assetId}`)
  }

  const feePayerAddress = isAccount(feePayer) ? feePayer.addr : feePayer.address()

  // Group with an application call to get permission for the opt-in
  const permissionParams = await algodClient.getTransactionParams().do()
  const permissionTxn = algosdk.makeApplicationNoOpTxnFromObject({
    from: feePayerAddress,
    suggestedParams: permissionParams,
    appIndex: appId,
    appArgs: [new Uint8Array(Buffer.from('permission'))],
    accounts: [assetLogicSigAccount.address()],
  })

  // Pay any funds required for logic sig account to meet minimum balance requirements
  const requiredFunds = await getRequiredFundsToReachBalance(
    assetLogicSigAccount.address(),
    getConfigNumber('OPT_IN_ASSET_MINIMUM_BALANCE'),
  )
  const minBalanceParams = await algodClient.getTransactionParams().do()
  minBalanceParams.flatFee = true
  minBalanceParams.fee = 2 * getConfigNumber('MINIMUM_TRANSACTION_FEE') // Cover this transaction and the opt in
  const minBalanceTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: feePayerAddress,
    to: assetLogicSigAccount.address(),
    amount: requiredFunds,
    suggestedParams: minBalanceParams,
  })

  // LogicSigAccount doesn't pay the fees
  const optInParams = await algodClient.getTransactionParams().do()
  optInParams.flatFee = true
  optInParams.fee = 0
  const optInTxn = await createOptInAssetTxn(assetLogicSigAccount.address(), assetId, optInParams)

  algosdk.assignGroupID([permissionTxn, minBalanceTxn, optInTxn])

  // Sign and send
  const signedPermissionTxn = signTransaction(feePayer, permissionTxn)
  const signedMinBalanceTxn = signTransaction(feePayer, minBalanceTxn)
  const signedOptInTxn = algosdk.signLogicSigTransaction(optInTxn, assetLogicSigAccount)
  const tx = await algodClient.sendRawTransaction([signedPermissionTxn, signedMinBalanceTxn, signedOptInTxn.blob]).do()

  return await waitForTransaction(tx.txId)
}

export async function optAssetLogicSigAccountIntoApplication(
  assetLogicSigAccount: LogicSigAccount,
  mintAppId: number,
  appId: number,
  feePayer: Account | LogicSigAccount,
): Promise<PendingTxnResponse> {
  if (await isAssetLogicSigOptedIntoApplication(assetLogicSigAccount, appId)) {
    throw new Error(`Already opted into app with ID ${appId}`)
  }

  const feePayerAddress = isAccount(feePayer) ? feePayer.addr : feePayer.address()

  // Get the asset corresponding to the LogicSig account
  let assetId = null
  try {
    const asset = await getAssetFromAssetLogicSigAccount(assetLogicSigAccount, mintAppId)
    assetId = asset.index as number
  } catch (err) {
    assetId = null
  }

  // Group with an application call to get permission for the opt-in
  const permissionParams = await algodClient.getTransactionParams().do()
  const permissionTxn = algosdk.makeApplicationNoOpTxnFromObject({
    from: feePayerAddress,
    suggestedParams: permissionParams,
    appIndex: mintAppId,
    appArgs: [new Uint8Array(Buffer.from('permission'))],
    accounts: [assetLogicSigAccount.address()],
    foreignAssets: assetId ? [assetId] : [],
  })

  // Pay any funds required for logic sig account to meet minimum balance requirements
  const minimumBalance = await getMinimumApplicationOptInBalance(appId)
  const requiredFunds = await getRequiredFundsToReachBalance(assetLogicSigAccount.address(), minimumBalance)
  const minBalanceParams = await algodClient.getTransactionParams().do()
  minBalanceParams.flatFee = true
  minBalanceParams.fee = 2 * getConfigNumber('MINIMUM_TRANSACTION_FEE') // Cover this transaction and the opt in
  const minBalanceTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: feePayerAddress,
    to: assetLogicSigAccount.address(),
    amount: requiredFunds,
    suggestedParams: minBalanceParams,
  })

  // LogicSigAccount doesn't pay the fees
  const optInParams = await algodClient.getTransactionParams().do()
  optInParams.flatFee = true
  optInParams.fee = 0
  const optInTxn = algosdk.makeApplicationOptInTxn(assetLogicSigAccount.address(), optInParams, appId)

  algosdk.assignGroupID([permissionTxn, minBalanceTxn, optInTxn])

  // Sign and send
  const signedPermissionTxn = signTransaction(feePayer, permissionTxn)
  const signedMinBalanceTxn = signTransaction(feePayer, minBalanceTxn)
  const signedOptInTxn = algosdk.signLogicSigTransaction(optInTxn, assetLogicSigAccount)

  const tx = await algodClient.sendRawTransaction([signedPermissionTxn, signedMinBalanceTxn, signedOptInTxn.blob]).do()

  return await waitForTransaction(tx.txId)
}
