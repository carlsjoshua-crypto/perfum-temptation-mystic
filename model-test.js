/* ==========================================================================
   Temptation Mystic - 3D Model Test Viewer
   Visualizador Three.js con Materiales Físicos, Atomizador y Spray Cinemático
   ========================================================================== */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import gsap from 'gsap';

// ==========================================================================
// 1. Configuración del Renderizador y Escena
// ==========================================================================
const canvas = document.getElementById('webgl-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// 14. Constante reversible: usar shader multivista proyectivo en cuerpoMesh o planos flotantes
const USE_BODY_MULTIVIEW_SHADER = true;
// Constante reversible: usar shader multivista proyectivo en tapaMesh o planos flotantes
const USE_CAP_MULTIVIEW_SHADER = true;

// PASO 1: Configuración del renderizador (exposición 0.84)
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.84;

// Escena oscura color borgoña profundo (restaurado fondo original)
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x120308);

// Mantener obligatoriamente sin mapa ambiental
scene.environment = null;

// Cámara en perspectiva
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.01,
  100
);
camera.position.set(0, 0, 0.32);

// ==========================================================================
// PASO 12: Iluminación General Calibrada
// ==========================================================================
const hemisphereLight = new THREE.HemisphereLight(
  0xffd1cb,
  0x120004,
  0.68
);
scene.add(hemisphereLight);

const keyLight = new THREE.DirectionalLight(
  0xffc5b8,
  0.42
);
keyLight.position.set(4, 5, 6);
scene.add(keyLight);

const redRimLight = new THREE.DirectionalLight(
  0xa00028,
  0.38
);
redRimLight.position.set(-4, 2.5, -5);
scene.add(redRimLight);

// 6 & 10. OrbitControls para rotar y hacer zoom con el mouse
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 0.05;
controls.maxDistance = 1.6;

// Variables de estado y animación
let initialCameraPos = camera.position.clone();
let initialTarget = controls.target.clone();
let isAnimating = false;

// Referencias de elementos DOM
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const uncapBtn = document.getElementById('uncapBtn');
const resetCamBtn = document.getElementById('resetCamBtn');
const screenMistOverlay = document.getElementById('screenMistOverlay');

// Referencias a los objetos de la escena
let modelRoot = null;
let bottleGroup = null;
let capGroup = null;
let cuerpoMesh = null; // bodyOuterGlass
let bodyAdvertisingShader = null; // Shader publicitario del cuerpo (base lateral)
let bodyFrontCanvasTexture = null;
let capFrontCanvasTexture = null;
let bodyBackCanvasTexture = null;
let capBackCanvasTexture = null;

// Texturas explícitas e independientes para cuerpo y tapa
let bodyFrontTexture = null;
let bodyBackTexture = null;
let capOriginalFrontTexture = null;
let capOriginalBackTexture = null;
let capCleanFrontTexture = null;
let capCleanBackTexture = null;
let capSideClosedTexture = null;
let capSideCleanTexture = null;
let capSideClosedMirroredTexture = null;
let capSideCleanMirroredTexture = null;

// Variables de estado para suavizado temporal del paralaje interior de la tapa
let smoothShiftFront = 0;
let smoothShiftBack = 0;
let smoothProgressFront = 0;
let smoothProgressBack = 0;

// Objeto mutable de uniformes exclusivo para la tapa
const capMultiviewUniforms = {
  uCapCleanMix: { value: 0.0 },
  uCapOrigFront: { value: null },
  uCapOrigBack: { value: null },
  uCapCleanFront: { value: null },
  uCapCleanBack: { value: null },
  uCapSideClosedRight: { value: null },
  uCapSideCleanRight: { value: null },
  uCapSideClosedLeft: { value: null },
  uCapSideCleanLeft: { value: null },
  uTexRight: { value: null },
  uTexLeft: { value: null },
  uCapLocalBoxMin: { value: new THREE.Vector3() },
  uCapLocalBoxSize: { value: new THREE.Vector3(1, 1, 1) },
  uCapLocalCenter: { value: new THREE.Vector3() },
  uHoleRadius: { value: 0.00750 },
  uDiskRadius: { value: 0.00695 },
  uBaseRuby: { value: new THREE.Color(0x760019) },
  uCapParallaxShiftFront: { value: 0.0 },
  uCapParallaxShiftBack: { value: 0.0 },
  uCapLateralProgressFront: { value: 0.0 },
  uCapLateralProgressBack: { value: 0.0 },
};

// Objeto mutable de uniformes exclusivo para el cuerpo
const bodyMultiviewUniforms = {
  uTexFront: { value: null },
  uTexBack: { value: null },
  uTexRight: { value: null },
  uTexLeft: { value: null },
  uLocalBoxMin: { value: new THREE.Vector3() },
  uLocalBoxSize: { value: new THREE.Vector3(1, 1, 1) },
  uBaseBurgundy: { value: new THREE.Color(0x350009) },
};

let bodyRightCanvasTexture = null;
let bodyLeftCanvasTexture = null;

// Material y referencias para Shader Multivista del cuerpo
let bodyMultiviewMaterial = null;
let savedCuerpoMesh = null;
let savedBottleSize = null;
let savedCuerpoBox = null;
let savedLocalBox = null;
let savedLocalSize = null;

// Material y referencias para Shader Multivista de la tapa
let capMultiviewMaterial = null;
let savedTapaMesh = null;
let savedTapaBox = null;
let savedTapaLocalBox = null;
let savedTapaLocalSize = null;
let savedTapaLocalCenter = null;
let savedModelSize = null;

let capRightCanvasTexture = null;
let capLeftCanvasTexture = null;

let neckRightPhotoProjection = null;
let neckLeftPhotoProjection = null;
let neckRightPhotoMaterial = null;
let neckLeftPhotoMaterial = null;
let neckRightCanvasTexture = null;
let neckLeftCanvasTexture = null;

let tapaMesh = null;
let cuelloMesh = null;
let atomizerGroup = null;
let pulsadorGroup = null;
let buttonMesh = null;
let nozzleOuterMesh = null;
let sprayPinholeMesh = null;
let atomizerAccentLight = null;

// Calibración de proporciones del pulsador: Estado sellado (al ras de la tapa) vs Estado compacto (foto de referencia)
const ATOMIZER_SEALED = {
  buttonScaleY: 1.0,
  nozzleY: 0.0098, // Cota de reposo que sitúa el tope a Y = 0.0598 m (al ras del orificio exterior Y = 0.0600 m)
};

const ATOMIZER_COMPACT = {
  buttonScaleY: 0.65, // Reduce la altura visible a ~9.6 mm sobre el anillo toroidal (~5.2 mm de reducción achatada)
  nozzleY: 0.0065,    // Centrado proporcional en la pared cilíndrica del pulsador compacto
};

// Elementos de la simulación del agujero central de la tapa
let capRecessGroup = null;
let capRecessShadowMesh = null;
let capTopHoleDarkDisk = null;
let capTopHoleDarkMaterial = null;
let capInsetAtomizerDisk = null;
let capInsetAtomizerMaterial = null;
let capBottomRecessMesh = null;
let capBottomRecessMaterial = null;
let initialCapY = 0;
let simulatedGoldAtomizerHead = null;

// Manguera interna procedural (Dip Tube)
let dipTubeGroup = null;
let dipTubeMaterial = null;

// Conector transparente escalonado entre collar y manguera
let dipTubeConnectorGroup = null;
let dipTubeConnectorMaterial = null;

// ==========================================================================
// PASO 1, 2, 13 y 14: Materiales
// ==========================================================================

// PASO 1: Conservar referencia del material exterior anterior para desarrollo
const outerGlassMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x560012,
  metalness: 0,
  roughness: 0.4,
  transmission: 0,
  clearcoat: 0.22,
  clearcoatRoughness: 0.32,
  opacity: 1,
  transparent: false,
  vertexColors: false,
  envMap: null,
  envMapIntensity: 0,
  side: THREE.FrontSide,
});
const previousOuterGlassMaterial = outerGlassMaterial;


// 2. Material base de la tapa (MeshPhongMaterial rubí calibrado)
const capMaterial = new THREE.MeshPhongMaterial({
  color: 0x760019,
  emissive: 0x180003,
  emissiveIntensity: 0.28,
  specular: 0xd73354,
  shininess: 48,
  transparent: false,
  opacity: 1,
  vertexColors: false,
  side: THREE.FrontSide,
});

// 7. Material dorado básico original (conservado para disco superior simulado de la tapa)
const atomizerGoldMaterial = new THREE.MeshBasicMaterial({
  color: 0xc9963e,
  transparent: false,
  opacity: 1,
  vertexColors: false,
  side: THREE.FrontSide,
  toneMapped: false,
});

