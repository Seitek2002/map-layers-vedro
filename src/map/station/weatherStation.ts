import { MercatorCoordinate, type CustomLayerInterface, type Map as MapLibreMap } from "maplibre-gl";
import {
  AmbientLight,
  BoxGeometry,
  Camera,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from "three";
import type { LngLat } from "../../domain/grid";

// Loaded with a dynamic import: three.js is only fetched after the map is up,
// so it doesn't weigh on first paint.

export interface StationWind {
  readonly speed: number;
  readonly bearing: number;
}

export interface WeatherStation {
  readonly layer: CustomLayerInterface;
  /** `null` stops the anemometer (wind layer off / no data); the vane holds its last heading. */
  setWind(wind: StationWind | null): void;
}

const MAST_HEIGHT = 36;
const MODEL_HEIGHT_M = 42;
/** On-screen height the model keeps when zoomed out, so it reads as a landmark at the regional view. */
const MIN_SCREEN_HEIGHT_PX = 90;
/** Web-mercator metres per pixel at zoom 0 (512 px tiles) on the equator. */
const EQUATOR_METRES_PER_PX_Z0 = 78271.517;

function material(color: string, metalness = 0.2): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, metalness, roughness: 0.55 });
}

/**
 * Model space: metres, Y up, north = -Z, east = +X (that's where the layer
 * transform below puts them).
 */
function buildModel(): { root: Group; rotor: Group; vane: Group } {
  const root = new Group();

  // Deliberately chunky proportions: it's a map landmark, legible from far away.
  const base = new Mesh(new BoxGeometry(16, 1.6, 16), material("#7d858d", 0));
  base.position.y = 0.8;
  const cabinet = new Mesh(new BoxGeometry(4, 4.5, 3), material("#f1f3f5"));
  cabinet.position.set(4.5, 3.8, 3.5);
  const mast = new Mesh(new CylinderGeometry(0.9, 1.5, MAST_HEIGHT, 16), material("#4a5561", 0.5));
  mast.position.y = 1.6 + MAST_HEIGHT / 2;
  const panel = new Mesh(new BoxGeometry(6, 0.3, 3.6), material("#1f3a5f", 0.4));
  panel.position.set(0, 10, 2.6);
  panel.rotation.x = -0.6;
  root.add(base, cabinet, mast, panel);

  const vane = new Group();
  vane.position.y = MAST_HEIGHT - 5;
  const shaft = new Mesh(new BoxGeometry(0.6, 0.6, 12), material("#1d2433"));
  const head = new Mesh(new ConeGeometry(1.6, 3.6, 16), material("#e4572e"));
  head.rotation.x = -Math.PI / 2;
  head.position.z = -7.6;
  const fin = new Mesh(new BoxGeometry(0.3, 4, 4), material("#1d2433"));
  fin.position.z = 5.4;
  vane.add(shaft, head, fin);

  const rotor = new Group();
  rotor.position.y = 1.6 + MAST_HEIGHT + 1;
  rotor.add(new Mesh(new CylinderGeometry(1, 1, 2, 14), material("#1d2433")));
  for (let i = 0; i < 3; i += 1) {
    const arm = new Group();
    arm.rotation.y = (i * 2 * Math.PI) / 3;
    const rod = new Mesh(new BoxGeometry(5.4, 0.4, 0.4), material("#1d2433"));
    rod.position.x = 2.7;
    const cup = new Mesh(new SphereGeometry(1.3, 16, 12), material("#f0a202"));
    cup.position.set(5.4, 0, 0);
    arm.add(rod, cup);
    rotor.add(arm);
  }

  root.add(vane, rotor);
  return { root, rotor, vane };
}

function shortestAngleDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

export function createWeatherStation(origin: LngLat): WeatherStation {
  const anchor = MercatorCoordinate.fromLngLat({ lng: origin[0], lat: origin[1] }, 0);
  const metre = anchor.meterInMercatorCoordinateUnits();
  const latitudeScale = Math.cos((origin[1] * Math.PI) / 180);

  const scene = new Scene();
  const camera = new Camera();
  const { root, rotor, vane } = buildModel();
  const sun = new DirectionalLight("#ffffff", 2.4);
  sun.position.set(60, 120, 40);
  scene.add(root, new AmbientLight("#ffffff", 1.5), sun);

  // Reused every frame to avoid per-frame allocations.
  const upright = new Matrix4().makeRotationAxis(new Vector3(1, 0, 0), Math.PI / 2);
  const model = new Matrix4();
  const scaleVector = new Vector3();

  let map: MapLibreMap | null = null;
  let renderer: WebGLRenderer | null = null;
  let targetSpeed = 0;
  let speed = 0;
  let targetBearing = 0;
  let bearing = 0;
  let spin = 0;
  let lastFrame = 0;

  const layer: CustomLayerInterface = {
    id: "weather-station-3d",
    type: "custom",
    renderingMode: "3d",

    onAdd(addedTo, gl) {
      map = addedTo;
      renderer = new WebGLRenderer({ canvas: addedTo.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },

    onRemove() {
      renderer?.dispose();
      renderer = null;
      map = null;
    },

    render(_gl, options) {
      if (!map || !renderer) return;

      const now = performance.now();
      const dt = lastFrame === 0 ? 0 : Math.min(0.1, (now - lastFrame) / 1000);
      lastFrame = now;
      speed += (targetSpeed - speed) * Math.min(1, dt * 1.5);
      bearing += shortestAngleDelta(bearing, targetBearing) * Math.min(1, dt * 2.5);
      spin += speed * 0.8 * dt;
      rotor.rotation.y = -spin;
      vane.rotation.y = (-bearing * Math.PI) / 180;

      // Never smaller than MIN_SCREEN_HEIGHT_PX on screen (readable at the
      // regional view), never smaller than true scale (close up, among buildings).
      const metresPerPx = (EQUATOR_METRES_PER_PX_Z0 * latitudeScale) / 2 ** map.getZoom();
      const scale = metre * Math.max(1, (MIN_SCREEN_HEIGHT_PX * metresPerPx) / MODEL_HEIGHT_M);
      model
        .makeTranslation(anchor.x, anchor.y, anchor.z)
        .scale(scaleVector.set(scale, -scale, scale))
        .multiply(upright);
      camera.projectionMatrix.fromArray(options.defaultProjectionData.mainMatrix).multiply(model);

      renderer.resetState();
      renderer.render(scene, camera);

      // Only keep the render loop hot while something is actually moving.
      const settling = Math.abs(targetSpeed - speed) > 0.01 || Math.abs(shortestAngleDelta(bearing, targetBearing)) > 0.2;
      if (speed > 0.05 || settling) map.triggerRepaint();
      else lastFrame = 0;
    },
  };

  return {
    layer,
    setWind(wind) {
      targetSpeed = wind ? wind.speed : 0;
      if (wind) targetBearing = wind.bearing;
      map?.triggerRepaint();
    },
  };
}
