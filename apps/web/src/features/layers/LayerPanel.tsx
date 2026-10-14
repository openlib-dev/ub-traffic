import { CONGESTION_COLOR } from "@/domain/simulation";
import { satelliteConfigured } from "@/map/basemap";
import { ROAD_CLASS_LEGEND } from "@/map/road-style";
import { Switch } from "@/components/ui/switch";
import { cn } from "cn";
import type { BasemapId } from "@/state/use-app-store";
import { classLabel } from "@/i18n/catalog";
import { useI18n } from "@/i18n/use-i18n";
import { useAppStore } from "@/state/use-app-store";

export function LayerPanel() {
  const { locale, copy } = useI18n();
  const basemaps: { id: BasemapId; label: string }[] = [
    { id: "dark", label: copy.dark },
    { id: "light", label: copy.light },
    ...(satelliteConfigured ? [{ id: "satellite" as const, label: copy.satellite }] : []),
  ];
  const basemap = useAppStore((state) => state.basemap);
  const setBasemap = useAppStore((state) => state.setBasemap);
  const layers = useAppStore((state) => state.layers);
  const setLayer = useAppStore((state) => state.setLayer);
  const showCongestion = useAppStore((state) => state.runStatus === "ready" && state.frames.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h2 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          {copy.mapStyle}
        </h2>
        <div className={cn("grid gap-1 rounded-lg bg-muted p-1", basemaps.length > 2 ? "grid-cols-3" : "grid-cols-2")}>
          {basemaps.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={basemap === option.id}
              className={cn(
                "h-7 w-full rounded-md text-xs font-medium transition-colors",
                basemap === option.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setBasemap(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-1">
        <h2 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
          {copy.roadNetwork}
        </h2>
        <LayerToggle
          label={copy.arterials}
          detail={copy.arterialsDetail}
          checked={layers.arterials}
          onChange={(enabled) => setLayer("arterials", enabled)}
        />
        <LayerToggle
          label={copy.localStreets}
          detail={copy.localDetail}
          checked={layers.local}
          onChange={(enabled) => setLayer("local", enabled)}
        />
        <LayerToggle
          label={copy.serviceRoads}
          detail={copy.serviceDetail}
          checked={layers.service}
          onChange={(enabled) => setLayer("service", enabled)}
        />
      </section>

      {showCongestion ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            {copy.congestion}
          </h2>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {(
              [
                [copy.free, CONGESTION_COLOR.free],
                [copy.moderate, CONGESTION_COLOR.moderate],
                [copy.heavy, CONGESTION_COLOR.heavy],
                [copy.severe, CONGESTION_COLOR.severe],
              ] as const
            ).map(([label, color]) => (
              <li key={label} className="flex items-center gap-2 text-xs text-foreground">
                <span className="h-1.5 w-5 rounded-full" style={{ backgroundColor: color }} />
                {label}
              </li>
            ))}
          </ul>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {copy.congestionNote}
          </p>
        </section>
      ) : (
        <section className="flex flex-col gap-2">
          <h2 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            {copy.roadClass}
          </h2>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {ROAD_CLASS_LEGEND.map((item) => (
              <li key={item.label} className="flex items-center gap-2 text-xs text-foreground">
                <span className="h-1.5 w-5 rounded-full" style={{ backgroundColor: item.color }} />
                {classLabel(locale, item.label)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function LayerToggle({
  label,
  detail,
  checked,
  onChange,
}: {
  label: string;
  detail: string;
  checked: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5">
      <span className="min-w-0">
        <span className="block text-sm">{label}</span>
        <span className="block text-xs leading-snug text-muted-foreground">{detail}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}
