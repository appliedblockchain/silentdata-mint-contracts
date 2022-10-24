# Silent Data Mint Smart Contracts

**Note:** This code has not been security audited and should only be used as an example.

[Silent Data](https://silentdata.com) is a platform for proving properties of private web2 data in the form of signed proof certificates that can be consumed by smart contracts. Silent Data leverages Intel SGX enclaves in order to enable privacy-preserving retrieval and processing of off-chain data, and generation of cryptographic proofs that are verifiable in blockchain smart contracts. This ensures that sensitive information is never revealed, not even to those hosting the platform, and that the code used to retrieve the data and generate the proofs cannot be modified or interfered with by the operator.

Silent Data Mint is a decentralised application for tokenising off-chain assets on the Algorand blockchain. Silent Data Mint is composed of a stateful smart contract, the minting contract, deployed on the Algorand blockchain and a templated smart signature designed to hold the verified asset properties. The accepted enclave signing public key and proof type are stored in the global storage of the contract when it is created. Any user is able to read the public key and verify that it comes from a legitimate enclave.

After successfully completing the proof process relevant for the chosen asset type on Silent Data, the owner of the asset will have access to the signed proof certificate. This proof certificate contains a unique asset ID and the expected address of the asset smart signature. The asset owner can recreate the smart signature address by replacing the asset ID in the smart signature template, they can then use this smart signature to interact with the minting contract. In order for the asset to be minted, the smart signature must be funded with the minimum balance required to opt in to a stateful contract and one asset.

The asset owner must initially transfer the minimum balance to the asset address and use the asset smart signature to opt in to the minting contract. The asset owner then uploads the proof data and signature from the Silent Data certificate to the minting contract in a transaction signed by their wallet private key along with the address of the asset smart signature. As the smart signature address is unique to the asset, the minting contract can check if the asset has already been minted by querying the local storage of the address. When an asset is minted successfully the minting contract will write to the local storage, so if data has already been written then the contract knows that the asset has already been minted.

The minting contract will verify the signature using the global public key and then parse the CBOR encoded data to extract the wallet address of the owner, the asset address, the proof type and the verified properties of the asset. The wallet address is compared with the sender of the transaction and the asset address is compared with the smart signature address passed to the transaction. The proof type is also compared with the allowed value for this minting contract. If all of the verifications are successful the minting contract will write the verified asset properties into the local storage of the asset smart signature.

The minting contract will then generate a pair of ownership tokens and write the asset ID of the ownership token and the asset address to the local storage of the asset owner. The minting contract cannot immediately transfer the ownership tokens because both the asset owner and asset smart signature must opt in to the ownership asset and the asset ID is not known until the proof is verified and the ownership token pair is created. The asset owner can then claim ownership of the asset by opting in to the ownership token and requesting the minting contract to transfer the tokens. The minting contract will extract the ownership token ID and asset address from the local storage of the asset owner, transfer the ownership tokens to the owner and asset smart signature, and then delete the local storage of the asset owner.

The ownership tokens allow the minted asset to function like a non-fungible token. It is effectively unique as its twin is frozen in the asset smart signature address and can never leave. The original asset owner can transfer the on-chain ownership of the asset to another user or DeFi protocol and could burn the asset by burning the ownership token. The asset smart signature allows the verified asset properties to be stored on-chain and easily accessed by other smart contracts by comparing ownership tokens.

![SILENTDATA whitepaper(1)](https://user-images.githubusercontent.com/12896404/197568667-7f0a5448-7a7b-469a-ba9d-949e23a0cee3.png)

## Setup

``` bash
npm i
```

## Tests

``` bash
./sandbox up dev
npm run test
./sandbox down
```

If you see `ERROR: No container found for algod_1`, it might be an issue with a previous sandbox container still hanging around somewhere. Try to find `sandbox_algod` with `docker container ls -a` and remove it with `docker container rm < container id >`.

## Deployment

Use this command to test your configuration before deploying the contract:

``` bash
npm run deploy:dry
```

Below are the environment variables that you can/need to set:

- Algod server configuration. Optional - by default the credentials for the sandbox will be used.
  - `ALGOD_SERVER` = the algod server host
  - `ALGOD_PORT` = the algod server port
  - `ALGOD_TOKEN` = the algod server token

- Application creator account. Either set `CREATOR_MNEMONIC` or `GENERATE_CREATOR_ACCOUNT=true`.
  - `CREATOR_MNEMONIC` = the mnemonic for the account that should create the application (needs to have algos)
  - `GENERATE_CREATOR_ACCOUNT` = If running in the sandbox, can set this to `true` to generate a temporary account for the creator - useful for testing.

- Enclave configuration. Required.
  - `ENCLAVE_PUBLIC_KEY` = the public signing key used by the enclave to sign certificates (hex encoded)

Once you have a valid configuration, a file will be created in the [scripts/logs/](scripts/logs) directory with the suffix `_dry-run.json`.
Read this file to double check that you are happy with your configuration options.

Once happy, deploy for real using:

``` bash
npm run deploy
```

The details of the newly created application will be output in the logs directory, including its ID & program hash.

## Deployment to TestNet

### Create a new account on TestNet if you need to

Use this command to generate a new account:

``` bash
npm run generate-account
```

This will create a new randomly generated account & write the details to [scripts/logs/](scripts/logs) with the file prefix `account_`.

Go to the Algorand TestNet dispenser and get some Algos for testing by entering your newly generated address (see `addr` in the output file):
[https://bank.testnet.algorand.network/](https://bank.testnet.algorand.network/)

You can check that this worked by going to [https://testnet.algoexplorer.io/](https://testnet.algoexplorer.io/) and looking the account's address.

### Run the deployment script

- Set `ALGOD_SERVER`, `ALGOD_PORT` and `ALGOD_TOKEN` to point to the Applied Blockchain Algorand TestNet node (ask someone for the details if you don't know them already).
- Set `CREATOR_MNEMONIC` to the mnemonic of the account (if you generated it in the last step see `mn` in the output file)
- Set `GENERATE_CREATOR_ACCOUNT` to `false`
- Set `ENCLAVE_PUBLIC_KEY` to the required value (should be the `sigModulus` returned by the enclave)
- Run `npm run deploy:dry`
- Check the configuration, and once you're happy run: `npm run deploy`
- The newly created `appId` & `programHash` are printed to the log file

### Update the enclave key

The development contracts allow the admin to set the enclave key after the initial deployment.

Use this command to set a new key:

``` bash
npm run set-key
```

- Set `ALGOD_SERVER`, `ALGOD_PORT` and `ALGOD_TOKEN` to point to the Applied Blockchain Algorand TestNet node.
- Set `CREATOR_MNEMONIC` to the mnemonic of the account used to deploy the app.
- Set `ENCLAVE_PUBLIC_KEY` to the required value (should be the `sigModulus` returned by the enclave).
- Set `SILENTDATA_MINT_APP_ID` to the app ID of the deployed app.
- Can use `npm run set-key -- --dry-run` to test first.
