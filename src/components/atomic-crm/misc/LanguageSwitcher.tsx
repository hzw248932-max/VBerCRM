import { useLocaleState, useLocales, useTranslate } from "ra-core";

export const LanguageSwitcher = () => {
  const [locale, setLocale] = useLocaleState();
  const locales = useLocales();
  const translate = useTranslate();
  return (
    <select
      aria-label={translate("crm.language")}
      value={locale}
      onChange={(event) => setLocale(event.target.value)}
      className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
    >
      {locales.map((option) => (
        <option key={option.locale} value={option.locale}>
          {option.name}
        </option>
      ))}
    </select>
  );
};
