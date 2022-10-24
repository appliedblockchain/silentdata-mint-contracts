import { algodClient } from './init'
import { getConfigNumber } from './config-util'

type ApplicationStateSchema = {
  'num-byte-slice': number
  'num-uint': number
}

function getMinimumBalance(schema: ApplicationStateSchema): number {
  const numByteSlice = schema['num-byte-slice']
  const numUint = schema['num-uint']

  if (numByteSlice === undefined || numUint === undefined) {
    throw new Error(`Malformed application state schema`)
  }

  // See here for docs on this formula
  // https://developer.algorand.org/docs/get-details/dapps/smart-contracts/apps/#minimum-balance-requirement-for-a-smart-contract
  return (
    getConfigNumber('APP_BASE_MINIMUM_BALANCE') +
    getConfigNumber('APP_PER_UINT_MINIMUM_BALANCE') * numUint +
    getConfigNumber('APP_PER_BYTE_SLICE_MINIMUM_BALANCE') * numByteSlice
  )
}

export async function getMinimumApplicationOptInBalance(appId: number): Promise<number> {
  const { params } = await algodClient.getApplicationByID(appId).do()

  const localSchema = params['local-state-schema']
  return getMinimumBalance(localSchema)
}

export async function getMinimumApplicationCreationBalance(appId: number): Promise<number> {
  const { params } = await algodClient.getApplicationByID(appId).do()

  const globalSchema = params['global-state-schema']
  return getMinimumBalance(globalSchema)
}

export async function getRequiredFundsToReachBalance(address: string, extraFunds: number): Promise<number> {
  // Account requires a minimum balance for other purposes (e.g. previously opted-in assets)
  // Get the current minimum balance and add the extra funds required
  const accountInfo = await algodClient.accountInformation(address).do()

  const minBalance = accountInfo['min-balance'] + extraFunds
  const balance = accountInfo['amount']

  return Math.max(0, minBalance - balance)
}