// ==========================================================================
// Estrategia 2: Textura MatCap de Oro Champán Pulido con Reflejo Espejo
// ==========================================================================
function createChampagneMatcapTexture(maxAnisotropy = 8) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  // Paleta de referencia:
  // - Bordes exteriores: dorado tostado #795426
  // - Zona de sombra: oro oscuro #96713A
  // - Base dominante: oro champán #C6A66A
  // - Transición clara: champán crema #D8C294
  // - Reflejo principal: crema #E9E2D8
  const colRim = [121, 84, 38];
  const colShadow = [150, 113, 58];
  const colBase = [198, 166, 106];
  const colTrans = [216, 194, 148];
  const colHl = [233, 226, 216];

  function lerpRGB(a, b, t) {
    const s = Math.max(0, Math.min(1, t));
    return [
      a[0] + (b[0] - a[0]) * s,
      a[1] + (b[1] - a[1]) * s,
      a[2] + (b[2] - a[2]) * s,
    ];
  }

  function smoothstep(min, max, value) {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
  }

  const cx = size / 2;
  const cy = size / 2;
  const radius = (size / 2) - 2;

  for (let y = 0; y < size; y++) {
    const ny = -(y - cy) / radius;
    for (let x = 0; x < size; x++) {
      const nx = (x - cx) / radius;
      const r2 = nx * nx + ny * ny;
      const idx = (y * size + x) * 4;

      if (r2 > 1.0) {
        data[idx] = colRim[0];
        data[idx + 1] = colRim[1];
        data[idx + 2] = colRim[2];
        data[idx + 3] = 255;
        continue;
      }

      const nz = Math.sqrt(Math.max(0, 1.0 - r2));
      const rimFactor = Math.pow(1.0 - nz, 2.0);

      // 1. Gradiente base: Sombra izquierda -> Base centro
      const shadowFactor = smoothstep(-0.05, -0.65, nx);
      let rgb = lerpRGB(colBase, colShadow, shadowFactor);

      // 2. Segundo reflejo vertical tenue en el lado contrario (nx = -0.50)
      const fillDist = Math.abs(nx - (-0.50));
      const fillHl = Math.exp(-(fillDist * fillDist) / 0.038) * smoothstep(0.08, 0.45, nz);
      rgb = lerpRGB(rgb, colTrans, fillHl * 0.35);

      // 3. Zona de transición hacia el reflejo
      const transZone = smoothstep(0.02, 0.26, nx) * (1.0 - smoothstep(0.46, 0.82, nx));
      rgb = lerpRGB(rgb, colTrans, transZone * 0.55);

      // 4. Reflejo principal: franja vertical amplia, suave, color crema, desplazada (nx = 0.26, ~20-25% ancho)
      const hlDist = Math.abs(nx - 0.26);
      const mainHl = Math.exp(-(hlDist * hlDist) / 0.020) * smoothstep(0.06, 0.45, nz);
      rgb = lerpRGB(rgb, colHl, mainHl * 0.95);

      // 5. Bordes exteriores con dorado tostado #795426
      rgb = lerpRGB(rgb, colRim, rimFactor * 0.85);

      // 6. Sutil luz cenital difusa de estudio
      if (ny > 0.0) {
        rgb = lerpRGB(rgb, colTrans, ny * 0.12 * nz);
      } else {
        rgb = lerpRGB(rgb, colShadow, (-ny) * 0.15 * nz);
      }

      data[idx] = Math.round(rgb[0]);
      data[idx + 1] = Math.round(rgb[1]);
      data[idx + 2] = Math.round(rgb[2]);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

const atomizerChampagneMatcap = createChampagneMatcapTexture(
  renderer ? renderer.capabilities.getMaxAnisotropy() : 8
);

// Material MatCap exclusivo para el atomizador: oro champán pulido con reflejo espejo
const atomizerMatcapMaterial = new THREE.MeshMatcapMaterial({
  color: 0xffffff,
  matcap: atomizerChampagneMatcap,
  transparent: false,
  opacity: 1.0,
  depthTest: true,
  depthWrite: true,
});

// Alias para compatibilidad completa en todo el código
const atomizerMirrorGoldMaterial = atomizerMatcapMaterial;
const champagneGoldMaterial = atomizerMatcapMaterial;
const goldNeckMaterial = atomizerMatcapMaterial;
const goldMaterial = atomizerMatcapMaterial;
const collarMaterial = atomizerMatcapMaterial;
const stemMaterial = atomizerMatcapMaterial;
const buttonMaterial = atomizerMatcapMaterial;

// Material MatCap exclusivo e independiente para las dos piezas del atomizador:
// Anillo cilíndrico inferior y pulsador superior (oro champán pulido tipo espejo)
function createAtomizerPieceMatcapTexture(maxAnisotropy = 8) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  // Paleta calibrada según fotografías reales de referencia (frente, lateral y dorso):
  // Oro champán pulido tipo espejo con contraste metálico nítido
  const colBase = [206, 176, 120];      // Base oro champán medio dominante (#ceb078)
  const colDark = [38, 24, 12];         // Franja vertical oscura de espejo (#26180c)
  const colCream = [253, 247, 232];     // Reflejo crema vertical de softbox (#fdf7e8)
  const colWarmGold = [228, 196, 138];  // Transición dorada intermedia cálida (#e4c48a)
  const colShadow = [82, 58, 30];       // Sombra dorada profunda (#523a1e)
  const colRim = [112, 78, 36];         // Bordes exteriores tostados (#704e24)

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2;

  function lerpRGB(c1, c2, t) {
    const factor = Math.max(0, Math.min(1, t));
    return [
      c1[0] + (c2[0] - c1[0]) * factor,
      c1[1] + (c2[1] - c1[1]) * factor,
      c1[2] + (c2[2] - c1[2]) * factor,
    ];
  }

  function smoothstep(minVal, maxVal, val) {
    const x = Math.max(0, Math.min(1, (val - minVal) / (maxVal - minVal)));
    return x * x * (3 - 2 * x);
  }

  for (let y = 0; y < size; y++) {
    const ny = -(y - cy) / radius;
    for (let x = 0; x < size; x++) {
      const nx = (x - cx) / radius;
      const r2 = nx * nx + ny * ny;
      const idx = (y * size + x) * 4;

      if (r2 > 1.0) {
        data[idx] = colRim[0];
        data[idx + 1] = colRim[1];
        data[idx + 2] = colRim[2];
        data[idx + 3] = 255;
        continue;
      }

      const nz = Math.sqrt(Math.max(0, 1.0 - r2));
      const rimFactor = Math.pow(1.0 - nz, 2.2);

      // 1. Base oro champán con degradado sutil
      let rgb = colBase;

      // 2. Transición hacia sombra en el cuadrante izquierdo
      const shadowFactor = smoothstep(0.05, -0.75, nx);
      rgb = lerpRGB(rgb, colShadow, shadowFactor * 0.55);

      // 3. Franja vertical crema secundaria izquierda (nx = -0.58)
      const leftHlDist = Math.abs(nx - (-0.58));
      const leftHl = Math.exp(-(leftHlDist * leftHlDist) / 0.016) * smoothstep(0.04, 0.40, nz);
      rgb = lerpRGB(rgb, colCream, leftHl * 0.72);

      // 4. Franja vertical oscura y estrecha (nx = -0.02)
      const darkDist = Math.abs(nx - (-0.02));
      const darkStripe = Math.exp(-(darkDist * darkDist) / 0.007) * smoothstep(0.06, 0.45, nz);
      rgb = lerpRGB(rgb, colDark, darkStripe * 0.88);

      // 5. Transición dorada intermedia cálida (nx = 0.08 a 0.22)
      const transZone = smoothstep(0.04, 0.16, nx) * (1.0 - smoothstep(0.24, 0.50, nx));
      rgb = lerpRGB(rgb, colWarmGold, transZone * 0.75);

      // 6. Franja crema vertical principal amplia (nx = 0.32)
      const rightHlDist = Math.abs(nx - 0.32);
      const rightHl = Math.exp(-(rightHlDist * rightHlDist) / 0.018) * smoothstep(0.05, 0.45, nz);
      rgb = lerpRGB(rgb, colCream, rightHl * 0.94);

      // 7. Bordes exteriores más oscuros con contraste metálico
      rgb = lerpRGB(rgb, colRim, rimFactor * 0.80);

      // 8. Iluminación cenital y rasante de estudio sobre curvaturas (ny)
      if (ny > 0.0) {
        rgb = lerpRGB(rgb, colWarmGold, ny * 0.22 * nz);
        const topRim = Math.pow(Math.max(0, ny), 3.0) * smoothstep(0.1, 0.6, nz);
        rgb = lerpRGB(rgb, colCream, topRim * 0.35);
      } else {
        rgb = lerpRGB(rgb, colDark, (-ny) * 0.18 * nz);
      }

      data[idx] = Math.round(rgb[0]);
      data[idx + 1] = Math.round(rgb[1]);
      data[idx + 2] = Math.round(rgb[2]);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

const atomizerPieceMatcap = createAtomizerPieceMatcapTexture(
  renderer ? renderer.capabilities.getMaxAnisotropy() : 8
);

// Instancia independiente de material para el anillo inferior y el pulsador superior
const atomizerPieceMaterial = new THREE.MeshMatcapMaterial({
  color: 0xffffff,
  matcap: atomizerPieceMatcap,
  transparent: false,
  opacity: 1.0,
  depthTest: true,
  depthWrite: true,
  side: THREE.DoubleSide,
});

// 8. Franja de brillo para profundidad visual sobre el frente del cilindro
const atomizerGoldHighlightMaterial = new THREE.MeshBasicMaterial({
  color: 0xffe3a0,
  transparent: true,
  opacity: 0.32,
  depthWrite: false,
  toneMapped: false,
});

// 9. Boquilla oscura (MeshBasicMaterial para visibilidad constante y oscura)
const nozzleMaterial = new THREE.MeshBasicMaterial({
  color: 0x180b06,
  transparent: false,
  opacity: 1,
  toneMapped: false,
});

// ==========================================================================
// 6 y 7. Etiqueta Frontal con CanvasTexture
// ==========================================================================
// ==========================================================================
// PASO 4 a 8: Carga y Proyección de la Fotografía Frontal Original
// ==========================================================================
function setupFrontPhotoProjection(cuerpoMesh, bottleSize, cuerpoCenter, cuerpoBox) {
  if (!cuerpoMesh || !cuerpoMesh.geometry || !bottleSize || !cuerpoCenter) {
    console.warn('Geometría o dimensiones del cuerpo no disponibles para la proyección.');
    if (cuerpoMesh) cuerpoMesh.visible = true;
    return;
  }

  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(
    './assets/models/temptation-mystic-front-reference.png',
    (loadedTexture) => {
      try {
        // 9. Comprobar que la imagen tenga dimensiones válidas
        if (
          !loadedTexture.image ||
          !loadedTexture.image.width ||
          !loadedTexture.image.height
        ) {
          throw new Error('La imagen frontal no tiene dimensiones válidas');
        }

        // Configuración de la textura fotográfica frontal
        loadedTexture.colorSpace = THREE.SRGBColorSpace;
        loadedTexture.minFilter = THREE.LinearMipmapLinearFilter;
        loadedTexture.magFilter = THREE.LinearFilter;
        loadedTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        loadedTexture.generateMipmaps = true;
        loadedTexture.needsUpdate = true;

        // Canvas fuera de pantalla para recortar exclusivamente el cuerpo
        const img = loadedTexture.image;
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = 1024;
        cropCanvas.height = 1344;
        const ctx = cropCanvas.getContext('2d');

        if (!ctx) {
          throw new Error('No se pudo obtener el contexto 2D del canvas');
        }

        // Región de recorte normalizada (excluyendo tapa, cuello y fondo)
        const sx = img.width * 0.300;
        const sy = img.height * 0.458;
        const sWidth = img.width * 0.395;
        const sHeight = img.height * 0.485;

        // Máscara suave con esquinas redondeadas en el canvas
        const cornerRadius = 42;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cornerRadius, 0);
        ctx.lineTo(cropCanvas.width - cornerRadius, 0);
        ctx.quadraticCurveTo(cropCanvas.width, 0, cropCanvas.width, cornerRadius);
        ctx.lineTo(cropCanvas.width, cropCanvas.height - cornerRadius);
        ctx.quadraticCurveTo(cropCanvas.width, cropCanvas.height, cropCanvas.width - cornerRadius, cropCanvas.height);
        ctx.lineTo(cornerRadius, cropCanvas.height);
        ctx.quadraticCurveTo(0, cropCanvas.height, 0, cropCanvas.height - cornerRadius);
        ctx.lineTo(0, cornerRadius);
        ctx.quadraticCurveTo(0, 0, cornerRadius, 0);
        ctx.closePath();
        ctx.clip();

        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, cropCanvas.width, cropCanvas.height);
        ctx.restore();

        // Textura Canvas recortada
        bodyFrontCanvasTexture = new THREE.CanvasTexture(cropCanvas);
        bodyFrontCanvasTexture.colorSpace = THREE.SRGBColorSpace;
        bodyFrontCanvasTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        bodyFrontCanvasTexture.needsUpdate = true;
        bodyFrontTexture = bodyFrontCanvasTexture;
        bodyMultiviewUniforms.uTexFront.value = bodyFrontTexture;

        // Intentar inicializar shader multivista
        tryInitBodyMultiviewShader();
      } catch (err) {
        console.error('Error al procesar la textura frontal del cuerpo:', err);
        if (cuerpoMesh) {
          cuerpoMesh.visible = true;
        }
      }
    },
    undefined,
    (error) => {
      console.error('No se pudo cargar la referencia frontal:', error);

      if (cuerpoMesh) {
        cuerpoMesh.visible = true;
      }
    }
  );
}

// ==========================================================================
// ==========================================================================
// ==========================================================================
// 3. Proyección Fotográfica Frontal Original de la Tapa (Cerrada)
// ==========================================================================
function setupCapFrontPhotoProjection(targetCapGroup, capMesh) {
  if (!targetCapGroup || !capMesh) return;

  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(
    './assets/models/temptation-mystic-front-reference.png',
    (loadedTexture) => {
      try {
        if (!loadedTexture.image || !loadedTexture.image.width || !loadedTexture.image.height) {
          throw new Error('La imagen de referencia frontal no tiene dimensiones válidas para la tapa');
        }

        const img = loadedTexture.image;
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = 1024;
        cropCanvas.height = 308;
        const ctx = cropCanvas.getContext('2d');
        if (!ctx) return;

        // Recorte normalizado original de la tapa: x=0.325, y=0.300, w=0.350, h=0.105
        const sx = img.width * 0.325;
        const sy = img.height * 0.300;
        const sWidth = img.width * 0.350;
        const sHeight = img.height * 0.105;

        // Máscara suave con esquinas redondeadas
        const cornerRadius = 14;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cornerRadius, 0);
        ctx.lineTo(cropCanvas.width - cornerRadius, 0);
        ctx.quadraticCurveTo(cropCanvas.width, 0, cropCanvas.width, cornerRadius);
        ctx.lineTo(cropCanvas.width, cropCanvas.height - cornerRadius);
        ctx.quadraticCurveTo(cropCanvas.width, cropCanvas.height, cropCanvas.width - cornerRadius, cropCanvas.height);
        ctx.lineTo(cornerRadius, cropCanvas.height);
        ctx.quadraticCurveTo(0, cropCanvas.height, 0, cropCanvas.height - cornerRadius);
        ctx.lineTo(0, cornerRadius);
        ctx.quadraticCurveTo(0, 0, cornerRadius, 0);
        ctx.closePath();
        ctx.clip();

        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, cropCanvas.width, cropCanvas.height);
        ctx.restore();

        // Textura original de la tapa (frontal cerrada)
        capOriginalFrontTexture = new THREE.CanvasTexture(cropCanvas);
        capOriginalFrontTexture.colorSpace = THREE.SRGBColorSpace;
        capOriginalFrontTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        capOriginalFrontTexture.flipY = true;
        capOriginalFrontTexture.needsUpdate = true;
        capFrontCanvasTexture = capOriginalFrontTexture;
        capMultiviewUniforms.uCapOrigFront.value = capOriginalFrontTexture;

        tryInitCapMultiviewShader();
      } catch (err) {
        console.error('Error al procesar la textura frontal original de la tapa:', err);
      }
    },
    undefined,
    (err) => {
      console.error('No se pudo cargar textura frontal original para la tapa:', err);
    }
  );
}

// ==========================================================================
// Textura Limpia de la Tapa para Elevación (temptation-mystic-cap-clean-reference.png)
// ==========================================================================
function setupCapCleanTextures() {
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(
    './assets/models/temptation-mystic-cap-clean-reference.png',
    (loadedTexture) => {
      try {
        if (!loadedTexture.image || !loadedTexture.image.width || !loadedTexture.image.height) return;

        const img = loadedTexture.image;

        // Detectar o recortar únicamente los límites reales no transparentes de la tapa
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;
        tempCtx.drawImage(img, 0, 0);
        const data = tempCtx.getImageData(0, 0, img.width, img.height).data;

        let minX = img.width, maxX = 0, minY = img.height, maxY = 0;
        for (let y = 0; y < img.height; y++) {
          for (let x = 0; x < img.width; x++) {
            if (data[(y * img.width + x) * 4 + 3] > 10) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (minX > maxX || minY > maxY) {
          minX = 352;
          maxX = 672;
          minY = 463;
          maxY = 561;
        }

        const cropW = maxX - minX + 1;
        const cropH = maxY - minY + 1;

        // Frontal limpia
        const cleanFrontCanvas = document.createElement('canvas');
        cleanFrontCanvas.width = 1024;
        cleanFrontCanvas.height = Math.round(1024 * (cropH / cropW));
        const ctxF = cleanFrontCanvas.getContext('2d');
        if (ctxF) {
          ctxF.drawImage(img, minX, minY, cropW, cropH, 0, 0, cleanFrontCanvas.width, cleanFrontCanvas.height);
          capCleanFrontTexture = new THREE.CanvasTexture(cleanFrontCanvas);
          capCleanFrontTexture.colorSpace = THREE.SRGBColorSpace;
          capCleanFrontTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
          capCleanFrontTexture.flipY = true;
          capCleanFrontTexture.needsUpdate = true;
          capMultiviewUniforms.uCapCleanFront.value = capCleanFrontTexture;
        }

        // Posterior limpia horizontalmente reflejada mediante canvas
        const cleanBackCanvas = document.createElement('canvas');
        cleanBackCanvas.width = cleanFrontCanvas.width;
        cleanBackCanvas.height = cleanFrontCanvas.height;
        const ctxB = cleanBackCanvas.getContext('2d');
        if (ctxB) {
          ctxB.save();
          ctxB.translate(cleanBackCanvas.width, 0);
          ctxB.scale(-1, 1);
          ctxB.drawImage(cleanFrontCanvas, 0, 0);
          ctxB.restore();

          capCleanBackTexture = new THREE.CanvasTexture(cleanBackCanvas);
          capCleanBackTexture.colorSpace = THREE.SRGBColorSpace;
          capCleanBackTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
          capCleanBackTexture.flipY = true;
          capCleanBackTexture.needsUpdate = true;
          capMultiviewUniforms.uCapCleanBack.value = capCleanBackTexture;
        }

        tryInitCapMultiviewShader();
      } catch (err) {
        console.error('Error procesando referencia limpia de la tapa:', err);
      }
    },
    undefined,
    (err) => {
      console.error('No se pudo cargar la referencia limpia de la tapa:', err);
    }
  );
}

// ==========================================================================
// 4, 5, 6 y 7. Proyecciones Fotográficas Posteriores (Cuerpo y Tapa)
// ==========================================================================
function setupBackPhotoProjections(cuerpoMesh, bottleSize, cuerpoCenter, cuerpoBox, targetCapGroup, capMesh) {
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(
    './assets/models/temptation-mystic-back-reference.png',
    (loadedTexture) => {
      try {
        if (
          !loadedTexture.image ||
          !loadedTexture.image.width ||
          !loadedTexture.image.height
        ) {
          throw new Error('La imagen de referencia posterior no tiene dimensiones válidas');
        }

        const img = loadedTexture.image;

        // -------------------------------------------------------------
        // 4 & 5. Proyección posterior del cuerpo
        // -------------------------------------------------------------
        if (cuerpoMesh && bottleSize && cuerpoCenter && cuerpoBox) {
          const backBodyCropCanvas = document.createElement('canvas');
          backBodyCropCanvas.width = 1024;
          backBodyCropCanvas.height = 1320;
          const ctxBody = backBodyCropCanvas.getContext('2d');

          if (ctxBody) {
            // 4. Recorte normalizado: x=0.300, y=0.465, width=0.380, height=0.490
            const sx = img.width * 0.300;
            const sy = img.height * 0.465;
            const sWidth = img.width * 0.380;
            const sHeight = img.height * 0.490;

            const cornerRadius = 36;
            ctxBody.save();
            ctxBody.beginPath();
            ctxBody.moveTo(cornerRadius, 0);
            ctxBody.lineTo(backBodyCropCanvas.width - cornerRadius, 0);
            ctxBody.quadraticCurveTo(backBodyCropCanvas.width, 0, backBodyCropCanvas.width, cornerRadius);
            ctxBody.lineTo(backBodyCropCanvas.width, backBodyCropCanvas.height - cornerRadius);
            ctxBody.quadraticCurveTo(backBodyCropCanvas.width, backBodyCropCanvas.height, backBodyCropCanvas.width - cornerRadius, backBodyCropCanvas.height);
            ctxBody.lineTo(cornerRadius, backBodyCropCanvas.height);
            ctxBody.quadraticCurveTo(0, backBodyCropCanvas.height, 0, backBodyCropCanvas.height - cornerRadius);
            ctxBody.lineTo(0, cornerRadius);
            ctxBody.quadraticCurveTo(0, 0, cornerRadius, 0);
            ctxBody.closePath();
            ctxBody.clip();

            ctxBody.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, backBodyCropCanvas.width, backBodyCropCanvas.height);
            ctxBody.restore();

            bodyBackCanvasTexture = new THREE.CanvasTexture(backBodyCropCanvas);
            bodyBackCanvasTexture.colorSpace = THREE.SRGBColorSpace;
            bodyBackCanvasTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
            bodyBackCanvasTexture.needsUpdate = true;
            bodyBackTexture = bodyBackCanvasTexture;
            bodyMultiviewUniforms.uTexBack.value = bodyBackTexture;
          }
        }

        // -------------------------------------------------------------
        // 6 & 7. Proyección posterior original de la tapa
        // -------------------------------------------------------------
        if (targetCapGroup && capMesh) {
          const backCapCropCanvas = document.createElement('canvas');
          backCapCropCanvas.width = 1024;
          backCapCropCanvas.height = 336;
          const ctxCap = backCapCropCanvas.getContext('2d');

          if (ctxCap) {
            // Valores normalizados originales: x = 0.325, y = 0.295, width = 0.350, height = 0.115
            const sx = img.width * 0.325;
            const sy = img.height * 0.295;
            const sWidth = img.width * 0.350;
            const sHeight = img.height * 0.115;

            const cornerRadius = 14;
            ctxCap.save();
            ctxCap.beginPath();
            ctxCap.moveTo(cornerRadius, 0);
            ctxCap.lineTo(backCapCropCanvas.width - cornerRadius, 0);
            ctxCap.quadraticCurveTo(backCapCropCanvas.width, 0, backCapCropCanvas.width, cornerRadius);
            ctxCap.lineTo(backCapCropCanvas.width, backCapCropCanvas.height - cornerRadius);
            ctxCap.quadraticCurveTo(backCapCropCanvas.width, backCapCropCanvas.height, backCapCropCanvas.width - cornerRadius, backCapCropCanvas.height);
            ctxCap.lineTo(cornerRadius, backCapCropCanvas.height);
            ctxCap.quadraticCurveTo(0, backCapCropCanvas.height, 0, backCapCropCanvas.height - cornerRadius);
            ctxCap.lineTo(0, cornerRadius);
            ctxCap.quadraticCurveTo(0, 0, cornerRadius, 0);
            ctxCap.closePath();
            ctxCap.clip();

            ctxCap.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, backCapCropCanvas.width, backCapCropCanvas.height);
            ctxCap.restore();

            capOriginalBackTexture = new THREE.CanvasTexture(backCapCropCanvas);
            capOriginalBackTexture.colorSpace = THREE.SRGBColorSpace;
            capOriginalBackTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
            capOriginalBackTexture.flipY = true;
            capOriginalBackTexture.needsUpdate = true;
            capBackCanvasTexture = capOriginalBackTexture;
            capMultiviewUniforms.uCapOrigBack.value = capOriginalBackTexture;

            tryInitCapMultiviewShader();
          }
        }

        // Intentar inicializar shader multivista
        tryInitBodyMultiviewShader();
      } catch (err) {
        console.error('Error al crear proyecciones posteriores:', err);
      }
    },
    undefined,
    (error) => {
      console.error('No se pudo cargar la referencia posterior:', error);
    }
  );
}

