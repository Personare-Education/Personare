import { BadgeCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getSession } from "@/actions/auth";
import { getBetaStatus } from "@/actions/beta";
import BetaCodeForm, { type BetaStatus } from "@/components/beta-code-form";
import { Badge } from "@/components/ui/badge";

type LoadState =
  | { kind: "loading" }
  | { kind: "loggedOut" }
  | { kind: "ready"; status: BetaStatus | null };

export default function BetaActivationSection() {
  const { i18n, t } = useTranslation();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    getSession().then(async (session) => {
      if (!session) {
        setState({ kind: "loggedOut" });
        return;
      }

      setState({ kind: "ready", status: await getBetaStatus() });
    });
  }, []);

  const handleActivated = useCallback((activatedStatus: BetaStatus) => {
    setState({ kind: "ready", status: activatedStatus });
  }, []);

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
        <div className="mt-2 flex flex-col gap-3">
          <Badge className="w-fit" variant="outline">
            {t("betaNotActivatedLabel")}
          </Badge>
          <BetaCodeForm onActivated={handleActivated} />
        </div>
      ) : null}
    </div>
  );
}
