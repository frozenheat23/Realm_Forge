// The 3D relief view (SPEC §5.4n): the finished flat map, laid like a printed sheet over
// raised terrain, with a camera you can swing around it. It only reads the world's
// heights and copies the 2D map's picture; it never changes anything.
// This is the only file that uses three.js, and main.ts loads it only when 3D is switched on.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { GeneratedWorld } from "../gen";
import { setNameFont, type NameLabel } from "../render/labels";
import { markScale } from "../render/marks";
import {
  NAME_HALO_SHARE,
  RELIEF_AMBIENT,
  RELIEF_BACKGROUND,
  RELIEF_CURVE,
  RELIEF_FOV,
  RELIEF_HEIGHT,
  RELIEF_NAME_LIFT,
  RELIEF_NAME_PIXELS,
  RELIEF_NAME_SCALE,
  RELIEF_NEAR_FAR,
  RELIEF_SKIN_SCALE,
  RELIEF_STEP,
  RELIEF_SUN,
  type MapLook,
} from "../render/palette";
import { reliefHeightAt, reliefHeights } from "./reliefHeights";

export interface ReliefView {
  /** The canvas the 3D picture is drawn on. main.ts puts it on the page. */
  readonly canvas: HTMLCanvasElement;
  /** How many times larger than the map the flat picture should be drawn while 3D shows, to stay sharp close up. */
  readonly skinScale: number;
  /** Matches the 3D picture to its size on the page, in CSS pixels. */
  setSize(width: number, height: number): void;
  /** Stands these realm names up as signs that always face the camera, replacing the ones before. */
  setNames(labels: NameLabel[], look: MapLook): void;
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

/** A name sign's picture: the name in the map's own lettering, on a see-through background. */
function paintName(text: string, look: MapLook): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const size = RELIEF_NAME_PIXELS;
  setNameFont(ctx, size, look);
  // Room for the letters plus their halo on every side.
  canvas.width = Math.ceil(ctx.measureText(text).width + size);
  canvas.height = Math.ceil(size * 1.5);
  setNameFont(ctx, size, look); // resizing a canvas resets its settings
  const [x, y] = [canvas.width / 2, canvas.height / 2];
  ctx.lineWidth = size * NAME_HALO_SHARE;
  ctx.strokeStyle = look.labelHalo;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = look.labelColor;
  ctx.fillText(text, x, y);
  return canvas;
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
  // A graphics card has a largest picture it can hold; never ask for a skin wider than that.
  const skinScale = Math.max(1, Math.min(RELIEF_SKIN_SCALE, Math.floor(renderer.capabilities.maxTextureSize / world.width)));
  let skinWidth = flatMap.width;
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

  // --- Realm names: sprites, which are flat pictures that always turn to face the camera ---
  const names = new THREE.Group();
  scene.add(names);
  /** Each name's picture is made once and kept, since most names stay for centuries. */
  const namePictures = new Map<string, THREE.SpriteMaterial>();
  /** The camera's starting distance: names are their flat-map size from here. */
  const homeDistance = camera.position.length();

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
    skinScale,
    setSize(width, height) {
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
    setNames(labels, look) {
      names.clear();
      const used = new Set<string>();
      for (const label of labels) {
        // The key changes once the map's font has loaded, so a name first made in a stand-in font is remade.
        const key = [label.text, look.labelFont, look.labelColor, look.labelHalo, document.fonts.check(`${RELIEF_NAME_PIXELS}px ${look.labelFont}`)].join("|");
        used.add(key);
        let picture = namePictures.get(key);
        if (!picture) {
          const map = new THREE.CanvasTexture(paintName(label.text, look));
          map.colorSpace = THREE.SRGBColorSpace;
          // depthTest off: a name shows even when a mountain stands in front of it.
          picture = new THREE.SpriteMaterial({ map, depthTest: false });
          namePictures.set(key, picture);
        }
        const sign = new THREE.Sprite(picture);
        const image = picture.map!.image as HTMLCanvasElement;
        const tall = (label.size * RELIEF_NAME_SCALE * image.height) / RELIEF_NAME_PIXELS;
        sign.userData.size = [(tall * image.width) / image.height, tall];
        sign.center.set(0.5, 0); // the sign is placed by the middle of its bottom edge
        const ground = reliefHeightAt(world.heightmap, label.x, label.y, RELIEF_HEIGHT, RELIEF_CURVE);
        sign.position.set(label.x - world.width / 2, ground + label.size * RELIEF_NAME_LIFT, label.y - world.height / 2);
        sign.renderOrder = 1; // drawn after the ground
        names.add(sign);
      }
      // Forget the pictures of names no longer on the map.
      for (const [key, picture] of namePictures) {
        if (used.has(key)) continue;
        picture.map?.dispose();
        picture.dispose();
        namePictures.delete(key);
      }
    },
    render() {
      controls.update();
      // Keep the camera's pivot on the map, however far it's been slid.
      controls.target.x = Math.min(world.width / 2, Math.max(-world.width / 2, controls.target.x));
      controls.target.z = Math.min(world.height / 2, Math.max(-world.height / 2, controls.target.z));
      controls.target.y = 0;
      // If the flat picture changed size, the card's old copy no longer fits: drop it and start again.
      if (flatMap.width !== skinWidth) {
        skin.dispose();
        skinWidth = flatMap.width;
      }
      // Like markers on the zoomed flat map, names grow more slowly than the map as the camera comes close.
      for (const sign of names.children) {
        const k = markScale(homeDistance / camera.position.distanceTo(sign.position));
        const [wide, tall] = sign.userData.size as [number, number];
        sign.scale.set(wide * k, tall * k, 1);
      }
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