// ==========================================================================
// Proyecciones Fotográficas Laterales (Cuerpo, Tapa y Cuello)
// ==========================================================================
function setupSidePhotoProjections(
  cuerpoMesh,
  bottleSize,
  cuerpoCenter,
  cuerpoBox,
  targetCapGroup,
  capMesh,
  cuelloMesh
) {
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(
    './assets/models/temptation-mystic-side-reference.png',
    (loadedTexture) => {
      try {
        if (
          !loadedTexture.image ||
          !loadedTexture.image.width ||
          !loadedTexture.image.height
        ) {
          throw new Error('La imagen de referencia lateral no tiene dimensiones válidas');
        }

        const img = loadedTexture.image;

        function createSideTexture(canvas) {
          const tex = new THREE.CanvasTexture(canvas);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
          tex.needsUpdate = true;
          return tex;
        }

        // -------------------------------------------------------------
        // 1. Cuerpo lateral (Cuerpo: x=0.414, y=0.463, width=0.170, height=0.490)
        // -------------------------------------------------------------
        if (cuerpoMesh && bottleSize && cuerpoCenter && cuerpoBox) {
          const sx = img.width * 0.414;
          const sy = img.height * 0.463;
          const sWidth = img.width * 0.170;
          const sHeight = img.height * 0.490;

          const canvasW = 512;
          const canvasH = Math.round(canvasW * (sHeight / sWidth));

          // Canvas original (derecho)
          const bodyRightCanvas = document.createElement('canvas');
          bodyRightCanvas.width = canvasW;
          bodyRightCanvas.height = canvasH;
          const ctxR = bodyRightCanvas.getContext('2d');
          ctxR.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, canvasW, canvasH);

          // Canvas reflejado horizontalmente (izquierdo)
          const bodyLeftCanvas = document.createElement('canvas');
          bodyLeftCanvas.width = canvasW;
          bodyLeftCanvas.height = canvasH;
          const ctxL = bodyLeftCanvas.getContext('2d');
          ctxL.save();
          ctxL.scale(-1, 1);
          ctxL.drawImage(img, sx, sy, sWidth, sHeight, -canvasW, 0, canvasW, canvasH);
          ctxL.restore();

          bodyRightCanvasTexture = createSideTexture(bodyRightCanvas);
          bodyLeftCanvasTexture = createSideTexture(bodyLeftCanvas);
          bodyMultiviewUniforms.uTexRight.value = bodyRightCanvasTexture;
          bodyMultiviewUniforms.uTexLeft.value = bodyLeftCanvasTexture;
        }

        // -------------------------------------------------------------
        // 2. Tapa lateral (Gestionada con referencias closed y clean independientes)
        // -------------------------------------------------------------
        if (targetCapGroup && capMesh) {
          setupCapSideTextures(targetCapGroup, capMesh);
        }

        // Intentar inicializar shader multivista del cuerpo cuando sus texturas laterales estén listas
        tryInitBodyMultiviewShader();
      } catch (err) {
        console.error('Error al configurar proyecciones laterales:', err);
      }
    },
    undefined,
    (error) => {
      console.error('No se pudo cargar la imagen de referencia lateral:', error);
    }
  );
}

// ==========================================================================
// Texturas Laterales de la Tapa (Cerrada y Limpia)
// ==========================================================================
function setupCapSideTextures(targetCapGroup, capMesh) {
  const textureLoader = new THREE.TextureLoader();

  let closedImg = null;
  let cleanImg = null;

  function processCapSideTextures() {
    if (!closedImg || !cleanImg) return;

    try {
      // 1. Detectar los límites reales no transparentes de cada imagen
      function detectBounds(img) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return { minX: 510, maxX: 744, minY: 556, maxY: 697 };
        tempCtx.drawImage(img, 0, 0);
        const data = tempCtx.getImageData(0, 0, img.width, img.height).data;
        let minX = img.width, maxX = 0, minY = img.height, maxY = 0;
        for (let y = 0; y < img.height; y++) {
          for (let x = 0; x < img.width; x++) {
            if (data[(y * img.width + x) * 4 + 3] > 10) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (minX > maxX || minY > maxY) {
          minX = 510; maxX = 744; minY = 556; maxY = 697;
        }
        return { minX, maxX, minY, maxY };
      }

      const boundsClosed = detectBounds(closedImg);
      const boundsClean = detectBounds(cleanImg);

      // Marco envolvente unificado para garantizar coincidencia perfecta:
      // mismo tamaño, mismo centro, misma altura, mismo ancho, misma silueta y misma posición vertical
      const minX = Math.min(boundsClosed.minX, boundsClean.minX);
      const maxX = Math.max(boundsClosed.maxX, boundsClean.maxX);
      const minY = Math.min(boundsClosed.minY, boundsClean.minY);
      const maxY = Math.max(boundsClosed.maxY, boundsClean.maxY);

      const cropW = maxX - minX + 1;
      const cropH = maxY - minY + 1;

      const canvasW = 512;
      const canvasH = Math.round(canvasW * (cropH / cropW));

      // 1. Lateral derecho cerrada (temptation-mystic-cap-side-closed.png)
      const canvasClosed = document.createElement('canvas');
      canvasClosed.width = canvasW;
      canvasClosed.height = canvasH;
      const ctxClosed = canvasClosed.getContext('2d');
      ctxClosed.drawImage(closedImg, minX, minY, cropW, cropH, 0, 0, canvasW, canvasH);

      capSideClosedTexture = new THREE.CanvasTexture(canvasClosed);
      capSideClosedTexture.colorSpace = THREE.SRGBColorSpace;
      capSideClosedTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      capSideClosedTexture.flipY = true;
      capSideClosedTexture.needsUpdate = true;
      capMultiviewUniforms.uCapSideClosedRight.value = capSideClosedTexture;

      // 2. Lateral derecho limpia (temptation-mystic-cap-side-clean.png)
      const canvasClean = document.createElement('canvas');
      canvasClean.width = canvasW;
      canvasClean.height = canvasH;
      const ctxClean = canvasClean.getContext('2d');
      ctxClean.drawImage(cleanImg, minX, minY, cropW, cropH, 0, 0, canvasW, canvasH);

      capSideCleanTexture = new THREE.CanvasTexture(canvasClean);
      capSideCleanTexture.colorSpace = THREE.SRGBColorSpace;
      capSideCleanTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      capSideCleanTexture.flipY = true;
      capSideCleanTexture.needsUpdate = true;
      capMultiviewUniforms.uCapSideCleanRight.value = capSideCleanTexture;

      // 3. Lateral izquierdo cerrada (reflejada horizontalmente mediante canvas)
      const canvasClosedM = document.createElement('canvas');
      canvasClosedM.width = canvasW;
      canvasClosedM.height = canvasH;
      const ctxClosedM = canvasClosedM.getContext('2d');
      ctxClosedM.save();
      ctxClosedM.translate(canvasW, 0);
      ctxClosedM.scale(-1, 1);
      ctxClosedM.drawImage(canvasClosed, 0, 0);
      ctxClosedM.restore();

      capSideClosedMirroredTexture = new THREE.CanvasTexture(canvasClosedM);
      capSideClosedMirroredTexture.colorSpace = THREE.SRGBColorSpace;
      capSideClosedMirroredTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      capSideClosedMirroredTexture.flipY = true;
      capSideClosedMirroredTexture.needsUpdate = true;
      capMultiviewUniforms.uCapSideClosedLeft.value = capSideClosedMirroredTexture;

      // 4. Lateral izquierdo limpia (reflejada horizontalmente mediante canvas)
      const canvasCleanM = document.createElement('canvas');
      canvasCleanM.width = canvasW;
      canvasCleanM.height = canvasH;
      const ctxCleanM = canvasCleanM.getContext('2d');
      ctxCleanM.save();
      ctxCleanM.translate(canvasW, 0);
      ctxCleanM.scale(-1, 1);
      ctxCleanM.drawImage(canvasClean, 0, 0);
      ctxCleanM.restore();

      capSideCleanMirroredTexture = new THREE.CanvasTexture(canvasCleanM);
      capSideCleanMirroredTexture.colorSpace = THREE.SRGBColorSpace;
      capSideCleanMirroredTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      capSideCleanMirroredTexture.flipY = true;
      capSideCleanMirroredTexture.needsUpdate = true;
      capMultiviewUniforms.uCapSideCleanLeft.value = capSideCleanMirroredTexture;

      // Actualizar referencias uTexRight / uTexLeft para retrocompatibilidad
      capRightCanvasTexture = capSideClosedTexture;
      capLeftCanvasTexture = capSideClosedMirroredTexture;
      capMultiviewUniforms.uTexRight.value = capSideClosedTexture;
      capMultiviewUniforms.uTexLeft.value = capSideClosedMirroredTexture;

      tryInitCapMultiviewShader();
    } catch (err) {
      console.error('Error al procesar texturas laterales de la tapa:', err);
    }
  }

  textureLoader.load(
    './assets/models/temptation-mystic-cap-side-closed.png',
    (loadedTex) => {
      closedImg = loadedTex.image;
      processCapSideTextures();
    },
    undefined,
    (err) => console.error('Error cargando assets/models/temptation-mystic-cap-side-closed.png:', err)
  );

  textureLoader.load(
    './assets/models/temptation-mystic-cap-side-clean.png',
    (loadedTex) => {
      cleanImg = loadedTex.image;
      processCapSideTextures();
    },
    undefined,
    (err) => console.error('Error cargando assets/models/temptation-mystic-cap-side-clean.png:', err)
  );
}

// ==========================================================================
// Shader Multivista Proyectivo Directo sobre cuerpoMesh
// ==========================================================================
function tryInitBodyMultiviewShader(cMesh, bSize, cBox, lBox, lSize) {
  if (cMesh) savedCuerpoMesh = cMesh;
  if (bSize) savedBottleSize = bSize;
  if (cBox) savedCuerpoBox = cBox;
  if (lBox) savedLocalBox = lBox;
  if (lSize) savedLocalSize = lSize;

  const targetMesh = savedCuerpoMesh;
  if (!targetMesh || !targetMesh.geometry) return;

  // Asegurar que cuerpoMesh tenga normales calculadas para el shader
  if (!targetMesh.geometry.attributes.normal) {
    targetMesh.geometry.computeVertexNormals();
  }

  // Si el interruptor está apagado, restaurar el material previo y los planos
  if (!USE_BODY_MULTIVIEW_SHADER) {
    if (bodyAdvertisingShader && targetMesh.material !== bodyAdvertisingShader) {
      targetMesh.material = bodyAdvertisingShader;
      targetMesh.material.needsUpdate = true;
    }
    return;
  }

  // Verificar que las 4 texturas de las 4 vistas estén completamente cargadas y generadas
  if (
    !bodyFrontCanvasTexture ||
    !bodyBackCanvasTexture ||
    !bodyRightCanvasTexture ||
    !bodyLeftCanvasTexture
  ) {
    return;
  }

  // Asegurar bounding box local
  if (!savedLocalBox || !savedLocalSize) {
    targetMesh.geometry.computeBoundingBox();
    savedLocalBox = targetMesh.geometry.boundingBox;
    savedLocalSize = savedLocalBox.getSize(new THREE.Vector3());
  }

  bodyMultiviewUniforms.uTexFront.value = bodyFrontTexture || bodyFrontCanvasTexture;
  bodyMultiviewUniforms.uTexBack.value = bodyBackTexture || bodyBackCanvasTexture;
  bodyMultiviewUniforms.uTexRight.value = bodyRightCanvasTexture;
  bodyMultiviewUniforms.uTexLeft.value = bodyLeftCanvasTexture;
  bodyMultiviewUniforms.uLocalBoxMin.value.set(savedLocalBox.min.x, savedLocalBox.min.y, savedLocalBox.min.z);
  bodyMultiviewUniforms.uLocalBoxSize.value.set(savedLocalSize.x, savedLocalSize.y, savedLocalSize.z);

  try {
    if (!bodyMultiviewMaterial) {
      bodyMultiviewMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.20,
        metalness: 0.02,
        clearcoat: 0.85,
        clearcoatRoughness: 0.10,
        reflectivity: 0.5,
        transmission: 0.0,
        transparent: false,
        opacity: 1.0,
        side: THREE.FrontSide,
        toneMapped: true,
      });

      bodyMultiviewMaterial.onBeforeCompile = (shader) => {
        bodyMultiviewMaterial.userData.shader = shader;
        shader.uniforms.uTexFront = bodyMultiviewUniforms.uTexFront;
        shader.uniforms.uTexBack = bodyMultiviewUniforms.uTexBack;
        shader.uniforms.uTexRight = bodyMultiviewUniforms.uTexRight;
        shader.uniforms.uTexLeft = bodyMultiviewUniforms.uTexLeft;
        shader.uniforms.uLocalBoxMin = bodyMultiviewUniforms.uLocalBoxMin;
        shader.uniforms.uLocalBoxSize = bodyMultiviewUniforms.uLocalBoxSize;
        shader.uniforms.uBaseBurgundy = bodyMultiviewUniforms.uBaseBurgundy;

        shader.vertexShader = shader.vertexShader.replace(
          '#include <common>',
          `#include <common>
varying vec3 vMultiviewLocalPos;
varying vec3 vMultiviewLocalNormal;`
        );

        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
vMultiviewLocalPos = position;
vMultiviewLocalNormal = normal;`
        );

        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <common>',
          `#include <common>
varying vec3 vMultiviewLocalPos;
varying vec3 vMultiviewLocalNormal;
uniform sampler2D uTexFront;
uniform sampler2D uTexBack;
uniform sampler2D uTexRight;
uniform sampler2D uTexLeft;
uniform vec3 uLocalBoxMin;
uniform vec3 uLocalBoxSize;
uniform vec3 uBaseBurgundy;

vec4 sampleMultiviewPhoto(sampler2D tex, vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    return vec4(0.0);
  }
  return texture2D(tex, uv);
}`
        );

        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
vec3 normPos = (vMultiviewLocalPos - uLocalBoxMin) / uLocalBoxSize;

// 1. Proyección frontal (+Z, límite superior extendido ~3% hacia arriba para cubrir el hombro frontal)
vec2 uvFront = vec2(
  (normPos.x - 0.5) / 0.985 + 0.5,
  (normPos.y - 0.5) / 1.015 + 0.485
);
vec4 colFront = sampleMultiviewPhoto(uTexFront, uvFront);

// 2. Proyección posterior (-Z, con desplazamiento de 1.2% hacia la izquierda aprobada)
vec2 uvBack = vec2(1.0 - ((normPos.x - 0.5) / 0.985 + 0.5) + 0.012, (normPos.y - 0.5) / 0.992 + 0.5);
vec4 colBack = sampleMultiviewPhoto(uTexBack, uvBack);

// 3. Proyección lateral derecha (+X, límite superior extendido ~4.5% hacia arriba para cubrir el hombro)
vec2 uvRight = vec2(
  1.0 - ((normPos.z - 0.5) / 0.98 + 0.5),
  (normPos.y - 0.5) / 1.03 + 0.480
);
vec4 colRight = sampleMultiviewPhoto(uTexRight, uvRight);

// 4. Proyección lateral izquierda (-X, reflejada horizontalmente, límite superior extendido ~4.5%)
vec2 uvLeft = vec2(
  ((normPos.z - 0.5) / 0.98 + 0.5),
  (normPos.y - 0.5) / 1.03 + 0.480
);
vec4 colLeft = sampleMultiviewPhoto(uTexLeft, uvLeft);

// 5. Pesos según normales locales para mezcla suave en curvaturas y biseles
vec3 n = normalize(vMultiviewLocalNormal);
float wFront = max(0.0, n.z);
float wBack  = max(0.0, -n.z);
float wRight = max(0.0, n.x);
float wLeft  = max(0.0, -n.x);

vec4 dirWeights = vec4(wFront, wBack, wRight, wLeft);
vec4 weights = pow(dirWeights, vec4(4.0));
float totalWeight = weights.x + weights.y + weights.z + weights.w;
weights /= max(totalWeight, 0.0001);

// Respetar canal alfa de cada vista y fundir con el vidrio borgoña base
vec3 cFront = mix(uBaseBurgundy, colFront.rgb, colFront.a);
vec3 cBack  = mix(uBaseBurgundy, colBack.rgb, colBack.a);
vec3 cRight = mix(uBaseBurgundy, colRight.rgb, colRight.a);
vec3 cLeft  = mix(uBaseBurgundy, colLeft.rgb, colLeft.a);

vec3 blendedPhoto = cFront * weights.x +
                    cBack  * weights.y +
                    cRight * weights.z +
                    cLeft  * weights.w;

// Suavizado en cuello/hombro superior y base inferior (mantiene hombro cubierto)
float horizFactor = smoothstep(0.98, 0.84, abs(n.y));
diffuseColor.rgb = mix(uBaseBurgundy, blendedPhoto, horizFactor);
diffuseColor.a = 1.0;`
        );
      };
    } else if (bodyMultiviewMaterial.userData && bodyMultiviewMaterial.userData.shader) {
      const s = bodyMultiviewMaterial.userData.shader;
      if (s.uniforms.uTexFront) s.uniforms.uTexFront.value = bodyMultiviewUniforms.uTexFront.value;
      if (s.uniforms.uTexBack) s.uniforms.uTexBack.value = bodyMultiviewUniforms.uTexBack.value;
      if (s.uniforms.uTexRight) s.uniforms.uTexRight.value = bodyMultiviewUniforms.uTexRight.value;
      if (s.uniforms.uTexLeft) s.uniforms.uTexLeft.value = bodyMultiviewUniforms.uTexLeft.value;
    }

    targetMesh.material = bodyMultiviewMaterial;
    targetMesh.material.needsUpdate = true;

    console.log('✨ [Shader Multivista] Cuerpo actualizado exitosamente con shader proyectivo en malla 3D.');
  } catch (err) {
    console.error('Error al inicializar shader multivista del cuerpo:', err);
    // Restaurar material en caso de error
    if (bodyAdvertisingShader) {
      targetMesh.material = bodyAdvertisingShader;
    }
  }
}

