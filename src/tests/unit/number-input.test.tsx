import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "i18next";
import { useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { NumberInput } from "@/components/ui/number-input";
import "@/localization/i18n";

/**
 * RED phase (docs/specs/exams.md §2 AC-3): a whole-number field with the
 * app's own − and + instead of the browser's spinner.
 */

function Harness({
  initial = "5",
  max,
  min = 1,
}: {
  initial?: string;
  max?: number;
  min?: number;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <label htmlFor="n">Quantas</label>
      <NumberInput
        id="n"
        max={max}
        min={min}
        onValueChange={setValue}
        value={value}
      />
    </>
  );
}

function field() {
  return screen.getByLabelText("Quantas");
}

describe("NumberInput", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("pt-BR");
  });

  it("is a text field with a numeric keyboard, between − and +", () => {
    render(<Harness />);

    expect(field()).toHaveAttribute("type", "text");
    expect(field()).toHaveAttribute("inputmode", "numeric");
    expect(
      screen.getByRole("button", { name: i18n.t("decreaseAction") })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: i18n.t("increaseAction") })
    ).toBeInTheDocument();
  });

  it("steps up and down with the buttons", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(
      screen.getByRole("button", { name: i18n.t("increaseAction") })
    );
    await user.click(
      screen.getByRole("button", { name: i18n.t("increaseAction") })
    );
    expect(field()).toHaveValue("7");
    await user.click(
      screen.getByRole("button", { name: i18n.t("decreaseAction") })
    );
    expect(field()).toHaveValue("6");
  });

  it("stops at the ends, and turns that button off", async () => {
    const user = userEvent.setup();
    render(<Harness initial="99" max={100} min={1} />);
    const plus = screen.getByRole("button", { name: i18n.t("increaseAction") });

    await user.click(plus);
    expect(field()).toHaveValue("100");
    expect(plus).toBeDisabled();

    render(<Harness initial="1" />);
    expect(
      screen.getAllByRole("button", { name: i18n.t("decreaseAction") })[1]
    ).toBeDisabled();
  });

  it("starts from the minimum when empty", async () => {
    const user = userEvent.setup();
    render(<Harness initial="" />);

    await user.click(
      screen.getByRole("button", { name: i18n.t("increaseAction") })
    );

    expect(field()).toHaveValue("1");
  });

  it("steps with the arrow keys, and still takes typing", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(field());
    await user.keyboard("{ArrowUp}{ArrowUp}{ArrowDown}");
    expect(field()).toHaveValue("6");
    await user.clear(field());
    await user.type(field(), "42");
    expect(field()).toHaveValue("42");
  });

  it("keeps the buttons out of the tab order, as the arrow keys do the same", () => {
    render(<Harness />);

    for (const name of ["increaseAction", "decreaseAction"]) {
      expect(
        screen.getByRole("button", { name: i18n.t(name) })
      ).toHaveAttribute("tabindex", "-1");
    }
  });
});
