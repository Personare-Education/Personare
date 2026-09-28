import { BadgeCheck } from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useId,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { getSession } from "@/actions/auth";
import { getBetaStatus, redeemBetaCode } from "@/actions/beta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BetaStatus {
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

type LoadState =
  | { kind: "loading" }
  | { kind: "loggedOut" }
  | { kind: "ready"; status: BetaStatus | null };

export default function BetaActivationSection() {
  const { i18n, t } = useTranslation();
  const codeInputId = useId();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [code, setCode] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    getSession().then(async (session) => {
      if (!session) {
        setState({ kind: "loggedOut" });
        return;
      }

      setState({ kind: "ready", status: await getBetaStatus() });
    });
  }, []);

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

      setState({ kind: "ready", status: result });
    },
    [code]
  );

  const status = state.kind === "ready" ? state.status : null;

  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">{t("betaSectionTitle")}</h2>
      <p className="text-muted-foreground text-sm">
        {t("betaSectionDescription")}
      </p>
      {state.kind === "loggedOut" ? (
        <p className="text-muted-foreground text-sm">
          {t("betaLoginRequiredHint")}
        </p>
      ) : null}
      {state.kind === "ready" && status?.activated ? (
        <div className="mt-2 flex items-start gap-3 rounded-lg border p-3">
          <BadgeCheck className="mt-0.5 size-5 shrink-0 text-success" />
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-sm">
              {t("betaActivatedLabel")}
            </span>
            <span className="text-muted-foreground text-sm">
              {t("betaActivatedDetail", {
                codeHint: status.codeHint,
                date: status.activatedAt
                  ? new Date(status.activatedAt).toLocaleDateString(
                      i18n.language
                    )
                  : "",
                interpolation: { escapeValue: false },
              })}
            </span>
          </div>
        </div>
      ) : null}
      {state.kind === "ready" && !status?.activated ? (
        <form className="mt-2 flex flex-col gap-3" onSubmit={handleSubmit}>
          <Badge className="w-fit" variant="outline">
            {t("betaNotActivatedLabel")}
          </Badge>
          <div className="flex flex-col gap-2">
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
                {isRedeeming
                  ? t("betaActivatingAction")
                  : t("betaActivateAction")}
              </Button>
            </div>
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
      ) : null}
    </div>
  );
}
