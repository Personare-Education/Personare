import { enUS, ptBR } from "date-fns/locale";
import i18n from "i18next";
import { afterEach, describe, expect, it } from "vitest";
import "@/localization/i18n";
import {
  buildEventCalendarI18n,
  resolveEventCalendarLocale,
} from "@/utils/event-calendar-i18n";

/**
 * The Calendar section (Issue #18) rendered its "Today"/"Previous"/"Next"
 * nav, view switcher, and empty/loading states in hardcoded English
 * regardless of the app's active language -- the EventCalendar component
 * itself already exposes an `i18n`/`locale` override mechanism for exactly
 * this, it just wasn't wired up. buildEventCalendarI18n bridges i18next's
 * `t` to that override shape; resolveEventCalendarLocale picks the
 * matching date-fns Locale for month/weekday name formatting.
 */

afterEach(async () => {
  await i18n.changeLanguage("en");
});

describe("resolveEventCalendarLocale", () => {
  it("resolves pt-BR to date-fns's ptBR locale", () => {
    expect(resolveEventCalendarLocale("pt-BR")).toBe(ptBR);
  });

  it("resolves en to date-fns's enUS locale", () => {
    expect(resolveEventCalendarLocale("en")).toBe(enUS);
  });

  it("falls back to enUS for an unconfigured language", () => {
    expect(resolveEventCalendarLocale("it")).toBe(enUS);
  });
});

describe("buildEventCalendarI18n", () => {
  it("translates the nav labels to English by default", () => {
    const overrides = buildEventCalendarI18n(i18n.t);

    expect(overrides.labels?.today).toBe("Today");
    expect(overrides.labels?.previous).toBe("Previous");
    expect(overrides.labels?.next).toBe("Next");
    expect(overrides.viewNames?.month).toBe("Month");
    expect(overrides.viewNames?.agenda).toBe("Agenda");
  });

  it("translates the nav labels to Portuguese when the language is pt-BR", async () => {
    await i18n.changeLanguage("pt-BR");

    const overrides = buildEventCalendarI18n(i18n.t);

    expect(overrides.labels?.today).toBe("Hoje");
    expect(overrides.labels?.previous).toBe("Anterior");
    expect(overrides.labels?.next).toBe("Próximo");
    expect(overrides.viewNames?.month).toBe("Mês");
    expect(overrides.viewNames?.agenda).toBe("Agenda");
  });

  it("pluralizes the events count label", () => {
    const overrides = buildEventCalendarI18n(i18n.t);

    expect(overrides.labels?.events?.(1)).toBe("1 event");
    expect(overrides.labels?.events?.(3)).toBe("3 events");
  });

  it("pluralizes the days count viewName", async () => {
    await i18n.changeLanguage("pt-BR");

    const overrides = buildEventCalendarI18n(i18n.t);

    expect(overrides.viewNames?.days?.(1)).toBe("1 dia");
    expect(overrides.viewNames?.days?.(2)).toBe("2 dias");
  });

  it("interpolates the moreEvents/more-compact overflow labels", () => {
    const overrides = buildEventCalendarI18n(i18n.t);

    expect(overrides.labels?.more?.(4)).toBe("+4 more");
    expect(overrides.labels?.moreCompact?.(4)).toBe("+4");
  });

  it("shares the same count-based wording between events and toggleDayEvents", () => {
    const overrides = buildEventCalendarI18n(i18n.t);

    expect(overrides.labels?.toggleDayEvents?.(1, false)).toBe(
      overrides.labels?.events?.(1)
    );
    expect(overrides.labels?.toggleDayEvents?.(2, true)).toBe(
      overrides.labels?.events?.(2)
    );
  });
});
