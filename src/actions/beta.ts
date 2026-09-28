import { ipc } from "@/ipc/manager";

export function getBetaStatus() {
  return ipc.client.beta.getStatus();
}

export function redeemBetaCode(code: string) {
  return ipc.client.beta.redeem({ code });
}

export function getBetaGate() {
  return ipc.client.beta.getGate();
}
