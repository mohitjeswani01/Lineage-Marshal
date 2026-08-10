/**
 * WebGL lineage graph.
 *
 * Lazily imported — three.js only enters the bundle for users who actually
 * render a graph, and never for reduced-motion or no-WebGL sessions.
 *
 * Rendering budget (see design.md §9): node cores are one instanced mesh and
 * node glows are one point cloud, so node count costs two draw calls total.
 * Edges are individual `Line2`s because per-edge width and opacity are what
 * carry the hop-by-hop reveal, and at our 120-edge cap that stays cheap.
 * Nothing allocates inside `useFrame`.
 */
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ElementRef,
} from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Billboard, Html, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { graph, type GraphPalette } from '@/design';
import type { GraphEdge, GraphLayout, GraphNode } from './layout';

export type GraphPhase = 'idle' | 'running' | 'complete';

interface GraphSceneProps {
  layout: GraphLayout;
  palette: GraphPalette;
  phase: GraphPhase;
  /** Changes to restart the hop-by-hop reveal (new trigger, replayed run). */
  revealKey: string;
  /** True when the OS asks for reduced motion — everything lands instantly. */
  reduced: boolean;
  /** Pauses rendering entirely when the tab or panel is not visible. */
  active: boolean;
}

/** Shared, mutable reveal clock. One writer, many readers, zero re-renders. */
interface RevealClock {
  t: number;
}

const { node: N, edge: E, camera: C, motion: M, limits: L } = graph;

export default function GraphScene({
  layout,
  palette,
  phase,
  revealKey,
  reduced,
  active,
}: GraphSceneProps) {
  const [hovered, setHovered] = useState<GraphNode | null>(null);

  const distance = C.baseDistance + layout.maxDepth * C.distancePerHop;

  return (
    <Canvas
      // `demand` renders only on change — the correct loop for a reduced-motion
      // session, and for a graph scrolled out of view.
      frameloop={!active ? 'demand' : reduced ? 'demand' : 'always'}
      camera={{ position: [0, C.height, distance], fov: C.fov }}
      dpr={[1, 2]}
      performance={{ min: 0.5 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onPointerMissed={() => setHovered(null)}
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <SceneContents
        layout={layout}
        palette={palette}
        phase={phase}
        revealKey={revealKey}
        reduced={reduced}
        hovered={hovered}
        onHover={setHovered}
        distance={distance}
      />
    </Canvas>
  );
}

function SceneContents({
  layout,
  palette,
  phase,
  revealKey,
  reduced,
  hovered,
  onHover,
  distance,
}: Omit<GraphSceneProps, 'active'> & {
  hovered: GraphNode | null;
  onHover: (node: GraphNode | null) => void;
  distance: number;
}) {
  // One clock, shared by every animated piece, so the reveal cannot desync.
  const clock = useRef<RevealClock>({ t: 0 }).current;

  useEffect(() => {
    // A new investigation replays the walk from the origin outwards.
    clock.t = reduced ? Number.POSITIVE_INFINITY : 0;
  }, [clock, revealKey, reduced]);

  useFrame((_, delta) => {
    if (reduced) return;
    // Clamped so a backgrounded tab doesn't resume with a multi-second jump.
    clock.t += Math.min(delta, 0.05);
  }, -1);

  const showHalos = layout.nodes.length <= L.haloThreshold;

  return (
    <>
      <color attach="background" args={[palette.background]} />
      <fog attach="fog" args={[palette.background, distance * 0.7, distance * 2.6]} />

      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 8, 6]} intensity={0.7} />
      <pointLight
        position={[0, 0, 0]}
        color={palette.trigger}
        intensity={2.2}
        distance={layout.extent * 2.2}
        decay={2}
      />

      <NodeCores
        nodes={layout.nodes}
        palette={palette}
        clock={clock}
        phase={phase}
        reduced={reduced}
        hovered={hovered}
        onHover={onHover}
      />

      {showHalos && (
        <NodeHalos
          nodes={layout.nodes}
          palette={palette}
          clock={clock}
          reduced={reduced}
        />
      )}

      <WarningRings nodes={layout.nodes} palette={palette} clock={clock} reduced={reduced} />

      {layout.edges.map((edge) => (
        <EdgeLine
          key={edge.id}
          edge={edge}
          palette={palette}
          clock={clock}
          phase={phase}
          reduced={reduced}
        />
      ))}

      {phase === 'running' && !reduced && (
        <EdgePackets edges={layout.edges} palette={palette} clock={clock} />
      )}

      <HopRings maxDepth={layout.maxDepth} palette={palette} clock={clock} reduced={reduced} />

      {hovered && <NodeTooltip node={hovered} />}

      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        autoRotate={!reduced}
        autoRotateSpeed={phase === 'running' ? M.activeRotate : M.idleRotate}
        minDistance={C.minDistance}
        maxDistance={C.maxDistance}
        // Keep the camera above the plane; looking up through the graph reads
        // as a bug, not a view.
        minPolarAngle={Math.PI * 0.12}
        maxPolarAngle={Math.PI * 0.48}
      />
    </>
  );
}

