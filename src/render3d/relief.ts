// The 3D relief view (SPEC §5.4n): the finished flat map, laid like a printed sheet over
// raised terrain, with a camera you can swing around it. It only reads the world's
// heights and copies the 2D map's picture; it never changes anything.
// This is the only file that uses three.js, and main.ts loads it only when 3D is switched on.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { GeneratedWorld } from "../gen";
import { RELIEF_AMBIENT, RELIEF_BACKGROUND, RELIEF_CURVE, RELIEF_FOV, RELIEF_HEIGHT, RELIEF_NEAR_FAR, RELIEF_STEP, RELIEF_SUN } from "../render/palette";
import { reliefHeights } from "./reliefHeights";

export interface ReliefView {
  /** The canvas the 3D picture is drawn on. main.ts puts it on the page. */
  readonly canvas: HTMLCanvasElement;
  /** Matches the 3D picture to its size on the page, in CSS pixels. */
  setSize(width: number, height: number): void;
  /** Copies the flat map's latest picture onto the terrain and draws one frame. */
  render(): void;
  /** The map point (in map pixels, like the flat map's) under the mouse, or null if it's off the map. */
  mapPointAt(event: MouseEvent): [number, number] | null;
}

/** The raised ground: a flat sheet of points, each lifted to its height. */
function buildTerrain(world: GeneratedWorld): THREE.BufferGeometry {
  const cols = Math.round(world.width / RELIEF_STEP);
  const rows = Math.round(world.height / RELIEF_STEP);
  const heights = reliefHeights(world.heightmap, cols, rows, RELIEF_HEIGHT, RELIEF_CURVE);
  // PlaneGeometry lists its points row by row from the top-left, the same order as `heights`.
  const geometry = new THREE.PlaneGeometry(world.width, world.height, cols, rows);
  const position = geometry.attributes.position!;
  for (let i = 0; i < heights.length; i++) position.setZ(i, heights[i]!);
  // Lay the sheet down: its "up" (z) becomes the scene's up (y), and north points away from the viewer.
  geometry.rotateX(-Math.PI / 2);
  // Normals say which way each bit of ground faces, so the sun can light slopes.
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Builds the 3D view of `world`. `flatMap` is the 2D map's canvas: its picture is the
 * terrain's skin, so borders, names, armies and effects all show without being redrawn.
 * Throws if the browser can't do 3D drawing (WebGL).
 */
export function createReliefView(world: GeneratedWorld, flatMap: HTMLCanvasElement): ReliefView {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(RELIEF_BACKGROUND);

  // A texture is a picture wrapped onto a 3D shape. This one is the live 2D map.
  const skin = new THREE.CanvasTexture(flatMap);
  skin.colorSpace = THREE.SRGBColorSpace;
  skin.anisotropy = renderer.capabilities.getMaxAnisotropy(); // keeps the map sharp when seen at a low angle
  const terrain = new THREE.Mesh(buildTerrain(world), new THREE.MeshLambertMaterial({ map: skin }));
  scene.add(terrain);
  // A raycaster shoots a line from the camera through the mouse and finds where it hits the ground.
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  scene.add(new THREE.AmbientLight(0xffffff, RELIEF_AMBIENT));
  const sun = new THREE.DirectionalLight(0xffffff, RELIEF_SUN);
  sun.position.set(-world.width, world.width * 0.9, -world.height); // high in the north-west
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(RELIEF_FOV, world.width / world.height, 1, world.width * 6);
  camera.position.set(0, world.width * 0.62, world.width * 0.58); // above the southern edge, looking north

  // OrbitControls: drag to swing around, wheel to zoom, right-drag to slide across the table.
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.screenSpacePanning = false;
  controls.maxPolarAngle = Math.PI * 0.46; // never below the table
  controls.minDistance = world.width * RELIEF_NEAR_FAR[0];
  controls.maxDistance = world.width * RELIEF_NEAR_FAR[1];
  controls.zoomToCursor = true;

  return {
    canvas: renderer.domElement,
    setSize(width, height) {
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
    render() {
      controls.update();
      // Keep the camera's pivot on the map, however far it's been slid.
      controls.target.x = Math.min(world.width / 2, Math.max(-world.width / 2, controls.target.x));
      controls.target.z = Math.min(world.height / 2, Math.max(-world.height / 2, controls.target.z));
      controls.target.y = 0;
      skin.needsUpdate = true;
      renderer.render(scene, camera);
    },
    mapPointAt(event) {
      const rect = renderer.domElement.getBoundingClientRect();
      // three.js wants the mouse as −1..1 across the picture, with up as positive.
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, 1 - ((event.clientY - rect.top) / rect.height) * 2);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(terrain)[0];
      // The terrain is centred on the scene's middle; map pixels count from the top-left corner.
      return hit ? [hit.point.x + world.width / 2, hit.point.z + world.height / 2] : null;
    },
  };
}
