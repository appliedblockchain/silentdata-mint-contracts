import { mintAsset } from '../operations/mint-asset'
import { getAssetLogicSigAccount, getAssetFromAssetLogicSigAccount } from '../operations/asset-lsig'
import { getLocalStateValue } from '../utils/state'
import { getTemporaryAccount, fundAccount } from './utils/account'
import {
  createTestMintApp,
  getTestSilentdataAssetId,
  getTestCertificateData,
  getCertificateDataSignature,
} from './test-data'
import algosdk from 'algosdk'

describe('Minting of assets', () => {
  let initiator, appId, schema, assetLogicSigAccount, certificateData, certificateDataCBOR, signature
  beforeAll(async () => {
    const { appId: testAppId, schema: testSchema, programHash, enclaveKeys, checkHashHex } = await createTestMintApp()

    appId = testAppId
    schema = testSchema

    // Create the asset initiator
    initiator = await getTemporaryAccount()
    fundAccount(initiator.addr)

    // Create an asset LogicSig account from the SILENTDATA asset ID
    // Opt the LogicSig into the minting app
    const silentdataAssetId = getTestSilentdataAssetId()
    assetLogicSigAccount = await getAssetLogicSigAccount(silentdataAssetId, appId)

    // Get the test certificate data and sign it
    const { certificateData: testCertificateData, certificateDataCBOR: testCertificateDataCBOR } =
      getTestCertificateData(checkHashHex, assetLogicSigAccount, initiator, silentdataAssetId)

    certificateData = testCertificateData
    certificateDataCBOR = testCertificateDataCBOR

    signature = getCertificateDataSignature(programHash, certificateDataCBOR, enclaveKeys)
  }, 40000)

  it(`Won't mint a new asset if the signature is incorrect`, async () => {
    const wrongSignature = new Uint8Array(Buffer.from('123'))
    await expect(async () => {
      await mintAsset(appId, initiator, wrongSignature, certificateDataCBOR, assetLogicSigAccount)
    }).rejects.toThrow()
  }, 40000)

  it(`Won't mint a new asset if the transaction is not sent the initiator`, async () => {
    const dummyAccount = await getTemporaryAccount()
    fundAccount(dummyAccount.addr)

    await expect(async () => {
      await mintAsset(appId, dummyAccount, signature, certificateDataCBOR, assetLogicSigAccount)
    }).rejects.toThrow()
  }, 40000)

  it(`Won't mint a new asset if the LogicSig account doesn't match the certificate`, async () => {
    const dummySilentdataAssetIdHex = 'f3186dc2a5fb61baf41f629c256107e8' // Aribtrary hex string (different to one already used)
    const dummySilentdataAssetId = Uint8Array.from(Buffer.from(dummySilentdataAssetIdHex, 'hex'))
    const dummyAssetLogicSigAccount = await getAssetLogicSigAccount(dummySilentdataAssetId, appId)

    await expect(async () => {
      await mintAsset(appId, initiator, signature, certificateDataCBOR, dummyAssetLogicSigAccount)
    }).rejects.toThrow()
  }, 40000)

  it('Mints a new asset', async () => {
    // Initiator mints the asset
    await mintAsset(appId, initiator, signature, certificateDataCBOR, assetLogicSigAccount)

    // Verify that the local state of the `assetLogicSigAccount` matches the `certificateData`
    const decode = false
    for (const [paramName, paramType] of Object.entries(schema)) {
      const paramValue = await getLocalStateValue(assetLogicSigAccount.address(), appId, paramName, decode)
      const expectedValue = certificateData[paramName]

      if (paramType === 'int') {
        expect(paramValue).toBe(expectedValue)
      } else {
        expect(paramValue).toStrictEqual(Buffer.from(expectedValue))
      }
    }

    // Verify that a new asset is minted
    const mintedAsset = await getAssetFromAssetLogicSigAccount(assetLogicSigAccount, appId)
    const assetParams = mintedAsset.params
    expect(assetParams).toBeTruthy()

    // Application is the controller of the newly minted asset
    const appAddress = algosdk.getApplicationAddress(appId)
    expect(assetParams.creator).toBe(appAddress)
    expect(assetParams.clawback).toBe(appAddress)
    expect(assetParams.freeze).toBe(appAddress)
    expect(assetParams.manager).toBe(appAddress)
    expect(assetParams.reserve).toBe(appAddress)

    // Two indivisible instances of the asset were minted
    expect(assetParams.decimals).toBe(0)
    expect(assetParams.total).toBe(2)

    // Asset has the expected name
    expect(assetParams.name).toBe('SILENTDATA asset ownership token')
    expect(assetParams.unitName).toBe('SD-OWN')

    // Metadata field is the public key of the assetLogicSigAccount
    const assetLogicSigAccountPubKey = algosdk.decodeAddress(assetLogicSigAccount.address()).publicKey
    expect(assetParams.metadataHash).toStrictEqual(assetLogicSigAccountPubKey)

    // URL includes public key of assetLogicSigAccount (encoded in hex)
    expect(assetParams.url).toBe(`https://defi.silentdata.com/a/${certificateData.id}`)

    // The id of the newly minted asset should be stored in the logicsig account
    const asaId = await getLocalStateValue(assetLogicSigAccount.address(), appId, 'asa_id', decode)
    expect(mintedAsset.index).toBe(asaId)
  }, 40000)

  it(`Won't mint a the same asset again`, async () => {
    await expect(async () => {
      await mintAsset(appId, initiator, signature, certificateDataCBOR, assetLogicSigAccount)
    }).rejects.toThrow()
  }, 40000)
})
