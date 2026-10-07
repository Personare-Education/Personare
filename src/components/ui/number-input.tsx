import { Minus, Plus } from "lucide-react"
import * as React from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { cn } from "@/utils/tailwind"

const DIGITS = /^\d+$/

interface NumberInputProps
  extends Omit<React.ComponentProps<"input">, "max" | "min" | "onChange" | "type" | "value"> {
  max?: number
  min?: number
  /** The text as typed; empty is allowed (an optional field). */
  onValueChange: (value: string) => void
  value: string
}

/**
 * A whole number between − and +, in the shape of the app's Input (the
 * shadcn input-group pattern), instead of the browser's number spinner.
 * The arrow keys step too, so the buttons stay out of the tab order.
 */
function NumberInput({
  className,
  disabled,
  max,
  min = 0,
  onKeyDown,
  onValueChange,
  value,
  ...props
}: NumberInputProps) {
  const { t } = useTranslation()
  const current = DIGITS.test(value.trim()) ? Number(value.trim()) : null

  const clamp = (next: number) =>
    Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, next))

  // From empty (or not a number), either button starts at the minimum.
  const step = (direction: -1 | 1) =>
    onValueChange(String(current === null ? min : clamp(current + direction)))

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event)
    if (event.defaultPrevented) {
      return
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault()
      step(event.key === "ArrowUp" ? 1 : -1)
    }
  }

  return (
    <div
      className={cn(
        "flex h-7 w-full min-w-0 items-center rounded-md border border-input bg-input/20 transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring dark:bg-input/30",
        disabled && "pointer-events-none opacity-50",
        className
      )}
      data-slot="number-input"
    >
      <Button
        aria-label={t("decreaseAction")}
        className="ms-0.5 text-muted-foreground"
        disabled={disabled || (current !== null && current <= min)}
        onClick={() => step(-1)}
        size="icon-sm"
        tabIndex={-1}
        type="button"
        variant="ghost"
      >
        <Minus />
      </Button>
      <input
        className="h-full min-w-0 flex-1 bg-transparent px-1 text-center text-sm tabular-nums outline-none md:text-xs/relaxed"
        disabled={disabled}
        inputMode="numeric"
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={handleKeyDown}
        type="text"
        value={value}
        {...props}
      />
      <Button
        aria-label={t("increaseAction")}
        className="me-0.5 text-muted-foreground"
        disabled={disabled || (current !== null && max !== undefined && current >= max)}
        onClick={() => step(1)}
        size="icon-sm"
        tabIndex={-1}
        type="button"
        variant="ghost"
      >
        <Plus />
      </Button>
    </div>
  )
}

export { NumberInput }
