// src/components/autopista3d/Autopista3D.jsx
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, OrbitControls, Text } from "@react-three/drei";
import { EffectComposer, Vignette } from "@react-three/postprocessing";
import { useMemo, useRef, useState } from "react";
import { clamp, tone, toneColor } from "./utils3d";

function Road({ length = 120, width = 18 }) {
  return (
    <group>
      {/* asfalto */}
      <mesh receiveShadow rotation-x={-Math.PI / 2}>
        <planeGeometry args={[length, width, 1, 1]} />
        <meshStandardMaterial
          color="#0b1220"
          roughness={0.96}
          metalness={0.04}
        />
      </mesh>

      {/* línea amarilla central */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, 0]}>
        <planeGeometry args={[length, 0.25]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.4} />
      </mesh>

      {/* líneas blancas discontinuas (2 carriles) */}
      {Array.from({ length: 20 }).map((_, i) => {
        const x = -length / 2 + (i + 0.5) * (length / 20);
        return (
          <group key={i}>
            <mesh rotation-x={-Math.PI / 2} position={[x, 0.01, -4]}>
              <planeGeometry args={[3, 0.12]} />
              <meshStandardMaterial color="#e2e8f0" roughness={0.5} />
            </mesh>
            <mesh rotation-x={-Math.PI / 2} position={[x, 0.01, 4]}>
              <planeGeometry args={[3, 0.12]} />
              <meshStandardMaterial color="#e2e8f0" roughness={0.5} />
            </mesh>
          </group>
        );
      })}

      {/* banquinas */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, -(width / 2 - 1)]}>
        <planeGeometry args={[length, 2]} />
        <meshStandardMaterial color="#111827" roughness={0.9} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, width / 2 - 1]}>
        <planeGeometry args={[length, 2]} />
        <meshStandardMaterial color="#111827" roughness={0.9} />
      </mesh>
    </group>
  );
}

/* =========================================
   Cámara suave hacia pin seleccionado
========================================= */
function CameraRig({ targetRef, enabled = true }) {
  useFrame((state, dt) => {
    if (!enabled) return;
    const t = targetRef.current;
    if (!t) return;

    // posición deseada (atrás/arriba y mirando el pin)
    const desired = new THREE.Vector3(t.x, 14, t.z + 18);

    // lerp suave, estable con dt
    const alpha = 1 - Math.pow(0.001, dt);
    state.camera.position.lerp(desired, alpha);
    state.camera.lookAt(t.x, 1.6, t.z);
  });

  return null;
}

/* =========================================
   Carteles KM (más legibles)
========================================= */
function KmSigns({ kmMin, span }) {
  const ticks = useMemo(() => {
    const n = 7;
    return Array.from({ length: n }).map((_, i) => {
      const x = -60 + (i / (n - 1)) * 120;
      const km = kmMin + (span * i) / (n - 1);
      return { x, km: km.toFixed(0) };
    });
  }, [kmMin, span]);

  return (
    <group>
      {ticks.map((t, i) => (
        <group key={i} position={[t.x, 0, -8.7]}>
          {/* poste */}
          <mesh position={[0, 0.7, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.07, 1.4, 12]} />
            <meshStandardMaterial
              color="#cbd5e1"
              roughness={0.55}
              metalness={0.35}
            />
          </mesh>

          {/* placa */}
          <mesh position={[0, 1.55, 0]} castShadow>
            <boxGeometry args={[2.3, 1.15, 0.12]} />
            <meshStandardMaterial color="#0b2a1f" roughness={0.7} />
          </mesh>

          {/* borde */}
          <mesh position={[0, 1.55, 0.07]}>
            <boxGeometry args={[2.36, 1.22, 0.01]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.7} />
          </mesh>

          {/* texto con outline */}
          <Text
            position={[0, 1.55, 0.13]}
            fontSize={0.34}
            color="#f8fafc"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#020617"
          >
            KM {t.km}
          </Text>
        </group>
      ))}
    </group>
  );
}

function buildPins({ rows, kmMin, kmMax, span }) {
  const base = rows
    .filter((r) => Number.isFinite(Number(r.km)))
    .map((r) => {
      const km = Number(r.km);
      const xPct = ((km - kmMin) / span) * 100;
      const label = String(r.codigo || "").trim() || "Luminaria";
      return { raw: r, km, xPct: clamp(xPct, 0, 100), t: tone(r), label };
    })
    .filter((p) => p.km >= kmMin && p.km <= kmMax)
    .sort((a, b) => a.xPct - b.xPct || a.km - b.km);

  // anticolisión
  const BUCKET = 1.6;
  const DX = 1.0;
  const buckets = new Map();

  const withLane = base.map((p) => {
    const k = Math.round(p.xPct / BUCKET);
    const n = buckets.get(k) || 0;
    buckets.set(k, n + 1);

    const lane = n % 4;
    const sign = n % 2 === 0 ? 1 : -1;
    const dx = n === 0 ? 0 : sign * Math.ceil(n / 2) * DX;

    return { ...p, xAdj: clamp(p.xPct + dx, 0, 100), lane };
  });

  // % -> mundo 3D
  const length = 120;
  const laneZ = (lane) => {
    switch (lane) {
      case 0:
        return -7.5;
      case 1:
        return -6.2;
      case 2:
        return 6.2;
      case 3:
        return 7.5;
      default:
        return 7.5;
    }
  };

  return withLane.map((p) => ({
    ...p,
    x: -length / 2 + (p.xAdj / 100) * length,
    z: laneZ(p.lane),
  }));
}

