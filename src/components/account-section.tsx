import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { exportAccountData, getSession, login, logout } from "@/actions/auth";
import {
  connectCalendar,
  getCalendarConnectionStatus,
} from "@/actions/calendar-sync";
import { selectAccountExportPath } from "@/actions/dialog";
import { connectDrive, getDriveConnectionStatus } from "@/actions/drive-backup";
import DeleteAccountDialog from "@/components/delete-account-dialog";
import ScopeConsentDialog from "@/components/scope-consent-dialog";
import { Button } from "@/components/ui/button";
import { notifySessionChanged } from "@/utils/session-events";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120_000;

interface Session {
  avatarUrl: string | null;
  email: string;
  id: string;
  name: string;
}

interface AccountSectionProps {
  onDriveConnectedChange?: (connected: boolean) => void;
}

export default function AccountSection({
  onDriveConnectedChange,
}: AccountSectionProps = {}) {
  const { t } = useTranslation();
  const [session, setSession] = useState<Session | null>(null);
  const [isAwaitingLogin, setIsAwaitingLogin] = useState(false);
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);
  const [isAwaitingCalendarConnect, setIsAwaitingCalendarConnect] =
    useState(false);
  const [isCalendarConsentOpen, setIsCalendarConsentOpen] = useState(false);
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [isAwaitingDriveConnect, setIsAwaitingDriveConnect] = useState(false);
  const [isDriveConsentOpen, setIsDriveConsentOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  useEffect(() => {
    getSession().then(setSession);
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    getCalendarConnectionStatus().then(setIsCalendarConnected);
    getDriveConnectionStatus().then((connected) => {
      setIsDriveConnected(connected);
      onDriveConnectedChange?.(connected);
    });
  }, [session, onDriveConnectedChange]);

  useEffect(() => {
    if (!isAwaitingLogin) {
      return;
    }

    const interval = setInterval(() => {
      getSession().then((nextSession) => {
        if (nextSession) {
          setSession(nextSession);
          setIsAwaitingLogin(false);
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
  }, [isAwaitingLogin]);

  useEffect(() => {
    if (!isAwaitingCalendarConnect) {
      return;
    }

    const interval = setInterval(() => {
      getCalendarConnectionStatus().then((connected) => {
        if (connected) {
          setIsCalendarConnected(true);
          setIsAwaitingCalendarConnect(false);
        }
      });
    }, POLL_INTERVAL_MS);
    const timeout = setTimeout(() => {
      setIsAwaitingCalendarConnect(false);
    }, POLL_TIMEOUT_MS);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isAwaitingCalendarConnect]);

  useEffect(() => {
    if (!isAwaitingDriveConnect) {
      return;
    }

    const interval = setInterval(() => {
      getDriveConnectionStatus().then((connected) => {
        if (connected) {
          setIsDriveConnected(true);
          onDriveConnectedChange?.(true);
          setIsAwaitingDriveConnect(false);
        }
      });
    }, POLL_INTERVAL_MS);
    const timeout = setTimeout(() => {
      setIsAwaitingDriveConnect(false);
    }, POLL_TIMEOUT_MS);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isAwaitingDriveConnect, onDriveConnectedChange]);

  const handleLoginClick = useCallback(() => {
    login();
    setIsAwaitingLogin(true);
  }, []);

  const handleLogoutClick = useCallback(() => {
    logout().then(() => {
      notifySessionChanged();
      setSession(null);
      setIsCalendarConnected(false);
      setIsDriveConnected(false);
      onDriveConnectedChange?.(false);
    });
  }, [onDriveConnectedChange]);

  const handleConnectCalendarClick = useCallback(() => {
    setIsCalendarConsentOpen(true);
  }, []);

  const handleCalendarConsentCancel = useCallback(() => {
    setIsCalendarConsentOpen(false);
  }, []);

  const handleCalendarConsentConfirm = useCallback(() => {
    setIsCalendarConsentOpen(false);
    connectCalendar();
    setIsAwaitingCalendarConnect(true);
  }, []);

  const handleConnectDriveClick = useCallback(() => {
    setIsDriveConsentOpen(true);
  }, []);

  const handleDriveConsentCancel = useCallback(() => {
    setIsDriveConsentOpen(false);
  }, []);

  const handleDriveConsentConfirm = useCallback(() => {
    setIsDriveConsentOpen(false);
    connectDrive();
    setIsAwaitingDriveConnect(true);
  }, []);

  const handleExportClick = useCallback(async () => {
    setExportMessage(null);

    const filePath = await selectAccountExportPath();

    if (!filePath) {
      return;
    }

    const success = await exportAccountData(filePath);
    setExportMessage(
      success
        ? t("accountExportSuccessMessage")
        : t("accountExportErrorMessage")
    );
  }, [t]);

  const handleDeleteClick = useCallback(() => {
    setIsDeleteDialogOpen(true);
  }, []);

  const handleAccountDeleted = useCallback(() => {
    setIsDeleteDialogOpen(false);
    notifySessionChanged();
    setSession(null);
    setIsCalendarConnected(false);
    setIsDriveConnected(false);
    onDriveConnectedChange?.(false);
  }, [onDriveConnectedChange]);

  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-semibold text-lg">{t("accountSectionTitle")}</h2>
      <p className="text-muted-foreground text-sm">
        {t("accountSectionDescription")}
      </p>
      {session ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              <span>{session.name}</span>
              <span className="text-muted-foreground text-sm">
                {session.email}
              </span>
            </div>
            <Button onClick={handleLogoutClick} variant="outline">
              {t("logoutAction")}
            </Button>
          </div>
          {isCalendarConnected ? (
            <p className="text-muted-foreground text-sm">
              {t("calendarConnectedLabel")}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <Button
                disabled={isAwaitingCalendarConnect}
                onClick={handleConnectCalendarClick}
                variant="outline"
              >
                {t("connectGoogleCalendarAction")}
              </Button>
              {isAwaitingCalendarConnect ? (
                <p className="text-muted-foreground text-sm">
                  {t("waitingForCalendarConnectMessage")}
                </p>
              ) : null}
            </div>
          )}
          {isDriveConnected ? (
            <p className="text-muted-foreground text-sm">
              {t("driveConnectedLabel")}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <Button
                disabled={isAwaitingDriveConnect}
                onClick={handleConnectDriveClick}
                variant="outline"
              >
                {t("connectGoogleDriveAction")}
              </Button>
              {isAwaitingDriveConnect ? (
                <p className="text-muted-foreground text-sm">
                  {t("waitingForDriveConnectMessage")}
                </p>
              ) : null}
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={handleExportClick} variant="outline">
              {t("exportAccountDataAction")}
            </Button>
            <Button onClick={handleDeleteClick} variant="destructive">
              {t("deleteAccountAction")}
            </Button>
          </div>
          {exportMessage ? (
            <p className="text-muted-foreground text-sm">{exportMessage}</p>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Button disabled={isAwaitingLogin} onClick={handleLoginClick}>
            {t("loginWithGoogleAction")}
          </Button>
          {isAwaitingLogin ? (
            <p className="text-muted-foreground text-sm">
              {t("waitingForGoogleLoginMessage")}
            </p>
          ) : null}
        </div>
      )}
      <ScopeConsentDialog
        descriptionKey="calendarScopeConsentDescription"
        onCancel={handleCalendarConsentCancel}
        onConfirm={handleCalendarConsentConfirm}
        open={isCalendarConsentOpen}
        titleKey="connectGoogleCalendarAction"
      />
      <ScopeConsentDialog
        descriptionKey="driveScopeConsentDescription"
        onCancel={handleDriveConsentCancel}
        onConfirm={handleDriveConsentConfirm}
        open={isDriveConsentOpen}
        titleKey="connectGoogleDriveAction"
      />
      <DeleteAccountDialog
        onDeleted={handleAccountDeleted}
        onOpenChange={setIsDeleteDialogOpen}
        open={isDeleteDialogOpen}
      />
    </div>
  );
}