/* ---------------------------------------------------------------------------
 * Reveal maths — hop distance is the delay, so the graph lights up outwards
 * in the same order the agent actually walked it.
 * ------------------------------------------------------------------------ */

function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
}

/** 0 → 1 with a small overshoot, or a hard 1 once the clock has run out. */
function nodeReveal(clock: RevealClock, depth: number): number {
  const start = depth * M.hopStagger;
  const p = (clock.t - start) / M.nodeReveal;
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  return easeOutBack(p);
}

function edgeReveal(clock: RevealClock, depth: number): number {
  const start = depth * M.hopStagger - M.hopStagger * 0.5;
  const p = (clock.t - start) / M.edgeReveal;
  return p <= 0 ? 0 : p >= 1 ? 1 : p;
}

/* ---------------------------------------------------------------------------
 * Node cores — one instanced mesh, one draw call.
 * ------------------------------------------------------------------------ */

function NodeCores({
  nodes,
  palette,
  clock,
  phase,
  reduced,
  hovered,
  onHover,
}: {
  nodes: GraphNode[];
  palette: GraphPalette;
  clock: RevealClock;
  phase: GraphPhase;
  reduced: boolean;
  hovered: GraphNode | null;
  onHover: (node: GraphNode | null) => void;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useRef(new THREE.Object3D()).current;
  const hoveredUrn = hovered?.urn;

  // Instance colour is static per node — severity doesn't change mid-render.
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;

    const color = new THREE.Color();
    nodes.forEach((node, i) => {
      color.set(node.isTrigger ? palette.trigger : palette[node.severity]);
      // Phantom assets sit back visually — they're a lineage claim, not a fact.
      if (!node.exists) color.multiplyScalar(N.ghostOpacity + 0.3);
      target.setColorAt(i, color);
    });
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
  }, [nodes, palette]);

  useFrame(() => {
    const target = mesh.current;
    if (!target) return;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]!;
      const base = node.isTrigger ? N.triggerRadius : N.radius;
      const reveal = reduced ? 1 : nodeReveal(clock, node.depth);

      let scale = base * reveal;
      if (!reduced) {
        // The origin breathes so an idle graph never reads as a still image.
        if (node.isTrigger) {
          scale *=
            1 + Math.sin((clock.t / M.triggerPulseCycle) * Math.PI * 2) * M.breath * 2;
        } else if (phase === 'idle') {
          scale *= 1 + Math.sin(clock.t + node.angle) * M.breath;
        }
      }
      if (node.urn === hoveredUrn) scale *= 1.25;

      dummy.position.set(node.x, node.y, node.z);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      target.setMatrixAt(i, dummy.matrix);
    }
    target.instanceMatrix.needsUpdate = true;
    // Instance matrices change every frame. A cached bounding sphere would
    // stay pinned to the reveal's starting (zero-scale) bounds and quietly
    // break hover hit-testing on the outer hops.
    target.boundingSphere = null;
  });

  return (
    <instancedMesh
      ref={mesh}
      // `undefined!` is the documented r3f form for "attach the children below".
      args={[undefined!, undefined!, nodes.length]}
      frustumCulled={false}
      onPointerMove={(e) => {
        e.stopPropagation();
        const node = e.instanceId !== undefined ? nodes[e.instanceId] : undefined;
        if (node && node.urn !== hoveredUrn) onHover(node);
      }}
      onPointerOut={() => onHover(null)}
    >
      {/* Unit sphere — per-instance scale carries the real radius. */}
      <sphereGeometry args={[1, N.segments, N.segments]} />
      {/* Lit, not emissive — the glow comes from the additive halo layer, so
          the cores keep enough shading to read as spheres rather than discs. */}
      <meshStandardMaterial roughness={0.32} metalness={0.1} toneMapped={false} />
    </instancedMesh>
  );
}

/* ---------------------------------------------------------------------------
 * Node glows — one additive point cloud. Brightness doubles as the reveal
 * fade, which is why this can be a single static geometry.
 * ------------------------------------------------------------------------ */

let glowTexture: THREE.Texture | undefined;

function getGlowTexture(): THREE.Texture {
  if (glowTexture) return glowTexture;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.28, 'rgba(255,255,255,0.36)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  glowTexture = new THREE.CanvasTexture(canvas);
  return glowTexture;
}

