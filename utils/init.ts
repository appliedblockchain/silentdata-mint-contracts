import algosdk from 'algosdk'

const ALGOD_SERVER = process.env.ALGOD_SERVER || 'http://localhost'
const ALGOD_PORT = process.env.ALGOD_PORT || '4001'
const ALGOD_TOKEN = process.env.ALGOD_TOKEN || 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

export const algodClient = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT)

const KMD_SERVER = process.env.KMD_SERVER || 'http://localhost'
const KMD_PORT = process.env.KMD_PORT || '4002'
const KMD_TOKEN = process.env.KMD_TOKEN || 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

export const kmdClient = new algosdk.Kmd(KMD_TOKEN, KMD_SERVER, KMD_PORT)
