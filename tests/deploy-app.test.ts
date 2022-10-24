import { createTestMintApp, getTestSchema } from './test-data'
import { getAppGlobalState } from '../utils/state'

describe('Deploy identity application', () => {
  const schema = getTestSchema()
  const removeKey = (k, { [k]: _, ...o }) => o

  it('Creates the smart contract and sets the key', async () => {
    const { appId, checkHashHex, enclaveKeys } = await createTestMintApp({ schema })
    expect(appId).toBeTruthy()

    const globalState = await getAppGlobalState(appId)
    expect(globalState).toBeTruthy()
    expect(globalState.expected_check_hash).toStrictEqual(Uint8Array.from(Buffer.from(checkHashHex, 'hex')))
    expect(globalState.enclave_signing_key).toStrictEqual(enclaveKeys.publicKey)

    const intCode = 'i'.charCodeAt(0)
    const byteSliceCode = 'b'.charCodeAt(0)
    for (const [paramName, paramType] of Object.entries(schema)) {
      expect(globalState[paramName]).toBe(paramType === 'int' ? intCode : byteSliceCode)
    }
  }, 20000)

  it('Rejects if schema is missing check_hash', async () => {
    await expect(async () => {
      await createTestMintApp({
        schema: removeKey('check_hash', schema),
      })
    }).rejects.toThrow()
  }, 20000)

  it('Rejects if check_hash is not byte-slice', async () => {
    await expect(async () => {
      await createTestMintApp({
        schema: {
          ...schema,
          check_hash: 'int',
        },
      })
    }).rejects.toThrow()
  }, 20000)

  it('Rejects if schema is missing lsig_pkey', async () => {
    await expect(async () => {
      await createTestMintApp({
        schema: removeKey('lsig_pkey', schema),
      })
    }).rejects.toThrow()
  }, 20000)

  it('Rejects if lsig_pkey is not byte-slice', async () => {
    await expect(async () => {
      await createTestMintApp({
        schema: {
          ...schema,
          lsig_pkey: 'int',
        },
      })
    }).rejects.toThrow()
  }, 20000)

  it('Rejects if schema is missing initiator_pkey', async () => {
    await expect(async () => {
      await createTestMintApp({
        schema: removeKey('initiator_pkey', schema),
      })
    }).rejects.toThrow()
  }, 20000)

  it('Rejects if initiator_pkey is not byte-slice', async () => {
    await expect(async () => {
      await createTestMintApp({
        schema: {
          ...schema,
          initiator_pkey: 'int',
        },
      })
    }).rejects.toThrow()
  }, 20000)

  it('Rejects if schema is missing asset_id', async () => {
    await expect(async () => {
      await createTestMintApp({
        schema: removeKey('asset_id', schema),
      })
    }).rejects.toThrow()
  }, 20000)

  it('Rejects if asset_id is not byte-slice', async () => {
    await expect(async () => {
      await createTestMintApp({
        schema: {
          ...schema,
          asset_id: 'int',
        },
      })
    }).rejects.toThrow()
  }, 20000)
})
