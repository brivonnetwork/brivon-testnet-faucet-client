# Brivon Testnet Faucet Client

A small Node.js CLI that demonstrates the signed Brivon Testnet Airdrop API. The API pays the fixed 0.01 test ETH amount; this project does not deploy a faucet contract or integrate with the Brivon app.

The client signs an EIP-712 authorization with a dedicated testnet wallet, submits it with an idempotency key, and reads the request status with its owner proof. The signature authorizes only this recipient, amount, network, audience, and short expiry.

## Requirements

- Node.js 22.13 or newer
- A Brivon public app identifier
- A dedicated Brivon Testnet wallet private key

## Run

    npm install
    cp .env.example .env

Edit .env with the correct public app identifier, API URL and a dedicated testnet-only wallet key. Do not use a wallet with mainnet funds. The standard public identifier is included as an example; if the API operator has configured a different public identifier, replace it.

Preview the signed request without contacting the API:

    npm run faucet

Submit one request to the configured API:

    npm run faucet -- --submit

The server enforces its own rolling Airdrop allowance and liquidity checks. A preview is not a promise that the server is ready or that a payout will complete.

## Credential notes

BRIVON_PUBLIC_APP_KEY is a public app identifier sent in the X-API-Key header. It is not wallet authorization. FAUCET_WALLET_PRIVATE_KEY remains on this machine and is used only to sign the request. Keep .env private; commit .env.example only. Never copy the service's private API_KEY or settlement signer keys into this client.
