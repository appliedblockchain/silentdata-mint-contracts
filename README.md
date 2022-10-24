# silentdata-mint/contracts: Algorand smart contracts and supporting components

This code has not been security audited and should only be used as an example.

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