function NodeHalos({
  nodes,
  palette,
  clock,
  reduced,
}: {
  nodes: GraphNode[];
  palette: GraphPalette;
  clock: RevealClock;
  reduced: boolean;
}) {
  const points = useRef<THREE.Points>(null);

  const { positions, baseColors } = useMemo(() => {
    const pos = new Float32Array(nodes.length * 3);
    const cols = new Float32Array(nodes.length * 3);
    const color = new THREE.Color();

    nodes.forEach((node, i) => {
      pos[i * 3] = node.x;
      pos[i * 3 + 1] = node.y;
      pos[i * 3 + 2] = node.z;

      color.set(node.isTrigger ? palette.trigger : palette[node.severity]);
      cols[i * 3] = color.r;
      cols[i * 3 + 1] = color.g;
      cols[i * 3 + 2] = color.b;
    });
    return { positions: pos, baseColors: cols };
  }, [nodes, palette]);

  // Live copy the frame loop scales; `baseColors` stays the untouched source.
  const colors = useMemo(() => new Float32Array(baseColors), [baseColors]);

  useFrame(() => {
    const target = points.current;
    if (!target) return;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]!;
      let gain = reduced ? 1 : Math.min(1, nodeReveal(clock, node.depth));
      if (!reduced && node.isTrigger) {
        // Additive blending means scaling RGB *is* the glow pulse.
        gain *= 0.75 + 0.45 * Math.sin((clock.t / M.triggerPulseCycle) * Math.PI * 2);
      }
      colors[i * 3] = baseColors[i * 3]! * gain;
      colors[i * 3 + 1] = baseColors[i * 3 + 1]! * gain;
      colors[i * 3 + 2] = baseColors[i * 3 + 2]! * gain;
    }

    const attribute = target.geometry.getAttribute('color');
    if (attribute) attribute.needsUpdate = true;
  });

  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={getGlowTexture()}
        size={N.radius * N.haloScale}
        sizeAttenuation
        vertexColors
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

/* ---------------------------------------------------------------------------
 * Ownership gaps — the one thing the product exists to surface, so it gets a
 * dedicated pulsing ring rather than just a colour.
 * ------------------------------------------------------------------------ */

function WarningRings({
  nodes,
  palette,
  clock,
  reduced,
}: {
  nodes: GraphNode[];
  palette: GraphPalette;
  clock: RevealClock;
  reduced: boolean;
}) {
  const ownerless = useMemo(
    () => nodes.filter((node) => node.ownerless && !node.isTrigger && node.exists),
    [nodes],
  );

  if (ownerless.length === 0) return null;

  return (
    <>
      {ownerless.map((node) => (
        <WarningRing
          key={node.urn}
          node={node}
          color={palette.high}
          clock={clock}
          reduced={reduced}
        />
      ))}
    </>
  );
}

function WarningRing({
  node,
  color,
  clock,
  reduced,
}: {
  node: GraphNode;
  color: string;
  clock: RevealClock;
  reduced: boolean;
}) {
  // Own ref rather than walking the parent's children: `Billboard` nests its
  // content in a second inner group, so index-based traversal silently misses.
  const mesh = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const target = mesh.current;
    if (!target) return;

    const reveal = reduced ? 1 : Math.min(1, nodeReveal(clock, node.depth));
    const pulse = reduced
      ? 1
      : 0.55 + 0.45 * Math.sin((clock.t / M.warningPulseCycle) * Math.PI * 2);

    target.scale.setScalar(reveal * (reduced ? 1 : 0.94 + pulse * 0.12));
    const material = target.material as THREE.Material;
    material.opacity = reveal * (reduced ? 0.85 : 0.4 + pulse * 0.5);
  });

  return (
    <Billboard position={[node.x, node.y, node.z]}>
      <mesh ref={mesh}>
        <ringGeometry
          args={[
            N.radius * N.warningRingScale,
            N.radius * (N.warningRingScale + 0.16),
            32,
          ]}
        />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </Billboard>
  );
}

/* ---------------------------------------------------------------------------
 * Edges
 * ------------------------------------------------------------------------ */

function curvePoints(edge: GraphEdge): THREE.Vector3[] {
  const source = new THREE.Vector3(edge.source.x, edge.source.y, edge.source.z);
  const target = new THREE.Vector3(edge.target.x, edge.target.y, edge.target.z);
  // Lift the control point so overlapping hops separate in depth instead of
  // collapsing into one flat line.
  const control = source
    .clone()
    .add(target)
    .multiplyScalar(0.5)
    .add(new THREE.Vector3(0, source.distanceTo(target) * E.curve, 0));

  return new THREE.QuadraticBezierCurve3(source, control, target).getPoints(
    E.segments,
  );
}

