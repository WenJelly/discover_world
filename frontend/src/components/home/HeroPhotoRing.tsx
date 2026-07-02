import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";

type RingConfig = {
  photos: string[];
  radius: number;
  tilt: number;
  rotationSpeed: number;
  reverse?: boolean;
};

function PhotoRing({
  photos,
  radius,
  tilt,
  rotationSpeed,
  reverse = false,
}: RingConfig) {
  const groupRef = useRef<THREE.Group>(null);
  const textures = useLoader(THREE.TextureLoader, photos);

  const items = useMemo(() => {
    return photos.map((_, i) => {
      const angle = (i / photos.length) * Math.PI * 2;
      const x = Math.sin(angle) * radius;
      const y = Math.cos(angle) * radius;
      return { x, y, texture: textures[i] };
    });
  }, [photos, radius, textures]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const dir = reverse ? -1 : 1;
    groupRef.current.rotation.y += rotationSpeed * dir * delta;
  });

  return (
    <group ref={groupRef} rotation={[tilt, 0, 0]}>
      {items.map((item, i) => (
        <mesh key={i} position={[item.x, 0, item.y]}>
          <planeGeometry args={[1.4, 1.8]} />
          <meshBasicMaterial
            map={item.texture}
            side={THREE.DoubleSide}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

type HeroPhotoRingProps = {
  photos: string[];
};

export default function HeroPhotoRing({ photos }: HeroPhotoRingProps) {
  const midpoint = Math.ceil(photos.length / 2);
  const ringA = photos.slice(0, midpoint);
  const ringB = photos.slice(midpoint);

  return (
    <Canvas
      camera={{ position: [0, 0, 12], fov: 50 }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.6} />
      <Suspense fallback={null}>
        <PhotoRing
          photos={ringA}
          radius={4.5}
          tilt={Math.PI / 12}
          rotationSpeed={0.15}
        />
        <PhotoRing
          photos={ringB}
          radius={5.5}
          tilt={-Math.PI / 12}
          rotationSpeed={0.1}
          reverse
        />
      </Suspense>
    </Canvas>
  );
}
