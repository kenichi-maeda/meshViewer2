import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.158.0/examples/jsm/controls/OrbitControls.js?module';
import { OBJLoader } from 'https://unpkg.com/three@0.158.0/examples/jsm/loaders/OBJLoader.js?module';

const canvasMap = {
  main: document.getElementById('mainCanvas'),
  before: document.getElementById('beforeCanvas'),
  after: document.getElementById('afterCanvas'),
};

const meshFiles = {
  main: 'data/main.obj',
  before: 'data/before.obj',
  after: 'data/after.obj',
};

const labelFiles = {
  main: 'data/main_submeshes.json',
  before: 'data/before_submeshes.json',
  after: 'data/after_submeshes.json',
};

const intersectionFile = 'data/before_intersections.json';

const baseCenter = new THREE.Vector3(-119, -117, 82);
const clipDirection = new THREE.Vector3(1, 0, 0).normalize();
const cameraPosition = baseCenter.clone().add(clipDirection.clone().multiplyScalar(300));
const clippingPlane = new THREE.Plane(clipDirection.clone().negate(), -clipDirection.dot(baseCenter));

const sharedCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
sharedCamera.position.copy(cameraPosition);
sharedCamera.lookAt(baseCenter);

const sharedControls = new OrbitControls(sharedCamera, document.body);
sharedControls.target.copy(baseCenter);
sharedControls.enableDamping = true;

const viewers = [];

// ID remapping to sync submesh colors across meshes
const colorMapping = {
  main:   { 0: 0, 1: 1, 2: 2 },
  before: { 0: 0, 1: 2 },
  after:  { 0: 0, 1: 2 },
};

function getColorForId(id) {
  const color = new THREE.Color();
  color.setHSL((0.05 + id * 0.15) % 1, 1.0, 0.45);
  return color;
}

async function initViewer(name) {
  const canvas = canvasMap[name];
  const meshFile = meshFiles[name];
  const labelFile = labelFiles[name];

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const light = new THREE.DirectionalLight(0xffffff, 1.2);
  light.position.set(3, 5, 2);
  scene.add(light);

  const loader = new OBJLoader();
  const [obj, submeshLabels, intersectionData] = await Promise.all([
    new Promise((resolve) => loader.load(meshFile, resolve)),
    fetch(labelFile).then((res) => res.json()),
    name === 'before' ? fetch(intersectionFile).then((res) => res.json()) : Promise.resolve([]),
  ]);

  const intersectingFaceSet = new Set(intersectionData || []);

  obj.traverse((child) => {
    if (child.isMesh) {
      let geometry = child.geometry;
      if (geometry.index) {
        geometry = geometry.toNonIndexed();
        child.geometry = geometry;
      }

      geometry.computeVertexNormals();

      const pos = geometry.attributes.position;
      const faceCount = pos.count / 3;
      const colors = new Float32Array(pos.count * 3);

      for (let i = 0; i < faceCount; i++) {
        const isHighlight = intersectingFaceSet.has(i);
        const rawId = submeshLabels[i] ?? 0;
        const mappedId = colorMapping[name]?.[rawId] ?? 0;

        const color = isHighlight
          ? new THREE.Color(1, 0, 0)  // red for intersecting face
          : getColorForId(mappedId);

        for (let j = 0; j < 3; j++) {
          const vi = i * 3 + j;
          colors[vi * 3 + 0] = color.r;
          colors[vi * 3 + 1] = color.g;
          colors[vi * 3 + 2] = color.b;
        }
      }

      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      child.material = new THREE.MeshPhongMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
        clippingPlanes: [clippingPlane],
        clipShadows: true,
      });

      const wireframe = new THREE.LineSegments(
        new THREE.WireframeGeometry(geometry),
        new THREE.LineBasicMaterial({
          color: 0x000000,
          clippingPlanes: [clippingPlane],
        })
      );
      child.add(wireframe);
    }
  });

  scene.add(obj);
  viewers.push({ renderer, scene, canvas });
}

// Load all scenes
initViewer('main');
initViewer('before');
initViewer('after');

// Animate all
function animate() {
  requestAnimationFrame(animate);
  sharedControls.update();

  for (const { renderer, scene, canvas } of viewers) {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (canvas.width !== width || canvas.height !== height) {
      renderer.setSize(width, height, false);
    }

    sharedCamera.aspect = width / height;
    sharedCamera.updateProjectionMatrix();

    renderer.render(scene, sharedCamera);
  }
}
animate();

// Slider
const slider = document.createElement('input');
slider.type = 'range';
slider.min = '0';
slider.max = '300';
slider.step = '0.1';
slider.value = '0';
slider.style.position = 'fixed';
slider.style.top = '20px';
slider.style.left = '50%';
slider.style.transform = 'translateX(-50%)';
slider.style.zIndex = '999';
slider.style.width = '300px';
document.body.appendChild(slider);

slider.addEventListener('input', () => {
  const offset = parseFloat(slider.value);
  const movedCenter = baseCenter.clone().add(clipDirection.clone().multiplyScalar(offset));
  clippingPlane.constant = -clipDirection.dot(movedCenter);
});

slider.addEventListener('pointerdown', () => (sharedControls.enabled = false));
slider.addEventListener('pointerup', () => (sharedControls.enabled = true));
slider.addEventListener('pointerleave', () => (sharedControls.enabled = true));
