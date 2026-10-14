import {
  ArrowLeftRight,
  ArrowRight,
  Bridge,
  Eraser,
  MousePointer2,
  Plus,
  Route,
  TrainFront,
  TrafficCone,
  TrainTrack,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DrawTool } from "@/domain/editor";
import { useI18n } from "@/i18n/use-i18n";
import { useAppStore } from "@/state/use-app-store";

const GROUPS: { label: "roads" | "transit" | "junctions" | "editing"; tools: { id: DrawTool; icon: LucideIcon; shortcut: string }[] }[] = [
  {
    label: "roads",
    tools: [
      { id: "road", icon: ArrowLeftRight, shortcut: "1" },
      { id: "oneway", icon: ArrowRight, shortcut: "2" },
      { id: "highway", icon: Route, shortcut: "3" },
      { id: "street", icon: Waypoints, shortcut: "4" },
      { id: "bridge", icon: Bridge, shortcut: "5" },
    ],
  },
  {
    label: "transit",
    tools: [
      { id: "subway", icon: TrainFront, shortcut: "6" },
      { id: "railway", icon: TrainTrack, shortcut: "7" },
    ],
  },
  {
    label: "junctions",
    tools: [
      { id: "intersection", icon: Plus, shortcut: "8" },
      { id: "signal", icon: TrafficCone, shortcut: "9" },
    ],
  },
  {
    label: "editing",
    tools: [
      { id: "select", icon: MousePointer2, shortcut: "V" },
      { id: "eraser", icon: Eraser, shortcut: "E" },
    ],
  },
];

export function EditorToolbar() {
  const { copy } = useI18n();
  const tool = useAppStore((state) => state.editorTool);
  const setTool = useAppStore((state) => state.setEditorTool);
  const labels: Record<typeof GROUPS[number]["label"], string> = {
    roads: copy.toolRoads,
    transit: copy.toolTransit,
    junctions: copy.toolJunctions,
    editing: copy.toolEditing,
  };
  const names: Record<DrawTool, string> = {
    select: copy.toolSelect,
    road: copy.toolTwoWay,
    oneway: copy.toolOneWay,
    highway: copy.highway,
    street: copy.toolStreet,
    subway: copy.subway,
    railway: copy.toolRailway,
    bridge: copy.toolBridge,
    intersection: copy.toolIntersection,
    signal: copy.toolSignal,
    eraser: copy.toolEraser,
  };

  return (
    <div className="pointer-events-auto absolute top-16 right-3 z-10 flex w-9 flex-col gap-1.5">
      {GROUPS.map((group) => (
        <div key={group.label} className="flex w-9 flex-col gap-0.5 rounded-lg border border-border bg-background/95 p-1 shadow-sm">
          <p className="sr-only">{labels[group.label]}</p>
          {group.tools.map((item) => {
            const Icon = item.icon;
            const pressed = tool === item.id;
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <Button
                    size="icon-sm"
                    variant={pressed ? "default" : "ghost"}
                    aria-pressed={pressed}
                    aria-label={names[item.id]}
                    onClick={() => setTool(item.id)}
                  >
                    <Icon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  {names[item.id]} · {item.shortcut}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      ))}
    </div>
  );
}