function EdgeLine({
  edge,
  palette,
  clock,
  phase,
  reduced,
}: {
  edge: GraphEdge;
  palette: GraphPalette;
  clock: RevealClock;
  phase: GraphPhase;
  reduced: boolean;
}) {
  const line = useRef<ElementRef<typeof Line>>(null);
  const points = useMemo(() => curvePoints(edge), [edge]);

  // First-hop edges carry the most blast-radius signal, so they read heavier.
  const width = edge.depth <= 1 ? E.widthEmphasis : E.width;
  const restingOpacity = phase === 'idle' ? E.baseOpacity : E.baseOpacity + 0.18;

  useFrame(() => {
    const material = line.current?.material as THREE.Material | undefined;
    if (!material) return;

    const reveal = reduced ? 1 : edgeReveal(clock, edge.depth);
    // While the walk is passing through this hop, the edge burns bright and
    // settles back once the reveal has moved outwards.
    const recency = reduced
      ? 0
      : Math.max(0, 1 - Math.abs(clock.t - edge.depth * M.hopStagger) / M.hopStagger);
    material.opacity =
      reveal * (restingOpacity + recency * (E.activeOpacity - restingOpacity));
  });

  return (
    <Line
      ref={line}
      points={points}
      color={edge.depth <= 1 ? palette.edgeActive : palette.edge}
      lineWidth={width}
      transparent
      opacity={reduced ? restingOpacity : 0}
      toneMapped={false}
    />
  );
}

/**
 * Packets travelling outwards along the edges while the agent walks — the
 * literal "the investigation is here right now" cue. One point cloud.
 */
function EdgePackets({
  edges,
  palette,
  clock,
}: {
  edges: GraphEdge[];
  palette: GraphPalette;
  clock: RevealClock;
}) {
  const points = useRef<THREE.Points>(null);

  const curves = useMemo(
    () =>
      edges.slice(0, L.maxEdges).map((edge) => {
        const pts = curvePoints(edge);
        return { edge, pts };
      }),
    [edges],
  );

  const positions = useMemo(
    () => new Float32Array(curves.length * 3),
    [curves.length],
  );

  useFrame(() => {
    const target = points.current;
    if (!target) return;

    curves.forEach(({ edge, pts }, i) => {
      // Offset per hop so packets ripple outwards rather than moving in lockstep.
      const phase = (clock.t * E.pulseSpeed + edge.depth * 0.25) % 1;
      const index = Math.min(pts.length - 1, Math.floor(phase * (pts.length - 1)));
      const point = pts[index]!;
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;
    });

    const attribute = target.geometry.getAttribute('position');
    if (attribute) attribute.needsUpdate = true;
  });

  if (curves.length === 0) return null;

  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={getGlowTexture()}
        color={palette.edgeActive}
        size={E.pulseRadius * 6}
        sizeAttenuation
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

/**
 * Faint ground rings at each hop radius. They make "how many hops out is this
 * node" readable without hovering anything.
 */
function HopRings({
  maxDepth,
  palette,
  clock,
  reduced,
}: {
  maxDepth: number;
  palette: GraphPalette;
  clock: RevealClock;
  reduced: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const depths = useMemo(
    () => Array.from({ length: maxDepth }, (_, i) => i + 1),
    [maxDepth],
  );

  useFrame(() => {
    const target = group.current;
    if (!target) return;
    target.children.forEach((child, i) => {
      const depth = depths[i]!;
      const reveal = reduced ? 1 : Math.min(1, edgeReveal(clock, depth));
      const mesh = child as THREE.Mesh;
      const material = mesh.material as THREE.Material;
      material.opacity = reveal * 0.12;
    });
  });

  if (depths.length === 0) return null;

  return (
    <group ref={group}>
      {depths.map((depth) => (
        <mesh
          key={depth}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -depth * graph.layout.hopDrop - N.radius * 1.6, 0]}
        >
          <ringGeometry
            args={[
              depth * graph.layout.hopRadius - 0.012,
              depth * graph.layout.hopRadius + 0.012,
              96,
            ]}
          />
          <meshBasicMaterial
            color={palette.edge}
            transparent
            opacity={0}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Hover detail. DOM, not `troika` text — so it inherits the real type tokens. */
function NodeTooltip({ node }: { node: GraphNode }) {
  return (
    <Html
      position={[node.x, node.y + N.radius * 2.2, node.z]}
      center
      zIndexRange={[20, 0]}
      style={{ pointerEvents: 'none' }}
    >
      <div className="glass max-w-56 rounded-md border border-glass-border px-2.5 py-1.5 text-left shadow-elevated">
        <p className="truncate font-mono text-[11px] text-text">{node.name}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-muted">
          <span>{node.isTrigger ? 'origin' : `hop ${node.depth}`}</span>
          {!node.exists && <span className="text-danger">not in catalog</span>}
          {node.exists && node.ownerless && !node.isTrigger && (
            <span className="text-warning">no owner</span>
          )}
          {node.owners.length > 0 && (
            <span className="text-text-secondary">
              {node.owners.length} owner{node.owners.length === 1 ? '' : 's'}
            </span>
          )}
        </p>
      </div>
    </Html>
  );
}
