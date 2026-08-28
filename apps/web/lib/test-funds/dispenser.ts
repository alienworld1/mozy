import "server-only";

import { releaseConfig } from "@mozy/chain-config";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Chain,
  type Hash,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";
import type {
  TestFundsAssetResult,
  TestFundsResponse,
} from "@/features/test-funds/types";
import { topUpDeficit } from "@/features/test-funds/claim";
import { faucetErc20Abi } from "@/lib/acquisition-contracts";

const CLAIM_TTL_SECONDS = 24 * 60 * 60;
const PROCESSING_TTL_SECONDS = 2 * 60;
const NONCE_LEASE_MS = 30_000;

const serverEnvironmentSchema = z.object({
  enabled: z.literal("true"),
  redisUrl: z.string().url(),
  redisToken: z.string().min(1),
  sepoliaKey: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  creditcoinKey: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  dailyLimit: z.coerce.number().int().positive().max(10_000),
});

type AssetName = "test" | "btkt";
type StoredAssetClaim = {
  state: "processing" | "submitted" | "ready";
  transactionHash?: Hash;
  startedAt: string;
};

type AssetDefinition = {
  name: AssetName;
  chain: Chain;
  token: Address;
  target: bigint;
  privateKey: Hex;
};

type Services = {
  redis: Redis;
  requestLimit: Ratelimit;
  dailyLimit: Ratelimit;
  definitions: Record<AssetName, AssetDefinition>;
};

export class TestFundsUnavailableError extends Error {}

function environment() {
  return serverEnvironmentSchema.safeParse({
    enabled: process.env.MOZY_FAUCET_ENABLED,
    redisUrl: process.env.UPSTASH_REDIS_REST_URL,
    redisToken: process.env.UPSTASH_REDIS_REST_TOKEN,
    sepoliaKey: process.env.MOZY_SEPOLIA_FAUCET_PRIVATE_KEY,
    creditcoinKey: process.env.MOZY_CREDITCOIN_FAUCET_PRIVATE_KEY,
    dailyLimit: process.env.MOZY_FAUCET_DAILY_BUNDLE_LIMIT ?? "100",
  });
}

function createServices(): Services {
  const parsed = environment();
  if (!parsed.success) {
    throw new TestFundsUnavailableError("The test-funds dispenser is not configured.");
  }
  const redis = new Redis({ url: parsed.data.redisUrl, token: parsed.data.redisToken });
  return {
    redis,
    requestLimit: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "10 m"),
      prefix: "mozy:test-funds:request",
    }),
    dailyLimit: new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(parsed.data.dailyLimit, "1 d"),
      prefix: "mozy:test-funds:daily",
    }),
    definitions: {
      test: {
        name: "test",
        chain: releaseConfig.foreign,
        token: releaseConfig.deliveryToken.address,
        target: releaseConfig.demoFunding.deliveryTokenTarget,
        privateKey: parsed.data.sepoliaKey as Hex,
      },
      btkt: {
        name: "btkt",
        chain: releaseConfig.creditcoin,
        token: releaseConfig.settlementToken.address,
        target: releaseConfig.demoFunding.settlementTokenTarget,
        privateKey: parsed.data.creditcoinKey as Hex,
      },
    },
  };
}

function claimKey(address: Address, asset: AssetName) {
  return `mozy:test-funds:claim:${releaseConfig.configVersion}:${address.toLowerCase()}:${asset}`;
}

function leaseKey(asset: AssetName) {
  return `mozy:test-funds:nonce:${releaseConfig.configVersion}:${asset}`;
}

function bundleKey(address: Address) {
  return `mozy:test-funds:bundle:${releaseConfig.configVersion}:${address.toLowerCase()}`;
}

async function releaseLease(redis: Redis, key: string, value: string) {
  await redis.eval(
    "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
    [key],
    [value],
  );
}

function result(
  status: TestFundsAssetResult["status"],
  balance: bigint,
  target: bigint,
  extra: Partial<TestFundsAssetResult> = {},
): TestFundsAssetResult {
  return { status, balance: balance.toString(), target: target.toString(), ...extra };
}