// ==========================================================================
// Shader Multivista Proyectivo Directo sobre tapaMesh
// ==========================================================================
function tryInitCapMultiviewShader(tMesh, tBox, lBox, lSize) {
  if (tMesh) savedTapaMesh = tMesh;
  if (tBox) savedTapaBox = tBox;
  if (lBox) savedTapaLocalBox = lBox;
  if (lSize) savedTapaLocalSize = lSize;

  const targetMesh = savedTapaMesh;
  if (!targetMesh || !targetMesh.geometry) return;

  // Asegurar normales calculadas para el shader de la tapa
  if (!targetMesh.geometry.attributes.normal) {
    targetMesh.geometry.computeVertexNormals();
  }

  // Si el interruptor está apagado, restaurar el material previo y los planos
  if (!USE_CAP_MULTIVIEW_SHADER) {
    if (capMaterial && targetMesh.material !== capMaterial) {
      targetMesh.material = capMaterial;
      targetMesh.material.needsUpdate = true;
    }
    return;
  }

  // Verificar que las 4 texturas de las 4 vistas de la tapa estén listas
  if (
    !capOriginalFrontTexture ||
    !capOriginalBackTexture ||
    (!capSideClosedTexture && !capRightCanvasTexture) ||
    (!capSideClosedMirroredTexture && !capLeftCanvasTexture)
  ) {
    return;
  }

  // Asegurar bounding box local
  if (!savedTapaLocalBox || !savedTapaLocalSize) {
    targetMesh.geometry.computeBoundingBox();
    savedTapaLocalBox = targetMesh.geometry.boundingBox;
    savedTapaLocalSize = savedTapaLocalBox.getSize(new THREE.Vector3());
    savedTapaLocalCenter = savedTapaLocalBox.getCenter(new THREE.Vector3());
  } else if (!savedTapaLocalCenter) {
    savedTapaLocalCenter = savedTapaLocalBox.getCenter(new THREE.Vector3());
  }

  const sideClosedRight = capSideClosedTexture || capRightCanvasTexture;
  const sideCleanRight = capSideCleanTexture || sideClosedRight;
  const sideClosedLeft = capSideClosedMirroredTexture || capLeftCanvasTexture;
  const sideCleanLeft = capSideCleanMirroredTexture || sideClosedLeft;

  capMultiviewUniforms.uCapOrigFront.value = capOriginalFrontTexture;
  capMultiviewUniforms.uCapOrigBack.value = capOriginalBackTexture;
  capMultiviewUniforms.uCapCleanFront.value = capCleanFrontTexture || capOriginalFrontTexture;
  capMultiviewUniforms.uCapCleanBack.value = capCleanBackTexture || capOriginalBackTexture;
  capMultiviewUniforms.uCapSideClosedRight.value = sideClosedRight;
  capMultiviewUniforms.uCapSideCleanRight.value = sideCleanRight;
  capMultiviewUniforms.uCapSideClosedLeft.value = sideClosedLeft;
  capMultiviewUniforms.uCapSideCleanLeft.value = sideCleanLeft;
  capMultiviewUniforms.uTexRight.value = sideClosedRight;
  capMultiviewUniforms.uTexLeft.value = sideClosedLeft;
  capMultiviewUniforms.uCapLocalBoxMin.value.set(
    savedTapaLocalBox.min.x,
    savedTapaLocalBox.min.y,
    savedTapaLocalBox.min.z
  );
  capMultiviewUniforms.uCapLocalBoxSize.value.set(
    savedTapaLocalSize.x,
    savedTapaLocalSize.y,
    savedTapaLocalSize.z
  );
  capMultiviewUniforms.uCapLocalCenter.value.set(
    savedTapaLocalCenter.x,
    savedTapaLocalCenter.y,
    savedTapaLocalCenter.z
  );
  capMultiviewUniforms.uHoleRadius.value = 0.00750;
  capMultiviewUniforms.uDiskRadius.value = 0.00695;

  try {
    if (!capMultiviewMaterial) {
      capMultiviewMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.18,
        metalness: 0.04,
        clearcoat: 0.85,
        clearcoatRoughness: 0.10,
        reflectivity: 0.65,
        transmission: 0.0,
        transparent: false,
        opacity: 1.0,
        side: THREE.DoubleSide,
        toneMapped: true,
      });

      capMultiviewMaterial.onBeforeCompile = (shader) => {
        capMultiviewMaterial.userData.shader = shader;
        shader.uniforms.uCapOrigFront = capMultiviewUniforms.uCapOrigFront;
        shader.uniforms.uCapOrigBack = capMultiviewUniforms.uCapOrigBack;
        shader.uniforms.uCapCleanFront = capMultiviewUniforms.uCapCleanFront;
        shader.uniforms.uCapCleanBack = capMultiviewUniforms.uCapCleanBack;
        shader.uniforms.uCapSideClosedRight = capMultiviewUniforms.uCapSideClosedRight;
        shader.uniforms.uCapSideCleanRight = capMultiviewUniforms.uCapSideCleanRight;
        shader.uniforms.uCapSideClosedLeft = capMultiviewUniforms.uCapSideClosedLeft;
        shader.uniforms.uCapSideCleanLeft = capMultiviewUniforms.uCapSideCleanLeft;
        shader.uniforms.uTexRight = capMultiviewUniforms.uTexRight;
        shader.uniforms.uTexLeft = capMultiviewUniforms.uTexLeft;
        shader.uniforms.uCapCleanMix = capMultiviewUniforms.uCapCleanMix;
        shader.uniforms.uCapLocalBoxMin = capMultiviewUniforms.uCapLocalBoxMin;
        shader.uniforms.uCapLocalBoxSize = capMultiviewUniforms.uCapLocalBoxSize;
        shader.uniforms.uCapLocalCenter = capMultiviewUniforms.uCapLocalCenter;
        shader.uniforms.uHoleRadius = capMultiviewUniforms.uHoleRadius;
        shader.uniforms.uDiskRadius = capMultiviewUniforms.uDiskRadius;
        shader.uniforms.uBaseRuby = capMultiviewUniforms.uBaseRuby;
        shader.uniforms.uCapParallaxShiftFront = capMultiviewUniforms.uCapParallaxShiftFront;
        shader.uniforms.uCapParallaxShiftBack = capMultiviewUniforms.uCapParallaxShiftBack;
        shader.uniforms.uCapLateralProgressFront = capMultiviewUniforms.uCapLateralProgressFront;
        shader.uniforms.uCapLateralProgressBack = capMultiviewUniforms.uCapLateralProgressBack;

        shader.vertexShader = shader.vertexShader.replace(
          '#include <common>',
          `#include <common>
precision highp float;
precision highp int;
varying vec3 vCapLocalPos;
varying vec3 vCapLocalNormal;`
        );

        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
vCapLocalPos = position;
vCapLocalNormal = normal;`
        );

        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <common>',
          `#include <common>
precision highp float;
precision highp int;
varying vec3 vCapLocalPos;
varying vec3 vCapLocalNormal;
uniform sampler2D uCapOrigFront;
uniform sampler2D uCapOrigBack;
uniform sampler2D uCapCleanFront;
uniform sampler2D uCapCleanBack;
uniform sampler2D uCapSideClosedRight;
uniform sampler2D uCapSideCleanRight;
uniform sampler2D uCapSideClosedLeft;
uniform sampler2D uCapSideCleanLeft;
uniform sampler2D uTexRight;
uniform sampler2D uTexLeft;
uniform float uCapCleanMix;
uniform vec3 uCapLocalBoxMin;
uniform vec3 uCapLocalBoxSize;
uniform vec3 uCapLocalCenter;
uniform float uHoleRadius;
uniform float uDiskRadius;
uniform vec3 uBaseRuby;
uniform float uCapParallaxShiftFront;
uniform float uCapParallaxShiftBack;
uniform float uCapLateralProgressFront;
uniform float uCapLateralProgressBack;

vec4 sampleCapPhoto(sampler2D tex, vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    return vec4(0.0);
  }
  return texture2D(tex, uv);
}`
        );

        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
vec3 normPos = (vCapLocalPos - uCapLocalBoxMin) / uCapLocalBoxSize;

// -------------------------------------------------------------
// 1. Proyección frontal (+Z): cristal limpio sin cavidad oscura falsa
// -------------------------------------------------------------
vec2 uvFront = vec2(
  (normPos.x - 0.5) / 1.085 + 0.5,
  (normPos.y - 0.5) / 0.94 + 0.46
);
vec4 colBgFront = sampleCapPhoto(uCapCleanFront, uvFront);
vec4 colFront = colBgFront;

// -------------------------------------------------------------
// 2. Proyección posterior (-Z): cristal limpio sin cavidad oscura falsa
// -------------------------------------------------------------
vec2 uvBack = vec2(
  1.0 - ((normPos.x - 0.5) / 1.085 + 0.5),
  (normPos.y - 0.5) / 0.94 + 0.46
);
vec4 colBgBack = sampleCapPhoto(uCapCleanBack, uvBack);
vec4 colBack = colBgBack;

// -------------------------------------------------------------
// 3. Proyección lateral derecha (+X): lateral limpio sin cavidad falsa
// -------------------------------------------------------------
vec2 uvRight = vec2(
  1.0 - ((normPos.z - 0.5) / 1.095 + 0.5),
  (normPos.y - 0.5) / 0.98 + 0.5
);
vec4 sideRightColor = sampleCapPhoto(uCapSideCleanRight, uvRight);

// -------------------------------------------------------------
// 4. Proyección lateral izquierda (-X): lateral limpio sin cavidad falsa
// -------------------------------------------------------------
vec2 uvLeft = vec2(
  ((normPos.z - 0.5) / 1.095 + 0.5),
  (normPos.y - 0.5) / 0.98 + 0.5
);
vec4 sideLeftColor = sampleCapPhoto(uCapSideCleanLeft, uvLeft);

// -------------------------------------------------------------
// 5. Pesos según normales locales para mezcla suave en curvaturas
// -------------------------------------------------------------
vec3 n = normalize(vCapLocalNormal);
float wFront = max(0.0, n.z);
float wBack  = max(0.0, -n.z);
float wRight = max(0.0, n.x);
float wLeft  = max(0.0, -n.x);

vec4 dirWeights = vec4(wFront, wBack, wRight, wLeft);
vec4 weights = pow(dirWeights, vec4(4.0));
float totalWeight = weights.x + weights.y + weights.z + weights.w;
weights /= max(totalWeight, 0.0001);

// Respetar canal alfa de cada vista y fundir con el material rubí base
vec3 cFront = mix(uBaseRuby, colFront.rgb, colFront.a);
vec3 cBack  = mix(uBaseRuby, colBack.rgb, colBack.a);
vec3 cRight = mix(uBaseRuby, sideRightColor.rgb, sideRightColor.a);
vec3 cLeft  = mix(uBaseRuby, sideLeftColor.rgb, sideLeftColor.a);

vec3 blendedPhoto = cFront * weights.x +
                    cBack  * weights.y +
                    cRight * weights.z +
                    cLeft  * weights.w;

// -------------------------------------------------------------
// 6. Superficie Superior e Inferior: Transición Suave con Rubí Base
// -------------------------------------------------------------
float horizFactor = smoothstep(0.92, 0.65, abs(n.y));
vec3 finalCapColor = mix(uBaseRuby, blendedPhoto, horizFactor);

diffuseColor.rgb = finalCapColor;
diffuseColor.a = 1.0;`
        );
      };
    } else if (capMultiviewMaterial.userData && capMultiviewMaterial.userData.shader) {
      const s = capMultiviewMaterial.userData.shader;
      if (s.uniforms.uCapOrigFront) s.uniforms.uCapOrigFront.value = capMultiviewUniforms.uCapOrigFront.value;
      if (s.uniforms.uCapOrigBack) s.uniforms.uCapOrigBack.value = capMultiviewUniforms.uCapOrigBack.value;
      if (s.uniforms.uCapCleanFront) s.uniforms.uCapCleanFront.value = capMultiviewUniforms.uCapCleanFront.value;
      if (s.uniforms.uCapCleanBack) s.uniforms.uCapCleanBack.value = capMultiviewUniforms.uCapCleanBack.value;
      if (s.uniforms.uCapSideClosedRight) s.uniforms.uCapSideClosedRight.value = capMultiviewUniforms.uCapSideClosedRight.value;
      if (s.uniforms.uCapSideCleanRight) s.uniforms.uCapSideCleanRight.value = capMultiviewUniforms.uCapSideCleanRight.value;
      if (s.uniforms.uCapSideClosedLeft) s.uniforms.uCapSideClosedLeft.value = capMultiviewUniforms.uCapSideClosedLeft.value;
      if (s.uniforms.uCapSideCleanLeft) s.uniforms.uCapSideCleanLeft.value = capMultiviewUniforms.uCapSideCleanLeft.value;
      if (s.uniforms.uTexRight) s.uniforms.uTexRight.value = capMultiviewUniforms.uTexRight.value;
      if (s.uniforms.uTexLeft) s.uniforms.uTexLeft.value = capMultiviewUniforms.uTexLeft.value;
      if (s.uniforms.uCapLocalCenter) s.uniforms.uCapLocalCenter.value = capMultiviewUniforms.uCapLocalCenter.value;
      if (s.uniforms.uHoleRadius) s.uniforms.uHoleRadius.value = capMultiviewUniforms.uHoleRadius.value;
      if (s.uniforms.uDiskRadius) s.uniforms.uDiskRadius.value = capMultiviewUniforms.uDiskRadius.value;
      if (s.uniforms.uCapParallaxShiftFront) s.uniforms.uCapParallaxShiftFront.value = capMultiviewUniforms.uCapParallaxShiftFront.value;
      if (s.uniforms.uCapParallaxShiftBack) s.uniforms.uCapParallaxShiftBack.value = capMultiviewUniforms.uCapParallaxShiftBack.value;
      if (s.uniforms.uCapLateralProgressFront) s.uniforms.uCapLateralProgressFront.value = capMultiviewUniforms.uCapLateralProgressFront.value;
      if (s.uniforms.uCapLateralProgressBack) s.uniforms.uCapLateralProgressBack.value = capMultiviewUniforms.uCapLateralProgressBack.value;
    }

    targetMesh.material = capMultiviewMaterial;
    targetMesh.material.needsUpdate = true;

    console.log('✨ [Shader Multivista] Tapa actualizada exitosamente con shader proyectivo en malla 3D.');
  } catch (err) {
    console.error('Error al inicializar shader multivista de la tapa:', err);
    // Restaurar material en caso de error
    if (capMaterial) {
      targetMesh.material = capMaterial;
      targetMesh.material.needsUpdate = true;
    }
  }
}


