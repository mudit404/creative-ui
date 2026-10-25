/**
 * Procedural demo models for the 3D components. Built in memory with Three.js
 * primitives so the docs carry no licensed assets; a real product would load a
 * prepared GLB through `model={{ kind: "url", src }}`.
 */
import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, Object3D, SphereGeometry, TorusGeometry } from "three";
import type { PartDefinition } from "@/components/ui/exploded-product";

function mesh(name: string, geometry: BoxGeometry | CylinderGeometry | SphereGeometry | TorusGeometry, color: string, position: [number, number, number], opts: { closed?: boolean; transparent?: boolean; metalness?: number; roughness?: number } = {}): Mesh {
  const m = new Mesh(geometry, new MeshStandardMaterial({ color, metalness: opts.metalness ?? 0.15, roughness: opts.roughness ?? 0.6, transparent: !!opts.transparent, opacity: opts.transparent ? 0.35 : 1 }));
  m.name = name;
  m.position.set(...position);
  m.userData.closed = opts.closed ?? true;
  return m;
}

/** A 12-part desk speaker: nested "Body" group so parent-local offsets are exercised. */
export function buildSpeaker(): Object3D {
  const root = new Group();
  root.name = "Speaker";
  const body = new Group();
  body.name = "Body";
  body.add(
    mesh("Cabinet", new BoxGeometry(1.6, 2, 1.2), "#3d3a35", [0, 0, 0]),
    mesh("Baffle", new BoxGeometry(1.5, 1.9, 0.08), "#e9e5dc", [0, 0, 0.64]),
    mesh("Woofer", new CylinderGeometry(0.5, 0.42, 0.14, 32), "#141311", [0, -0.35, 0.72], { metalness: 0.3 }),
    mesh("Tweeter", new CylinderGeometry(0.2, 0.17, 0.1, 24), "#1d2a6b", [0, 0.6, 0.7], { metalness: 0.5, roughness: 0.3 }),
    mesh("Port", new CylinderGeometry(0.16, 0.16, 0.4, 20), "#5c6b73", [0, -0.75, -0.6]),
    mesh("Grille", new BoxGeometry(1.5, 1.9, 0.04), "#2b2b2b", [0, 0, 0.78], { transparent: true }),
  );
  body.children[2]!.rotation.x = Math.PI / 2;
  body.children[3]!.rotation.x = Math.PI / 2;
  body.children[4]!.rotation.x = Math.PI / 2;
  const base = new Group();
  base.name = "Base";
  base.position.set(0, -1.2, 0);
  base.add(mesh("Plinth", new BoxGeometry(1.8, 0.16, 1.4), "#b8b8b8", [0, 0, 0], { metalness: 0.6, roughness: 0.35 }), mesh("Foot L", new CylinderGeometry(0.1, 0.12, 0.12, 16), "#141311", [-0.7, -0.14, 0]), mesh("Foot R", new CylinderGeometry(0.1, 0.12, 0.12, 16), "#141311", [0.7, -0.14, 0]));
  root.add(body, base);
  root.add(mesh("Knob", new CylinderGeometry(0.12, 0.12, 0.1, 20), "#c8a000", [0.55, 0.95, 0.7], { metalness: 0.8, roughness: 0.3 }));
  root.children[2]!.rotation.x = Math.PI / 2;
  root.add(mesh("Badge", new BoxGeometry(0.3, 0.1, 0.02), "#ff4d1c", [-0.5, -0.85, 0.69]));
  root.add(mesh("Cable", new TorusGeometry(0.18, 0.025, 8, 24), "#141311", [0, -0.6, -0.75]));
  return root;
}

