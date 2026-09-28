import { os } from "@orpc/server";
import { z } from "zod";
import { getAuthToken } from "@/ipc/auth/state";
import { fetchBetaStatus, redeemBetaCode } from "@/main/backend-client";
import { rememberBetaStatus, resolveBetaGate } from "./gate";

export const getStatus = os.handler(() => {
  const token = getAuthToken();

  if (!token) {
    return null;
  }

  return fetchBetaStatus(token);
});

export const getGate = os.handler(() => resolveBetaGate());

export const redeem = os
  .input(z.object({ code: z.string() }))
  .handler(async ({ input }) => {
    const token = getAuthToken();

    if (!token) {
      return { error: "not_logged_in" };
    }

    const result = await redeemBetaCode(token, input.code);

    if (!("error" in result)) {
      rememberBetaStatus(token, result.activated);
    }

    return result;
  });
