import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useId,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { redeemBetaCode } from "@/actions/beta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface BetaStatus {
  activated: boolean;
  activatedAt: string | null;
  codeHint: string | null;
}

const ERROR_MESSAGE_KEYS: Record<string, string> = {
  already_activated: "betaErrorAlreadyActivated",
  code_already_used: "betaErrorCodeAlreadyUsed",
  invalid_code: "betaErrorInvalidCode",
  rate_limited: "betaErrorRateLimited",
};

/**
 * The activation code field, shared by Settings -> Beta and the beta gate
 * (src/components/beta-gate.tsx).
 */
export default function BetaCodeForm({
  onActivated,
}: {
  onActivated: (status: BetaStatus) => void;
}) {
  const { t } = useTranslation();
  const codeInputId = useId();
  const [code, setCode] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const handleCodeChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setCode(event.target.value);
    },
    []
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setErrorKey(null);
      setIsRedeeming(true);

      const result = await redeemBetaCode(code);

      setIsRedeeming(false);

      if ("error" in result) {
        setErrorKey(ERROR_MESSAGE_KEYS[result.error] ?? "betaErrorUnreachable");
        return;
      }

      onActivated(result);
    },
    [code, onActivated]
  );

  return (
    <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
      <Label htmlFor={codeInputId}>{t("betaCodeLabel")}</Label>
      <div className="flex gap-2">
        <Input
          aria-describedby={errorKey ? `${codeInputId}-error` : undefined}
          aria-invalid={errorKey ? true : undefined}
          autoCapitalize="characters"
          autoComplete="off"
          className="max-w-xs font-mono uppercase placeholder:normal-case"
          id={codeInputId}
          onChange={handleCodeChange}
          placeholder="PRSN-XXXX-XXXX-XXXX"
          spellCheck={false}
          value={code}
        />
        <Button
          disabled={isRedeeming || code.trim().length === 0}
          type="submit"
        >
          {isRedeeming ? t("betaActivatingAction") : t("betaActivateAction")}
        </Button>
      </div>
      {errorKey ? (
        <p
          className="text-destructive text-sm"
          id={`${codeInputId}-error`}
          role="alert"
        >
          {t(errorKey)}
        </p>
      ) : null}
    </form>
  );
}