// ==========================================================================
// Manguera Interna Frontal Procedural (Dip Tube)
// ==========================================================================
function buildDipTube() {
  const group = new THREE.Group();
  group.name = 'dipTubeGroup';

  // Material de la manguera: gris cálido translúcido según referencias reales
  // Rugosidad y reflectividad calibradas para difuminar reflejos especulares y evitar destellos bruscos
  dipTubeMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x8a8580,
    metalness: 0,
    roughness: 0.88,
    reflectivity: 0.2,
    clearcoat: 0.0,
    transparent: true,
    opacity: 0.38,
    transmission: 0.0,
    depthWrite: false,
    depthTest: false,
    side: THREE.FrontSide,
    toneMapped: true,
  });

  // Trayectoria suave recortada en el tramo superior:
  // Comienza dentro del frasco justo debajo del conector transparente,
  // baja vertical por el centro, pasa detrás del área del nombre, se curva suavemente a la derecha y termina junto a YANBAL.
  const points = [
    new THREE.Vector3(0.0000, 0.0242, 0.0034),
    new THREE.Vector3(0.0000, 0.0200, 0.0035),
    new THREE.Vector3(0.0003, 0.0100, 0.0040),
    new THREE.Vector3(0.0008, 0.0040, 0.0045),
    new THREE.Vector3(0.0018, -0.0020, 0.0048),
    new THREE.Vector3(0.0038, -0.0080, 0.0050),
    new THREE.Vector3(0.0075, -0.0190, 0.0050),
    new THREE.Vector3(0.0118, -0.0310, 0.0048),
    new THREE.Vector3(0.0148, -0.0400, 0.0045),
    new THREE.Vector3(0.0162, -0.0450, 0.0042),
  ];

  const curve = new THREE.CatmullRomCurve3(points);
  const tubeGeo = new THREE.TubeGeometry(curve, 64, 0.00055, 12, false);
  const tubeMesh = new THREE.Mesh(tubeGeo, dipTubeMaterial);
  tubeMesh.name = 'dipTubeMesh';
  tubeMesh.renderOrder = 2;
  group.add(tubeMesh);

  // Extremo inferior ligeramente redondeado
  const endCapGeo = new THREE.SphereGeometry(0.00055, 12, 12);
  const endCapMesh = new THREE.Mesh(endCapGeo, dipTubeMaterial);
  endCapMesh.name = 'dipTubeEndCap';
  endCapMesh.position.copy(points[points.length - 1]);
  endCapMesh.renderOrder = 2;
  group.add(endCapMesh);

  return group;
}

// ==========================================================================
// Conector Transparente Escalonado (entre collar metálico y manguera)
// ==========================================================================
function buildDipTubeConnector() {
  const group = new THREE.Group();
  group.name = 'dipTubeConnectorGroup';

  // Material físico transparente: plástico cristalino grisáceo estable
  // Mantiene constantes color, roughness, metalness, transmission y clearcoat para eliminar glitches
  dipTubeConnectorMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xc8c5bd,
    transparent: true,
    opacity: 0.38,
    transmission: 0.0,
    roughness: 0.45,
    metalness: 0,
    clearcoat: 0.0,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: true,
  });

  // Conector de 3 niveles escalonados mediante geometría continua de revolución:
  // Límite inferior del collar metálico: Y = 0.0294.
  // Nivel 1 (superior): radio 0.0026, de Y=0.02935 a Y=0.02775 (comienza justo debajo del anillo)
  // Nivel 2 (intermedio): radio 0.0019, de Y=0.02775 a Y=0.02595
  // Nivel 3 (inferior cónico): de radio 0.0014 a 0.00075, de Y=0.02595 a Y=0.02375
  const profilePoints = [
    new THREE.Vector2(0.00075, 0.02375), // Extremo inferior (abertura de unión donde entra la manguera)
    new THREE.Vector2(0.00140, 0.02595), // Cima nivel 3 cónico
    new THREE.Vector2(0.00190, 0.02595), // Escalón horizontal hacia nivel 2
    new THREE.Vector2(0.00190, 0.02775), // Cima nivel 2
    new THREE.Vector2(0.00260, 0.02775), // Escalón horizontal hacia nivel 1
    new THREE.Vector2(0.00260, 0.02935), // Cima nivel 1 (límite inferior real del collar metálico)
    new THREE.Vector2(0.00000, 0.02935), // Tapa superior sellada debajo del collar
  ];

  const connectorGeo = new THREE.LatheGeometry(profilePoints, 32);
  connectorGeo.computeVertexNormals();

  const connectorMesh = new THREE.Mesh(connectorGeo, dipTubeConnectorMaterial);
  connectorMesh.name = 'connectorLevel1';
  connectorMesh.position.set(0, 0, 0.0034);
  connectorMesh.renderOrder = 2;
  group.add(connectorMesh);

  return group;
}

// ==========================================================================
// 5. Construcción Procedimental del Atomizador (atomizerGroup)
// ==========================================================================
function buildProceduralAtomizer() {
  const group = new THREE.Group();
  group.name = 'atomizerGroup';
  group.renderOrder = 4;

  // a) Collar o anillo inferior metálico alrededor del cuello
  // Construcción mediante perfil torneado (LatheGeometry) con biseles superior e inferior reales
  // y laterales perfectamente rectos según referencias
  const ringRadius = 0.0116;          // Diámetro exterior 0.0232 m
  const ringHeight = 0.0131;          // Altura 13.1 mm (cubre desde Y = 0.0294 hasta Y = 0.0425)
  const ringHalfH = ringHeight / 2;    // 0.00655 m

  const ringPoints = [
    new THREE.Vector2(0.0070, -ringHalfH),           // Borde interior inferior
    new THREE.Vector2(0.0111, -ringHalfH),           // Borde plano inferior antes del bisel
    new THREE.Vector2(0.0115, -ringHalfH + 0.00020), // Bisel inferior redondeado suave
    new THREE.Vector2(ringRadius, -ringHalfH + 0.00055), // Inicio de pared cilíndrica recta exterior
    new THREE.Vector2(ringRadius, ringHalfH - 0.00055),  // Fin de pared cilíndrica recta exterior
    new THREE.Vector2(0.0115, ringHalfH - 0.00020),  // Bisel exterior superior suave
    new THREE.Vector2(0.0111, ringHalfH),            // Cara plana superior inicio
    new THREE.Vector2(0.0091, ringHalfH),            // Cara plana superior fin
    new THREE.Vector2(0.0089, ringHalfH - 0.00030),   // Bisel interior superior
    new THREE.Vector2(0.0089, -0.00300),             // Cavidad cilíndrica interna para el recorrido del pulsador
    new THREE.Vector2(0.0070, -0.00350),             // Transición de cavidad interna
    new THREE.Vector2(0.0070, -ringHalfH),           // Cierre inferior
  ];

  const ringGeo = new THREE.LatheGeometry(ringPoints, 64);
  ringGeo.computeVertexNormals();
  const ringMesh = new THREE.Mesh(ringGeo, atomizerPieceMaterial);
  ringMesh.name = 'atomizerRing';
  ringMesh.position.set(0, 0.03595, 0); // Posición centrada entre Y = 0.0294 y 0.0425
  ringMesh.renderOrder = 4;
  group.add(ringMesh);

  // Anillo intermedio abombado toroidal (atomizerBevelRing) entre el collar y el pulsador
  const torusRadius = 0.0098; // Radio mayor
  const torusTube = 0.0015;   // Grosor del tubo (diámetro 3 mm)
  const torusGeo = new THREE.TorusGeometry(torusRadius, torusTube, 20, 64);
  torusGeo.rotateX(Math.PI / 2); // Orientación horizontal plana
  torusGeo.computeVertexNormals();
  const torusMesh = new THREE.Mesh(torusGeo, atomizerPieceMaterial);
  torusMesh.name = 'atomizerBevelRing';
  torusMesh.position.set(0, 0.0430, 0); // Asentado sobre el tope del collar
  torusMesh.renderOrder = 4;
  group.add(torusMesh);

  // Grupo del pulsador móvil (cabeza presionable)
  pulsadorGroup = new THREE.Group();
  pulsadorGroup.name = 'pulsadorGroup';
  pulsadorGroup.position.set(0, 0.0450, 0); // Asentado sobre el nuevo anillo
  pulsadorGroup.renderOrder = 4;

  // b) Pulsador superior cilíndrico más estrecho con bisel suave en el borde superior
  // Geometría cilíndrica cerrada de 360°, con devanado ascendente (de base a tope)
  // para garantizar normales 100% exteriores, tapa superior y pared lateral completas
  const buttonRadius = 0.0083; // Diámetro exterior 0.0166 m (proporción anillo/pulsador = 1.398 ~ 1.40)
  const buttonPoints = [
    new THREE.Vector2(0.0001, -0.0035),              // Centro de la base inferior (oculta dentro del toroide y collar)
    new THREE.Vector2(buttonRadius, -0.0035),        // Borde inferior del faldón dentro del anillo
    new THREE.Vector2(buttonRadius, 0.0142),         // Pared cilíndrica recta exterior extendida
    new THREE.Vector2(0.0081, 0.0145),               // Bisel redondeado superior 1
    new THREE.Vector2(0.0078, 0.0147),               // Bisel redondeado superior 2
    new THREE.Vector2(0.0074, 0.0148),               // Borde exterior plano de la tapa superior
    new THREE.Vector2(0.0001, 0.0148),               // Centro de la tapa superior (tope a 0.0450 + 0.0148 = 0.0598 m)
  ];

  const buttonGeo = new THREE.LatheGeometry(buttonPoints, 64);
  buttonGeo.computeVertexNormals();
  buttonMesh = new THREE.Mesh(buttonGeo, atomizerPieceMaterial);
  buttonMesh.name = 'atomizerButton';
  buttonMesh.renderOrder = 4;
  pulsadorGroup.add(buttonMesh);

  // c) Boquilla metálica en la cara frontal (+Z)
  const nozzleOuterGeo = new THREE.CylinderGeometry(0.0011, 0.0011, 0.0006, 32);
  nozzleOuterGeo.rotateX(Math.PI / 2);
  nozzleOuterGeo.computeVertexNormals();
  nozzleOuterMesh = new THREE.Mesh(nozzleOuterGeo, atomizerPieceMaterial);
  nozzleOuterMesh.name = 'sprayNozzleOuter';
  nozzleOuterMesh.position.set(0, ATOMIZER_SEALED.nozzleY, buttonRadius + 0.00015);
  nozzleOuterMesh.renderOrder = 4;
  pulsadorGroup.add(nozzleOuterMesh);

  // Orificio oscuro central de spray (origen de las partículas)
  const pinholeGeo = new THREE.CylinderGeometry(0.00045, 0.00045, 0.0007, 16);
  pinholeGeo.rotateX(Math.PI / 2);
  const pinholeMat = new THREE.MeshBasicMaterial({ color: 0x040404 });
  sprayPinholeMesh = new THREE.Mesh(pinholeGeo, pinholeMat);
  sprayPinholeMesh.name = 'sprayPinhole';
  sprayPinholeMesh.position.set(0, ATOMIZER_SEALED.nozzleY, buttonRadius + 0.00025);
  sprayPinholeMesh.renderOrder = 4;
  pulsadorGroup.add(sprayPinholeMesh);

  group.add(pulsadorGroup);
  return group;
}