async function reconcileStoredClaim(
  redis: Redis,
  definition: AssetDefinition,
  recipient: Address,
  stored: StoredAssetClaim,
  balance: bigint,
): Promise<TestFundsAssetResult> {
  if (balance >= definition.target) return result("ready", balance, definition.target, { transactionHash: stored.transactionHash });
  if (!stored.transactionHash) {
    return result("unavailable", balance, definition.target, {
      message: "A request for this token is already being prepared. Try again shortly.",
    });
  }
  const client = createPublicClient({ chain: definition.chain, transport: http(definition.chain.rpcUrls.default.http[0]) });
  const receipt = await client.getTransactionReceipt({ hash: stored.transactionHash }).catch(() => undefined);
  if (!receipt) {
    return result("uncertain", balance, definition.target, {
      transactionHash: stored.transactionHash,
      message: "This transfer was submitted but its receipt is not available yet. Check it before requesting again.",
    });
  }
  if (receipt.status !== "success") {
    await redis.del(claimKey(recipient, definition.name));
    return result("unavailable", balance, definition.target, {
      transactionHash: stored.transactionHash,
      message: "The previous transfer reverted and can be retried safely.",
    });
  }
  return result("unavailable", balance, definition.target, {
    transactionHash: stored.transactionHash,
    message: "This wallet has already received its demo allocation during the current claim window.",
  });
}

async function dispenseAsset(
  services: Services,
  definition: AssetDefinition,
  recipient: Address,
): Promise<TestFundsAssetResult> {
  const client = createPublicClient({ chain: definition.chain, transport: http(definition.chain.rpcUrls.default.http[0]) });
  const account = privateKeyToAccount(definition.privateKey);
  const key = claimKey(recipient, definition.name);
  const [balance, stored] = await Promise.all([
    client.readContract({ address: definition.token, abi: faucetErc20Abi, functionName: "balanceOf", args: [recipient] }),
    services.redis.get<StoredAssetClaim>(key),
  ]);
  if (stored) return reconcileStoredClaim(services.redis, definition, recipient, stored, balance);
  if (balance >= definition.target) {
    await services.redis.set(key, { state: "ready", startedAt: new Date().toISOString() } satisfies StoredAssetClaim, { ex: CLAIM_TTL_SECONDS });
    return result("ready", balance, definition.target);
  }

  const processing: StoredAssetClaim = { state: "processing", startedAt: new Date().toISOString() };
  const reserved = await services.redis.set(key, processing, { nx: true, ex: PROCESSING_TTL_SECONDS });
  if (reserved !== "OK") {
    const concurrent = await services.redis.get<StoredAssetClaim>(key);
    return concurrent
      ? reconcileStoredClaim(services.redis, definition, recipient, concurrent, balance)
      : result("unavailable", balance, definition.target, { message: "Another request is being prepared. Try again shortly." });
  }

  const amount = topUpDeficit(balance, definition.target);
  try {
    const [faucetTokenBalance, faucetGasBalance] = await Promise.all([
      client.readContract({ address: definition.token, abi: faucetErc20Abi, functionName: "balanceOf", args: [account.address] }),
      client.getBalance({ address: account.address }),
    ]);
    if (faucetTokenBalance < amount || faucetGasBalance === 0n) {
      await services.redis.del(key);
      return result("unavailable", balance, definition.target, {
        message: "This token is temporarily unavailable while the dispenser is refilled.",
      });
    }

    const lockKey = leaseKey(definition.name);
    const lockValue = crypto.randomUUID();
    const locked = await services.redis.set(lockKey, lockValue, { nx: true, px: NONCE_LEASE_MS });
    if (locked !== "OK") {
      await services.redis.del(key);
      return result("unavailable", balance, definition.target, {
        message: "The dispenser is handling another request. Try again shortly.",
      });
    }

    let transactionHash: Hash;
    try {
      const nonce = await client.getTransactionCount({ address: account.address, blockTag: "pending" });
      const simulation = await client.simulateContract({
        account,
        address: definition.token,
        abi: faucetErc20Abi,
        functionName: "transfer",
        args: [recipient, amount],
        nonce,
      });
      const wallet = createWalletClient({ account, chain: definition.chain, transport: http(definition.chain.rpcUrls.default.http[0]) });
      transactionHash = await wallet.writeContract(simulation.request);
      await services.redis.set(
        key,
        { state: "submitted", transactionHash, startedAt: processing.startedAt } satisfies StoredAssetClaim,
        { ex: CLAIM_TTL_SECONDS },
      );
    } finally {
      await releaseLease(services.redis, lockKey, lockValue);
    }

    const receipt = await client.waitForTransactionReceipt({ hash: transactionHash, timeout: 45_000 }).catch(() => undefined);
    if (!receipt) {
      return result("submitted", balance, definition.target, {
        amount: amount.toString(),
        transactionHash,
        message: "Transfer submitted. Mozy is waiting for the network to confirm it.",
      });
    }
    if (receipt.status !== "success") {
      await services.redis.del(key);
      return result("unavailable", balance, definition.target, {
        amount: amount.toString(),
        transactionHash,
        message: "The transfer reverted and can be retried safely.",
      });
    }
    const confirmedBalance = await client.readContract({ address: definition.token, abi: faucetErc20Abi, functionName: "balanceOf", args: [recipient] });
    await services.redis.set(
      key,
      { state: "ready", transactionHash, startedAt: processing.startedAt } satisfies StoredAssetClaim,
      { ex: CLAIM_TTL_SECONDS },
    );
    return result("ready", confirmedBalance, definition.target, { amount: amount.toString(), transactionHash });
  } catch {
    const persisted = await services.redis.get<StoredAssetClaim>(key).catch(() => undefined);
    if (!persisted?.transactionHash) await services.redis.del(key).catch(() => undefined);
    return result(persisted?.transactionHash ? "uncertain" : "unavailable", balance, definition.target, {
      transactionHash: persisted?.transactionHash,
      message: persisted?.transactionHash
        ? "The transfer status is uncertain. Check the transaction before requesting again."
        : "The dispenser could not prepare this transfer. Try again later.",
    });
  }
}

