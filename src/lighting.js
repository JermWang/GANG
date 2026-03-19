import * as THREE from 'three';

export function setupLighting(scene) {
  // GTA San Andreas warm sunset/dusk atmosphere

  // Bright ambient for sunny day
  const ambient = new THREE.AmbientLight('#ffffff', 0.8);
  scene.add(ambient);

  // Main sun — bright afternoon light
  const sun = new THREE.DirectionalLight('#fff8e0', 3.5);
  sun.position.set(-40, 60, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 200;
  sun.shadow.camera.left = -80;
  sun.shadow.camera.right = 80;
  sun.shadow.camera.top = 80;
  sun.shadow.camera.bottom = -80;
  sun.shadow.bias = -0.0003;
  scene.add(sun);

  // Fill light — sky bounce
  const fill = new THREE.DirectionalLight('#a0c0e0', 1.5);
  fill.position.set(30, 50, -20);
  scene.add(fill);

  // Hemisphere — bright blue sky, warm ground bounce
  const hemi = new THREE.HemisphereLight('#87ceeb', '#c0a080', 1.8);
  scene.add(hemi);

  // Light coastal haze
  scene.fog = new THREE.FogExp2('#b0c8e0', 0.004);

  // Background matches sky
  scene.background = new THREE.Color('#87ceeb');
}

export function createSkybox(scene) {
  // Load sunny beach HDRI for Vice City/San Andreas coastal vibes
  const loader = new THREE.TextureLoader();
  const hdriTex = loader.load('/assets/textures/hdri_sunny_beach.jpg');
  hdriTex.mapping = THREE.EquirectangularReflectionMapping;
  hdriTex.colorSpace = THREE.SRGBColorSpace;

  // Use as environment map for reflections
  scene.environment = hdriTex;

  // Sky sphere with HDRI
  const skyGeo = new THREE.SphereGeometry(400, 64, 32);
  const skyMat = new THREE.MeshBasicMaterial({
    map: hdriTex,
    side: THREE.BackSide,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
}