export const SPEAKER_PARTS: PartDefinition[] = [
  { id: "cabinet", nodePath: "Body/Cabinet", label: "Cabinet", description: "MDF enclosure, 12 mm walls.", offset: [0, 0, -0.9] },
  { id: "baffle", nodePath: "Body/Baffle", label: "Baffle", description: "Front board carrying both drivers.", offset: [0, 0, 0.4] },
  { id: "woofer", nodePath: "Body/Woofer", label: "Woofer", description: "4-inch paper cone.", offset: [0, 0, 1.2] },
  { id: "tweeter", nodePath: "Body/Tweeter", label: "Tweeter", description: "25 mm silk dome.", offset: [0, 0.3, 1.2] },
  { id: "port", nodePath: "Body/Port", label: "Bass port", description: "Rear-firing reflex port.", offset: [0, 0, -1.4] },
  { id: "grille", nodePath: "Body/Grille", label: "Grille", description: "Acoustic cloth on a magnetic frame.", offset: [0, 0, 2] },
  { id: "plinth", nodePath: "Base/Plinth", label: "Plinth", description: "Aluminium base plate.", offset: [0, -0.8, 0] },
  { id: "footl", nodePath: "Base/Foot L", label: "Left foot", offset: [-0.5, -1.2, 0] },
  { id: "footr", nodePath: "Base/Foot R", label: "Right foot", offset: [0.5, -1.2, 0] },
  { id: "knob", nodePath: "Knob", label: "Volume knob", description: "Machined brass.", offset: [0.8, 0.6, 0.8] },
  { id: "badge", nodePath: "Badge", label: "Badge", offset: [-0.8, -0.3, 0.9] },
  { id: "cable", nodePath: "Cable", label: "Cable loop", offset: [0, -0.2, -1.6] },
];

/** A closed layered box with real inner objects (cutaway fixture). */
export function buildLayeredBox(opts: { open?: boolean; glass?: boolean } = {}): Object3D {
  const root = new Group();
  root.name = "Layered box";
  root.add(mesh("Shell", new BoxGeometry(2.4, 1.6, 1.8), "#e9e5dc", [0, 0, 0], { closed: !opts.open, transparent: !!opts.glass }));
  root.add(mesh("Liner", new BoxGeometry(2, 1.2, 1.4), "#1d2a6b", [0, 0, 0]));
  root.add(mesh("Core", new SphereGeometry(0.42, 32, 24), "#ff4d1c", [-0.4, 0, 0]));
  root.add(mesh("Battery", new CylinderGeometry(0.22, 0.22, 0.9, 24), "#c8a000", [0.55, 0, 0.2], { metalness: 0.5 }));
  root.children[3]!.rotation.z = Math.PI / 2;
  root.add(mesh("Board", new BoxGeometry(1.2, 0.06, 0.8), "#1f7a4f", [0.1, -0.45, -0.2]));
  return root;
}

/** A lounge chair with three finish targets. */
export function buildChair(): Object3D {
  const root = new Group();
  root.name = "Chair";
  root.add(mesh("Shell", new BoxGeometry(1.8, 0.14, 1.6), "#b78d5a", [0, 0.5, 0], { roughness: 0.7 }));
  const back = mesh("Shell", new BoxGeometry(1.8, 1.3, 0.14), "#b78d5a", [0, 1.15, -0.72], { roughness: 0.7 });
  back.rotation.x = -0.18;
  root.add(back);
  root.add(mesh("Seat", new BoxGeometry(1.6, 0.18, 1.3), "#e9e5dc", [0, 0.66, 0.08], { roughness: 1 }));
  for (const [x, z] of [[-0.75, 0.6], [0.75, 0.6], [-0.75, -0.6], [0.75, -0.6]] as const) root.add(mesh("Trim", new CylinderGeometry(0.05, 0.05, 1, 12), "#c8a000", [x, 0, z], { metalness: 1, roughness: 0.3 }));
  root.add(mesh("Trim", new TorusGeometry(0.9, 0.03, 8, 40), "#c8a000", [0, 0.1, 0], { metalness: 1, roughness: 0.3 }));
  root.children[root.children.length - 1]!.rotation.x = Math.PI / 2;
  return root;
}

export function posterSvg(title: string, hue: number): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400' viewBox='0 0 600 400'><rect width='600' height='400' fill='hsl(${hue} 20% 90%)'/><rect x='200' y='110' width='200' height='180' rx='18' fill='hsl(${hue} 30% 55%)'/><text x='300' y='350' text-anchor='middle' font-family='ui-sans-serif,system-ui' font-size='22' fill='rgba(20,19,17,0.7)'>${title}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
