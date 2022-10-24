import { claimAsset } from '../operations/claim-asset'
import { mintAsset } from '../operations/mint-asset'
import {
  getAssetLogicSigAccount,
  getAssetFromAssetLogicSigAccount,
  optAssetLogicSigAccountIntoOwnAsset,
} from '../operations/asset-lsig'
import { algodClient } from '../utils/init'
import { getTemporaryAccount, fundAccount } from './utils/account'
import {
  createTestMintApp,
  getTestSilentdataAssetId,
  getTestCertificateData,
  getCertificateDataSignature,
} from './test-data'
import algosdk from 'algosdk'

describe('Claiming of assets', () => {
  let initiator, appId, assetLogicSigAccount, assetId
  beforeAll(async () => {
    const { appId: testAppId, programHash, enclaveKeys, checkHashHex } = await createTestMintApp()

    appId = testAppId

    const silentdataAssetId = getTestSilentdataAssetId()
    assetLogicSigAccount = await getAssetLogicSigAccount(silentdataAssetId, appId)

    // Mint a new asset for some "initiator" account, and claim it
    initiator = await getTemporaryAccount()
    fundAccount(initiator.addr)

    const { certificateDataCBOR } = getTestCertificateData(
      checkHashHex,
      assetLogicSigAccount,
      initiator,
      silentdataAssetId,
    )
    const signature = getCertificateDataSignature(programHash, certificateDataCBOR, enclaveKeys)

    await mintAsset(appId, initiator, signature, certificateDataCBOR, assetLogicSigAccount)
    await optAssetLogicSigAccountIntoOwnAsset(assetLogicSigAccount, appId, initiator)

    // Opt the initiator into the asset
    const asset = await getAssetFromAssetLogicSigAccount(assetLogicSigAccount, appId)
    assetId = asset.index as number
  }, 80000)

  it(`Doesn't allow accounts other than the initiator to claim asset`, async () => {
    const thief = await getTemporaryAccount()
    fundAccount(thief.addr)

    // Try to claim the asset (should fail)
    await expect(async () => {
      await claimAsset(appId, thief, assetLogicSigAccount)
    }).rejects.toThrow()

    // Check that the application still holds the tokens
    const appAddress = algosdk.getApplicationAddress(appId)
    const applicationInfo = await algodClient.accountInformation(appAddress).do()
    const applicationAmount = applicationInfo['assets'].find((a) => a['asset-id'] === assetId)?.amount
    expect(applicationAmount).toBe(2)
  }, 60000)

  it('Allows initiator to claim asset', async () => {
    await claimAsset(appId, initiator, assetLogicSigAccount)

    // Check that the asset logicsig account holds the token
    const assetLogicSigAccountInfo = await algodClient.accountInformation(assetLogicSigAccount.address()).do()
    const assetLogicSigAccountAmount = assetLogicSigAccountInfo['assets'].find((a) => a['asset-id'] === assetId)?.amount
    expect(assetLogicSigAccountAmount).toBe(1)

    // Check that the initiator holds the token
    const initiatorInfo = await algodClient.accountInformation(initiator.addr).do()
    const initiatorAmount = initiatorInfo['assets'].find((a) => a['asset-id'] === assetId)?.amount
    expect(initiatorAmount).toBe(1)

    // Check that the application no longer holds the tokens
    const appAddress = algosdk.getApplicationAddress(appId)
    const applicationInfo = await algodClient.accountInformation(appAddress).do()
    const applicationAmount = applicationInfo['assets'].find((a) => a['asset-id'] === assetId)?.amount
    expect(applicationAmount).toBe(0)
  }, 60000)
})
