import * as THREE from 'three';

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();

    // Dimensional rift atmospheric fog
    this.scene.background = new THREE.Color(0x05070a);
    this.scene.fog = new THREE.FogExp2(0x05070a, 0.025);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.initLighting();
    this.buildHubFloor();
    this.handleResize();
  }

  initLighting() {
    // Ambient baseline
    const ambient = new THREE.AmbientLight(0x1a2634, 1.5);
    this.scene.add(ambient);

    // Directional sunlight / dimensional breach light
    const dirLight = new THREE.DirectionalLight(0x00d9ff, 1.8);
    dirLight.position.set(20, 40, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 100;
    dirLight.shadow.camera.left = -30;
    dirLight.shadow.camera.right = 30;
    dirLight.shadow.camera.top = 30;
    dirLight.shadow.camera.bottom = -30;
    this.scene.add(dirLight);

    // Atmospheric warm accent light
    const pointLight = new THREE.PointLight(0xff0055, 2, 25);
    pointLight.position.set(0, 5, 0);
    this.scene.add(pointLight);
  }

  buildHubFloor() {
    // Ground mesh
    const floorGeo = new THREE.PlaneGeometry(100, 100);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x090e17,
      roughness: 0.8,
      metalness: 0.2
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Grid overlay for spatial grounding
    const grid = new THREE.GridHelper(100, 50, 0x00d9ff, 0x1a365d);
    grid.position.y = 0.01;
    this.scene.add(grid);
  }

  handleResize() {
    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  render(camera) {
    this.renderer.render(this.scene, camera);
  }
}