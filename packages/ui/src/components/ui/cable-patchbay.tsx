"use client";

import * as React from "react";
import { motion as m, useMotionValue, useSpring, useTransform } from "motion/react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cablePath, nearestWithin, portMap, validateCandidate, validateConnections, type Candidate, type Connection, type Point, type Port, type Verdict } from "@/lib/patch-graph";
import { createRequestId, matchResolution, type Resolution } from "@/lib/transactions";

export type { Connection, Port, Verdict } from "@/lib/patch-graph";
export type { Resolution } from "@/lib/transactions";

export interface PatchModule {
  id: string;
  label: string;
}

export type ConnectSource = "pointer" | "tap" | "keyboard" | "list";

export interface ConnectIntent {
  requestId: string;
  sourcePortId: string;
  targetPortId: string;
  source: ConnectSource;
}
export interface ReconnectIntent extends ConnectIntent {
  connectionId: string;
}
export interface DisconnectIntent {
  requestId: string;
  connectionId: string;
  source: "list" | "cable";
}

export interface CablePatchbayHandle {
  root: HTMLDivElement | null;
  focusPort: (id: string) => void;
}

export interface CablePatchbayProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  ports: readonly Port[];
  /** Module labels; derived from port nodeIds when omitted. */
  modules?: readonly PatchModule[];
  connections?: readonly Connection[];
  /** Host rule run after structural checks (types, duplicates, capacity). */
  validateConnection?: (candidate: Candidate, ctx: { source: Port; target: Port; connections: readonly Connection[] }) => boolean | Verdict;
  onConnectRequest?: (intent: ConnectIntent) => void;
  onReconnectRequest?: (intent: ReconnectIntent) => void;
  onDisconnectRequest?: (intent: DisconnectIntent) => void;
  /** Settles the pending request by id; stale resolutions are ignored. */
  resolution?: Resolution | null;
  snapRadius?: number;
  /** Fraction of the endpoint distance added as sag. */
  cableSlack?: number;
  maxSlackPx?: number;
  maxConnectionsPerInput?: number;
  variant?: "patch" | "mapping" | "lesson";
  renderPort?: (port: Port, state: { connected: boolean; eligible: boolean; invalidReason?: string }) => React.ReactNode;
  renderConnectionLabel?: (c: Connection, source: Port, target: Port) => React.ReactNode;
  label?: string;
  motion?: "auto" | "reduced" | "off";
}

interface Geometry {
  [portId: string]: Point;
}

type Pending = { requestId: string; kind: "connect" | "reconnect" | "disconnect"; sourcePortId?: string; targetPortId?: string; connectionId?: string };

/**
 * CablePatchbay — connect typed output ports to input ports with cables.
 *
 * Modules and ports are DOM controls; cables are an SVG overlay measured from
 * the ports. Connecting works by drag, by two taps, by keyboard and from a
 * text list, all producing the same intent. Candidates are validated with a
 * reason before any request; the host owns the connections and settles each
 * request by id. Elastic lag on the free cable end is decoration only.
 */
