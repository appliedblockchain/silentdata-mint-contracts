import nacl from 'tweetnacl'
import { getTemporaryAccount } from './utils/account'
import { createTestMintApp } from './test-data'
import { setKey } from '../operations/deploy-app'
import { getAppGlobalState } from '../utils/state'

describe('Set signing key', () => {
  let appId, creator
  beforeAll(async () => {
    const { appId: testAppId, creator: testCreator } = await createTestMintApp()

    appId = testAppId
    creator = testCreator
  }, 40000)

  it('Enclave key can be set after creation', async () => {
    const seed = new Uint8Array(Buffer.from('0000000000000000000000000000000000000000000000000000000000000001', 'hex'))
    const newKeys = nacl.sign.keyPair.fromSeed(seed)
    await setKey(creator, appId, newKeys.publicKey)
    const actualState = await getAppGlobalState(appId)
    expect(actualState.enclave_signing_key).toEqual(newKeys.publicKey)
  })

  it('Enclave key cannot be set by another user', async () => {
    const notCreator = await getTemporaryAccount()
    const seed = new Uint8Array(Buffer.from('0000000000000000000000000000000000000000000000000000000000000011', 'hex'))
    const newKeys = nacl.sign.keyPair.fromSeed(seed)
    await expect(async () => {
      await setKey(notCreator, appId, newKeys.publicKey)
    }).rejects.toThrow()
  })
})
