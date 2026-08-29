export function DirectWalletAct({ recipient }: { recipient: string }) {
  return (
    <section
      aria-labelledby="ordinary-wallet-title"
      className="border-y border-line bg-wash"
    >
      <div className="mx-auto grid max-w-360 gap-12 px-4 py-20 sm:px-8 sm:py-28 lg:grid-cols-12 lg:px-12 lg:py-36">
        <div className="lg:col-span-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-ink-tertiary">
            The receiving side
          </p>
          <h2
            id="ordinary-wallet-title"
            className="mt-5 max-w-md text-[34px] leading-10 font-medium tracking-[-0.035em] sm:text-[42px] sm:leading-12"
          >
            The wallet stays ordinary.
          </h2>
          <p className="mt-6 max-w-lg text-[16px] leading-7 text-ink-secondary">
            The asset wasn&apos;t bridged. No Mozy delivery contract or adapter
            ran on Ethereum Sepolia.
          </p>
        </div>

        <div className="lg:col-span-7 lg:pt-2">
          <div className="border-y border-line-strong bg-paper">
            <div className="flex items-center justify-between border-b border-line px-4 py-3 font-mono text-[10px] text-ink-tertiary sm:px-6">
              <span>STANDARD ERC-20 TRANSFER</span>
              <span>ETHEREUM SEPOLIA</span>
            </div>
            <div className="grid min-h-52 grid-cols-[1fr_48px_1fr] items-center px-4 sm:grid-cols-[1fr_96px_1fr] sm:px-6">
              <div>
                <p className="font-mono text-[10px] text-ink-tertiary">FROM</p>
                <p className="mt-2 text-lg font-medium">Reserved solver</p>
                <p className="mt-1 text-sm text-ink-secondary">
                  Payout locked first
                </p>
              </div>
              <div className="flex items-center" aria-hidden="true">
                <span className="h-px flex-1 bg-ink" />
                <span className="h-3 w-px bg-signal" />
              </div>
              <div className="min-w-0 pl-4 sm:pl-6">
                <p className="font-mono text-[10px] text-ink-tertiary">TO</p>
                <p className="mt-2 text-lg font-medium">Treasury wallet</p>
                <p className="mt-1 truncate font-mono text-[10px] text-ink-secondary">
                  {recipient}
                </p>
              </div>
            </div>
            <div className="grid border-t border-line sm:grid-cols-3">
              {["Direct delivery", "Existing wallet", "No Mozy contract"].map(
                (label, index) => (
                  <p
                    key={label}
                    className="border-t border-line px-4 py-4 text-sm first:border-t-0 sm:border-t-0 sm:border-l sm:first:border-l-0 sm:px-6"
                  >
                    <span className="mr-3 font-mono text-[10px] text-ink-tertiary">
                      0{index + 1}
                    </span>
                    {label}
                  </p>
                ),
              )}
            </div>
          </div>
          <p className="mt-5 max-w-2xl text-sm leading-6 text-ink-secondary">
            The solver locks an exact payout, delivers the approved token
            directly, and is paid only after that receipt is proven.
          </p>
        </div>
      </div>
    </section>
  );
}
