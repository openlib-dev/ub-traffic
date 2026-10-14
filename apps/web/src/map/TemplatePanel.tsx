import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createTemplate,
  deleteTemplate,
  fetchSavedResult,
  fetchTemplate,
  listSavedResults,
  listTemplates,
  type TemplateListItem,
} from "@/data/simulation-client";
import { savedTemplate, type RoadTemplate } from "@/domain/template";
import type { SavedListItem } from "@/domain/saved-result";
import { useI18n } from "@/i18n/use-i18n";
import { useAppStore } from "@/state/use-app-store";

export function TemplatePanel() {
  const { copy, show } = useI18n();
  const availability = useAppStore((state) => state.simulationAvailability);
  const mapTemplates = useAppStore((state) => state.mapTemplates);
  const templateBase = useAppStore((state) => state.templateBase);
  const setMapTemplates = useAppStore((state) => state.setMapTemplates);
  const showBaseMap = useAppStore((state) => state.showBaseMap);
  const [saved, setSaved] = useState<SavedListItem[]>([]);
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (availability !== "connected") return;
    let cancelled = false;
    void Promise.all([listSavedResults(), listTemplates()])
      .then(([results, stored]) => {
        if (cancelled) return;
        setSaved(results);
        setTemplates(stored);
      })
      .catch(() => {
        if (!cancelled) setError("The templates could not be read.");
      });
    return () => {
      cancelled = true;
    };
  }, [availability]);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const label = name.trim();
      const id = await createTemplate(label, []);
      setName("");
      setTemplates(await listTemplates());
      useAppStore.getState().openTemplate({ key: `template:${id}`, name: label, edits: [], summary: null });
      setOpen(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The template could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteTemplate(id);
      setTemplates((current) => current.filter((item) => item.id !== id));
      const key = `template:${id}`;
      const next = useAppStore.getState().mapTemplates.filter((item) => item.key !== key);
      if (next.length === 0) useAppStore.getState().showBaseMap();
      else if (next.length === 1 && next[0].key.startsWith("template:")) useAppStore.getState().openTemplate(next[0]);
      else setMapTemplates(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The template could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(key: string) {
    setError(null);
    const current = useAppStore.getState().mapTemplates;
    if (current.some((item) => item.key === key)) {
      const next = current.filter((item) => item.key !== key);
      if (next.length === 1 && next[0].key.startsWith("template:")) useAppStore.getState().openTemplate(next[0]);
      else if (next.length === 0) useAppStore.getState().showBaseMap();
      else setMapTemplates(next);
      return;
    }
    try {
      const template = key.startsWith("saved:") ? await savedRecordTemplate(key.slice(6)) : await storedTemplate(key.slice(9));
      const latest = useAppStore.getState().mapTemplates.filter((item) => item.key !== template.key);
      if (latest.length === 0 && template.key.startsWith("template:")) {
        useAppStore.getState().openTemplate(template);
        return;
      }
      const room = latest.length >= 2 ? latest.slice(1) : latest;
      setMapTemplates([...room, template]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The templates could not be read.");
    }
  }

  const drawn = templates.map((item) => ({ key: `template:${item.id}`, id: item.id, label: item.name }));
  const results = saved.filter((item) => item.editCount > 0).map((item) => ({ key: `saved:${item.id}`, label: item.name }));
  const summary = mapTemplates.map((item) => item.name).join(", ");

  return (
    <section className="pointer-events-auto absolute bottom-3 left-3 z-10 flex max-h-[50%] w-56 flex-col rounded-lg border border-border bg-background/95 shadow-sm">
      <button
        type="button"
        aria-expanded={open}
        className="flex items-center justify-between gap-2 px-2 py-1.5 text-left"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">{copy.templates}</span>
        <span className="truncate text-[11px] text-foreground">{summary || copy.basemap}</span>
      </button>
      {open ? (
        <div className="flex flex-col gap-2 overflow-auto border-t border-border p-2">
          <button type="button" aria-pressed={templateBase} className={choiceClass(templateBase)} onClick={showBaseMap}>
            {copy.basemap}
          </button>
          <Group title={copy.templates}>
            {drawn.map((item) => (
              <Row
                key={item.key}
                label={item.label}
                selected={mapTemplates.some((template) => template.key === item.key)}
                removeLabel={copy.deleteResult}
                onSelect={() => void toggle(item.key)}
                onRemove={() => void remove(item.id)}
              />
            ))}
          </Group>
          {results.length > 0 ? (
            <Group title={copy.saved}>
              {results.map((item) => (
                <Row
                  key={item.key}
                  label={item.label}
                  selected={mapTemplates.some((template) => template.key === item.key)}
                  onSelect={() => void toggle(item.key)}
                />
              ))}
            </Group>
          ) : null}
          {mapTemplates.length === 2 ? (
            <p className="text-[11px] text-muted-foreground">
              <span className="mr-2 text-[#e2b340]">{mapTemplates[0]?.name}</span>
              <span className="mr-2 text-[#3aa0d8]">{mapTemplates[1]?.name}</span>
              <span>{copy.inBothTemplates}</span>
            </p>
          ) : null}
          <Input className="h-7 px-2 text-xs" aria-label={copy.resultName} value={name} disabled={busy} onChange={(event) => setName(event.target.value)} />
          <Button size="sm" variant="outline" disabled={busy || name.trim().length === 0} onClick={() => void save()}>
            {copy.saveTemplate}
          </Button>
          {error ? <p className="text-xs text-destructive">{show(error)}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function Row({
  label,
  selected,
  removeLabel,
  onSelect,
  onRemove,
}: {
  label: string;
  selected: boolean;
  removeLabel?: string;
  onSelect: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" aria-pressed={selected} className={choiceClass(selected)} onClick={onSelect}>
        {label}
      </button>
      {onRemove && removeLabel ? (
        <button type="button" className="shrink-0 px-1 text-[11px] text-muted-foreground" onClick={onRemove}>
          {removeLabel}
        </button>
      ) : null}
    </div>
  );
}

function choiceClass(selected: boolean): string {
  return selected
    ? "min-w-0 flex-1 truncate rounded-md border border-foreground bg-foreground px-2 py-1 text-left text-xs text-background"
    : "min-w-0 flex-1 truncate rounded-md border border-border px-2 py-1 text-left text-xs";
}

async function savedRecordTemplate(id: string): Promise<RoadTemplate> {
  return savedTemplate(await fetchSavedResult(id));
}

async function storedTemplate(id: string): Promise<RoadTemplate> {
  const record = await fetchTemplate(id);
  return { key: `template:${record.id}`, name: record.name, edits: record.edits, summary: null };
}