// ==========================================================================
// 10. Simulación Visual del Agujero Central de la Tapa (Desactivado para modelo perforado)
// ==========================================================================
function buildSimulatedCapHole(targetCapGroup, capMesh) {
  // Desactivado: El modelo 3D 'temptation-mystic-perforado.glb' cuenta con la perforación geométrica real.
  // Ya no se requiere superponer discos, anillos ni cavidades procedimentales oscuras.
  return;
  const recessRadius = 0.00750; // Diámetro exterior de la cavidad (0.0150 m)
  const diskRadius = 0.00695;   // Diámetro interior del disco dorado (0.0139 m)
  const recessElevationY = capTopY + 0.00008; // Cota base sobre la superficie de la tapa
  const diskElevationY = capTopY + 0.00009;   // Cara dorada plana apenas hundida

  capRecessGroup = new THREE.Group();
  capRecessGroup.name = 'capRecessGroup';
  targetCapGroup.add(capRecessGroup);

  // 1. Cavidad exterior / Borde perimetral del hueco (RingGeometry): expresa el espesor del cristal sin tapar el círculo interior
  const recessGeo = new THREE.RingGeometry(diskRadius, recessRadius, 64);
  recessGeo.rotateX(-Math.PI / 2);
  const recessMat = new THREE.MeshBasicMaterial({
    color: 0x140508, // Borgoña extremadamente oscuro / negro cálido mate
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
    side: THREE.FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  capRecessShadowMesh = new THREE.Mesh(recessGeo, recessMat);
  capRecessShadowMesh.name = 'capRecessShadowMesh';
  capRecessShadowMesh.position.set(capCenter.x, recessElevationY, capCenter.z);
  capRecessGroup.add(capRecessShadowMesh);

  // 1b. Fondo oscuro profundo del orificio superior de la tapa abierta (CircleGeometry r = 0.0070)
  const holeDarkGeo = new THREE.CircleGeometry(0.0070, 64);
  holeDarkGeo.rotateX(-Math.PI / 2);
  capTopHoleDarkMaterial = new THREE.MeshBasicMaterial({
    color: 0x0d0205, // Negro/borgoña profundo
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    side: THREE.FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: -1.5,
    polygonOffsetUnits: -1.5,
  });
  capTopHoleDarkDisk = new THREE.Mesh(holeDarkGeo, capTopHoleDarkMaterial);
  capTopHoleDarkDisk.name = 'capTopHoleDarkDisk';
  capTopHoleDarkDisk.position.set(capCenter.x, recessElevationY, capCenter.z);
  capTopHoleDarkDisk.visible = false;
  capRecessGroup.add(capTopHoleDarkDisk);

  // 2. Cabeza circular real del atomizador: cara circular plana con oro champán aprobado
  // Pertenece al atomizador real (pulsadorGroup), no a la tapa
  const diskGeo = new THREE.CircleGeometry(diskRadius, 64);
  diskGeo.rotateX(-Math.PI / 2);
  capInsetAtomizerMaterial = new THREE.MeshMatcapMaterial({
    color: 0xffffff,
    matcap: atomizerChampagneMatcap,
    transparent: true,
    opacity: 1.0,
    depthTest: true,
    depthWrite: false,
    side: THREE.FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  capInsetAtomizerDisk = new THREE.Mesh(diskGeo, capInsetAtomizerMaterial);
  capInsetAtomizerDisk.name = 'capInsetAtomizerDisk';

  if (pulsadorGroup) {
    const diskLocalY = diskElevationY - pulsadorGroup.position.y;
    capInsetAtomizerDisk.position.set(0, diskLocalY, 0);
    pulsadorGroup.add(capInsetAtomizerDisk);
  } else {
    capInsetAtomizerDisk.position.set(capCenter.x, diskElevationY, capCenter.z);
    capRecessGroup.add(capInsetAtomizerDisk);
  }

  simulatedGoldAtomizerHead = capInsetAtomizerDisk;

  // Simulación independiente del hueco visto desde la cara inferior
  // de la tapa cuando esta se encuentra levantada.
  function createCapBottomRecessTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2;

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    // 1. Centro oscuro profundo (vacío de la cavidad):
    grad.addColorStop(0.00, 'rgba(10, 2, 4, 1.0)');
    grad.addColorStop(0.55, 'rgba(16, 3, 6, 1.0)');
    // 2. Transición hacia la pared cilíndrica interior (sombra sutil):
    grad.addColorStop(0.78, 'rgba(28, 5, 11, 0.98)');
    // 3. Borde interior sutil antes del bisel:
    grad.addColorStop(0.88, 'rgba(44, 7, 16, 0.95)');
    // 4. Borde perimetral con transición suave hacia la superficie roja de la tapa:
    grad.addColorStop(0.96, 'rgba(65, 10, 22, 0.65)');
    grad.addColorStop(1.00, 'rgba(65, 10, 22, 0.0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // Variables que controlan tamaño, posición y profundidad aparente del hueco inferior:
  const bottomRecessRadius = 0.0086; // Diámetro de cavidad: 0.0172 m (ligeramente mayor que la cabeza del atomizador de 0.0166 m)
  const bottomRecessElevationY = capBottomY - 0.00008; // Cota apenas por debajo de la superficie inferior (evita z-fighting)

  const bottomRecessGeo = new THREE.CircleGeometry(bottomRecessRadius, 64);
  bottomRecessGeo.rotateX(Math.PI / 2); // Orientación normal hacia abajo (-Y)
  bottomRecessGeo.computeVertexNormals();

  const bottomRecessTexture = createCapBottomRecessTexture();
  capBottomRecessMaterial = new THREE.MeshBasicMaterial({
    map: bottomRecessTexture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.FrontSide, // Solo visible desde abajo; culleada desde arriba
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  capBottomRecessMesh = new THREE.Mesh(bottomRecessGeo, capBottomRecessMaterial);
  capBottomRecessMesh.name = 'capBottomRecessMesh';
  capBottomRecessMesh.position.set(capCenter.x, bottomRecessElevationY, capCenter.z);
  capBottomRecessMesh.visible = false;
  targetCapGroup.add(capBottomRecessMesh);
}

// ==========================================================================
// PASO 7, 8 y 9: Iluminación de Estudio Responsiva (Softboxes y Acento Cuello)
// ==========================================================================
// ==========================================================================
// ==========================================================================
// ==========================================================================
// ==========================================================================
// PASO 2, 3, 4, 5, 6 y 7: Shader Publicitario de Vidrio Borgoña
// ==========================================================================
function createBodyAdvertisingShader(horizontalData, verticalData) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uCenterColor: {
        value: new THREE.Vector3(0.055, 0.001, 0.004),
      },
      uMidColor: {
        value: new THREE.Vector3(0.11, 0.002, 0.008),
      },
      uEdgeColor: {
        value: new THREE.Vector3(0.22, 0.005, 0.018),
      },
      uHighlightColor: {
        value: new THREE.Vector3(0.55, 0.055, 0.09),
      },
      uFresnelColor: {
        value: new THREE.Vector3(0.32, 0.012, 0.04),
      },
      uHighlightStrength: {
        value: 0.06,
      },
      uFresnelStrength: {
        value: 0.08,
      },
      uHorizontalAxis: { value: horizontalData.axis },
      uVerticalAxis: { value: verticalData.axis },
      uHorizontalMin: { value: horizontalData.min },
      uHorizontalMax: { value: horizontalData.max },
      uVerticalMin: { value: verticalData.min },
      uVerticalMax: { value: verticalData.max },
    },
    vertexShader: `
      varying vec3 vLocalPosition;
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;

      void main() {
        vLocalPosition = position;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        vViewNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uCenterColor;
      uniform vec3 uMidColor;
      uniform vec3 uEdgeColor;
      uniform vec3 uHighlightColor;
      uniform vec3 uFresnelColor;
      uniform float uHighlightStrength;
      uniform float uFresnelStrength;
      uniform vec3 uHorizontalAxis;
      uniform vec3 uVerticalAxis;
      uniform float uHorizontalMin;
      uniform float uHorizontalMax;
      uniform float uVerticalMin;
      uniform float uVerticalMax;

      varying vec3 vLocalPosition;
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;

      float verticalHighlight(float position, float center, float width) {
        float distanceValue = (position - center) / width;
        return exp(-(distanceValue * distanceValue));
      }

      void main() {
        // Coordenada horizontal normalizada
        float horizontalPosition = dot(vLocalPosition, uHorizontalAxis);
        float x01 = clamp(
          (horizontalPosition - uHorizontalMin) /
          max(uHorizontalMax - uHorizontalMin, 0.00001),
          0.0,
          1.0
        );

        // Transición borgoña hacia rubí
        float edgeDistance = abs(x01 - 0.5) * 2.0;
        float midMix = smoothstep(0.15, 0.72, edgeDistance);
        float edgeMix = smoothstep(0.68, 1.0, edgeDistance);

        vec3 finalColor = mix(uCenterColor, uMidColor, midMix);
        finalColor = mix(finalColor, uEdgeColor, edgeMix);

        // Coordenada vertical normalizada
        float verticalPosition = dot(vLocalPosition, uVerticalAxis);
        float y01 = clamp(
          (verticalPosition - uVerticalMin) /
          max(uVerticalMax - uVerticalMin, 0.00001),
          0.0,
          1.0
        );

        // 5. Profundidad frontal controlada (centro vino oscuro visible)
        float centerDepth = 1.0 - smoothstep(0.0, 0.72, abs(x01 - 0.5) * 2.0);
        finalColor *= mix(1.0, 0.82, centerDepth);

        // 7. Suavizar el brillo superior
        float topGlow = smoothstep(0.78, 0.97, y01) * 0.025;
        finalColor += uMidColor * topGlow;

        // 6. Reflejos verticales finos
        float leftHighlightCenter = 0.075;
        float leftHighlightWidth = 0.012;

        float rightHighlightCenter = 0.925;
        float rightHighlightWidth = 0.009;

        float verticalMask =
          smoothstep(0.06, 0.18, y01) *
          (1.0 - smoothstep(0.82, 0.96, y01));

        float hlLeft = verticalHighlight(x01, leftHighlightCenter, leftHighlightWidth) * verticalMask * uHighlightStrength;
        float hlRight = verticalHighlight(x01, rightHighlightCenter, rightHighlightWidth) * verticalMask * (uHighlightStrength * 0.60);
        float totalHighlight = hlLeft + hlRight;
        finalColor += uHighlightColor * totalHighlight;

        // Fresnel integrado
        vec3 normal = normalize(vViewNormal);
        vec3 viewDirection = normalize(vViewPosition);

        float fresnel = pow(
          1.0 - max(dot(normal, viewDirection), 0.0),
          2.8
        );
        finalColor += uFresnelColor * fresnel * uFresnelStrength;

        // 4. Limitar la iluminación matemática del cuerpo y clampear
        vec3 lightDir = normalize(vec3(0.35, 0.55, 0.75));
        float diffuseFactor = max(dot(normal, lightDir), 0.0);
        float lighting = mix(0.94, 1.06, diffuseFactor);
        finalColor *= lighting;

        finalColor = clamp(
          finalColor,
          vec3(0.0),
          vec3(0.62, 0.12, 0.15)
        );

        // 3. Finalización requerida exactamente:
        gl_FragColor = vec4(finalColor, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: false,
    opacity: 1,
    depthWrite: true,
    depthTest: true,
    side: THREE.FrontSide,
    toneMapped: true,
  });
}

// ==========================================================================
// PASO 10 y 11: Iluminación Responsiva (Sin goldAccentLight para evitar brillos en cuello)
// ==========================================================================
function setupResponsiveLights(bodyMesh, neckMesh) {
  const cuerpoBox = new THREE.Box3().setFromObject(bodyMesh);
  const cuerpoCenter = cuerpoBox.getCenter(new THREE.Vector3());

  // Orientar luces direccionales hacia el centro del cuerpo
  keyLight.target.position.copy(cuerpoCenter);
  scene.add(keyLight.target);
  redRimLight.target.position.copy(cuerpoCenter);
  scene.add(redRimLight.target);

  console.group('💡 [Iluminación Publicitaria Calibrada]');
  console.log('● Centro del cuerpo:', cuerpoCenter);
  console.groupEnd();
}

// ==========================================================================
// 1 a 6. Sistema de Partículas de Perfume (Spray Cinemático con THREE.Points)
// ==========================================================================
const PARTICLE_COUNT = 550; // Entre 400 y 700 partículas ligeras
const SPRAY_TRAVEL_DISTANCE = 0.28; // Distancia física de alcance del spray (28 cm)
let sprayPoints = null;
let sprayGeometry = null;
let sprayMaterial = null;
let particleData = [];

const sprayOrigin = new THREE.Vector3();
const sprayForward = new THREE.Vector3();
const sprayRight = new THREE.Vector3();
const sprayUp = new THREE.Vector3();
let currentMistOpacity = 0;

const sprayState = {
  progress: 0,
  active: false,
};

// 5. CanvasTexture circular suave para gotas y niebla
function createParticleTexture() {
  const pCanvas = document.createElement('canvas');
  pCanvas.width = 128;
  pCanvas.height = 128;
  const ctx = pCanvas.getContext('2d');

  const cx = 64;
  const cy = 64;
  const radius = 60;

  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  gradient.addColorStop(0.18, 'rgba(255, 250, 242, 0.88)');
  gradient.addColorStop(0.48, 'rgba(247, 202, 210, 0.45)');
  gradient.addColorStop(0.78, 'rgba(229, 193, 88, 0.18)');
  gradient.addColorStop(1.0, 'rgba(229, 193, 88, 0.0)');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(pCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function initSprayParticleSystem() {
  sprayGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const scales = new Float32Array(PARTICLE_COUNT);

  // 6. Colores: blanco cálido, rosa tenue y dorado
  const colorWarmWhite = new THREE.Color(0xfff8ee);
  const colorSoftRose = new THREE.Color(0xf7cad0);
  const colorGold = new THREE.Color(0xebd07b);

  particleData = [];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    positions[i * 3 + 0] = 0;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = 0;

    const randColor = Math.random();
    let pColor;
    if (randColor < 0.48) {
      pColor = colorWarmWhite.clone().offsetHSL((Math.random() - 0.5) * 0.04, 0, (Math.random() - 0.5) * 0.05);
    } else if (randColor < 0.78) {
      pColor = colorSoftRose.clone().offsetHSL((Math.random() - 0.5) * 0.05, 0, (Math.random() - 0.5) * 0.05);
    } else {
      pColor = colorGold.clone().offsetHSL((Math.random() - 0.5) * 0.04, 0, (Math.random() - 0.5) * 0.05);
    }

    colors[i * 3 + 0] = pColor.r;
    colors[i * 3 + 1] = pColor.g;
    colors[i * 3 + 2] = pColor.b;

    // Tamaños variables: micro-gotas y vaho esponjoso
    scales[i] = THREE.MathUtils.lerp(0.4, 2.2, Math.pow(Math.random(), 1.4));

    // Parámetros de dispersión cónica ligera perpendicular a la dirección del spray
    const angle = Math.random() * Math.PI * 2;
    const rType = Math.random();
    let coneSpread;
    if (rType < 0.4) {
      coneSpread = THREE.MathUtils.lerp(0.12, 0.24, Math.random()); // Núcleo fino del chorro
    } else if (rType < 0.8) {
      coneSpread = THREE.MathUtils.lerp(0.24, 0.44, Math.random()); // Manto cónico principal
    } else {
      coneSpread = THREE.MathUtils.lerp(0.44, 0.64, Math.random()); // Neblina ligera circundante
    }

    particleData.push({
      stagger: Math.random() * 0.28,
      angle: angle,
      spread: coneSpread,
      distFactor: THREE.MathUtils.lerp(0.85, 1.15, Math.random()),
      driftY: (Math.random() - 0.15) * 0.025,
      jitterX: (Math.random() - 0.5) * 0.012,
      jitterY: (Math.random() - 0.5) * 0.012,
    });
  }

  sprayGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  sprayGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  sprayGeometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));

  const particleTexture = createParticleTexture();

  // 6. Material de partículas con transparencia, AdditiveBlending, depthWrite: false y depthTest: true
  sprayMaterial = new THREE.PointsMaterial({
    size: 0.022,
    map: particleTexture,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    vertexColors: true,
    sizeAttenuation: true,
  });

  sprayMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = 'attribute float aScale;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      'gl_PointSize = size;',
      'gl_PointSize = size * aScale;'
    );
  };

  sprayPoints = new THREE.Points(sprayGeometry, sprayMaterial);
  sprayPoints.name = 'sprayPoints';
  sprayPoints.visible = false;
  scene.add(sprayPoints);
}

// 1 a 4, 9 y 10. Orientar el spray según la rotación mundial del atomizador y calcular la niebla hacia la cámara
function prepareSprayTrajectory() {
  if (!sprayPinholeMesh || !sprayGeometry || !pulsadorGroup) return;

  // 1. Posición mundial de la salida del atomizador
  sprayPinholeMesh.getWorldPosition(sprayOrigin);

  // 2. Dirección frontal local para la boquilla (+Z según la orientación frontal del modelo)
  const localForward = new THREE.Vector3(0, 0, 1);

  // 3. Rotación mundial del atomizador
  const worldQuaternion = new THREE.Quaternion();
  pulsadorGroup.getWorldQuaternion(worldQuaternion);

  // 4. Dirección real del spray en el espacio mundial
  const worldDirection = localForward
    .clone()
    .applyQuaternion(worldQuaternion)
    .normalize();

  // 5. Asignar la dirección principal del spray basada en la boquilla
  sprayForward.copy(worldDirection);

  // Base ortonormal para la dispersión cónica perpendicular
  const tempUp = Math.abs(sprayForward.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  sprayRight.crossVectors(tempUp, sprayForward).normalize();
  sprayUp.crossVectors(sprayForward, sprayRight).normalize();

  // 9. Dirección desde la boquilla hacia la cámara y producto punto
  const cameraPos = new THREE.Vector3();
  camera.getWorldPosition(cameraPos);
  const dirToCam = cameraPos.clone().sub(sprayOrigin).normalize();

  // Producto punto entre la dirección del spray y el vector hacia la cámara
  const dot = worldDirection.dot(dirToCam);

  // 10. Control de intensidad de la niebla HTML:
  // - Boquilla hacia la cámara (dot > 0.8) -> niebla intensa (~0.82)
  // - Boquilla en diagonal (dot ~ 0.5)      -> niebla leve (~0.35)
  // - Boquilla hacia un lado (dot <= 0.15)  -> sin niebla de pantalla (0)
  // - Boquilla hacia atrás (dot <= 0)       -> sin niebla de pantalla (0)
  let mistFactor = 0;
  if (dot > 0.15) {
    const normalizedDot = (dot - 0.15) / (1.0 - 0.15);
    mistFactor = Math.pow(normalizedDot, 1.4);
  }
  currentMistOpacity = 0.82 * mistFactor;

  console.log(
    `💨 [Spray 3D] Dirección boquilla: (x: ${worldDirection.x.toFixed(2)}, y: ${worldDirection.y.toFixed(2)}, z: ${worldDirection.z.toFixed(2)}) | Dot a cámara: ${dot.toFixed(2)} | Niebla pantalla: ${(mistFactor * 100).toFixed(0)}%`
  );

  // Reiniciar todas las posiciones exactamente en la salida de la boquilla
  const positions = sprayGeometry.attributes.position.array;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    positions[i * 3 + 0] = sprayOrigin.x;
    positions[i * 3 + 1] = sprayOrigin.y;
    positions[i * 3 + 2] = sprayOrigin.z;
  }
  sprayGeometry.attributes.position.needsUpdate = true;
}

// Actualización en cada cuadro durante el spray
function updateParticles(progress) {
  if (!sprayPoints || !sprayPoints.visible || !sprayGeometry) return;

  const positions = sprayGeometry.attributes.position.array;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = particleData[i];

    if (progress < p.stagger) {
      positions[i * 3 + 0] = sprayOrigin.x;
      positions[i * 3 + 1] = sprayOrigin.y;
      positions[i * 3 + 2] = sprayOrigin.z;
      continue;
    }

    const t = Math.min(1.0, (progress - p.stagger) / (1.0 - p.stagger));
    // Curva física: avance rápido inicial con desaceleración natural
    const easeAdvance = 1.0 - Math.pow(1.0 - t, 1.8);
    // 5. Avance a lo largo de worldDirection
    const forwardDist = SPRAY_TRAVEL_DISTANCE * p.distFactor * easeAdvance;

    // Dispersión cónica ligera perpendicular a worldDirection
    const coneRadius = forwardDist * p.spread;
    const radialX = Math.cos(p.angle) * coneRadius + p.jitterX * t;
    const radialY = Math.sin(p.angle) * coneRadius + p.jitterY * t + p.driftY * t;

    positions[i * 3 + 0] = sprayOrigin.x + sprayForward.x * forwardDist + sprayRight.x * radialX + sprayUp.x * radialY;
    positions[i * 3 + 1] = sprayOrigin.y + sprayForward.y * forwardDist + sprayRight.y * radialX + sprayUp.y * radialY;
    positions[i * 3 + 2] = sprayOrigin.z + sprayForward.z * forwardDist + sprayRight.z * radialX + sprayUp.z * radialY;
  }

  sprayGeometry.attributes.position.needsUpdate = true;
}

// ==========================================================================
// Distancia de cámara responsive basada en aspect ratio (orientación frontal pura)
// ==========================================================================
function calculateResponsiveCameraDistance() {
  const fovRad = camera.fov * (Math.PI / 180);
  const tanHalfFov = Math.tan(fovRad / 2);
  const refSize = savedModelSize || savedBottleSize;
  const maxDim = refSize ? Math.max(refSize.x, refSize.y, refSize.z) : 16383;
  const distV = Math.abs(maxDim / 2 / tanHalfFov) * 1.55;
  if (camera.aspect < 1.0 && refSize) {
    const distH = Math.abs(refSize.x / 2 / (tanHalfFov * Math.max(camera.aspect, 0.35))) * 1.25;
    return Math.max(distV, distH);
  }
  return distV;
}

// ==========================================================================
// Carga del Modelo GLB e Inicialización
// ==========================================================================
const MODEL_PATH = './assets/models/temptation-mystic-perforado.glb';
const loader = new GLTFLoader();

loader.load(
  MODEL_PATH,
  (gltf) => {
    modelRoot = gltf.scene;

    const meshes = [];
    modelRoot.traverse((child) => {
      if (child.isMesh && child.geometry) {
        meshes.push(child);
      }
    });

    // Conservar clasificación de las tres mallas por cantidad de vértices
    meshes.sort((a, b) => {
      const countA = a.geometry.attributes.position ? a.geometry.attributes.position.count : 0;
      const countB = b.geometry.attributes.position ? b.geometry.attributes.position.count : 0;
      return countB - countA;
    });

    cuerpoMesh = meshes[0];
    tapaMesh = meshes[1];
    cuelloMesh = meshes[2];

    // PASO 1 — Limpiar la geometría del cuerpo (eliminar COLOR_0 y generar normales perfectas)
    if (cuerpoMesh.geometry.getAttribute('color')) {
      cuerpoMesh.geometry.deleteAttribute('color');
    }
    cuerpoMesh.geometry.deleteAttribute('normal');
    cuerpoMesh.geometry.computeVertexNormals();
    if (typeof cuerpoMesh.geometry.normalizeNormals === 'function') {
      cuerpoMesh.geometry.normalizeNormals();
    }

    // 6. Eliminar cualquier atributo color/vertexColors residual de tapa y cuello y recalcular normales limpias
    if (tapaMesh.geometry.getAttribute('color')) {
      tapaMesh.geometry.deleteAttribute('color');
    }
    tapaMesh.geometry.deleteAttribute('normal');
    tapaMesh.geometry.computeVertexNormals();

    if (cuelloMesh.geometry.getAttribute('color')) {
      cuelloMesh.geometry.deleteAttribute('color');
    }
    cuelloMesh.geometry.deleteAttribute('normal');
    cuelloMesh.geometry.computeVertexNormals();

    // Centrado de referencia vertical y horizontal anclado al cuerpo y cuello del frasco
    const cuerpoBoxRaw = new THREE.Box3().setFromObject(cuerpoMesh);
    const cuerpoCenterRaw = cuerpoBoxRaw.getCenter(new THREE.Vector3());
    // Altura total del frasco ensamblado: 0.12 m (desde la base del cuerpo en Y=0 hasta la cima de la tapa en Y=0.12)
    // El centro geométrico ensamblado corresponde a Y = 0.06 m sobre la base
    const targetModelCenter = new THREE.Vector3(cuerpoCenterRaw.x, cuerpoBoxRaw.min.y + 0.0600, cuerpoCenterRaw.z);
    modelRoot.position.sub(targetModelCenter);
    modelRoot.updateMatrixWorld(true);

    bottleGroup = new THREE.Group();
    bottleGroup.name = 'bottleGroup';
    scene.add(bottleGroup);

    bottleGroup.attach(cuerpoMesh);

    // 1 & 3. Grupo dedicado para la tapa y su simulación de cavidad y agujero
    capGroup = new THREE.Group();
    capGroup.name = 'capGroup';
    bottleGroup.add(capGroup);
    capGroup.attach(tapaMesh);

    // Compensación espacial de la tapa: alinear con la cota de referencia original (centro Y = 0.05162 m / cima Y = 0.0600 m)
    const currentTapaCenter = new THREE.Box3().setFromObject(tapaMesh).getCenter(new THREE.Vector3());
    const desiredTapaCenter = new THREE.Vector3(0, 0.05162058, 0);
    const capOffset = desiredTapaCenter.clone().sub(currentTapaCenter);
    if (capOffset.lengthSq() > 0.00001) {
      tapaMesh.position.add(capOffset);
      tapaMesh.updateMatrixWorld(true);
    }
    initialCapY = capGroup.position.y;

    bottleGroup.attach(cuelloMesh);
    bottleGroup.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(bottleGroup);
    const size = box.getSize(new THREE.Vector3());

    // 4. El GLB debe añadirse y mostrarse antes de intentar crear la proyección
    scene.add(modelRoot);
    modelRoot.visible = true;
    bottleGroup.visible = true;
    cuerpoMesh.visible = true;
    tapaMesh.visible = true;
    cuelloMesh.visible = true;

    // PASO 4: Calcular dinámicamente los ejes y cotas locales del cuerpo
    cuerpoMesh.geometry.computeBoundingBox();
    const localBox = cuerpoMesh.geometry.boundingBox;
    const localSize = localBox.getSize(new THREE.Vector3());

    const extents = [
      { axis: new THREE.Vector3(1, 0, 0), length: localSize.x, min: localBox.min.x, max: localBox.max.x, name: 'X' },
      { axis: new THREE.Vector3(0, 1, 0), length: localSize.y, min: localBox.min.y, max: localBox.max.y, name: 'Y' },
      { axis: new THREE.Vector3(0, 0, 1), length: localSize.z, min: localBox.min.z, max: localBox.max.z, name: 'Z' },
    ];
    extents.sort((a, b) => b.length - a.length);
    const verticalData = extents[0];   // Eje mayor vertical
    const horizontalData = extents[1]; // Eje frontal horizontal

    // PASO 5: Asignar bodyAdvertisingShader al cuerpo exterior
    bodyAdvertisingShader = createBodyAdvertisingShader(horizontalData, verticalData);
    cuerpoMesh.name = 'bodyOuterGlass';
    cuerpoMesh.material = bodyAdvertisingShader;

    // Bounding box en espacio del objeto para calcular medidas y centros
    const cuerpoBox = new THREE.Box3().setFromObject(cuerpoMesh);
    const cuerpoCenter = cuerpoBox.getCenter(new THREE.Vector3());
    const cuerpoSize = cuerpoBox.getSize(new THREE.Vector3());

    // 7. Tapa: cristal rojo oscuro y pulido con poca transmisión
    tapaMesh.name = 'tapa';
    tapaMesh.material = capMaterial;

    // Cuello dorado uniforme con acabado espejo oro champán (atomizerMirrorGoldMaterial)
    cuelloMesh.name = 'cuello';
    cuelloMesh.material = atomizerMirrorGoldMaterial;
    cuelloMesh.renderOrder = 4;
    if (cuelloMesh.geometry) {
      if (cuelloMesh.geometry.getAttribute('color')) {
        cuelloMesh.geometry.deleteAttribute('color');
      }
      cuelloMesh.geometry.computeVertexNormals();
    }

    // Atomizador procedural
    atomizerGroup = buildProceduralAtomizer();
    bottleGroup.add(atomizerGroup);

    // Manguera interna procedural visible sutilmente a través del vidrio
    dipTubeGroup = buildDipTube();
    bottleGroup.add(dipTubeGroup);

    // Conector transparente escalonado entre collar y manguera
    dipTubeConnectorGroup = buildDipTubeConnector();
    bottleGroup.add(dipTubeConnectorGroup);

    // Aplicar atomizerMirrorGoldMaterial exclusivamente al cuello y piezas metálicas del atomizador
    [cuelloMesh, atomizerGroup].forEach((target) => {
      if (!target) return;
      target.traverse((child) => {
        if (!child.isMesh) return;
        if (
          child === cuerpoMesh ||
          child === tapaMesh ||
          child.name === 'cuerpo' ||
          child.name === 'tapa' ||
          child.name === 'sprayPinhole' ||
          child.name === 'atomizerGoldHighlight' ||
          child.name === 'dipTubeMesh' ||
          child.name === 'dipTubeEndCap' ||
          child.name === 'connectorLevel1' ||
          child.name === 'connectorLevel2' ||
          child.name === 'connectorLevel3' ||
          child.name === 'atomizerRing' ||
          child.name === 'atomizerBevelRing' ||
          child.name === 'atomizerButton' ||
          child.name === 'sprayNozzleOuter'
        ) {
          return;
        }
        if (child.geometry) {
          if (child.geometry.getAttribute('color')) {
            child.geometry.deleteAttribute('color');
          }
          child.geometry.computeVertexNormals();
        }
        child.material = atomizerMirrorGoldMaterial;
      });
    });

    // 5. La creación de la proyección debe ejecutarse únicamente después de que el GLB haya terminado de cargar,
    // cuerpoMesh exista, la geometría del cuerpo exista y el bounding box sea válido
    const isBoundingBoxValid =
      !cuerpoBox.isEmpty() &&
      Number.isFinite(cuerpoSize.x) && cuerpoSize.x > 0 &&
      Number.isFinite(cuerpoSize.y) && cuerpoSize.y > 0 &&
      Number.isFinite(cuerpoSize.z) && cuerpoSize.z > 0;

    savedCuerpoMesh = cuerpoMesh;
    savedBottleSize = cuerpoSize;
    savedCuerpoBox = cuerpoBox;
    savedLocalBox = localBox;
    savedLocalSize = localSize;

    if (cuerpoMesh && cuerpoMesh.geometry && isBoundingBoxValid) {
      setupFrontPhotoProjection(cuerpoMesh, cuerpoSize, cuerpoCenter, cuerpoBox);
    } else {
      console.warn('Condiciones de geometría no válidas para proyección frontal.');
      cuerpoMesh.visible = true;
    }

    // 2 & 3. Simulación visual del agujero central desactivada (el modelo perforado ya cuenta con orificio real)
    // buildSimulatedCapHole(capGroup, tapaMesh);

    // 3, 4 y 5. Proyección fotográfica frontal de la tapa unida directamente a capGroup
    setupCapFrontPhotoProjection(capGroup, tapaMesh);

    // Cargar texturas limpias de la tapa para elevación
    setupCapCleanTextures();

    // 4, 5, 6 y 7. Proyecciones fotográficas posteriores (cuerpo y tapa)
    setupBackPhotoProjections(cuerpoMesh, cuerpoSize, cuerpoCenter, cuerpoBox, capGroup, tapaMesh);

    // Proyecciones fotográficas laterales (cuerpo, tapa y cuello)
    setupSidePhotoProjections(cuerpoMesh, cuerpoSize, cuerpoCenter, cuerpoBox, capGroup, tapaMesh, cuelloMesh);
    setupCapSideTextures(capGroup, tapaMesh);

    // Inicializar shader multivista del cuerpo si las texturas ya están preparadas
    tryInitBodyMultiviewShader(cuerpoMesh, cuerpoSize, cuerpoBox, localBox, localSize);

    // Inicializar shader multivista de la tapa si las texturas ya están preparadas
    tapaMesh.geometry.computeBoundingBox();
    const tapaLocalBox = tapaMesh.geometry.boundingBox;
    const tapaLocalSize = tapaLocalBox.getSize(new THREE.Vector3());
    const tapaBox = new THREE.Box3().setFromObject(tapaMesh);
    tryInitCapMultiviewShader(tapaMesh, tapaBox, tapaLocalBox, tapaLocalSize);

    // 9. Luz exclusiva para el oro (PointLight vinculado a bottleGroup)
    atomizerAccentLight = new THREE.PointLight(
      0xffc66b,
      0.32,
      0.75,
      2
    );
    atomizerAccentLight.name = 'atomizerAccentLight';
    atomizerAccentLight.position.set(0.024, 0.035, 0.032);
    bottleGroup.add(atomizerAccentLight);

    // PASO 7, 8 y 9: Iluminación de estudio responsiva (softboxes y acento cuello)
    setupResponsiveLights(cuerpoMesh, cuelloMesh);

    // Sistema de partículas para el spray
    initSprayParticleSystem();

    // Cálculo de distancia de encuadre responsive basado en aspect, conservando orientación frontal exacta
    savedModelSize = size.clone();
    savedBottleSize = size.clone();

    const cameraZ = calculateResponsiveCameraDistance();
    camera.position.set(0, 0, cameraZ);
    camera.lookAt(0, 0, 0);

    controls.target.set(0, 0, 0);
    controls.minDistance = cameraZ * 0.2;
    controls.maxDistance = cameraZ * 5;
    controls.update();

    initialCameraPos = camera.position.clone();
    initialTarget = controls.target.clone();

    // Inicializar inmediatamente la proyección del atomizador sobre la tapa
    updateCapParallax(true);

    console.group('🏺 [Temptation Mystic 3D] Estructura y Sistema de Spray');
    console.log('%c● Modelo 3D cargado y centrado', 'color: #e5c158; font-weight: bold;');
    console.log('%c● Sistema de partículas (550 gotas AdditiveBlending)', 'color: #f7cad0; font-weight: bold;', sprayPoints);
    console.groupEnd();

    if (loadingOverlay) {
      loadingOverlay.classList.add('is-hidden');
    }
  },
  (progress) => {
    if (progress.total > 0 && loadingText) {
      const pct = Math.round((progress.loaded / progress.total) * 100);
      loadingText.textContent = `Cargando modelo 3D... ${pct}%`;
    }
  },
  (error) => {
    console.error('Error al cargar el archivo GLB:', error);
    if (loadingText) {
      loadingText.textContent = 'Error al cargar el modelo 3D. Revisa la consola.';
      loadingText.style.color = '#ff6b6b';
    }
  }
);

// ==========================================================================
// 4, 5 y 7. Animación Sincronizada con GSAP: "Probar destapado" + Spray
// ==========================================================================
if (uncapBtn) {
  uncapBtn.addEventListener('click', () => {
    if (!capGroup || !pulsadorGroup || isAnimating) return;

    isAnimating = true;
    uncapBtn.disabled = true;
    capMultiviewUniforms.uCapCleanMix.value = 1.0;

    initialCapY = capGroup.position.y;
    const initialPulsadorY = pulsadorGroup.position.y;

    const tl = gsap.timeline({
      onComplete: () => {
        isAnimating = false;
        uncapBtn.disabled = false;
        sprayState.active = false;
        capMultiviewUniforms.uCapCleanMix.value = 1.0;
        if (sprayPoints) sprayPoints.visible = false;
        if (screenMistOverlay) screenMistOverlay.style.opacity = '0';
        if (buttonMesh) buttonMesh.scale.y = ATOMIZER_SEALED.buttonScaleY;
        if (nozzleOuterMesh) nozzleOuterMesh.position.y = ATOMIZER_SEALED.nozzleY;
        if (sprayPinholeMesh) sprayPinholeMesh.position.y = ATOMIZER_SEALED.nozzleY;
        if (pulsadorGroup) pulsadorGroup.position.y = initialPulsadorY;
      },
    });

    // 1. Inicio del destapado: la tapa sube revelando el orificio real
    tl.to(capGroup.position, {
      y: initialCapY + 0.048,
      duration: 1.1,
      ease: 'power3.inOut',
    }, 0);

    // 1b. Transición dinámica: el pulsador adopta suavemente la proporción compacta real de la foto
    if (buttonMesh) {
      tl.to(buttonMesh.scale, {
        y: ATOMIZER_COMPACT.buttonScaleY,
        duration: 0.5,
        ease: 'power2.out',
      }, 0);
    }
    if (nozzleOuterMesh && sprayPinholeMesh) {
      tl.to([nozzleOuterMesh.position, sprayPinholeMesh.position], {
        y: ATOMIZER_COMPACT.nozzleY,
        duration: 0.5,
        ease: 'power2.out',
      }, 0);
    }

    // 2. Tapa arriba: el pulsador baja (pulsación ocurre sobre la altura compacta y realista)
    tl.to(pulsadorGroup.position, {
      y: initialPulsadorY - 0.0030,
      duration: 0.22,
      ease: 'power2.in',
      onComplete: () => {
        // Al tocar fondo el pulsador, se orienta y activa el spray desde la boquilla hacia la cámara
        prepareSprayTrajectory();
        if (sprayPoints) {
          sprayPoints.visible = true;
          sprayState.active = true;
          sprayState.progress = 0;
        }
      },
    }, '+=0.2')

    // 3. Comienza el spray: las partículas viajan a lo largo de worldDirection
    .to(sprayState, {
      progress: 1,
      duration: 1.3,
      ease: 'power1.out',
    }, 'sprayBurst')
    .to(sprayMaterial, {
      opacity: 0.95,
      duration: 0.2,
      ease: 'power2.out',
    }, 'sprayBurst')

    // 8, 9 y 10. Capa HTML de niebla según orientación hacia la cámara (controlada por producto punto)
    .to(screenMistOverlay, {
      opacity: () => currentMistOpacity,
      duration: 0.45,
      ease: 'power2.out',
    }, 'sprayBurst+=0.35')

    // 5. El pulsador vuelve a subir
    .to(pulsadorGroup.position, {
      y: initialPulsadorY,
      duration: 0.32,
      ease: 'back.out(2)',
    }, 'sprayBurst+=0.15')

    // 6 & 8. Las partículas y la niebla desaparecen suavemente
    .to(sprayMaterial, {
      opacity: 0,
      duration: 0.55,
      ease: 'power2.in',
    }, 'sprayBurst+=0.75')
    .to(screenMistOverlay, {
      opacity: 0,
      duration: 0.85,
      ease: 'power2.inOut',
    }, 'sprayBurst+=0.85')

    // Pausa de contemplación con atomizador al descubierto
    .to({}, { duration: 0.25 })

    // 7. Retorno: la tapa desciende hacia su posición inicial cerrada
    .to(capGroup.position, {
      y: initialCapY,
      duration: 1.05,
      ease: 'power3.inOut',
    }, 'capReturn');

    // 7b. Al cerrar: interpolar el botón y boquilla de nuevo a su cota/escala de sellado al ras
    // Con retardo de 0.70s y duración 0.35s para que la expansión ocurra 100% oculta bajo la falda de la tapa
    if (buttonMesh) {
      tl.to(buttonMesh.scale, {
        y: ATOMIZER_SEALED.buttonScaleY,
        duration: 0.35,
        ease: 'power2.out',
      }, 'capReturn+=0.70');
    }
    if (nozzleOuterMesh && sprayPinholeMesh) {
      tl.to([nozzleOuterMesh.position, sprayPinholeMesh.position], {
        y: ATOMIZER_SEALED.nozzleY,
        duration: 0.35,
        ease: 'power2.out',
      }, 'capReturn+=0.70');
    }
  });
}

// Botón para restablecer cámara
if (resetCamBtn) {
  resetCamBtn.addEventListener('click', () => {
    const targetZ = calculateResponsiveCameraDistance();
    gsap.to(camera.position, {
      x: 0,
      y: 0,
      z: targetZ,
      duration: 0.8,
      ease: 'power2.out',
    });
    gsap.to(controls.target, {
      x: 0,
      y: 0,
      z: 0,
      duration: 0.8,
      ease: 'power2.out',
      onUpdate: () => controls.update(),
    });
  });
}

// Redimensionamiento de ventana y eventos responsive (PC y móvil)
function onWindowResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Ajuste de encuadre responsive manteniendo la dirección visual actual
  const targetDist = calculateResponsiveCameraDistance();
  if (controls) {
    controls.minDistance = targetDist * 0.2;
    controls.maxDistance = targetDist * 5.0;
    const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
    if (offset.lengthSq() > 0.0001) {
      offset.normalize().multiplyScalar(targetDist);
      camera.position.copy(controls.target).add(offset);
      controls.update();
    }
  }

  // Recalcular inmediatamente la proyección del atomizador sin reutilizar valores previos
  updateCapParallax(true);
}

window.addEventListener('resize', onWindowResize);
window.addEventListener('orientationchange', () => {
  setTimeout(onWindowResize, 60);
});
document.addEventListener('fullscreenchange', onWindowResize);

// ==========================================================================
// 8 y 9. Transición Frontal, Posterior y Lateral (Facing y Opacidades)
// ==========================================================================
const bottleWorldPosition = new THREE.Vector3();
const cameraDirection = new THREE.Vector3();
const bottleWorldNormal = new THREE.Vector3();
const bottleWorldQuaternion = new THREE.Quaternion();
const bottleUpNormal = new THREE.Vector3();

// Constantes y vectores persistentes para el cálculo de paralaje interior (evita garbage collection)
const _capLocalCam = new THREE.Vector3();
const _atomizerWorldPos = new THREE.Vector3();
const _frontCenterLocal = new THREE.Vector3();
const _frontCenterWorld = new THREE.Vector3();
const _frontOffsetLocal = new THREE.Vector3();
const _frontOffsetWorld = new THREE.Vector3();
const _backCenterLocal = new THREE.Vector3();
const _backCenterWorld = new THREE.Vector3();
const _backOffsetLocal = new THREE.Vector3();
const _backOffsetWorld = new THREE.Vector3();
const _projAtomizer = new THREE.Vector3();
const _projFrontCenter = new THREE.Vector3();
const _projFrontOffset = new THREE.Vector3();
const _projBackCenter = new THREE.Vector3();
const _projBackOffset = new THREE.Vector3();

// Proyección dinámica del eje del atomizador 3D sobre la tapa (PC y móvil)
function updateCapParallax(immediate = false) {
  const activeCapMesh = savedTapaMesh || tapaMesh;
  if (!activeCapMesh || !savedTapaLocalBox) return;

  if (!savedTapaLocalCenter) {
    savedTapaLocalCenter = savedTapaLocalBox.getCenter(new THREE.Vector3());
  }
  if (!savedTapaLocalSize) {
    savedTapaLocalSize = savedTapaLocalBox.getSize(new THREE.Vector3());
  }

  // 1. Obtener la posición del eje vertical del atomizador 3D en el espacio mundial (nivel cuello/collar)
  if (bottleGroup) {
    _atomizerWorldPos.set(0, 0.036, 0);
    bottleGroup.localToWorld(_atomizerWorldPos);
  } else if (cuelloMesh) {
    cuelloMesh.getWorldPosition(_atomizerWorldPos);
  } else if (pulsadorGroup) {
    pulsadorGroup.getWorldPosition(_atomizerWorldPos);
  } else {
    _atomizerWorldPos.set(0, 0, 0);
  }

  // 2. Proyección 3D a coordenadas normalizadas de pantalla (NDC [-1, 1])
  // Totalmente independiente de window.innerWidth, CSS o devicePixelRatio
  _projAtomizer.copy(_atomizerWorldPos).project(camera);

  // 3. Posición relativa de la cámara en el espacio local de la tapa
  activeCapMesh.worldToLocal(_capLocalCam.copy(camera.position));
  const camRelX = _capLocalCam.x - savedTapaLocalCenter.x;
  const camRelZ = _capLocalCam.z - savedTapaLocalCenter.z;

  const inFrontHemisphere = camRelZ > 0.0001;
  const inBackHemisphere = camRelZ < -0.0001;

  // Cota Y local donde el mecanismo conecta con el atomizador (base de la tapa)
  const capBaseY = savedTapaLocalBox.min.y + savedTapaLocalSize.y * 0.08;

  // Paso horizontal de referencia en espacio local (corresponde a deltaU = 0.20 en la textura)
  // En el shader: uvFront.x = (normPos.x - 0.5) / 1.085 + 0.5
  // deltaNormPos = deltaU * 1.085
  const deltaXRef = 0.20 * 1.085 * savedTapaLocalSize.x;

  // --- Cara Frontal (+Z) ---
  let targetShiftFront = 0;
  let targetProgressFront = 1.0;

  if (inFrontHemisphere) {
    _frontCenterLocal.set(savedTapaLocalCenter.x, capBaseY, savedTapaLocalBox.max.z);
    _frontOffsetLocal.set(savedTapaLocalCenter.x + deltaXRef, capBaseY, savedTapaLocalBox.max.z);

    activeCapMesh.localToWorld(_frontCenterWorld.copy(_frontCenterLocal));
    activeCapMesh.localToWorld(_frontOffsetWorld.copy(_frontOffsetLocal));

    _projFrontCenter.copy(_frontCenterWorld).project(camera);
    _projFrontOffset.copy(_frontOffsetWorld).project(camera);

    const screenSpanUVFront = _projFrontOffset.x - _projFrontCenter.x;
    const screenDistFront = _projAtomizer.x - _projFrontCenter.x;

    if (Math.abs(screenSpanUVFront) > 0.00001) {
      targetShiftFront = (screenDistFront / screenSpanUVFront) * 0.20;
    }
    targetShiftFront = THREE.MathUtils.clamp(targetShiftFront, -0.40, 0.40);

    const angleFront = Math.abs(Math.atan2(camRelX, camRelZ));
    targetProgressFront = THREE.MathUtils.clamp(angleFront / (Math.PI * 0.5), 0.0, 1.0);
  } else {
    targetShiftFront = Math.sign(camRelX || 1.0) * 0.40;
    targetProgressFront = 1.0;
  }

  // --- Cara Posterior (-Z) ---
  let targetShiftBack = 0;
  let targetProgressBack = 1.0;

  if (inBackHemisphere) {
    _backCenterLocal.set(savedTapaLocalCenter.x, capBaseY, savedTapaLocalBox.min.z);
    _backOffsetLocal.set(savedTapaLocalCenter.x - deltaXRef, capBaseY, savedTapaLocalBox.min.z);

    activeCapMesh.localToWorld(_backCenterWorld.copy(_backCenterLocal));
    activeCapMesh.localToWorld(_backOffsetWorld.copy(_backOffsetLocal));

    _projBackCenter.copy(_backCenterWorld).project(camera);
    _projBackOffset.copy(_backOffsetWorld).project(camera);

    const screenSpanUVBack = _projBackOffset.x - _projBackCenter.x;
    const screenDistBack = _projAtomizer.x - _projBackCenter.x;

    if (Math.abs(screenSpanUVBack) > 0.00001) {
      targetShiftBack = (screenDistBack / screenSpanUVBack) * 0.20;
    }
    targetShiftBack = THREE.MathUtils.clamp(targetShiftBack, -0.40, 0.40);

    const angleBack = Math.abs(Math.atan2(-camRelX, -camRelZ));
    targetProgressBack = THREE.MathUtils.clamp(angleBack / (Math.PI * 0.5), 0.0, 1.0);
  } else {
    targetShiftBack = Math.sign(-camRelX || 1.0) * 0.40;
    targetProgressBack = 1.0;
  }

  // Suavizado temporal continuo: respuesta ágil y limpia sin vibraciones ni saltos
  const LERP_FACTOR = 0.26;
  if (immediate) {
    smoothShiftFront = targetShiftFront;
    smoothShiftBack = targetShiftBack;
    smoothProgressFront = targetProgressFront;
    smoothProgressBack = targetProgressBack;
  } else {
    smoothShiftFront = THREE.MathUtils.lerp(smoothShiftFront, targetShiftFront, LERP_FACTOR);
    smoothShiftBack = THREE.MathUtils.lerp(smoothShiftBack, targetShiftBack, LERP_FACTOR);
    smoothProgressFront = THREE.MathUtils.lerp(smoothProgressFront, targetProgressFront, LERP_FACTOR);
    smoothProgressBack = THREE.MathUtils.lerp(smoothProgressBack, targetProgressBack, LERP_FACTOR);
  }

  if (capMultiviewUniforms) {
    capMultiviewUniforms.uCapParallaxShiftFront.value = smoothShiftFront;
    capMultiviewUniforms.uCapParallaxShiftBack.value = smoothShiftBack;
    capMultiviewUniforms.uCapLateralProgressFront.value = smoothProgressFront;
    capMultiviewUniforms.uCapLateralProgressBack.value = smoothProgressBack;
  }
}

// Loop de animación principal único (sin bucles duplicados)
function animate() {
  requestAnimationFrame(animate);

  // Actualizar partículas activas durante el spray
  if (sprayState.active) {
    updateParticles(sprayState.progress);
  }

  // Control dinámico sincronizado del disco simulado del atomizador y el hueco profundo superior
  // 8 y 9. Transición frontal, posterior y lateral con normales del modelo
  if (bottleGroup) {
    bottleGroup.getWorldPosition(bottleWorldPosition);
    bottleGroup.getWorldQuaternion(bottleWorldQuaternion);
    bottleWorldNormal.set(0, 0, 1).applyQuaternion(bottleWorldQuaternion).normalize();
    bottleUpNormal.set(0, 1, 0).applyQuaternion(bottleWorldQuaternion).normalize();

    cameraDirection.subVectors(camera.position, bottleWorldPosition).normalize();

    const rawFacing = bottleWorldNormal.dot(cameraDirection);
    const facing = Number.isFinite(rawFacing) ? rawFacing : 1;

    // Manguera interna: visibilidad independiente que permanece visible dentro del cuerpo
    if (dipTubeGroup && dipTubeMaterial) {
      const hoseFacingFade = THREE.MathUtils.smoothstep(facing, 0.15, 0.65);
      const hoseUpDot = Math.max(0, bottleUpNormal.dot(cameraDirection));
      const hoseUpFade = 1.0 - THREE.MathUtils.smoothstep(hoseUpDot, 0.55, 0.88);
      const hoseVisibility = THREE.MathUtils.clamp(hoseFacingFade * hoseUpFade, 0, 1);
      dipTubeMaterial.opacity = 0.38 * hoseVisibility;
      dipTubeGroup.visible = hoseVisibility > 0.001;
    }

    // Conector transparente escalonado: visibilidad angular independiente y control superior
    if (dipTubeConnectorGroup && dipTubeConnectorMaterial) {
      const connectorFacingFade = THREE.MathUtils.smoothstep(facing, 0.20, 0.65);
      const connectorUpDot = Math.max(0, bottleUpNormal.dot(cameraDirection));
      const connectorElevationFade = 1.0 - THREE.MathUtils.smoothstep(connectorUpDot, 0.04, 0.32);
      const connectorVisibility = THREE.MathUtils.clamp(
        connectorFacingFade * connectorElevationFade,
        0,
        1
      );

      const connectorBaseOpacity = 0.38;
      dipTubeConnectorMaterial.opacity = connectorBaseOpacity * connectorVisibility;
      dipTubeConnectorGroup.visible = connectorVisibility > 0.001;
    }
  }

  // Paralaje interior fotográfico sincronizado en todo fotograma tanto en PC como en móvil
  updateCapParallax(false);

  // 10. OrbitControls continúa funcionando en todo momento
  controls.update();
  renderer.render(scene, camera);
}

animate();

