# Mozy web application

From the repository root, install dependencies and configure the two required browser RPC endpoints:

```bash
pnpm install
cp .env.example apps/web/.env.local
```

Set `NEXT_PUBLIC_CREDITCOIN_RPC_URL` and `NEXT_PUBLIC_FOREIGN_RPC_URL` in `apps/web/.env.local`, then run:

```bash
pnpm web:dev
```

Open [http://localhost:3000](http://localhost:3000). Use a disposable testnet-only EVM wallet to verify connection and network switching.

## Checks

```bash
pnpm --filter @mozy/web lint
pnpm --filter @mozy/web build
```
