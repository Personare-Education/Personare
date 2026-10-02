import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { useCallback, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  saveAttachmentImage,
  saveAttachmentImageData,
} from "@/actions/attachments";
import { selectImageFile } from "@/actions/dialog";
import MarkdownComposer from "@/components/markdown-composer";
import "@/localization/i18n";

vi.mock("@/actions/dialog", () => ({
  selectImageFile: vi.fn(),
}));
vi.mock("@/actions/attachments", () => ({
  deleteAttachmentImage: vi.fn(),
  getAttachmentImageDataUrl: vi.fn(),
  saveAttachmentImage: vi.fn(),
  saveAttachmentImageData: vi.fn(),
}));

/**
 * RED phase (docs/specs/quiz-question-single-editor.md AC-2): a single
 * GitHub-style Markdown editor -- Write/Preview tabs, a formatting toolbar,
 * a "Markdown is supported" footer and a pending image. Enter breaks the
 * line; Shift+Enter (or the submit button) calls onSubmit. It does not
 * advertise LaTeX.
 */

const LABEL = "Editor";
const LATEX_PATTERN = /latex/i;

function Harness({
  initialImagePath = null,
  onSubmit,
}: {
  initialImagePath?: string | null;
  onSubmit: (value: string, imagePath: string | null) => void;
}) {
  const [value, setValue] = useState("");
  const [imagePath, setImagePath] = useState<string | null>(initialImagePath);
  const handleSubmit = useCallback(
    () => onSubmit(value, imagePath),
    [imagePath, onSubmit, value]
  );

  return (
    <MarkdownComposer
      imagePath={imagePath}
      label={LABEL}
      onChange={setValue}
      onImagePathChange={setImagePath}
      onSubmit={handleSubmit}
      submitLabel="Enviar"
      value={value}
    />
  );
}

function textarea() {
  return screen.getByRole("textbox", { name: LABEL }) as HTMLTextAreaElement;
}

describe("MarkdownComposer", () => {
  beforeEach(() => {
    vi.mocked(selectImageFile).mockReset();
    vi.mocked(saveAttachmentImage).mockReset();
    vi.mocked(saveAttachmentImageData).mockReset();
  });

  it("has Write and Preview tabs", () => {
    render(<Harness onSubmit={vi.fn()} />);

    expect(
      screen.getByRole("tab", { name: i18n.t("markdownWriteTabLabel") })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: i18n.t("markdownPreviewTabLabel") })
    ).toBeInTheDocument();
  });

  it("says Markdown is supported and does not mention LaTeX", () => {
    render(<Harness onSubmit={vi.fn()} />);

    expect(
      screen.getByText(i18n.t("markdownSupportedHint"))
    ).toBeInTheDocument();
    expect(screen.queryByText(LATEX_PATTERN)).not.toBeInTheDocument();
  });

  it("breaks the line on Enter without submitting", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await user.type(textarea(), "a{Enter}b");

    expect(textarea()).toHaveValue("a\nb");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits on Shift+Enter without inserting a line break", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await user.type(textarea(), "texto{Shift>}{Enter}{/Shift}");

    expect(onSubmit).toHaveBeenCalledWith("texto", null);
    expect(textarea()).toHaveValue("texto");
  });

  it("submits from the submit button", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await user.type(textarea(), "texto");
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(onSubmit).toHaveBeenCalledWith("texto", null);
  });

  it("applies bold from the toolbar to the selection", async () => {
    const user = userEvent.setup();
    render(<Harness onSubmit={vi.fn()} />);

    await user.type(textarea(), "word");
    textarea().setSelectionRange(0, 4);
    await user.click(
      screen.getByRole("button", { name: i18n.t("markdownBoldAction") })
    );

    expect(textarea()).toHaveValue("**word**");
  });

  it("attaches an image picked from the native dialog as the pending image", async () => {
    const user = userEvent.setup();
    vi.mocked(selectImageFile).mockResolvedValue("C:/pics/a.png");
    vi.mocked(saveAttachmentImage).mockResolvedValue({ fileName: "saved.png" });
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await user.click(
      screen.getByRole("button", { name: i18n.t("attachImageAction") })
    );

    await screen.findByText(i18n.t("imageAttachedLabel"));
    expect(saveAttachmentImage).toHaveBeenCalledWith("C:/pics/a.png");

    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(onSubmit).toHaveBeenCalledWith("", "saved.png");
  });

  it("saves a pasted clipboard image (which has no path) from its bytes", async () => {
    vi.mocked(saveAttachmentImageData).mockResolvedValue({
      fileName: "pasted.png",
    });
    render(<Harness onSubmit={vi.fn()} />);
    const file = new File([new Uint8Array([1, 2, 3])], "image.png", {
      type: "image/png",
    });

    fireEvent.paste(textarea(), { clipboardData: { files: [file] } });

    await waitFor(() => {
      expect(saveAttachmentImageData).toHaveBeenCalledWith("AQID", ".png");
    });
    await screen.findByText(i18n.t("imageAttachedLabel"));
  });

  it("disables typing, formatting and submitting when disabled", () => {
    render(
      <MarkdownComposer
        disabled
        imagePath={null}
        label={LABEL}
        onChange={vi.fn()}
        onImagePathChange={vi.fn()}
        onSubmit={vi.fn()}
        submitLabel="Enviar"
        value=""
      />
    );

    expect(textarea()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: i18n.t("markdownBoldAction") })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: i18n.t("attachImageAction") })
    ).toBeDisabled();
  });

  it("removes the pending image without deleting the file", async () => {
    const user = userEvent.setup();
    render(<Harness initialImagePath="kept.png" onSubmit={vi.fn()} />);

    await user.click(
      screen.getByRole("button", { name: i18n.t("removeImageAction") })
    );

    expect(
      screen.queryByText(i18n.t("imageAttachedLabel"))
    ).not.toBeInTheDocument();
  });
});
