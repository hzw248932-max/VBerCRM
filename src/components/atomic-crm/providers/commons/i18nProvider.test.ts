import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getInitialLocale, i18nProvider } from "./i18nProvider";
import { englishCrmMessages } from "./englishCrmMessages";
import { chineseCrmMessages } from "./chineseCrmMessages";
import { formatRelativeDate } from "../../misc/RelativeDate";

beforeEach(() => {
  const entries = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("i18nProvider", () => {
  it("registers English, Chinese and French locales", () => {
    expect(i18nProvider.getLocales?.()).toEqual([
      { locale: "en", name: "English" },
      { locale: "zh-CN", name: "简体中文" },
      { locale: "fr", name: "Français" },
    ]);
  });

  it("translates the language key in french", async () => {
    await i18nProvider.changeLocale("fr");

    expect(i18nProvider.translate("crm.language")).toBe("Langue");
  });

  it("falls back to english for unknown locales", async () => {
    await i18nProvider.changeLocale("es");

    expect(i18nProvider.translate("crm.language")).toBe("Language");
  });

  it("uses customized password reset overrides for en and fr", async () => {
    await i18nProvider.changeLocale("en");
    expect(i18nProvider.translate("ra-supabase.auth.password_reset")).toBe(
      "Check your emails for a Reset Password message.",
    );

    await i18nProvider.changeLocale("fr");
    expect(i18nProvider.translate("ra-supabase.auth.password_reset")).toBe(
      "Consultez vos emails pour trouver le message de reinitialisation du mot de passe.",
    );
  });

  it("translates recently added fr crm keys", async () => {
    await i18nProvider.changeLocale("fr");

    expect(i18nProvider.translate("resources.deals.empty.title")).toBe(
      "Aucune affaire trouvée",
    );
  });

  it("uses browser french locale when available", () => {
    vi.stubGlobal("navigator", {
      language: "fr-FR",
      languages: ["fr-FR", "en-US"],
    });

    expect(getInitialLocale()).toBe("fr");
  });

  it("falls back to english when browser locale is unsupported", () => {
    vi.stubGlobal("navigator", {
      language: "es-ES",
      languages: ["es-ES", "pt-BR"],
    });

    expect(getInitialLocale()).toBe("en");
  });

  it("uses Chinese browser locale and remembers an explicit English selection", async () => {
    vi.stubGlobal("navigator", { language: "zh-CN", languages: ["zh-CN"] });
    expect(getInitialLocale()).toBe("zh-CN");
    await i18nProvider.changeLocale("en");
    expect(getInitialLocale()).toBe("en");
  });

  it("switches between Chinese and English without losing interpolation", async () => {
    await i18nProvider.changeLocale("zh-CN");
    expect(
      i18nProvider.translate("resources.companies.name", { smart_count: 2 }),
    ).toBe("公司");
    expect(
      i18nProvider.translate("resources.companies.nb_contacts", {
        smart_count: 5,
      }),
    ).toBe("5 位联系人");
    expect(i18nProvider.translate("ra.action.save")).toBe("保存");
    expect(i18nProvider.translate("crm.auth.welcome_title")).toBe(
      "欢迎使用 VBerCRM",
    );
    expect(i18nProvider.translate("ra-supabase.auth.forgot_password")).toBe(
      "忘记密码？",
    );
    await i18nProvider.changeLocale("en");
    expect(
      i18nProvider.translate("resources.companies.name", { smart_count: 2 }),
    ).toBe("Companies");
    expect(i18nProvider.translate("crm.auth.welcome_title")).toBe(
      "Welcome to VBerCRM",
    );
  });

  it("preserves every CRM translation key and interpolation variable", () => {
    const check = (
      english: Record<string, unknown>,
      chinese: Record<string, unknown>,
    ) => {
      expect(Object.keys(chinese).sort()).toEqual(Object.keys(english).sort());
      for (const key of Object.keys(english)) {
        if (typeof english[key] === "string") {
          const tokens = (text: string) =>
            [...new Set(text.match(/%\{[^}]+\}/g) ?? [])].sort();
          expect(tokens(chinese[key] as string), key).toEqual(
            tokens(english[key] as string),
          );
        } else {
          check(
            english[key] as Record<string, unknown>,
            chinese[key] as Record<string, unknown>,
          );
        }
      }
    };
    check(englishCrmMessages, chineseCrmMessages);
  });

  it("updates the document language and tolerates unavailable storage", async () => {
    vi.stubGlobal("document", { documentElement: { lang: "en" } });
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    await i18nProvider.changeLocale("zh-CN");
    expect(document.documentElement.lang).toBe("zh-CN");
    expect(i18nProvider.translate("crm.language")).toBe("语言");
  });

  it("formats recent dates in Chinese", () => {
    expect(formatRelativeDate(new Date().toISOString(), "zh-CN")).toContain(
      "今天",
    );
  });
});