export const CablePatchbay = React.forwardRef<CablePatchbayHandle, CablePatchbayProps>(function CablePatchbay(
  {
    ports,
    modules,
    connections = [],
    validateConnection,
    onConnectRequest,
    onReconnectRequest,
    onDisconnectRequest,
    resolution = null,
    snapRadius = 24,
    cableSlack = 0.18,
    maxSlackPx = 120,
    maxConnectionsPerInput = 1,
    variant = "patch",
    renderPort,
    renderConnectionLabel,
    label = "Patchbay",
    motion = "auto",
    className,
    ...rest
  },
  ref,
) {
  const prefersReduced = useReducedMotion();
  const mode: "full" | "reduced" | "off" = motion === "off" ? "off" : motion === "reduced" || prefersReduced ? "reduced" : "full";

  /* data */
  const map = React.useMemo(() => portMap(ports), [ports]);
  const { valid: edges, diagnostics } = React.useMemo(() => validateConnections(ports, connections, { maxConnectionsPerInput }), [ports, connections, maxConnectionsPerInput]);
  const mods = React.useMemo<PatchModule[]>(() => {
    if (modules) return [...modules];
    const seen = new Map<string, PatchModule>();
    for (const p of ports) if (!seen.has(p.nodeId)) seen.set(p.nodeId, { id: p.nodeId, label: p.nodeId });
    return [...seen.values()];
  }, [modules, ports]);
  const outputs = ports.filter((p) => p.direction === "output");
  const inputs = ports.filter((p) => p.direction === "input");
  const vopts = React.useMemo(() => ({ maxConnectionsPerInput, custom: validateConnection }), [maxConnectionsPerInput, validateConnection]);
  const check = (c: Candidate): Verdict => validateCandidate(map, edges, c, vopts);

  /* transaction + gesture state */
  const [connecting, setConnecting] = React.useState<{ sourcePortId: string; replaceConnectionId?: string } | null>(null);
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [hoverId, setHoverId] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<{ text: string; error?: boolean }>({ text: "" });
  const [handled, setHandled] = React.useState<string | null>(null);
  if (resolution && resolution.requestId !== handled) {
    setHandled(resolution.requestId);
    const match = matchResolution(resolution, pending?.requestId ?? null);
    if (pending && match === "accepted") {
      setPending(null);
      setNotice({ text: pending.kind === "disconnect" ? "Disconnected." : pending.kind === "reconnect" ? "Reconnected." : `Connected ${map.get(pending.sourcePortId!)?.label ?? ""} to ${map.get(pending.targetPortId!)?.label ?? ""}.` });
    } else if (pending && match === "rejected") {
      setPending(null);
      setNotice({ text: resolution.message ?? "The request was not accepted.", error: true }); // original edge untouched (C45-T03)
    }
  }

  /* geometry */
  const rootRef = React.useRef<HTMLDivElement>(null);
  const socketRefs = React.useRef(new Map<string, HTMLElement>());
  const [geom, setGeom] = React.useState<Geometry>({});
  const measure = React.useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const rr = root.getBoundingClientRect();
    const next: Geometry = {};
    for (const [id, el] of socketRefs.current) {
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      next[id] = { x: r.left - rr.left + r.width / 2 + root.scrollLeft, y: r.top - rr.top + r.height / 2 + root.scrollTop };
    }
    setGeom((prev) => {
      const keys = Object.keys(next);
      if (keys.length === Object.keys(prev).length && keys.every((k) => prev[k] && prev[k]!.x === next[k]!.x && prev[k]!.y === next[k]!.y)) return prev;
      return next;
    });
  }, []);
  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => measure());
      ro.observe(root);
      for (const el of socketRefs.current.values()) ro.observe(el);
    }
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [measure, ports]);

  /* drag */
  const pointer = useMotionValue<Point>({ x: 0, y: 0 });
  const fx = useMotionValue(0);
  const fy = useMotionValue(0);
  const sx = useSpring(fx, { stiffness: 900, damping: 40 }); // ≤ ~8px lag at pointer speed
  const sy = useSpring(fy, { stiffness: 900, damping: 40 });
  const drag = React.useRef<{ pointerId: number; el: HTMLElement; sourcePortId: string; startX: number; startY: number; lifted: boolean; snapped: string | null; verdict: Verdict | null } | null>(null);
  const [dragView, setDragView] = React.useState<{ sourcePortId: string; snapped: string | null; verdict: Verdict | null } | null>(null);
  const endDrag = () => {
    const d = drag.current;
    if (!d) return;
    try {
      d.el.releasePointerCapture(d.pointerId);
    } catch {
      /* not captured */
    }
    drag.current = null;
    setDragView(null);
  };
  const toLocal = (clientX: number, clientY: number): Point => {
    const rr = rootRef.current?.getBoundingClientRect();
    return { x: clientX - (rr?.left ?? 0), y: clientY - (rr?.top ?? 0) };
  };
  const eligibleSockets = (sourcePortId: string, replaceConnectionId?: string) =>
    inputs.filter((p) => geom[p.id]).map((p) => ({ id: p.id, point: geom[p.id]!, verdict: check({ sourcePortId, targetPortId: p.id, replaceConnectionId }) }));

  const onOutputPointerDown = (port: Port) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || pending) return;
    if (!Object.keys(geom).length) measure();
    const el = e.currentTarget;
    drag.current = { pointerId: e.pointerId, el, sourcePortId: port.id, startX: e.clientX, startY: e.clientY, lifted: false, snapped: null, verdict: null };
  };
  const onOutputPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (!d.lifted) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 6) return;
      d.lifted = true;
      d.el.setPointerCapture(e.pointerId);
      setConnecting({ sourcePortId: d.sourcePortId });
      const start = geom[d.sourcePortId];
      if (start) {
        fx.jump(start.x);
        fy.jump(start.y);
      }
    }
    const p = toLocal(e.clientX, e.clientY);
    const near = nearestWithin(p, eligibleSockets(d.sourcePortId), snapRadius);
    d.snapped = near?.id ?? null;
    d.verdict = near?.verdict ?? null;
    const target = near && near.verdict.allowed ? near.point : p;
    pointer.set(p);
    if (mode === "full") {
      fx.set(target.x);
      fy.set(target.y);
    } else {
      fx.jump(target.x);
      fy.jump(target.y);
    }
    setDragView({ sourcePortId: d.sourcePortId, snapped: d.snapped, verdict: d.verdict });
  };
  const onOutputPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const { lifted, snapped, verdict, sourcePortId } = d;
    endDrag();
    if (!lifted) return; // a tap: the click handler toggles connect mode
    if (snapped && verdict?.allowed) request({ sourcePortId, targetPortId: snapped }, "pointer");
    else {
      setConnecting(null);
      if (snapped && verdict && !verdict.allowed) setNotice({ text: verdict.reason ?? "Not allowed.", error: true });
    }
  };
  const onOutputPointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    endDrag();
    setConnecting(null);
  };

  /* requests */
  const request = (c: { sourcePortId: string; targetPortId: string }, source: ConnectSource, replaceConnectionId?: string) => {
    if (pending) return; // one request at a time (C45-T06)
    const v = check({ ...c, replaceConnectionId });
    if (!v.allowed) {
      setNotice({ text: v.reason ?? "Not allowed.", error: true });
      return;
    }
    const requestId = createRequestId(replaceConnectionId ? "reconnect" : "connect");
    setConnecting(null);
    setNotice({ text: "Connecting…" });
    if (replaceConnectionId) {
      setPending({ requestId, kind: "reconnect", ...c, connectionId: replaceConnectionId });
      onReconnectRequest?.({ requestId, connectionId: replaceConnectionId, ...c, source });
    } else {
      setPending({ requestId, kind: "connect", ...c });
      onConnectRequest?.({ requestId, ...c, source });
    }
  };
  const disconnect = (connectionId: string, source: "list" | "cable") => {
    if (pending) return;
    const requestId = createRequestId("disconnect");
    setPending({ requestId, kind: "disconnect", connectionId });
    setNotice({ text: "Disconnecting…" });
    setSelectedId(null);
    onDisconnectRequest?.({ requestId, connectionId, source });
  };
  const cancel = () => {
    endDrag();
    setConnecting(null);
    setNotice({ text: "" });
  };

  /* a removed source port cancels the gesture; unrelated edges stay (C45-T04) */
  const sourceId = connecting?.sourcePortId ?? null;
  const [seenPortsKey, setSeenPortsKey] = React.useState("");
  const portsKey = ports.map((p) => p.id).join("\u0000");
  if (portsKey !== seenPortsKey) {
    setSeenPortsKey(portsKey);
    if (sourceId && !map.has(sourceId)) {
      setConnecting(null);
      setDragView(null);
      setNotice({ text: "The source port was removed; the connection was cancelled." });
    }
    if (pending?.sourcePortId && !map.has(pending.sourcePortId)) setPending(null);
  }
  React.useEffect(() => {
    if (drag.current && !map.has(drag.current.sourcePortId)) endDrag();
  });
  React.useEffect(() => () => endDrag(), []);

  /* keyboard */
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && (connecting || drag.current)) {
      e.stopPropagation();
      cancel();
    }
  };
  const portRefs = React.useRef(new Map<string, HTMLButtonElement>());
  React.useImperativeHandle(ref, () => ({ root: rootRef.current, focusPort: (id) => portRefs.current.get(id)?.focus() }), []);

  /* derived */
  const uid = React.useId();
  const connectedPortIds = new Set(edges.flatMap((c) => [c.sourcePortId, c.targetPortId]));
  const activeSource = dragView?.sourcePortId ?? connecting?.sourcePortId ?? null;
  const verdictFor = (inputId: string): Verdict | null => (activeSource ? check({ sourcePortId: activeSource, targetPortId: inputId, replaceConnectionId: connecting?.replaceConnectionId }) : null);
  const pathFor = (a: Point, b: Point) => cablePath(a, b, { slack: cableSlack, maxSlackPx, style: variant === "mapping" ? "mapping" : "patch" });
  const tempD = useTransform([sx, sy], ([x, y]) => {
    const a = activeSource ? geom[activeSource] : null;
    return a ? pathFor(a, { x: x as number, y: y as number }) : "";
  });
  const pendingPath = pending?.sourcePortId && pending.targetPortId && geom[pending.sourcePortId] && geom[pending.targetPortId] ? pathFor(geom[pending.sourcePortId]!, geom[pending.targetPortId]!) : null;

  const onOutputClick = (port: Port) => {
    if (pending) return;
    if (connecting?.sourcePortId === port.id) {
      cancel();
      return;
    }
    if (!Object.keys(geom).length) measure();
    setConnecting({ sourcePortId: port.id });
    setNotice({ text: `Connecting from ${port.label} (${port.dataType}). Choose an input.` });
  };
  const onInputClick = (port: Port, viaKeyboard: boolean) => {
    if (!connecting) return;
    request({ sourcePortId: connecting.sourcePortId, targetPortId: port.id }, viaKeyboard ? "keyboard" : "tap", connecting.replaceConnectionId);
  };

  const renderPortButton = (port: Port) => {
    const isOutput = port.direction === "output";
    const connected = connectedPortIds.has(port.id);
    const verdict = !isOutput ? verdictFor(port.id) : null;
    const eligible = !!verdict?.allowed;
    const invalid = !!verdict && !verdict.allowed;
    const isSource = activeSource === port.id;
    const describedBy = invalid ? `${uid}-why-${port.id}` : undefined;
    return (
      <li key={port.id} className="list-none">
        <button
          ref={(el) => {
            if (el) portRefs.current.set(port.id, el);
            else portRefs.current.delete(port.id);
          }}
          type="button"
          data-port={port.id}
          data-direction={port.direction}
          data-type={port.dataType}
          data-connected={connected || undefined}
          data-eligible={eligible || undefined}
          data-invalid={invalid || undefined}
          data-source={isSource || undefined}
          data-snapped={dragView?.snapped === port.id || undefined}
          aria-pressed={isOutput ? isSource : undefined}
          aria-label={`${port.label} (${port.dataType} ${port.direction})${connected ? ", connected" : ""}`}
          aria-describedby={describedBy}
          aria-disabled={!!pending || undefined}
          onPointerDown={isOutput ? onOutputPointerDown(port) : undefined}
          onPointerMove={isOutput ? onOutputPointerMove : undefined}
          onPointerUp={isOutput ? onOutputPointerUp : undefined}
          onPointerCancel={isOutput ? onOutputPointerCancel : undefined}
          onLostPointerCapture={isOutput ? onOutputPointerCancel : undefined}
          onClick={(e) => (isOutput ? onOutputClick(port) : onInputClick(port, e.detail === 0))}
          className={cn(
            "flex min-h-[44px] w-full touch-none items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--cui-patch-focus,light-dark(#141311,#ecebe6))]",
            !isOutput && "flex-row-reverse text-right",
            isSource && "bg-[light-dark(rgba(20,19,17,0.08),rgba(236,235,230,0.08))]",
            eligible && "bg-[light-dark(rgba(26,107,69,0.15),rgba(95,207,143,0.2))]",
            invalid && "opacity-60",
          )}
        >
          <span
            ref={(el) => {
              if (el) socketRefs.current.set(port.id, el);
              else socketRefs.current.delete(port.id);
            }}
            aria-hidden
            data-socket
            className={cn(
              "grid size-[22px] shrink-0 place-items-center rounded-full",
              eligible ? "ring-2 ring-[var(--cui-cable-active,light-dark(#1a6b45,#5fcf8f))]" : invalid ? "ring-2 ring-[var(--cui-port-invalid,light-dark(#b8310c,#ff8a65))]" : "",
            )}
          >
            <span className={cn("block size-[10px] rounded-full border-2", connected || isSource ? "border-[var(--cui-port-fill,light-dark(#141311,#ecebe6))] bg-[var(--cui-port-fill,light-dark(#141311,#ecebe6))]" : "border-[var(--cui-port-fill,light-dark(#141311,#ecebe6))] bg-[var(--cui-patch-background,light-dark(#faf9f6,#1f1f1c))]")} />
          </span>
          {renderPort ? renderPort(port, { connected, eligible, invalidReason: verdict && !verdict.allowed ? verdict.reason : undefined }) : (
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{port.label}</span>
              <span className="block font-mono text-[10px] uppercase tracking-wide text-[light-dark(rgba(20,19,17,0.65),rgba(236,235,230,0.65))]">{port.dataType}</span>
            </span>
          )}
        </button>
        {invalid && (
          <span id={describedBy} className="sr-only">
            {verdict!.reason}
          </span>
        )}
      </li>
    );
  };

  const module = (mod: PatchModule, side: "left" | "right") => {
    const list = (side === "left" ? outputs : inputs).filter((p) => p.nodeId === mod.id);
    if (!list.length) return null;
    return (
      <section key={`${side}-${mod.id}`} aria-label={mod.label} data-module={mod.id} className="rounded-xl border border-[var(--cui-patch-border,light-dark(rgba(20,19,17,0.15),rgba(236,235,230,0.15)))] bg-[var(--cui-patch-module,light-dark(rgba(20,19,17,0.03),rgba(236,235,230,0.03)))] p-2">
        <h3 className="m-0 mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide opacity-70">{mod.label}</h3>
        <ul className="m-0 flex flex-col gap-0.5 p-0">{list.map(renderPortButton)}</ul>
      </section>
    );
  };

  const hovered = hoverId ? edges.find((c) => c.id === hoverId) : null;
  const hoveredMid = hovered && geom[hovered.sourcePortId] && geom[hovered.targetPortId] ? { x: (geom[hovered.sourcePortId]!.x + geom[hovered.targetPortId]!.x) / 2, y: (geom[hovered.sourcePortId]!.y + geom[hovered.targetPortId]!.y) / 2 + 10 } : null;

  return (
    <div
      ref={rootRef}
      data-slot="cable-patchbay"
      data-variant={variant}
      data-motion={mode}
      data-state={pending ? "pending" : dragView ? "dragging" : connecting ? "connecting" : "idle"}
      role="group"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("relative flex w-full flex-col gap-4 text-[var(--cui-patch-text,light-dark(#141311,#ecebe6))]", className)}
      {...rest}
    >
      {/* board */}
      {/* the board grows with its modules (a fixed 720×420 aspect would let modules overflow the cable overlay) */}
      <div className="relative grid min-h-[200px] grid-cols-1 gap-3 rounded-2xl bg-[var(--cui-patch-background,light-dark(#faf9f6,#1f1f1c))] p-3 sm:grid-cols-[1fr_minmax(48px,0.6fr)_1fr] sm:gap-0">
        <div className="flex flex-col gap-3" data-side="outputs">
          {mods.map((mod) => module(mod, "left"))}
        </div>
        <div className="hidden sm:block" aria-hidden />
        <div className="flex flex-col gap-3" data-side="inputs">
          {mods.map((mod) => module(mod, "right"))}
        </div>
        {/* cable overlay: semantics live in the list, not here */}
        <svg aria-hidden className="pointer-events-none absolute inset-0 size-full overflow-visible" data-cables>
          {edges.map((c) => {
            const a = geom[c.sourcePortId];
            const b = geom[c.targetPortId];
            if (!a || !b) return null;
            const isSel = selectedId === c.id;
            const isHover = hoverId === c.id;
            const replacing = pending?.kind === "reconnect" && pending.connectionId === c.id;
            return (
              <g key={c.id} data-cable={c.id} data-selected={isSel || undefined} className="pointer-events-auto">
                <path d={pathFor(a, b)} fill="none" stroke="transparent" strokeWidth={14} className="cursor-pointer" onPointerEnter={() => setHoverId(c.id)} onPointerLeave={() => setHoverId((h) => (h === c.id ? null : h))} onClick={() => setSelectedId((s) => (s === c.id ? null : c.id))} />
                <path d={pathFor(a, b)} fill="none" stroke={isSel || isHover ? "var(--cui-cable-active, light-dark(#1a6b45, #5fcf8f))" : "var(--cui-cable-stroke, light-dark(#141311, #ecebe6))"} strokeWidth={isSel ? 4 : 3} strokeDasharray={isSel ? "8 4" : replacing ? "2 4" : undefined} strokeLinecap="round" opacity={isHover || isSel ? 1 : 0.75} />
                <circle cx={a.x} cy={a.y} r={5} fill="var(--cui-cable-stroke, light-dark(#141311, #ecebe6))" />
                <circle cx={b.x} cy={b.y} r={5} fill="var(--cui-cable-stroke, light-dark(#141311, #ecebe6))" />
              </g>
            );
          })}
          {pendingPath && <path data-pending-cable d={pendingPath} fill="none" stroke="var(--cui-cable-active, light-dark(#1a6b45, #5fcf8f))" strokeWidth={3} strokeDasharray="6 6" strokeLinecap="round" />}
          {dragView && <m.path data-temp-cable d={tempD} fill="none" stroke="var(--cui-cable-active, light-dark(#1a6b45, #5fcf8f))" strokeWidth={3} strokeLinecap="round" strokeDasharray={dragView.snapped && dragView.verdict?.allowed ? undefined : "6 6"} />}
        </svg>
        {hoveredMid && hovered && !pending && (
          <button type="button" aria-label={`Disconnect ${map.get(hovered.sourcePortId)?.label} from ${map.get(hovered.targetPortId)?.label}`} onPointerEnter={() => setHoverId(hovered.id)} onClick={() => disconnect(hovered.id, "cable")} className="absolute z-10 -translate-x-1/2 rounded-full bg-[var(--cui-cable-active,light-dark(#1a6b45,#5fcf8f))] px-2 py-0.5 text-[11px] font-medium text-[light-dark(#ffffff,#121210)] shadow" style={{ left: hoveredMid.x, top: hoveredMid.y }}>
            Disconnect
          </button>
        )}
      </div>

      {/* status */}
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <div role="status" aria-live="polite" className={cn("min-h-[1.5rem] flex-1", notice.error ? "text-[var(--cui-port-invalid,light-dark(#b8310c,#ff8a65))]" : "opacity-80")}>
          {dragView ? (dragView.snapped ? (dragView.verdict?.allowed ? `Release to connect to ${map.get(dragView.snapped)?.label}.` : `Cannot connect: ${dragView.verdict?.reason}`) : "Drag to an input.") : notice.text}
        </div>
        {(connecting || dragView) && (
          <button type="button" onClick={cancel} className={BTN}>
            Cancel
          </button>
        )}
      </div>

      {/* functional equivalent: the connection list and a no-drag connect form */}
      <div className="grid gap-3 sm:grid-cols-2">
        <section aria-labelledby={`${uid}-list-h`} className="min-w-0">
          <h3 id={`${uid}-list-h`} className="m-0 mb-1 text-[12px] font-semibold uppercase tracking-wide opacity-70">
            Connections ({edges.length})
          </h3>
          <ul aria-label="Connections" className="m-0 flex list-none flex-col gap-1 p-0 text-[13px]">
            {edges.length === 0 && <li className="text-[light-dark(rgba(20,19,17,0.65),rgba(236,235,230,0.65))]">None yet.</li>}
            {edges.map((c) => {
              const s = map.get(c.sourcePortId)!;
              const t = map.get(c.targetPortId)!;
              const isSel = selectedId === c.id;
              const alternatives = inputs.filter((p) => p.id !== c.targetPortId && check({ sourcePortId: c.sourcePortId, targetPortId: p.id, replaceConnectionId: c.id }).allowed);
              return (
                <li key={c.id} data-connection={c.id} className={cn("flex flex-wrap items-center gap-2 rounded-lg px-2 py-1", isSel && "bg-[light-dark(rgba(26,107,69,0.15),rgba(95,207,143,0.2))]")}>
                  <button type="button" aria-pressed={isSel} onClick={() => setSelectedId(isSel ? null : c.id)} className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--cui-patch-focus,light-dark(#141311,#ecebe6))]">
                    {renderConnectionLabel ? renderConnectionLabel(c, s, t) : <span>{s.label} → {t.label}</span>}
                  </button>
                  {isSel && onReconnectRequest && alternatives.length > 0 && (
                    <ReconnectControl alternatives={alternatives} disabled={!!pending} onReconnect={(targetId) => request({ sourcePortId: c.sourcePortId, targetPortId: targetId }, "list", c.id)} />
                  )}
                  <button type="button" aria-label={`Disconnect ${s.label} from ${t.label}`} disabled={!!pending} onClick={() => disconnect(c.id, "list")} className={BTN}>
                    Disconnect
                  </button>
                </li>
              );
            })}
          </ul>
          {diagnostics.length > 0 && (
            <div role="note" className="mt-2 rounded-lg border border-[var(--cui-port-invalid,light-dark(#b8310c,#ff8a65))] p-2 text-[12px] text-[var(--cui-port-invalid,light-dark(#b8310c,#ff8a65))]">
              <strong>{diagnostics.length} invalid connection{diagnostics.length === 1 ? "" : "s"} not drawn:</strong>
              <ul className="m-0 mt-1 list-disc pl-4">
                {diagnostics.map((d) => (
                  <li key={d.connectionId}>
                    {d.connectionId}: {d.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
        <ConnectForm outputs={outputs} inputs={inputs} check={check} disabled={!!pending} onConnect={(s, t) => request({ sourcePortId: s, targetPortId: t }, "list")} uid={uid} />
      </div>
    </div>
  );
});
CablePatchbay.displayName = "CablePatchbay";

const BTN =
  "inline-flex h-7 items-center rounded-full border border-[var(--cui-patch-control-border,light-dark(rgba(20,19,17,0.5),rgba(236,235,230,0.45)))] px-2.5 text-[12px] outline-none hover:bg-[light-dark(rgba(20,19,17,0.06),rgba(236,235,230,0.06))] focus-visible:ring-2 focus-visible:ring-[var(--cui-patch-focus,light-dark(#141311,#ecebe6))] disabled:cursor-not-allowed disabled:opacity-40";
const SELECT = "h-7 rounded-md border border-[var(--cui-patch-control-border,light-dark(rgba(20,19,17,0.5),rgba(236,235,230,0.45)))] bg-transparent px-1 text-[12px]";

function ReconnectControl({ alternatives, disabled, onReconnect }: { alternatives: Port[]; disabled: boolean; onReconnect: (targetId: string) => void }) {
  const [to, setTo] = React.useState(alternatives[0]!.id);
  const current = alternatives.some((p) => p.id === to) ? to : alternatives[0]!.id;
  return (
    <span className="flex items-center gap-1">
      <select aria-label="Reconnect to" value={current} onChange={(e) => setTo(e.target.value)} disabled={disabled} className={SELECT}>
        {alternatives.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      <button type="button" disabled={disabled} onClick={() => onReconnect(current)} className={BTN}>
        Reconnect
      </button>
    </span>
  );
}

function ConnectForm({ outputs, inputs, check, disabled, onConnect, uid }: { outputs: Port[]; inputs: Port[]; check: (c: Candidate) => Verdict; disabled: boolean; onConnect: (s: string, t: string) => void; uid: string }) {
  const [s, setS] = React.useState(outputs[0]?.id ?? "");
  const [t, setT] = React.useState(inputs[0]?.id ?? "");
  const source = outputs.some((p) => p.id === s) ? s : (outputs[0]?.id ?? "");
  const target = inputs.some((p) => p.id === t) ? t : (inputs[0]?.id ?? "");
  const verdict = source && target ? check({ sourcePortId: source, targetPortId: target }) : { allowed: false, reason: "Choose two ports." };
  return (
    <form
      aria-labelledby={`${uid}-form-h`}
      className="flex flex-col gap-2 rounded-xl border border-[var(--cui-patch-border,light-dark(rgba(20,19,17,0.15),rgba(236,235,230,0.15)))] p-2 text-[13px]"
      onSubmit={(e) => {
        e.preventDefault();
        if (verdict.allowed) onConnect(source, target);
      }}
    >
      <h3 id={`${uid}-form-h`} className="m-0 text-[12px] font-semibold uppercase tracking-wide opacity-70">
        Connect without dragging
      </h3>
      <label className="flex items-center justify-between gap-2">
        <span>Source</span>
        <select aria-label="Source output" value={source} onChange={(e) => setS(e.target.value)} disabled={disabled} className={SELECT}>
          {outputs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label} ({p.dataType})
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center justify-between gap-2">
        <span>Target</span>
        <select aria-label="Target input" value={target} onChange={(e) => setT(e.target.value)} disabled={disabled} className={SELECT}>
          {inputs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label} ({p.dataType})
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center justify-between gap-2">
        <span className={cn("text-[12px]", verdict.allowed ? "text-[light-dark(rgba(20,19,17,0.65),rgba(236,235,230,0.65))]" : "text-[var(--cui-port-invalid,light-dark(#b8310c,#ff8a65))]")} data-form-verdict>
          {verdict.allowed ? "Ready" : verdict.reason}
        </span>
        <button type="submit" disabled={disabled || !verdict.allowed} className={cn(BTN, "bg-[var(--cui-patch-focus,light-dark(#141311,#ecebe6))] text-[var(--cui-patch-background,light-dark(#faf9f6,#1f1f1c))]")}>
          Connect
        </button>
      </div>
    </form>
  );
}