export async function dispenseTestFunds(address: Address, ipAddress: string): Promise<TestFundsResponse> {
  const services = createServices();
  let requestLimit;
  try {
    requestLimit = await services.requestLimit.limit(ipAddress);
  } catch {
    throw new TestFundsUnavailableError("Rate-limit storage is unavailable.");
  }
  if (requestLimit.reason === "timeout") {
    throw new TestFundsUnavailableError("Rate-limit storage timed out.");
  }
  if (!requestLimit.success) {
    const retryAt = new Date(requestLimit.reset).toISOString();
    return {
      ok: false,
      status: "rate_limited",
      address,
      retryAt,
      message: "Too many requests were made from this connection. Try again after the displayed time.",
      assets: {
        test: result("unavailable", 0n, releaseConfig.demoFunding.deliveryTokenTarget),
        btkt: result("unavailable", 0n, releaseConfig.demoFunding.settlementTokenTarget),
      },
    };
  }

  const bundle = bundleKey(address);
  const firstBundleRequest = await services.redis.set(bundle, new Date().toISOString(), { nx: true, ex: CLAIM_TTL_SECONDS });
  if (firstBundleRequest === "OK") {
    let dailyLimit;
    try {
      dailyLimit = await services.dailyLimit.limit("bundles");
    } catch {
      await services.redis.del(bundle).catch(() => undefined);
      throw new TestFundsUnavailableError("Daily-limit storage is unavailable.");
    }
    if (dailyLimit.reason === "timeout") {
      await services.redis.del(bundle).catch(() => undefined);
      throw new TestFundsUnavailableError("Daily-limit storage timed out.");
    }
    if (!dailyLimit.success) {
      await services.redis.del(bundle).catch(() => undefined);
      const retryAt = new Date(dailyLimit.reset).toISOString();
      return {
        ok: false,
        status: "rate_limited",
        address,
        retryAt,
        message: "Today’s demo-fund allocation has been used. Try again after the displayed time.",
        assets: {
          test: result("unavailable", 0n, releaseConfig.demoFunding.deliveryTokenTarget),
          btkt: result("unavailable", 0n, releaseConfig.demoFunding.settlementTokenTarget),
        },
      };
    }
  }

  const [test, btkt] = await Promise.all([
    dispenseAsset(services, services.definitions.test, address),
    dispenseAsset(services, services.definitions.btkt, address),
  ]);
  const ready = test.status === "ready" && btkt.status === "ready";
  const submitted = [test.status, btkt.status].some((status) => status === "submitted");
  const usable = [test.status, btkt.status].some((status) => status === "ready" || status === "submitted");
  return {
    ok: ready || usable,
    status: ready ? "ready" : submitted ? "submitted" : usable ? "partial" : "unavailable",
    address,
    assets: { test, btkt },
    message: ready
      ? "Demo tokens are ready."
      : usable
        ? "At least one token is still being prepared. Review each network below."
        : "Demo tokens are temporarily unavailable. Nothing was sent from your wallet.",
  };
}
