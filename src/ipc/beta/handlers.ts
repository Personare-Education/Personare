import { os } from "@orpc/server";
import { z } from "zod";
import { getAuthToken } from "@/ipc/auth/state";
import { fetchBetaStatus, redeemBetaCode } from "@/main/backend-client";

export const getStatus = os.handler(() => {
  const token = getAuthToken();

  if (!token) {
    return null;
  }

  return fetchBetaStatus(token);
});

export const redeem = os
  .input(z.object({ code: z.string() }))
  .handler(({ input }) => {
    const token = getAuthToken();

    if (!token) {
      return { error: "not_logged_in" };
    }

    return redeemBetaCode(token, input.code);
  });
