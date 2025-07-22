# BTC Transaction Nuke

A Bitcoin transaction cancellation tool that helps users cancel pending transactions using Replace-By-Fee (RBF).

## Features

- Cancel pending Bitcoin transactions
- Replace-By-Fee (RBF) transaction creation
- Support for P2SH-wrapped SegWit (3...) and native SegWit (bc1q...) && Taproot (bc1p...) addresses
- PSBT generation for wallet signing
- Mempool API integration
- Ordiscan API integration

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Set environment variables:

```bash
cp .env.example .env.local
```

3. Start the development server:

```bash
pnpm dev
```

## Environment Variables

```
.env.example
```

## API Endpoints

- `POST /api/cancel-tx` - Cancel a pending transaction
- `POST /api/broadcast-tx` - Broadcast a signed transaction

## Usage

The tool generates unsigned PSBTs that can be signed by compatible Bitcoin wallets. Requires the payment public key for P2SH address types.

## Tech Stack

- Next.js 15
- TypeScript
- bitcoinjs-lib
- Tailwind CSS
