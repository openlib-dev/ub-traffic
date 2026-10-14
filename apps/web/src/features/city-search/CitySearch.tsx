import { useEffect, useId, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { flyTargetForPlace, searchPlaces } from "@/data/nominatim";
import type { PlaceHit } from "@/domain/city";
import { useI18n } from "@/i18n/use-i18n";
import { useAppStore } from "@/state/use-app-store";

export function CitySearch() {
  const { locale, copy } = useI18n();
  const flyTo = useAppStore((state) => state.flyTo);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceHit[]>([]);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        setStatus("loading");
        try {
          const hits = await searchPlaces(trimmed, locale, controller.signal);
          setResults(hits);
          setStatus("idle");
          setOpen(true);
        } catch {
          if (controller.signal.aborted) return;
          setResults([]);
          setStatus("error");
          setOpen(true);
        }
      })();
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [locale, query]);

  function choose(place: PlaceHit) {
    flyTo(flyTargetForPlace(place));
    setQuery(place.label);
    setOpen(false);
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={copy.searchLabel}
        placeholder={copy.searchPlaceholder}
        className="pl-8"
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (results.length > 0 || status === "error") setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (event.key === "Enter" && results[0]) {
            event.preventDefault();
            choose(results[0]);
          }
        }}
      />
      {open && query.trim().length >= 2 ? (
        <div
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-popover p-1 shadow-lg"
        >
          {status === "loading" ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">{copy.searching}</p>
          ) : null}
          {status === "error" ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">{copy.searchUnavailable}</p>
          ) : null}
          {status === "idle" && results.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">{copy.noPlaces}</p>
          ) : null}
          {results.map((place) => (
            <button
              key={place.id}
              type="button"
              role="option"
              className="block w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              onMouseDown={(event) => {
                event.preventDefault();
                choose(place);
              }}
            >
              {place.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
