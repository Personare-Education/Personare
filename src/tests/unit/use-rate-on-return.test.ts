import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Activity } from "@/components/activities-data-table";
import { useRateOnReturn } from "@/hooks/use-rate-on-return";

/*
 * Issue #121: no Linux, a Dialog de Dificuldade nao abria ao voltar de um PDF.
 * O shell.openPath do Electron espera o xdg-open terminar, e em varios
 * desktops ele so retorna quando o visualizador fecha. A atividade so era
 * armada depois que o openPath resolvia -- tarde demais (ou nunca) para o
 * foco de retorno.
 */

const {
  armPendingActivityRating,
  clearPendingActivityRating,
  openActivityFile,
} = vi.hoisted(() => ({
  armPendingActivityRating: vi.fn(),
  clearPendingActivityRating: vi.fn(),
  openActivityFile: vi.fn(),
}));

vi.mock("@/actions/review", () => ({
  armPendingActivityRating,
  clearPendingActivityRating,
}));
vi.mock("@/actions/shell", () => ({ openActivityFile }));

const pdfActivity = {
  filePath: "/home/user/aula.pdf",
  id: "activity-1",
} as Activity;

function returnToApp() {
  act(() => {
    window.dispatchEvent(new Event("focus"));
  });
}

describe("useRateOnReturn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens the rating on return even while the PDF viewer keeps openPath pending (Linux)", () => {
    openActivityFile.mockReturnValue(new Promise(() => undefined));
    const onReturn = vi.fn();
    const { result } = renderHook(() => useRateOnReturn(onReturn));

    act(() => {
      result.current.openPdf(pdfActivity);
    });
    returnToApp();

    expect(armPendingActivityRating).toHaveBeenCalledWith("activity-1");
    expect(onReturn).toHaveBeenCalledWith(pdfActivity);
  });

  it("disarms when the file could not be opened", async () => {
    openActivityFile.mockResolvedValue({ errorMessage: "No such file" });
    const onReturn = vi.fn();
    const { result } = renderHook(() => useRateOnReturn(onReturn));

    await act(async () => {
      await result.current.openPdf(pdfActivity);
    });
    returnToApp();

    expect(clearPendingActivityRating).toHaveBeenCalledWith("activity-1");
    expect(onReturn).not.toHaveBeenCalled();
  });

  it("opens the rating on return after opening a link", () => {
    const onReturn = vi.fn();
    const { result } = renderHook(() => useRateOnReturn(onReturn));

    act(() => {
      result.current.arm(pdfActivity);
    });
    returnToApp();

    expect(armPendingActivityRating).toHaveBeenCalledWith("activity-1");
    expect(onReturn).toHaveBeenCalledWith(pdfActivity);
  });

  it("fires only once per opened activity", () => {
    const onReturn = vi.fn();
    const { result } = renderHook(() => useRateOnReturn(onReturn));

    act(() => {
      result.current.arm(pdfActivity);
    });
    returnToApp();
    returnToApp();

    expect(onReturn).toHaveBeenCalledTimes(1);
  });
});
