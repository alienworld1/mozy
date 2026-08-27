import { supportedChains } from "@mozy/chain-config";
import { createConfig, createStorage, http } from "wagmi";
import { injected } from "wagmi/connectors/injected";

function createWagmiConfig() {
  return createConfig({
    chains: supportedChains,
    connectors: [injected()],
    multiInjectedProviderDiscovery: true,
    ssr: true,
    storage: createStorage({
      key: "mozy.wallet",
      storage: typeof window === "undefined" ? undefined : window.localStorage,
    }),
    transports: {
      [supportedChains[0].id]: http(supportedChains[0].rpcUrls.default.http[0]),
      [supportedChains[1].id]: http(supportedChains[1].rpcUrls.default.http[0]),
    },
  });
}

type MozyBrowserGlobal = typeof globalThis & {
  __mozyWagmiConfig?: ReturnType<typeof createWagmiConfig>;
};

const browserGlobal = globalThis as MozyBrowserGlobal;

// Preserve the connector store across development hot reloads. Recreating it leaves
// wallet-provider listeners owned by the previous module instance attached.
export const wagmiConfig =
  typeof window === "undefined"
    ? createWagmiConfig()
    : (browserGlobal.__mozyWagmiConfig ??= createWagmiConfig());

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