function Posts({ pins, selectedId, onSelect }) {
  const postGeom = useMemo(
    () => new THREE.CylinderGeometry(0.06, 0.08, 2.2, 10),
    [],
  );
  const headGeom = useMemo(() => new THREE.BoxGeometry(0.4, 0.2, 0.2), []);
  const plateGeom = useMemo(() => new THREE.BoxGeometry(1.5, 0.55, 0.08), []);

  return (
    <group>
      {pins.map((p) => {
        const id = p.raw?.id;
        const isSel = id === selectedId;
        const c = toneColor(p.t);

        return (
          <group key={`${id}-${p.km}`} position={[p.x, 0, p.z]}>
            {/* poste */}
            <mesh castShadow geometry={postGeom} position={[0, 1.1, 0]}>
              <meshStandardMaterial
                color="#cbd5e1"
                roughness={0.55}
                metalness={0.35}
              />
            </mesh>

            {/* lampara */}
            <mesh castShadow geometry={headGeom} position={[0.25, 2.05, 0]}>
              <meshStandardMaterial
                color="#94a3b8"
                roughness={0.45}
                metalness={0.25}
              />
            </mesh>

            {/* aura sutil solo seleccionado */}
            {isSel && (
              <mesh position={[0.9, 1.6, -0.02]}>
                <planeGeometry args={[2.2, 0.9]} />
                <meshBasicMaterial transparent opacity={0.18} color={c} />
              </mesh>
            )}

            {/* placa clickeable */}
            <mesh
              geometry={plateGeom}
              position={[0.9, 1.6, 0]}
              castShadow
              scale={isSel ? 1.06 : 1.0}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(id, p);
              }}
            >
              <meshStandardMaterial
                color={isSel ? "#111827" : "#0b1220"}
                roughness={0.55}
                metalness={0.08}
                emissive={isSel ? c : "#000000"}
                emissiveIntensity={isSel ? 0.2 : 0}
              />
            </mesh>

            {/* estado */}
            <mesh position={[0.25, 1.6, 0.05]}>
              <boxGeometry args={[0.18, 0.18, 0.09]} />
              <meshStandardMaterial
                color={c}
                emissive={c}
                emissiveIntensity={0.32}
              />
            </mesh>

            {/* texto solo seleccionado, con outline */}
            {isSel && (
              <Text
                position={[0.95, 1.6, 0.09]}
                fontSize={0.2}
                color="#f8fafc"
                anchorX="left"
                anchorY="middle"
                maxWidth={1.2}
                outlineWidth={0.02}
                outlineColor="#020617"
              >
                {p.label}
              </Text>
            )}
          </group>
        );
      })}
    </group>
  );
}

export default function Autopista3D({
  ramalLabel,
  kmMin,
  kmMax,
  rows,
  quality = "mid", // low | mid | high
  onPinClick,
}) {
  const span = Math.max(0.01, kmMax - kmMin);
  const pins = useMemo(
    () => buildPins({ rows, kmMin, kmMax, span }),
    [rows, kmMin, kmMax, span],
  );

  const [selectedId, setSelectedId] = useState(null);

  // Target para cámara suave
  const camTarget = useRef(null);

  const dpr =
    quality === "high" ? [1, 1.5] : quality === "mid" ? [1, 1.25] : [1, 1.1];
  const enableShadows = quality === "high";
  const enablePost = quality !== "low"; // vignette solo en mid/high

  return (
    <div className="card" style={{ padding: 14, marginBottom: 16 }}>
      <div
        style={{ display: "flex", justifyContent: "space-between", gap: 10 }}
      >
        <div style={{ fontWeight: 900 }}>{ramalLabel}</div>
        <div className="muted" style={{ fontSize: 12 }}>
          KM {kmMin} — {kmMax} · {pins.length} registros · 3D{" "}
          {quality.toUpperCase()}
        </div>
      </div>

      <div
        style={{
          height: 360,
          marginTop: 12,
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <Canvas
          dpr={dpr}
          gl={{
            antialias: false,
            powerPreference: "high-performance",
            alpha: false,
            stencil: false,
            depth: true,
            preserveDrawingBuffer: false,
          }}
          shadows={enableShadows}
          camera={{ position: [0, 14, 18], fov: 45 }}
          onPointerMissed={() => {
            setSelectedId(null);
            camTarget.current = null;
          }}
        >
          {/* Cámara suave hacia target (si hay) */}
          <CameraRig targetRef={camTarget} enabled={true} />

          <ambientLight intensity={0.35} />
          <directionalLight
            position={[12, 20, 8]}
            intensity={1.05}
            castShadow={enableShadows}
            shadow-mapSize-width={enableShadows ? 2048 : 1024}
            shadow-mapSize-height={enableShadows ? 2048 : 1024}
          />

          <Environment preset="city" />

          <Road length={120} width={18} />
          <KmSigns kmMin={kmMin} span={span} />

          <Posts
            pins={pins}
            selectedId={selectedId}
            onSelect={(id, p) => {
              setSelectedId(id);
              camTarget.current = { x: p.x, z: p.z }; // mover cámara hacia ese pin

              // segundo tap: abrir OT
              if (selectedId === id) onPinClick?.(p.raw);
            }}
          />

          {/* Postprocesado liviano */}
          {enablePost && (
            <EffectComposer multisampling={0}>
              <Vignette eskil={false} offset={0.12} darkness={0.55} />
            </EffectComposer>
          )}

          <fog attach="fog" args={["#020617", 22, 60]} />

          {/* Controles: si ves que se pelea con CameraRig, te doy versión que lo desactiva al seleccionar */}
          <OrbitControls
            enablePan={false}
            enableDamping
            dampingFactor={0.08}
            minDistance={14}
            maxDistance={28}
            maxPolarAngle={Math.PI * 0.49}
          />
        </Canvas>
      </div>

      <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
        Tap 1: seleccionar · Tap 2: abrir OT.
      </div>
    </div>
  );
}
