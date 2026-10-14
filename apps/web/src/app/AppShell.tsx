import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { describeSimulation } from "@/domain/simulation";
import { CitySearch } from "@/features/city-search/CitySearch";
import { LayerPanel } from "@/features/layers/LayerPanel";
import { RoadInspector } from "@/features/road-inspector/RoadInspector";
import { PlaybackBar } from "@/features/simulation/PlaybackBar";
import { SimulationPanel } from "@/features/simulation/SimulationPanel";
import { useSimulation } from "@/features/simulation/use-simulation";
import { MapView } from "@/map/MapView";
import { applyDocumentLocale, useI18n } from "@/i18n/use-i18n";
import { useAppStore } from "@/state/use-app-store";

const MIN_WIDTH = 220;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 320;

type Drag = {
  pointerId: number;
  originX: number;
  originY: number;
  offsetX: number;
  offsetY: number;
  moved: boolean;
};

export function AppShell() {
  useSimulation();
  const { locale, setLocale, copy, show } = useI18n();
  const cityLabel = useAppStore((state) => state.cityLabel);
  const zoom = useAppStore((state) => state.camera.zoom);
  const loadedCount = useAppStore((state) => state.roads.length);
  const statusLine = useAppStore((state) =>
    describeSimulation({
      runStatus: state.runStatus,
      timestamp: state.runStatus === "ready" ? state.frames[state.frameIndex]?.timestamp : null,
      progressMessage: state.progressMessage,
    }),
  );
  useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);
  const shellRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const floating = position !== null;

  function clampPosition(x: number, y: number) {
    const shell = shellRef.current?.getBoundingClientRect();
    const panel = panelRef.current?.getBoundingClientRect();
    if (!shell || !panel) return { x, y };
    const maxX = Math.max(0, shell.width - 48);
    const maxY = Math.max(0, shell.height - 48);
    return {
      x: Math.min(maxX, Math.max(0, x)),
      y: Math.min(maxY, Math.max(0, y)),
    };
  }

  function onHeaderPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const shell = shellRef.current?.getBoundingClientRect();
    const panel = panelRef.current?.getBoundingClientRect();
    if (!shell || !panel) return;
    dragRef.current = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      offsetX: event.clientX - panel.left,
      offsetY: event.clientY - panel.top,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onHeaderPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const shell = shellRef.current?.getBoundingClientRect();
    if (!drag || drag.pointerId !== event.pointerId || !shell) return;
    const distance = Math.hypot(event.clientX - drag.originX, event.clientY - drag.originY);
    if (!drag.moved && distance < 4) return;
    drag.moved = true;
    if (position) {
      setPosition(
        clampPosition(event.clientX - shell.left - drag.offsetX, event.clientY - shell.top - drag.offsetY),
      );
      return;
    }
    setDragOffset({ x: event.clientX - drag.originX, y: event.clientY - drag.originY });
  }

  function onHeaderPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!drag.moved) return;
    const shell = shellRef.current?.getBoundingClientRect();
    if (!shell) return;
    const next = clampPosition(event.clientX - shell.left - drag.offsetX, event.clientY - shell.top - drag.offsetY);
    setDragOffset(null);
    setPosition(next.x < 24 && next.y < 24 ? null : next);
  }

  function onResizePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = width;
    function move(next: PointerEvent) {
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + next.clientX - startX)));
    }
    function up() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const panel = (
    <aside
      ref={panelRef}
      className={
        floating
          ? "absolute z-20 flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg"
          : "relative order-2 flex min-h-0 flex-col border-t border-border bg-background min-[900px]:order-1 min-[900px]:border-t-0 min-[900px]:border-r"
      }
      style={{
        ...(floating ? { left: position.x, top: position.y, width, maxHeight: `calc(100% - ${position.y}px - 0.5rem)` } : {}),
        ...(dragOffset ? { transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`, zIndex: 30 } : {}),
      }}
    >
      <div
        className="flex cursor-grab touch-none items-start gap-2 border-b border-border px-4 py-3 active:cursor-grabbing"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerUp}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">{copy.urbanNetwork}</p>
          <h1 className="mt-1 text-lg leading-tight font-medium">{copy.appTitle}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{copy.osmNetwork}</p>
        </div>
        <div className="flex shrink-0 gap-1" role="group" aria-label={copy.language}>
          {(["mn", "en"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={locale === option}
              className={
                locale === option
                  ? "rounded-md bg-foreground px-1.5 py-0.5 text-[11px] font-medium text-background"
                  : "rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground"
              }
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setLocale(option)}
            >
              {option === "mn" ? "МН" : "EN"}
            </button>
          ))}
        </div>
      </div>
      <div className="px-4 py-3">
        <CitySearch />
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 px-4 pb-4">
          <SimulationPanel />
          <LayerPanel />
        </div>
      </ScrollArea>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={copy.resizePanel}
        className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize"
        onPointerDown={onResizePointerDown}
      />
    </aside>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={shellRef} className="relative flex min-h-0 flex-1 flex-col">
      <div
        className={
          floating
            ? "grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,30dvh)] min-[900px]:grid-cols-[minmax(0,1fr)_300px] min-[900px]:grid-rows-1"
            : "grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,34dvh)_minmax(0,30dvh)] min-[900px]:grid-cols-[var(--side-width)_minmax(0,1fr)_300px] min-[900px]:grid-rows-1"
        }
        style={{ "--side-width": `${width}px` } as React.CSSProperties}
      >
        {floating ? null : panel}

        <main className="order-1 min-h-0 min-[900px]:order-2">
          <MapView />
        </main>

        <aside className="order-3 min-h-0 overflow-auto border-t border-border bg-background min-[900px]:border-t-0 min-[900px]:border-l">
          <RoadInspector />
        </aside>
      </div>
      {floating ? panel : null}
      </div>

      <footer className="shrink-0 border-t border-border bg-background">
        <PlaybackBar />
        <div className="flex h-9 items-center gap-x-4 gap-y-1 px-3 text-xs text-muted-foreground">
          <span className="truncate text-foreground">{show(cityLabel)}</span>
          <span className="hidden sm:inline">{copy.loaded(loadedCount.toLocaleString(locale === "mn" ? "mn-MN" : "en"))}</span>
          <span>z{zoom.toFixed(1)}</span>
          <span className="ml-auto shrink-0">{show(statusLine)}</span>
        </div>
      </footer>
    </div>
  );
}
