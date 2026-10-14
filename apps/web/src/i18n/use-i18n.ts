import { CATALOG, type Locale } from "@/i18n/catalog";
import { localize } from "@/i18n/localize";
import { useAppStore } from "@/state/use-app-store";

export function useI18n() {
  const locale = useAppStore((state) => state.locale);
  const setLocale = useAppStore((state) => state.setLocale);
  return {
    locale,
    setLocale,
    copy: CATALOG[locale],
    show: (value: string | null | undefined) => localize(locale, value),
  };
}

export function applyDocumentLocale(locale: Locale) {
  document.documentElement.lang = locale;
  document.title = CATALOG[locale].appTitle;
}
