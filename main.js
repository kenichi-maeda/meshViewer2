import * as THREE from 'https://unpkg.com/three@0.158.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.158.0/examples/jsm/controls/OrbitControls.js?module';
import { OBJLoader } from 'https://unpkg.com/three@0.158.0/examples/jsm/loaders/OBJLoader.js?module';

// Canvas DOM elements
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

// ✅ Clipping plane setup
const baseCenter = new THREE.Vector3(-119, -117, 82);
const clipDirection = new THREE.Vector3(1, 0, 0).normalize(); // X-axis
const distance = 300;

const cameraPosition = baseCenter.clone().sub(clipDirection.clone().multiplyScalar(distance));

const clippingPlane = new THREE.Plane(
  clipDirection.clone().negate(), // inward normal
  -clipDirection.dot(baseCenter)  // constant = -n·p
);

// ✅ Shared camera and controls
const sharedCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
sharedCamera.position.copy(cameraPosition);
sharedCamera.lookAt(baseCenter);

const sharedControls = new OrbitControls(sharedCamera, document.body);
sharedControls.target.copy(baseCenter);
sharedControls.enableDamping = true;

// ✅ Viewer setup
const viewers = [];

function initViewer(canvas, meshFile) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const light = new THREE.DirectionalLight(0xffffff, 0.8);
  light.position.set(3, 5, 2);
  scene.add(light);

  const loader = new OBJLoader();
  loader.load(meshFile, obj => {
    obj.traverse(child => {
      if (child.isMesh) {
        child.geometry.computeVertexNormals();
        child.material = new THREE.MeshPhongMaterial({
          color: 0xffe0bd,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1,
          clippingPlanes: [clippingPlane],
          clipShadows: true,
        });

        const wireframe = new THREE.LineSegments(
          new THREE.WireframeGeometry(child.geometry),
          new THREE.LineBasicMaterial({
            color: 0x000000,
            clippingPlanes: [clippingPlane],  // ✅ apply here too
          })
        );
        child.add(wireframe);
      }
    });
    scene.add(obj);
  });

  viewers.push({ renderer, scene, canvas });
}

// ✅ Initialize all three viewers
initViewer(canvasMap.main, meshFiles.main);
initViewer(canvasMap.before, meshFiles.before);
initViewer(canvasMap.after, meshFiles.after);

// ✅ Animation loop
function animate() {
  requestAnimationFrame(animate);
  sharedControls.update();

  for (const viewer of viewers) {
    const { renderer, scene, canvas } = viewer;

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

// ✅ Slider for clipping plane offset
const slider = document.createElement('input');
slider.type = 'range';
slider.min = '-300';
slider.max = '300';
slider.step = '1';
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

// Disable camera control while dragging slider
slider.addEventListener('pointerdown', () => {
  sharedControls.enabled = false;
});

slider.addEventListener('pointerup', () => {
  sharedControls.enabled = true;
});

slider.addEventListener('pointerleave', () => {
  sharedControls.enabled = true;
});
