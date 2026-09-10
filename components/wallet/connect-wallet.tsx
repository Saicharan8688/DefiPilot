"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useWallet } from "./wallet-provider";
import { DemoWalletMenu } from "./demo-wallet-menu";

export function ConnectWallet() {
  const { isDemo } = useWallet();

  if (isDemo) {
    return <DemoWalletMenu />;
  }

  return (
    <ConnectButton
      showBalance={false}
      chainStatus="icon"
      accountStatus="address"
    />
  );
}