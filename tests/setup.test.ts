import algosdk from 'algosdk'
import { getGenesisAccounts } from './setup'
import { algodClient, kmdClient } from '../utils/init'

describe('setup', () => {
  describe('init util', () => {
    it('Should create client', async () => {
      const response = await algodClient.healthCheck().do()
      expect(response).toStrictEqual({})
    })

    it('Should create KMD client', async () => {
      const { versions } = await kmdClient.versions()
      expect(versions).toEqual(['v1'])
    })
  })

  describe('getGenesisAccounts', () => {
    it('Should create valid genesis accounts', async () => {
      const accounts = await getGenesisAccounts()
      expect(accounts.length).toEqual(3)
      accounts.forEach((account) => {
        expect(algosdk.isValidAddress(account.addr)).toBeTruthy()
        expect(account.sk.byteLength).toEqual(64)
      })
    })
  })
})
