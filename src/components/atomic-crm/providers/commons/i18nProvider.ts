import { mergeTranslations } from "ra-core";
import polyglotI18nProvider from "ra-i18n-polyglot";
import englishMessages from "ra-language-english";
import frenchMessages from "ra-language-french";
import { raSupabaseEnglishMessages } from "ra-supabase-language-english";
import { raSupabaseFrenchMessages } from "ra-supabase-language-french";
import { englishCrmMessages } from "./englishCrmMessages";
import { frenchCrmMessages } from "./frenchCrmMessages";
import { chineseCrmMessages } from "./chineseCrmMessages";
import {
  chineseAdminMessages,
  chineseSupabaseMessages,
} from "./chineseAdminMessages";
import { brandMessages } from "./brandMessages";
import { chineseChoiceMessages } from "./chineseChoiceMessages";

const raSupabaseEnglishMessagesOverride = {
  "ra-supabase": {
    auth: {
      password_reset: "Check your emails for a Reset Password message.",
    },
    oauth: {
      authorize: "Authorize Application",
      authorize_details: "This application wants to access your account.",
      access_scope:
        "It will be able to read and modify your data, with the same permissions as your account.",
      approved: "Authorization Approved",
      close_tab: "You can now close this tab.",
      no_request: "No authorization request found",
    },
  },
};

const raSupabaseFrenchMessagesOverride = {
  "ra-supabase": {
    auth: {
      password_reset:
        "Consultez vos emails pour trouver le message de reinitialisation du mot de passe.",
    },
    oauth: {
      authorize: "Autoriser l'application",
      authorize_details: "Cette application souhaite accéder à votre compte.",
      access_scope:
        "Elle pourra lire et modifier vos données, avec les mêmes droits que votre compte.",
      approved: "Autorisation accordée",
      close_tab: "Vous pouvez fermer cet onglet.",
      no_request: "Aucune demande d'autorisation trouvée",
    },
  },
};

const englishCatalog = mergeTranslations(
  englishMessages,
  raSupabaseEnglishMessages,
  raSupabaseEnglishMessagesOverride,
  englishCrmMessages,
  brandMessages.en,
);

const frenchCatalog = mergeTranslations(
  englishCatalog,
  frenchMessages,
  raSupabaseFrenchMessages,
  raSupabaseFrenchMessagesOverride,
  frenchCrmMessages,
  brandMessages.fr,
);

const chineseCatalog = mergeTranslations(
  englishCatalog,
  chineseAdminMessages,
  chineseSupabaseMessages,
  chineseCrmMessages,
  brandMessages.zh,
  chineseChoiceMessages,
);
const supportedLocales = ["en", "fr", "zh-CN"];
export const getInitialLocale = (): "en" | "fr" | "zh-CN" => {
  try {
    const saved = localStorage.getItem("vbercrm.locale");
    if (saved && supportedLocales.includes(saved))
      return saved as "en" | "fr" | "zh-CN";
  } catch {
    /* Storage can be unavailable in restricted contexts. */
  }
  if (typeof navigator === "undefined") {
    return "en";
  }

  const browserLocale = navigator.languages?.[0] ?? navigator.language;
  if (browserLocale?.toLowerCase().startsWith("zh")) return "zh-CN";
  if (browserLocale?.toLowerCase().startsWith("fr")) {
    return "fr";
  }

  return "en";
};

export const i18nProvider = polyglotI18nProvider(
  (locale) => {
    if (locale === "zh-CN") return chineseCatalog;
    if (locale === "fr") {
      return frenchCatalog;
    }
    return englishCatalog;
  },
  getInitialLocale(),
  [
    { locale: "en", name: "English" },
    { locale: "zh-CN", name: "简体中文" },
    { locale: "fr", name: "Français" },
  ],
  { allowMissing: true },
);

const changeLocale = i18nProvider.changeLocale.bind(i18nProvider);
i18nProvider.changeLocale = async (locale: string) => {
  await changeLocale(locale);
  const resolved = supportedLocales.includes(locale) ? locale : "en";
  if (typeof document !== "undefined") document.documentElement.lang = resolved;
  try {
    localStorage.setItem("vbercrm.locale", resolved);
  } catch {
    /* Switching works without persistence. */
  }
};
if (typeof document !== "undefined")
  document.documentElement.lang = getInitialLocale();

export const testI18nProvider = polyglotI18nProvider(
  () => englishCatalog,
  "en",
  [{ locale: "en", name: "English" }],
  { allowMissing: true },
);
