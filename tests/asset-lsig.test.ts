import {
  getAssetLogicSigAccount,
  optAssetLogicSigAccountIntoApplication,
  optAssetLogicSigAccountIntoAsset,
  optAssetLogicSigAccountIntoOwnAsset,
} from '../operations/asset-lsig'
import { mintAsset } from '../operations/mint-asset'
import { claimAsset } from '../operations/claim-asset'
import {
  createTestMintApp,
  getTestSilentdataAssetId,
  getTestCertificateData,
  getCertificateDataSignature,
} from './test-data'
import { createDummyApp } from './utils/create-dummy-app'
import { getTemporaryAccount, fundAccount } from './utils/account'
import { createCurrencyAsset } from './utils/create-currency'

describe('Asset LogicSig', () => {
  let appId,
    programHash,
    enclaveKeys,
    checkHashHex,
    dummyAppId,
    dummyAssetId,
    dummyAccount,
    silentdataAssetId,
    assetLogicSigAccount
  beforeAll(async () => {
    const {
      creator,
      appId: testAppId,
      programHash: testProgramHash,
      enclaveKeys: testEnclaveKeys,
      checkHashHex: testCheckHashHex,
    } = await createTestMintApp()

    appId = testAppId
    programHash = testProgramHash
    enclaveKeys = testEnclaveKeys
    checkHashHex = testCheckHashHex

    dummyAppId = await createDummyApp(creator)
    dummyAssetId = await createCurrencyAsset(creator, 'dummy', 0)

    dummyAccount = await getTemporaryAccount()
    fundAccount(dummyAccount.addr)

    silentdataAssetId = getTestSilentdataAssetId()
    assetLogicSigAccount = await getAssetLogicSigAccount(silentdataAssetId, appId)
  }, 40000)

  describe(`Asset opt-in`, () => {
    it(`Won't opt the LogicSig account into an arbitrary asset`, async () => {
      await expect(async () => {
        await optAssetLogicSigAccountIntoAsset(assetLogicSigAccount, appId, dummyAssetId, dummyAccount)
      }).rejects.toThrow()
    })

    // ATTN test of opting logicsig account into it's corresponding asset is done throughout other tests!
  })

  describe(`Application opt-in`, () => {
    describe(`Opt-in to arbitrary application`, () => {
      let initiator
      beforeAll(async () => {
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

        await claimAsset(appId, initiator, assetLogicSigAccount)
      }, 40000)

      it(`Won't opt the LogicSig account into another application if requested by arbitrary account`, async () => {
        await expect(async () => {
          await optAssetLogicSigAccountIntoApplication(assetLogicSigAccount, appId, dummyAppId, dummyAccount)
        }).rejects.toThrow()
      }, 40000)

      it(`Opts the LogicSig account into another application if requested by asset owner`, async () => {
        await optAssetLogicSigAccountIntoApplication(assetLogicSigAccount, appId, dummyAppId, initiator)
      }, 40000)
    })
  })
})
