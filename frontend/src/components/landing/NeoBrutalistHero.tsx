import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import "./NeoBrutalistHero.css";

const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js";

const cards = [
  { url: "https://picsum.photos/seed/boora-ali-1/800/1100", x: -1.85, y: 0.25, z: 0.1, rotation: -0.16 },
  { url: "https://picsum.photos/seed/boora-ali-2/800/1100", x: 0, y: -0.15, z: 0.45, rotation: 0.04 },
  { url: "https://picsum.photos/seed/boora-ali-3/800/1100", x: 1.85, y: 0.2, z: 0, rotation: 0.16 },
];

type FloatingPlane = {
  position: { y: number };
  userData: { baseY: number; phase: number };
  geometry: { dispose: () => void };
  material: { map?: { dispose: () => void }; dispose: () => void };
};

export function NeoBrutalistHero() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || typeof ResizeObserver === "undefined" || typeof WebGLRenderingContext === "undefined") return;

    let disposed = false;
    let disposeScene = () => undefined;

    void import(/* @vite-ignore */ THREE_URL).then((THREE) => {
      if (disposed) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      const textureLoader = new THREE.TextureLoader();
      const planes: FloatingPlane[] = [];
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let frameId: number | undefined;

      camera.position.z = 8;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      mount.append(renderer.domElement);

      cards.forEach((card, index) => {
        const texture = textureLoader.load(card.url);
        texture.colorSpace = THREE.SRGBColorSpace;

        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(2.25, 3.1),
          new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
        );

        plane.position.set(card.x, card.y, card.z);
        plane.rotation.z = card.rotation;
        plane.userData.baseY = card.y;
        plane.userData.phase = index * 1.3;
        scene.add(plane);
        planes.push(plane);
      });

      const resizeObserver = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect;
        if (!width || !height) return;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      });

      resizeObserver.observe(mount);

      function animate(time = 0) {
        if (!reduceMotion) {
          planes.forEach((plane) => {
            plane.position.y = plane.userData.baseY + Math.sin(time * 0.001 + plane.userData.phase) * 0.18;
          });
        }

        renderer.render(scene, camera);
        if (!reduceMotion) frameId = requestAnimationFrame(animate);
      }

      animate();

      disposeScene = () => {
        if (frameId !== undefined) cancelAnimationFrame(frameId);
        resizeObserver.disconnect();
        planes.forEach((plane) => {
          plane.geometry.dispose();
          plane.material.map?.dispose();
          plane.material.dispose();
        });
        renderer.dispose();
        renderer.domElement.remove();
      };
    });

    return () => {
      disposed = true;
      disposeScene();
    };
  }, []);

  return (
    <section id="neo-brutalist-hero" aria-labelledby="neo-brutalist-hero-title">
      <div id="neo-brutalist-hero-copy">
        <p className="neo-brutalist-kicker">BOORA ALI / 01</p>
        <h1 id="neo-brutalist-hero-title">VÁ. VIVA. GUARDE.</h1>
        <p className="neo-brutalist-description">
          Transforme cada lugar marcante em uma memória que continua com você.
        </p>
        <Link className="neo-brutalist-cta" to="/register">
          COMEÇAR AGORA
        </Link>
      </div>

      <div id="neo-brutalist-hero-scene" aria-label="Memórias em movimento">
        <div id="neo-brutalist-scene" ref={mountRef} />
      </div>
    </section>
  );
}
