import { KeyRound, LogIn, WifiOff } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { getSession, login, logout } from "@/actions/auth";
import { getBetaGate } from "@/actions/beta";
import { openExternalLink } from "@/actions/shell";
import BetaCodeForm from "@/components/beta-code-form";
import DragWindowRegion from "@/components/drag-window-region";
import { Button } from "@/components/ui/button";
import { PERSONARE_SITE_URL } from "@/constants";
import { onSessionChanged } from "@/utils/session-events";

type GateState = Awaited<ReturnType<typeof getBetaGate>>;

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120_000;

function GateScreen({
  children,
  description,
  icon: Icon,
  title,
}: {
  children: ReactNode;
  description: string;
  icon: typeof KeyRound;
  title: string;
}) {
  return (
    <div className="flex h-svh flex-col bg-background">
      <DragWindowRegion />
      <main className="flex flex-1 items-center justify-center overflow-y-auto p-6">
        <div className="flex w-full max-w-md flex-col gap-6">
          <div className="flex size-11 items-center justify-center rounded-xl border bg-muted/50">
            <Icon className="size-5 text-muted-foreground" />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="font-semibold text-2xl tracking-tight">{title}</h1>
            <p className="text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

function ApplyLink() {
  const { t } = useTranslation();
  const handleClick = useCallback(() => {
    openExternalLink(`${PERSONARE_SITE_URL}/beta/`);
  }, []);

  return (
    <p className="text-muted-foreground text-sm">
      {t("betaGateApplyHint")}{" "}
      <button
        className="cursor-pointer font-medium text-foreground underline underline-offset-4"
        onClick={handleClick}
        type="button"
      >
        {t("betaGateApplyAction")}
      </button>
    </p>
  );
}

function SignInScreen({
  onChanged,
}: {
  onChanged: (state: GateState) => void;
}) {
  const { t } = useTranslation();
  const [isAwaitingLogin, setIsAwaitingLogin] = useState(false);

  useEffect(() => {
    if (!isAwaitingLogin) {
      return;
    }

    const interval = setInterval(() => {
      getBetaGate().then((next) => {
        if (next.kind !== "signed_out") {
          setIsAwaitingLogin(false);
          onChanged(next);
        }
      });
    }, POLL_INTERVAL_MS);
    const timeout = setTimeout(() => {
      setIsAwaitingLogin(false);
    }, POLL_TIMEOUT_MS);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isAwaitingLogin, onChanged]);

  const handleLoginClick = useCallback(() => {
    login();
    setIsAwaitingLogin(true);
  }, []);

  return (
    <GateScreen
      description={t("betaGateSignInDescription")}
      icon={LogIn}
      title={t("betaGateSignInTitle")}
    >
      <div className="flex flex-col gap-2">
        <Button
          className="w-fit"
          disabled={isAwaitingLogin}
          onClick={handleLoginClick}
        >
          {t("loginWithGoogleAction")}
        </Button>
        {isAwaitingLogin ? (
          <p className="text-muted-foreground text-sm">
            {t("waitingForGoogleLoginMessage")}
          </p>
        ) : null}
      </div>
      <ApplyLink />
    </GateScreen>
  );
}

function ActivationScreen({ onRefresh }: { onRefresh: () => void }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    getSession().then((session) => setEmail(session?.email ?? null));
  }, []);

  const handleActivateOnSite = useCallback(() => {
    openExternalLink(`${PERSONARE_SITE_URL}/ativar/`);
  }, []);

  const handleSwitchAccount = useCallback(() => {
    logout().then(onRefresh);
  }, [onRefresh]);

  return (
    <GateScreen
      description={t("betaGateActivateDescription")}
      icon={KeyRound}
      title={t("betaGateActivateTitle")}
    >
      {email ? (
        <p className="text-muted-foreground text-sm">
          {t("betaGateSignedInAs", { email })}
        </p>
      ) : null}
      <BetaCodeForm onActivated={onRefresh} />
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleActivateOnSite} variant="outline">
          {t("betaGateActivateOnSiteAction")}
        </Button>
        <Button onClick={handleSwitchAccount} variant="ghost">
          {t("betaGateSwitchAccountAction")}
        </Button>
      </div>
      <ApplyLink />
    </GateScreen>
  );
}

/**
 * Personare opens only for a signed-in account with the closed beta
 * activated; the decision (and its offline grace period) is made in main,
 * see src/ipc/beta/gate.ts. Until then this shows sign-in, activation or
 * offline screens instead of the app's routes.
 */
export default function BetaGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [state, setState] = useState<GateState | null>(null);
  const latestRequest = useRef(0);

  const refresh = useCallback(() => {
    const request = latestRequest.current + 1;
    latestRequest.current = request;
    getBetaGate().then((next) => {
      if (latestRequest.current === request) {
        setState(next);
      }
    });
  }, []);

  useEffect(() => {
    refresh();
    return onSessionChanged(refresh);
  }, [refresh]);

  if (!state) {
    return (
      <div className="flex h-svh flex-col bg-background">
        <DragWindowRegion />
      </div>
    );
  }

  if (state.kind === "activated") {
    return children;
  }

  if (state.kind === "signed_out") {
    return <SignInScreen onChanged={setState} />;
  }

  if (state.kind === "not_activated") {
    return <ActivationScreen onRefresh={refresh} />;
  }

  return (
    <GateScreen
      description={t("betaGateOfflineDescription")}
      icon={WifiOff}
      title={t("betaGateOfflineTitle")}
    >
      <Button className="w-fit" onClick={refresh}>
        {t("betaGateRetryAction")}
      </Button>
    </GateScreen>
  );
}
