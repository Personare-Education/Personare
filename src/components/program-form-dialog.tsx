import { useCallback, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Program } from "@/components/programs-card-grid";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_PROGRAM_COLOR,
  DEFAULT_PROGRAM_ICON_NAME,
  PROGRAM_COLORS,
  PROGRAM_ICONS,
} from "@/constants/program-appearance";
import { cn } from "@/utils/tailwind";

export interface ProgramFormSubmitValues {
  color: string;
  icon: string;
  name: string;
}

interface ProgramFormDialogProps {
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ProgramFormSubmitValues) => void;
  open: boolean;
  program: Program | null;
}

export default function ProgramFormDialog({
  onOpenChange,
  onSubmit,
  open,
  program,
}: ProgramFormDialogProps) {
  const { t } = useTranslation();
  const nameInputId = useId();
  const [name, setName] = useState(program?.name ?? "");
  const [icon, setIcon] = useState(program?.icon ?? DEFAULT_PROGRAM_ICON_NAME);
  const [color, setColor] = useState(program?.color ?? DEFAULT_PROGRAM_COLOR);

  useEffect(() => {
    if (open) {
      setName(program?.name ?? "");
      setIcon(program?.icon ?? DEFAULT_PROGRAM_ICON_NAME);
      setColor(program?.color ?? DEFAULT_PROGRAM_COLOR);
    }
  }, [open, program]);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      onSubmit({ color, icon, name });
    },
    [color, icon, name, onSubmit]
  );

  const handleNameChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setName(event.target.value);
    },
    []
  );

  const handleCancelClick = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleIconClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const selected = event.currentTarget.dataset.iconName;
      if (selected) {
        setIcon(selected);
      }
    },
    []
  );

  const handleColorClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const selected = event.currentTarget.dataset.color;
      if (selected) {
        setColor(selected);
      }
    },
    []
  );

  const SelectedIcon =
    PROGRAM_ICONS.find((entry) => entry.name === icon)?.Icon ??
    PROGRAM_ICONS[0].Icon;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {program ? t("editProgramTitle") : t("createProgramTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex justify-center">
              <span
                className="flex size-16 items-center justify-center rounded-full"
                style={{ backgroundColor: color }}
              >
                <SelectedIcon className="size-7 text-white" />
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t("programIconLabel")}</Label>
              <div className="flex flex-wrap gap-2">
                {PROGRAM_ICONS.map(({ Icon, name: iconName }) => (
                  <button
                    aria-label={iconName}
                    aria-pressed={icon === iconName}
                    className={cn(
                      "flex size-9 items-center justify-center rounded-lg border border-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      icon === iconName &&
                        "border-ring bg-accent text-accent-foreground"
                    )}
                    data-icon-name={iconName}
                    key={iconName}
                    onClick={handleIconClick}
                    type="button"
                  >
                    <Icon className="size-4" />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={nameInputId}>{t("programNameLabel")}</Label>
              <Input
                id={nameInputId}
                onChange={handleNameChange}
                required
                value={name}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>{t("programColorLabel")}</Label>
              <div className="flex flex-wrap gap-2">
                {PROGRAM_COLORS.map((swatch) => (
                  <button
                    aria-label={swatch}
                    aria-pressed={color === swatch}
                    className={cn(
                      "size-7 rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-background",
                      color === swatch && "ring-ring"
                    )}
                    data-color={swatch}
                    key={swatch}
                    onClick={handleColorClick}
                    style={{ backgroundColor: swatch }}
                    type="button"
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCancelClick} type="button" variant="outline">
              {t("cancelAction")}
            </Button>
            <Button type="submit">{t("saveAction")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
