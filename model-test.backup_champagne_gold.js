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
const verticesBodyEl = document.getElementById('verticesBody');
const verticesCapEl = document.getElementById('verticesCap');
const verticesNeckEl = document.getElementById('verticesNeck');
const uncapBtn = document.getElementById('uncapBtn');
const resetCamBtn = document.getElementById('resetCamBtn');
const screenMistOverlay = document.getElementById('screenMistOverlay');

// Referencias a los objetos de la escena
let modelRoot = null;
let bottleGroup = null;
let capGroup = null;
let cuerpoMesh = null; // bodyOuterGlass
let innerBodyMesh = null; // bodyInnerLiquid
let bodyInnerLiquid = null;
let bodyAdvertisingShader = null; // Shader publicitario del cuerpo (base lateral)
let bodyFrontPhotoProjection = null; // Proyección de fotografía frontal real
let bodyFrontPhotoMaterial = null;
let bodyFrontCanvasTexture = null;
let capFrontPhotoProjection = null; // Proyección de fotografía frontal de la tapa
let capFrontPhotoMaterial = null;
let capFrontCanvasTexture = null;
let bodyBackPhotoProjection = null; // Proyección de fotografía posterior del cuerpo
let bodyBackPhotoMaterial = null;
let bodyBackCanvasTexture = null;
let capBackPhotoProjection = null; // Proyección de fotografía posterior de la tapa
let capBackPhotoMaterial = null;
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
  uBaseRuby: { value: new THREE.Color(0x760019) },
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

// Proyecciones de fotografía lateral (derecha e izquierda)
let bodyRightPhotoProjection = null;
let bodyLeftPhotoProjection = null;
let bodyRightPhotoMaterial = null;
let bodyLeftPhotoMaterial = null;
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

let capRightPhotoProjection = null;
let capLeftPhotoProjection = null;
let capRightPhotoMaterial = null;
let capLeftPhotoMaterial = null;
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
let sprayPinholeMesh = null;
let labelMesh = null;
let label = null;
let atomizerAccentLight = null;

// Elementos de la simulación del agujero central de la tapa
let simulatedGoldAtomizerHead = null;
let simulatedCapTopRing = null;
let simulatedCapTopGroove = null;
let simulatedCapUndersideCavity = null;
let simulatedCapUndersideRing = null;

// Manguera interna procedural (Dip Tube)
let dipTubeGroup = null;
let dipTubeMaterial = null;

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

// PASO 8: Capa interior del líquido oscuro (conservada para reactivación posterior)
const innerLiquidMaterial = new THREE.MeshStandardMaterial({
  color: 0x350009,
  metalness: 0,
  roughness: 0.48,
  transparent: false,
  opacity: 1,
  vertexColors: false,
  envMap: null,
  envMapIntensity: 0,
});

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
// Entorno de Estudio Neutro con Softboxes Verticales Exclusivo para el Atomizador
// ==========================================================================
function createAtomizerStudioEnvMap(glRenderer) {
  const pmremGenerator = new THREE.PMREMGenerator(glRenderer);
  pmremGenerator.compileEquirectangularShader();

  const envCanvas = document.createElement('canvas');
  envCanvas.width = 1024;
  envCanvas.height = 512;
  const ctx = envCanvas.getContext('2d');

  // Fondo de estudio neutro oscuro (carbón suave con tonalidad cálida profunda)
  const bgGrad = ctx.createLinearGradient(0, 0, 0, envCanvas.height);
  bgGrad.addColorStop(0.0, '#100f12');
  bgGrad.addColorStop(0.5, '#0a090b');
  bgGrad.addColorStop(1.0, '#040405');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, envCanvas.width, envCanvas.height);

  // Función para trazar softboxes verticales de estudio
  function drawVerticalSoftbox(cx, width, heightRatio, colorCenter, colorEdge) {
    const w = width;
    const grad = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
    grad.addColorStop(0.0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.2, colorEdge);
    grad.addColorStop(0.5, colorCenter);
    grad.addColorStop(0.8, colorEdge);
    grad.addColorStop(1.0, 'rgba(0,0,0,0)');

    const yTop = envCanvas.height * (1 - heightRatio) / 2;
    const yHeight = envCanvas.height * heightRatio;

    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(cx - w / 2, yTop, w, yHeight);
    ctx.restore();
  }

  // 1. Softbox principal frontal-derecho (reflejo vertical suave, sin blancos quemados)
  drawVerticalSoftbox(envCanvas.width * 0.32, 130, 0.85, 'rgba(255, 246, 230, 0.88)', 'rgba(230, 210, 180, 0.28)');

  // 2. Softbox de relleno izquierdo (contraste y definición del cilindro)
  drawVerticalSoftbox(envCanvas.width * 0.72, 105, 0.80, 'rgba(242, 235, 220, 0.70)', 'rgba(210, 190, 160, 0.20)');

  // 3. Franja de perfil posterior sutil para acentuar el borde metálico
  drawVerticalSoftbox(envCanvas.width * 0.52, 60, 0.70, 'rgba(235, 220, 190, 0.45)', 'rgba(180, 160, 130, 0.12)');

  // 4. Suave degradado superior para iluminar la cara superior del pulsador
  const topGrad = ctx.createRadialGradient(envCanvas.width * 0.4, 0, 10, envCanvas.width * 0.4, 0, 260);
  topGrad.addColorStop(0.0, 'rgba(255, 248, 235, 0.55)');
  topGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, envCanvas.width, 240);

  const envTexture = new THREE.CanvasTexture(envCanvas);
  envTexture.mapping = THREE.EquirectangularReflectionMapping;
  envTexture.colorSpace = THREE.SRGBColorSpace;
  envTexture.needsUpdate = true;

  const envRenderTarget = pmremGenerator.fromEquirectangular(envTexture);
  envTexture.dispose();
  pmremGenerator.dispose();

  return envRenderTarget.texture;
}

const atomizerStudioEnvMap = createAtomizerStudioEnvMap(renderer);

// Material exclusivo para el atomizador: Oro champán pulido con efecto espejo
const atomizerMirrorGoldMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xd6a84b,
  metalness: 1.0,
  roughness: 0.14,
  clearcoat: 0.25,
  clearcoatRoughness: 0.10,
  envMap: atomizerStudioEnvMap,
  envMapIntensity: 0.75,
  toneMapped: true,
});

// Alias para compatibilidad
const champagneGoldMaterial = atomizerMirrorGoldMaterial;
const goldNeckMaterial = atomizerMirrorGoldMaterial;
const goldMaterial = atomizerMirrorGoldMaterial;
const collarMaterial = atomizerMirrorGoldMaterial;
const stemMaterial = atomizerMirrorGoldMaterial;
const buttonMaterial = atomizerMirrorGoldMaterial;

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
    if (label) label.visible = true;
    if (labelMesh) labelMesh.visible = true;
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

        // Material fotográfico transparente con tono original (toneMapped: false)
        bodyFrontPhotoMaterial = new THREE.MeshBasicMaterial({
          map: bodyFrontCanvasTexture,
          transparent: true,
          opacity: 1,
          alphaTest: 0.01,
          depthWrite: false,
          depthTest: true,
          side: THREE.FrontSide,
          toneMapped: false,
        });

        // Proporciones exactas de la cara frontal (98.5% de su ancho y altura reales en el modelo)
        const photoWidth = bottleSize.x * 0.985;
        const photoHeight = bottleSize.y * 0.985;
        const photoGeo = new THREE.PlaneGeometry(photoWidth, photoHeight);

        bodyFrontPhotoProjection = new THREE.Mesh(photoGeo, bodyFrontPhotoMaterial);
        bodyFrontPhotoProjection.name = 'bodyFrontPhotoProjection';
        bodyFrontPhotoProjection.renderOrder = 3;

        // Cara frontal (+Z) centrada y apenas separada de la superficie para evitar z-fighting
        const posZ = cuerpoBox ? cuerpoBox.max.z + 0.00015 : 0.01755;
        bodyFrontPhotoProjection.position.set(cuerpoCenter.x, cuerpoCenter.y, posZ);

        bottleGroup.add(bodyFrontPhotoProjection);

        // 6. Ocultar únicamente después de confirmar creación exitosa de la proyección
        if (label) {
          label.visible = false;
        }
        if (labelMesh) {
          labelMesh.visible = false;
        }
        if (bodyInnerLiquid) {
          bodyInnerLiquid.visible = false;
        }
        if (innerBodyMesh) {
          innerBodyMesh.visible = false;
        }

        // Intentar inicializar shader multivista
        tryInitBodyMultiviewShader();
      } catch (err) {
        console.error('Error al crear la proyección frontal:', err);

        // 11. Eliminar solamente la proyección incompleta
        if (bodyFrontPhotoProjection) {
          if (bodyFrontPhotoProjection.parent) {
            bodyFrontPhotoProjection.parent.remove(bodyFrontPhotoProjection);
          }
          if (bodyFrontPhotoProjection.geometry) {
            bodyFrontPhotoProjection.geometry.dispose();
          }
          bodyFrontPhotoProjection = null;
        }

        // Mantener cuerpo 3D visible y restaurar etiqueta
        if (cuerpoMesh) {
          cuerpoMesh.visible = true;
        }
        if (label) {
          label.visible = true;
        }
        if (labelMesh) {
          labelMesh.visible = true;
        }
        if (bodyInnerLiquid) {
          bodyInnerLiquid.visible = false;
        }
        if (innerBodyMesh) {
          innerBodyMesh.visible = false;
        }
      }
    },
    undefined,
    (error) => {
      console.error('No se pudo cargar la referencia frontal:', error);

      if (cuerpoMesh) {
        cuerpoMesh.visible = true;
      }
      if (label) {
        label.visible = true;
      }
      if (labelMesh) {
        labelMesh.visible = true;
      }
      if (bodyInnerLiquid) {
        bodyInnerLiquid.visible = false;
      }
      if (innerBodyMesh) {
        innerBodyMesh.visible = false;
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

        capFrontPhotoMaterial = new THREE.MeshBasicMaterial({
          map: capOriginalFrontTexture,
          transparent: true,
          opacity: 1,
          alphaTest: 0.01,
          depthWrite: false,
          depthTest: false,
          side: THREE.FrontSide,
          toneMapped: false,
        });

        const tapaBox = new THREE.Box3().setFromObject(capMesh);
        const tapaSize = tapaBox.getSize(new THREE.Vector3());
        const tapaCenter = tapaBox.getCenter(new THREE.Vector3());

        const photoWidth = tapaSize.x * 0.99;
        const photoHeight = tapaSize.y * 0.98;
        const photoGeo = new THREE.PlaneGeometry(photoWidth, photoHeight);

        capFrontPhotoProjection = new THREE.Mesh(photoGeo, capFrontPhotoMaterial);
        capFrontPhotoProjection.name = 'capFrontPhotoProjection';
        capFrontPhotoProjection.renderOrder = 5;
        capFrontPhotoProjection.scale.x = 1.04 * 1.025;
        capFrontPhotoProjection.scale.y = 1.20 * 1.08;

        const offsetVertical = -0.095 * tapaSize.y;
        const posY = tapaCenter.y + offsetVertical;
        const posZ = tapaBox.max.z + 0.00012;
        capFrontPhotoProjection.position.set(tapaCenter.x, posY, posZ);

        targetCapGroup.add(capFrontPhotoProjection);
      } catch (err) {
        console.error('Error al crear proyección frontal original de la tapa:', err);
        if (capFrontPhotoProjection) {
          if (capFrontPhotoProjection.parent) {
            capFrontPhotoProjection.parent.remove(capFrontPhotoProjection);
          }
          if (capFrontPhotoProjection.geometry) {
            capFrontPhotoProjection.geometry.dispose();
          }
          capFrontPhotoProjection = null;
        }
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

            bodyBackPhotoMaterial = new THREE.MeshBasicMaterial({
              map: bodyBackCanvasTexture,
              transparent: true,
              opacity: 0,
              alphaTest: 0.01,
              depthWrite: false,
              depthTest: true,
              side: THREE.FrontSide,
              toneMapped: false,
            });

            // Mismo ancho y altura proporcionales a la geometría
            const photoWidth = bottleSize.x * 0.985;
            const photoHeight = bottleSize.y * 0.985;
            const photoGeo = new THREE.PlaneGeometry(photoWidth, photoHeight);

            bodyBackPhotoProjection = new THREE.Mesh(photoGeo, bodyBackPhotoMaterial);
            bodyBackPhotoProjection.name = 'bodyBackPhotoProjection';
            bodyBackPhotoProjection.renderOrder = 4;

            // 3. Reducir ligeramente la proyección posterior (0.985 en X, 0.992 en Y)
            bodyBackPhotoProjection.scale.x = 0.985;
            bodyBackPhotoProjection.scale.y = 0.992;

            // 2. Mover hacia la izquierda vista desde atrás (+X en coordenadas de bottleGroup)
            const horizontalOffset = 0.012 * bottleSize.x;
            const posX = cuerpoCenter.x + horizontalOffset;
            const posZ = cuerpoBox ? cuerpoBox.min.z - 0.00015 : -0.01755;

            bodyBackPhotoProjection.position.set(posX, cuerpoCenter.y, posZ);
            bodyBackPhotoProjection.rotation.y = Math.PI;

            bottleGroup.add(bodyBackPhotoProjection);
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

            capBackPhotoMaterial = new THREE.MeshBasicMaterial({
              map: capOriginalBackTexture,
              transparent: true,
              opacity: 0,
              alphaTest: 0.01,
              depthWrite: false,
              depthTest: false,
              side: THREE.FrontSide,
              toneMapped: false,
            });

            const tapaBox = new THREE.Box3().setFromObject(capMesh);
            const tapaSize = tapaBox.getSize(new THREE.Vector3());
            const tapaCenter = tapaBox.getCenter(new THREE.Vector3());

            const photoWidth = tapaSize.x * 0.99;
            const photoHeight = tapaSize.y * 0.98;
            const photoGeo = new THREE.PlaneGeometry(photoWidth, photoHeight);

            capBackPhotoProjection = new THREE.Mesh(photoGeo, capBackPhotoMaterial);
            capBackPhotoProjection.name = 'capBackPhotoProjection';
            capBackPhotoProjection.renderOrder = 5;
            capBackPhotoProjection.scale.x = 1.04 * 1.025;
            capBackPhotoProjection.scale.y = 1.20 * 1.08;

            const offsetVertical = -0.095 * tapaSize.y;
            const posY = tapaCenter.y + offsetVertical;
            const posZ = tapaBox.min.z - 0.00012;

            capBackPhotoProjection.position.set(tapaCenter.x, posY, posZ);
            capBackPhotoProjection.rotation.y = Math.PI;

            targetCapGroup.add(capBackPhotoProjection);
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

        function createSideMaterial(texture) {
          return new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0,
            depthTest: true,
            depthWrite: false,
            side: THREE.FrontSide,
            toneMapped: false,
          });
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

          bodyRightPhotoMaterial = createSideMaterial(bodyRightCanvasTexture);
          bodyLeftPhotoMaterial = createSideMaterial(bodyLeftCanvasTexture);

          // Ajuste al 98% de la superficie disponible (profundidad Z y altura Y)
          const sideWidth = bottleSize.z * 0.98;
          const sideHeight = bottleSize.y * 0.98;
          const bodySideGeo = new THREE.PlaneGeometry(sideWidth, sideHeight);

          // Lateral derecho (+X)
          bodyRightPhotoProjection = new THREE.Mesh(bodySideGeo, bodyRightPhotoMaterial);
          bodyRightPhotoProjection.name = 'bodyRightPhotoProjection';
          bodyRightPhotoProjection.renderOrder = 4;
          bodyRightPhotoProjection.position.set(cuerpoBox.max.x + 0.00012, cuerpoCenter.y, 0);
          bodyRightPhotoProjection.rotation.y = Math.PI / 2;
          bottleGroup.add(bodyRightPhotoProjection);

          // Lateral izquierdo (-X)
          bodyLeftPhotoProjection = new THREE.Mesh(bodySideGeo, bodyLeftPhotoMaterial);
          bodyLeftPhotoProjection.name = 'bodyLeftPhotoProjection';
          bodyLeftPhotoProjection.renderOrder = 4;
          bodyLeftPhotoProjection.position.set(cuerpoBox.min.x - 0.00012, cuerpoCenter.y, 0);
          bodyLeftPhotoProjection.rotation.y = -Math.PI / 2;
          bottleGroup.add(bodyLeftPhotoProjection);
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

      if (targetCapGroup && capMesh) {
        const tapaBox = new THREE.Box3().setFromObject(capMesh);
        const tapaSize = tapaBox.getSize(new THREE.Vector3());
        const tapaCenter = tapaBox.getCenter(new THREE.Vector3());

        const sideWidth = tapaSize.z * 0.98;
        const sideHeight = tapaSize.y * 0.98;
        const capSideGeo = new THREE.PlaneGeometry(sideWidth, sideHeight);

        capRightPhotoMaterial = new THREE.MeshBasicMaterial({
          map: capSideClosedTexture,
          transparent: true,
          opacity: 0,
          depthTest: true,
          depthWrite: false,
          side: THREE.FrontSide,
          toneMapped: false,
        });
        capLeftPhotoMaterial = new THREE.MeshBasicMaterial({
          map: capSideClosedMirroredTexture,
          transparent: true,
          opacity: 0,
          depthTest: true,
          depthWrite: false,
          side: THREE.FrontSide,
          toneMapped: false,
        });

        if (!capRightPhotoProjection) {
          capRightPhotoProjection = new THREE.Mesh(capSideGeo, capRightPhotoMaterial);
          capRightPhotoProjection.name = 'capRightPhotoProjection';
          capRightPhotoProjection.renderOrder = 5;
          capRightPhotoProjection.position.set(tapaBox.max.x + 0.00012, tapaCenter.y, 0);
          capRightPhotoProjection.rotation.y = Math.PI / 2;
          targetCapGroup.add(capRightPhotoProjection);
        } else {
          capRightPhotoProjection.material = capRightPhotoMaterial;
        }

        if (!capLeftPhotoProjection) {
          capLeftPhotoProjection = new THREE.Mesh(capSideGeo, capLeftPhotoMaterial);
          capLeftPhotoProjection.name = 'capLeftPhotoProjection';
          capLeftPhotoProjection.renderOrder = 5;
          capLeftPhotoProjection.position.set(tapaBox.min.x - 0.00012, tapaCenter.y, 0);
          capLeftPhotoProjection.rotation.y = -Math.PI / 2;
          targetCapGroup.add(capLeftPhotoProjection);
        } else {
          capLeftPhotoProjection.material = capLeftPhotoMaterial;
        }
      }

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
    if (bodyFrontPhotoProjection) bodyFrontPhotoProjection.visible = true;
    if (bodyBackPhotoProjection) bodyBackPhotoProjection.visible = true;
    if (bodyRightPhotoProjection) bodyRightPhotoProjection.visible = true;
    if (bodyLeftPhotoProjection) bodyLeftPhotoProjection.visible = true;
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

    // Ocultar únicamente las proyecciones planas del cuerpo
    if (bodyFrontPhotoProjection) bodyFrontPhotoProjection.visible = false;
    if (bodyBackPhotoProjection) bodyBackPhotoProjection.visible = false;
    if (bodyRightPhotoProjection) bodyRightPhotoProjection.visible = false;
    if (bodyLeftPhotoProjection) bodyLeftPhotoProjection.visible = false;

    // Ocultar la etiqueta procedural básica porque está integrada en la foto frontal
    if (labelMesh) labelMesh.visible = false;
    if (label) label.visible = false;
    if (innerBodyMesh) innerBodyMesh.visible = false;
    if (bodyInnerLiquid) bodyInnerLiquid.visible = false;

    console.log('✨ [Shader Multivista] Cuerpo actualizado exitosamente con shader proyectivo en malla 3D.');
  } catch (err) {
    console.error('Error al inicializar shader multivista del cuerpo:', err);
    // Restaurar material y planos en caso de error
    if (bodyAdvertisingShader) {
      targetMesh.material = bodyAdvertisingShader;
    }
    if (bodyFrontPhotoProjection) bodyFrontPhotoProjection.visible = true;
    if (bodyBackPhotoProjection) bodyBackPhotoProjection.visible = true;
    if (bodyRightPhotoProjection) bodyRightPhotoProjection.visible = true;
    if (bodyLeftPhotoProjection) bodyLeftPhotoProjection.visible = true;
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
    if (capFrontPhotoProjection) capFrontPhotoProjection.visible = true;
    if (capBackPhotoProjection) capBackPhotoProjection.visible = true;
    if (capRightPhotoProjection) capRightPhotoProjection.visible = true;
    if (capLeftPhotoProjection) capLeftPhotoProjection.visible = true;
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
        side: THREE.FrontSide,
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
        shader.uniforms.uBaseRuby = capMultiviewUniforms.uBaseRuby;

        shader.vertexShader = shader.vertexShader.replace(
          '#include <common>',
          `#include <common>
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
uniform vec3 uBaseRuby;

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

// 1. Proyección frontal (+Z, ensanchada ~18% horizontalmente para cubrir completamente los extremos)
vec2 uvFront = vec2(
  (normPos.x - 0.5) / 1.085 + 0.5,
  (normPos.y - 0.5) / 0.94 + 0.46
);
vec4 colOrigFront = sampleCapPhoto(uCapOrigFront, uvFront);
vec4 colCleanFront = sampleCapPhoto(uCapCleanFront, uvFront);
vec4 colFront = mix(colOrigFront, colCleanFront, clamp(uCapCleanMix, 0.0, 1.0));

// 2. Proyección posterior (-Z, ensanchada con misma escala y offset de la referencia horizontalmente reflejada)
vec2 uvBack = vec2(
  1.0 - ((normPos.x - 0.5) / 1.085 + 0.5),
  (normPos.y - 0.5) / 0.94 + 0.46
);
vec4 colOrigBack = sampleCapPhoto(uCapOrigBack, uvBack);
vec4 colCleanBack = sampleCapPhoto(uCapCleanBack, uvBack);
vec4 colBack = mix(colOrigBack, colCleanBack, clamp(uCapCleanMix, 0.0, 1.0));

// 3. Proyección lateral derecha (+X, ensanchada para coincidencia y encaje exacto)
vec2 uvRight = vec2(
  1.0 - ((normPos.z - 0.5) / 1.095 + 0.5),
  (normPos.y - 0.5) / 0.98 + 0.5
);
vec4 capSideClosedColor = sampleCapPhoto(uCapSideClosedRight, uvRight);
vec4 capSideCleanColor  = sampleCapPhoto(uCapSideCleanRight, uvRight);
vec4 sideRightColor = mix(
  capSideClosedColor,
  capSideCleanColor,
  clamp(uCapCleanMix, 0.0, 1.0)
);

// 4. Proyección lateral izquierda (-X, ensanchada para coincidencia y encaje exacto)
vec2 uvLeft = vec2(
  ((normPos.z - 0.5) / 1.095 + 0.5),
  (normPos.y - 0.5) / 0.98 + 0.5
);
vec4 capSideClosedMirroredColor = sampleCapPhoto(uCapSideClosedLeft, uvLeft);
vec4 capSideCleanMirroredColor  = sampleCapPhoto(uCapSideCleanLeft, uvLeft);
vec4 sideLeftColor = mix(
  capSideClosedMirroredColor,
  capSideCleanMirroredColor,
  clamp(uCapCleanMix, 0.0, 1.0)
);

// 5. Pesos según normales locales para mezcla suave en curvaturas, semiarco y biseles
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

// Suavizado en superficie superior (n.y > 0) y superficie inferior (n.y < 0)
float horizFactor = smoothstep(0.92, 0.65, abs(n.y));
diffuseColor.rgb = mix(uBaseRuby, blendedPhoto, horizFactor);
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
    }

    targetMesh.material = capMultiviewMaterial;
    targetMesh.material.needsUpdate = true;

    // Ocultar únicamente las proyecciones planas de la tapa
    if (capFrontPhotoProjection) capFrontPhotoProjection.visible = false;
    if (capBackPhotoProjection) capBackPhotoProjection.visible = false;
    if (capRightPhotoProjection) capRightPhotoProjection.visible = false;
    if (capLeftPhotoProjection) capLeftPhotoProjection.visible = false;

    console.log('✨ [Shader Multivista] Tapa actualizada exitosamente con shader proyectivo en malla 3D.');
  } catch (err) {
    console.error('Error al inicializar shader multivista de la tapa:', err);
    // Restaurar material y planos en caso de error
    if (capMaterial) {
      targetMesh.material = capMaterial;
      targetMesh.material.needsUpdate = true;
    }
    if (capFrontPhotoProjection) capFrontPhotoProjection.visible = true;
    if (capBackPhotoProjection) capBackPhotoProjection.visible = true;
    if (capRightPhotoProjection) capRightPhotoProjection.visible = true;
    if (capLeftPhotoProjection) capLeftPhotoProjection.visible = true;
  }
}

// ==========================================================================
// PASO 11: Etiqueta Frontal Agrandada 1.7x con CanvasTexture 2048x2048
// ==========================================================================
function createLabelTexture() {
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 2048;
  labelCanvas.height = 2048;
  const ctx = labelCanvas.getContext('2d');

  function renderLabel() {
    ctx.clearRect(0, 0, labelCanvas.width, labelCanvas.height);

    const cx = labelCanvas.width / 2;

    const goldGrad = ctx.createLinearGradient(0, 480, 0, 1680);
    goldGrad.addColorStop(0.0, '#fff4cc');
    goldGrad.addColorStop(0.25, '#f0cf65');
    goldGrad.addColorStop(0.65, '#c89324');
    goldGrad.addColorStop(1.0, '#f9e08c');

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 1. TEMPTATION
    ctx.font = '600 112px "Montserrat", sans-serif';
    ctx.fillStyle = goldGrad;
    ctx.letterSpacing = '20px';
    ctx.fillText('TEMPTATION', cx, 730);

    // 2. MYSTIC
    ctx.font = 'italic 700 164px "Cormorant Garamond", Georgia, serif';
    ctx.fillStyle = goldGrad;
    ctx.letterSpacing = '24px';
    ctx.fillText('MYSTIC', cx, 910);

    // Línea sutil decorativa dorada
    ctx.strokeStyle = 'rgba(229, 193, 88, 0.45)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - 180, 1030);
    ctx.lineTo(cx + 180, 1030);
    ctx.stroke();

    // 3. EAU DE PARFUM
    ctx.font = '500 48px "Montserrat", sans-serif';
    ctx.fillStyle = '#ecd79a';
    ctx.letterSpacing = '14px';
    ctx.fillText('EAU DE PARFUM', cx, 1110);

    // 4. YANBAL
    ctx.font = '700 64px "Montserrat", sans-serif';
    ctx.fillStyle = goldGrad;
    ctx.letterSpacing = '28px';
    ctx.fillText('YANBAL', cx, 1420);
  }

  renderLabel();

  if (document.fonts) {
    document.fonts.ready.then(() => {
      renderLabel();
      texture.needsUpdate = true;
    });
  }

  const texture = new THREE.CanvasTexture(labelCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function buildLabelMesh(cuerpoCenter) {
  const labelTexture = createLabelTexture();
  // Aumentado ~1.7 veces conservando proporciones
  const labelGeo = new THREE.PlaneGeometry(0.058, 0.058);
  const labelMat = new THREE.MeshBasicMaterial({
    map: labelTexture,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    side: THREE.FrontSide,
    toneMapped: false,
  });

  const mesh = new THREE.Mesh(labelGeo, labelMat);
  mesh.name = 'labelMesh';
  mesh.renderOrder = 3; // PASO 10: Delante del panel
  // Centrado horizontal, ubicado en la mitad superior del panel
  const posY = (cuerpoCenter ? cuerpoCenter.y : -0.0152) + 0.0115;
  mesh.position.set(0, posY, 0.01758);
  return mesh;
}

// ==========================================================================
// Manguera Interna Frontal Procedural (Dip Tube)
// ==========================================================================
function buildDipTube() {
  const group = new THREE.Group();
  group.name = 'dipTubeGroup';

  dipTubeMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x3a000b,
    metalness: 0,
    roughness: 0.42,
    transparent: true,
    opacity: 0.38,
    transmission: 0,
    depthWrite: false,
    depthTest: false,
    side: THREE.FrontSide,
    toneMapped: true,
  });

  // Trayectoria suave: nace bajo atomizador, baja casi vertical, curva suavemente a la derecha tras EAU DE PARFUM y termina a la derecha de YANBAL
  const points = [
    new THREE.Vector3(0.0000, 0.0285, 0.0030),
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
  const tubeGeo = new THREE.TubeGeometry(curve, 64, 0.00065, 12, false);
  const tubeMesh = new THREE.Mesh(tubeGeo, dipTubeMaterial);
  tubeMesh.name = 'dipTubeMesh';
  tubeMesh.renderOrder = 2;
  group.add(tubeMesh);

  // Extremo inferior ligeramente redondeado
  const endCapGeo = new THREE.SphereGeometry(0.00065, 12, 12);
  const endCapMesh = new THREE.Mesh(endCapGeo, dipTubeMaterial);
  endCapMesh.name = 'dipTubeEndCap';
  endCapMesh.position.copy(points[points.length - 1]);
  endCapMesh.renderOrder = 2;
  group.add(endCapMesh);

  return group;
}

// ==========================================================================
// 5. Construcción Procedimental del Atomizador (atomizerGroup)
// ==========================================================================
function buildProceduralAtomizer() {
  const group = new THREE.Group();
  group.name = 'atomizerGroup';

  // a) Collar inferior metálico alrededor del cuello
  const ringRadius = 0.0116;
  const ringGeo = new THREE.CylinderGeometry(ringRadius, ringRadius * 1.025, 0.0024, 64);
  ringGeo.computeVertexNormals();
  const ringMesh = new THREE.Mesh(ringGeo, atomizerMirrorGoldMaterial);
  ringMesh.name = 'atomizerRing';
  ringMesh.position.set(0, 0.0306, 0);
  group.add(ringMesh);

  // Vástago cilíndrico intermedio
  const stemRadius = 0.0055;
  const stemHeight = 0.0050;
  const stemGeo = new THREE.CylinderGeometry(stemRadius, stemRadius, stemHeight, 48);
  stemGeo.translate(0, stemHeight / 2, 0);
  stemGeo.computeVertexNormals();
  const stemMesh = new THREE.Mesh(stemGeo, atomizerMirrorGoldMaterial);
  stemMesh.name = 'atomizerStem';
  stemMesh.position.set(0, 0.0318, 0);
  group.add(stemMesh);

  // Grupo del pulsador móvil (cabeza presionable)
  pulsadorGroup = new THREE.Group();
  pulsadorGroup.name = 'pulsadorGroup';
  pulsadorGroup.position.set(0, 0.0430, 0);

  // b) Cabeza presionable
  const buttonRadius = 0.0076;
  const buttonHeight = 0.0105;
  const buttonGeo = new THREE.CylinderGeometry(buttonRadius, buttonRadius, buttonHeight, 64);
  buttonGeo.translate(0, buttonHeight / 2, 0);
  buttonGeo.computeVertexNormals();
  const buttonMesh = new THREE.Mesh(buttonGeo, atomizerMirrorGoldMaterial);
  buttonMesh.name = 'atomizerButton';
  pulsadorGroup.add(buttonMesh);

  // Franja vertical de brillo previa desactivada para permitir reflejos espejo físicos puros
  const highlightRadius = buttonRadius + 0.00008;
  const highlightHeight = buttonHeight * 0.94;
  const highlightGeo = new THREE.CylinderGeometry(
    highlightRadius,
    highlightRadius,
    highlightHeight,
    16,
    1,
    true,
    -Math.PI * 0.16,
    Math.PI * 0.08
  );
  highlightGeo.translate(0, buttonHeight / 2, 0);
  const highlightMesh = new THREE.Mesh(highlightGeo, atomizerGoldHighlightMaterial);
  highlightMesh.name = 'atomizerGoldHighlight';
  highlightMesh.visible = false;
  pulsadorGroup.add(highlightMesh);

  // c) Boquilla metálica en la cara frontal (+Z)
  const nozzleOuterGeo = new THREE.CylinderGeometry(0.0011, 0.0011, 0.0006, 32);
  nozzleOuterGeo.rotateX(Math.PI / 2);
  nozzleOuterGeo.computeVertexNormals();
  const nozzleOuterMesh = new THREE.Mesh(nozzleOuterGeo, atomizerMirrorGoldMaterial);
  nozzleOuterMesh.name = 'sprayNozzleOuter';
  nozzleOuterMesh.position.set(0, 0.0072, buttonRadius + 0.0002);
  pulsadorGroup.add(nozzleOuterMesh);

  // Orificio oscuro central de spray (origen de las partículas)
  const pinholeGeo = new THREE.CylinderGeometry(0.00045, 0.00045, 0.0007, 16);
  pinholeGeo.rotateX(Math.PI / 2);
  const pinholeMat = new THREE.MeshBasicMaterial({ color: 0x040404 });
  sprayPinholeMesh = new THREE.Mesh(pinholeGeo, pinholeMat);
  sprayPinholeMesh.name = 'sprayPinhole';
  sprayPinholeMesh.position.set(0, 0.0072, buttonRadius + 0.00025);
  pulsadorGroup.add(sprayPinholeMesh);

  // Asegurar asignación de atomizerMirrorGoldMaterial a las piezas metálicas del atomizador
  group.traverse((child) => {
    if (
      child.isMesh &&
      child.name !== 'sprayPinhole' &&
      child.name !== 'atomizerGoldHighlight'
    ) {
      if (child.geometry) {
        child.geometry.computeVertexNormals();
      }
      child.material = atomizerMirrorGoldMaterial;
    }
  });

  group.add(pulsadorGroup);
  return group;
}

// ==========================================================================
// 10. Simulación Visual del Agujero Central de la Tapa (Colores Phong)
// ==========================================================================
function buildSimulatedCapHole(targetCapGroup, capMesh) {
  // Calcular bounding box real de la tapa para situar los elementos con exactitud
  const tapaBox = new THREE.Box3().setFromObject(capMesh);
  const capTopY = tapaBox.max.y;
  const capBottomY = tapaBox.min.y;
  const capCenter = tapaBox.getCenter(new THREE.Vector3());

  console.group('🔍 [Tapa] Bounding Box y Cotas para Simulación de Agujero');
  console.log(`Cota Superior (capTopY): ${capTopY.toFixed(5)} m`);
  console.log(`Cota Inferior (capBottomY): ${capBottomY.toFixed(5)} m`);
  console.log(`Centro Horizontal: x=${capCenter.x.toFixed(5)}, z=${capCenter.z.toFixed(5)}`);
  console.log(`Altura total de tapa: ${(capTopY - capBottomY).toFixed(5)} m`);
  console.groupEnd();

  const headRadius = 0.0072;
  const headThickness = 0.0003;

  // 10. Disco dorado superior simulado con atomizerGoldMaterial
  const goldHeadGeo = new THREE.CylinderGeometry(headRadius, headRadius, headThickness, 36);
  const goldHeadMat = atomizerGoldMaterial.clone();
  goldHeadMat.transparent = true;
  goldHeadMat.opacity = 1;
  simulatedGoldAtomizerHead = new THREE.Mesh(goldHeadGeo, goldHeadMat);
  simulatedGoldAtomizerHead.name = 'simulatedGoldAtomizerHead';
  simulatedGoldAtomizerHead.position.set(capCenter.x, capTopY + headThickness / 2 + 0.00015, capCenter.z);
  targetCapGroup.add(simulatedGoldAtomizerHead);

  // Pequeño aro de profundidad oscura alrededor del disco dorado
  const grooveGeo = new THREE.RingGeometry(headRadius * 0.96, headRadius * 1.05, 36);
  grooveGeo.rotateX(-Math.PI / 2);
  const grooveMat = new THREE.MeshBasicMaterial({
    color: 0x140105,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  simulatedCapTopGroove = new THREE.Mesh(grooveGeo, grooveMat);
  simulatedCapTopGroove.name = 'simulatedCapTopGroove';
  simulatedCapTopGroove.position.set(capCenter.x, capTopY + 0.0001, capCenter.z);
  targetCapGroup.add(simulatedCapTopGroove);

  // 10. Aro borgoña
  const ringRadius = headRadius + 0.0005;
  const ringTube = 0.00055;
  const ringGeo = new THREE.TorusGeometry(ringRadius, ringTube, 16, 48);
  ringGeo.rotateX(Math.PI / 2);
  const ringMat = new THREE.MeshPhongMaterial({
    color: 0x650013,
    emissive: 0x160002,
    emissiveIntensity: 0.2,
    specular: 0xb52242,
    shininess: 38,
    transparent: true,
    opacity: 1,
    side: THREE.FrontSide,
  });
  simulatedCapTopRing = new THREE.Mesh(ringGeo, ringMat);
  simulatedCapTopRing.name = 'simulatedCapTopRing';
  simulatedCapTopRing.position.set(capCenter.x, capTopY + 0.00012, capCenter.z);
  targetCapGroup.add(simulatedCapTopRing);

  // 10. Cavidad inferior (MeshPhongMaterial negro profundo hacia abajo)
  const cavityRadius = 0.0082;
  const cavityDepth = 0.0085;
  const cavityGeo = new THREE.CylinderGeometry(cavityRadius, cavityRadius, cavityDepth, 32, 1, false);
  cavityGeo.translate(0, cavityDepth / 2, 0);
  const cavityMat = new THREE.MeshPhongMaterial({
    color: 0x090002,
    emissive: 0x120003,
    emissiveIntensity: 0.12,
    specular: 0x4d0715,
    shininess: 18,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0,
  });
  simulatedCapUndersideCavity = new THREE.Mesh(cavityGeo, cavityMat);
  simulatedCapUndersideCavity.name = 'simulatedCapUndersideCavity';
  simulatedCapUndersideCavity.position.set(capCenter.x, capBottomY + 0.00005, capCenter.z);
  simulatedCapUndersideCavity.visible = false;
  targetCapGroup.add(simulatedCapUndersideCavity);

  // Aro interior rojo oscuro para dar sensación de espesor de pared en la base de la tapa
  const undersideRingGeo = new THREE.RingGeometry(cavityRadius * 0.98, cavityRadius * 1.15, 32);
  undersideRingGeo.rotateX(Math.PI / 2);
  const undersideRingMat = new THREE.MeshPhongMaterial({
    color: 0x3d020d,
    emissive: 0x100002,
    emissiveIntensity: 0.15,
    specular: 0x6e1022,
    shininess: 30,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
  });
  simulatedCapUndersideRing = new THREE.Mesh(undersideRingGeo, undersideRingMat);
  simulatedCapUndersideRing.name = 'simulatedCapUndersideRing';
  simulatedCapUndersideRing.position.set(capCenter.x, capBottomY + 0.00008, capCenter.z);
  simulatedCapUndersideRing.visible = false;
  targetCapGroup.add(simulatedCapUndersideRing);
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
// Carga del Modelo GLB e Inicialización
// ==========================================================================
const MODEL_PATH = './assets/models/temptation-mystic-parts-web.glb';
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

    const box = new THREE.Box3().setFromObject(modelRoot);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    modelRoot.position.sub(center);
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

    bottleGroup.attach(cuelloMesh);

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

    // PASO 2: Desactivar temporalmente la capa interior (bodyInnerLiquid.visible = false)
    innerBodyMesh = cuerpoMesh.clone();
    innerBodyMesh.name = 'bodyInnerLiquid';
    innerBodyMesh.material = innerLiquidMaterial;
    innerBodyMesh.visible = false;
    bodyInnerLiquid = innerBodyMesh;
    const scaleFactor = 0.96;
    innerBodyMesh.scale.multiplyScalar(scaleFactor);

    // Centrado concéntrico perfecto con respecto al centro geométrico del cuerpo
    innerBodyMesh.position
      .copy(cuerpoCenter)
      .sub(cuerpoCenter.clone().sub(cuerpoMesh.position).multiplyScalar(scaleFactor));

    // La capa interior queda dentro de bottleGroup (lista para reactivación posterior)
    bottleGroup.add(innerBodyMesh);

    // 7. Tapa: cristal rojo oscuro y pulido con poca transmisión
    tapaMesh.name = 'tapa';
    tapaMesh.material = capMaterial;

    // Cuello dorado uniforme con acabado espejo oro champán (atomizerMirrorGoldMaterial)
    cuelloMesh.name = 'cuello';
    cuelloMesh.material = atomizerMirrorGoldMaterial;
    if (cuelloMesh.geometry) {
      if (cuelloMesh.geometry.getAttribute('color')) {
        cuelloMesh.geometry.deleteAttribute('color');
      }
      cuelloMesh.geometry.computeVertexNormals();
    }

    if (verticesBodyEl) verticesBodyEl.textContent = `${cuerpoMesh.geometry.attributes.position.count.toLocaleString()} vtx`;
    if (verticesCapEl) verticesCapEl.textContent = `${tapaMesh.geometry.attributes.position.count.toLocaleString()} vtx`;
    if (verticesNeckEl) verticesNeckEl.textContent = `${cuelloMesh.geometry.attributes.position.count.toLocaleString()} vtx`;

    // Atomizador procedural
    atomizerGroup = buildProceduralAtomizer();
    bottleGroup.add(atomizerGroup);

    // Manguera interna procedural visible sutilmente a través del vidrio
    dipTubeGroup = buildDipTube();
    bottleGroup.add(dipTubeGroup);

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
          child.name === 'simulatedCapTopRing' ||
          child.name === 'simulatedCapTopGroove' ||
          child.name === 'simulatedCapUndersideCavity' ||
          child.name === 'simulatedCapUndersideRing' ||
          child.name.includes('PhotoProjection') ||
          child.name === 'labelMesh' ||
          child.name === 'dipTubeMesh' ||
          child.name === 'dipTubeEndCap'
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

    // 6. Etiqueta inicial procedural visible (se ocultará únicamente si la fotografía frontal carga con éxito)
    labelMesh = buildLabelMesh(cuerpoCenter);
    label = labelMesh;
    labelMesh.visible = true;
    bottleGroup.add(labelMesh);

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
      console.warn('Condiciones de geometría no válidas para proyección frontal. Se mantiene etiqueta procedural.');
      cuerpoMesh.visible = true;
      if (labelMesh) labelMesh.visible = true;
      if (label) label.visible = true;
    }

    // 2 & 3. Simulación visual del agujero central de la tapa
    buildSimulatedCapHole(capGroup, tapaMesh);

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

    // Ajuste de encuadre de la cámara
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    const cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.55;
    camera.position.set(0, 0, cameraZ);
    camera.lookAt(0, 0, 0);

    controls.target.set(0, 0, 0);
    controls.minDistance = cameraZ * 0.2;
    controls.maxDistance = cameraZ * 5;
    controls.update();

    initialCameraPos = camera.position.clone();
    initialTarget = controls.target.clone();

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
    capMultiviewUniforms.uCapCleanMix.value = 0.0;

    const initialCapY = capGroup.position.y;
    const initialPulsadorY = pulsadorGroup.position.y;

    const tl = gsap.timeline({
      onComplete: () => {
        isAnimating = false;
        uncapBtn.disabled = false;
        sprayState.active = false;
        capMultiviewUniforms.uCapCleanMix.value = 0.0;
        if (sprayPoints) sprayPoints.visible = false;
        if (screenMistOverlay) screenMistOverlay.style.opacity = '0';

        // 4. Estado final cerrado garantizado
        if (simulatedGoldAtomizerHead) {
          simulatedGoldAtomizerHead.visible = true;
          simulatedGoldAtomizerHead.material.opacity = 1;
        }
        if (simulatedCapTopRing) {
          simulatedCapTopRing.visible = true;
          simulatedCapTopRing.material.opacity = 1;
        }
        if (simulatedCapTopGroove) {
          simulatedCapTopGroove.visible = true;
          simulatedCapTopGroove.material.opacity = 0.9;
        }
        if (simulatedCapUndersideCavity) {
          simulatedCapUndersideCavity.visible = false;
          simulatedCapUndersideCavity.material.opacity = 0;
        }
        if (simulatedCapUndersideRing) {
          simulatedCapUndersideRing.visible = false;
          simulatedCapUndersideRing.material.opacity = 0;
        }
      },
    });

    // 4. Inicio del destapado: la tapa sube y transiciona a la referencia limpia
    tl.to(capGroup.position, {
      y: initialCapY + 0.048,
      duration: 1.1,
      ease: 'power3.inOut',
    }, 0)
    .to(capMultiviewUniforms.uCapCleanMix, {
      value: 1.0,
      duration: 1.1,
      ease: 'power3.inOut',
    }, 0)

    // Desvanecer gradualmente el disco dorado superior falso y su aro (duración 0.20s)
    .to([simulatedGoldAtomizerHead.material, simulatedCapTopRing.material, simulatedCapTopGroove.material], {
      opacity: 0,
      duration: 0.20,
      ease: 'power2.out',
      onComplete: () => {
        simulatedGoldAtomizerHead.visible = false;
        simulatedCapTopRing.visible = false;
        simulatedCapTopGroove.visible = false;
      },
    }, 0)

    // Mostrar gradualmente la cavidad inferior en la cara oculta de la tapa mientras asciende
    .set([simulatedCapUndersideCavity, simulatedCapUndersideRing], {
      visible: true,
    }, 0.20)
    .to([simulatedCapUndersideCavity.material, simulatedCapUndersideRing.material], {
      opacity: 1,
      duration: 0.35,
      ease: 'power2.out',
    }, 0.22)

    // 2. Tapa arriba: el pulsador baja
    .to(pulsadorGroup.position, {
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

    // 7. Retorno: la tapa desciende hacia su posición inicial y recupera la fotografía original
    .to(capGroup.position, {
      y: initialCapY,
      duration: 1.05,
      ease: 'power3.inOut',
    }, 'capReturn')
    .to(capMultiviewUniforms.uCapCleanMix, {
      value: 0.0,
      duration: 1.05,
      ease: 'power3.inOut',
    }, 'capReturn')

    // Ocultar cavidad inferior justo antes del cierre
    .to([simulatedCapUndersideCavity.material, simulatedCapUndersideRing.material], {
      opacity: 0,
      duration: 0.25,
      ease: 'power2.in',
      onComplete: () => {
        simulatedCapUndersideCavity.visible = false;
        simulatedCapUndersideRing.visible = false;
      },
    }, 'capReturn+=0.75')

    // Restaurar progresivamente el disco dorado superior y su aro al asentarse la tapa
    .set([simulatedGoldAtomizerHead, simulatedCapTopRing, simulatedCapTopGroove], {
      visible: true,
    }, 'capReturn+=0.80')
    .to(simulatedGoldAtomizerHead.material, {
      opacity: 1,
      duration: 0.25,
      ease: 'power2.out',
    }, 'capReturn+=0.80')
    .to(simulatedCapTopRing.material, {
      opacity: 1,
      duration: 0.25,
      ease: 'power2.out',
    }, 'capReturn+=0.80')
    .to(simulatedCapTopGroove.material, {
      opacity: 0.9,
      duration: 0.25,
      ease: 'power2.out',
    }, 'capReturn+=0.80');
  });
}

// Botón para restablecer cámara
if (resetCamBtn) {
  resetCamBtn.addEventListener('click', () => {
    gsap.to(camera.position, {
      x: initialCameraPos.x,
      y: initialCameraPos.y,
      z: initialCameraPos.z,
      duration: 0.8,
      ease: 'power2.out',
    });
    gsap.to(controls.target, {
      x: initialTarget.x,
      y: initialTarget.y,
      z: initialTarget.z,
      duration: 0.8,
      ease: 'power2.out',
      onUpdate: () => controls.update(),
    });
  });
}

// Redimensionamiento de ventana
function onWindowResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

window.addEventListener('resize', onWindowResize);

// ==========================================================================
// 8 y 9. Transición Frontal, Posterior y Lateral (Facing y Opacidades)
// ==========================================================================
const bottleWorldPosition = new THREE.Vector3();
const cameraDirection = new THREE.Vector3();
const bottleWorldNormal = new THREE.Vector3();
const bottleWorldQuaternion = new THREE.Quaternion();
const bottleRightNormal = new THREE.Vector3();
const bottleLeftNormal = new THREE.Vector3();

// Loop de animación principal único (sin bucles duplicados)
function animate() {
  requestAnimationFrame(animate);

  // Actualizar partículas activas durante el spray
  if (sprayState.active) {
    updateParticles(sprayState.progress);
  }

  // 8 y 9. Transición frontal, posterior y lateral con normales del modelo
  if (bottleGroup) {
    bottleGroup.getWorldPosition(bottleWorldPosition);
    bottleGroup.getWorldQuaternion(bottleWorldQuaternion);
    bottleWorldNormal.set(0, 0, 1).applyQuaternion(bottleWorldQuaternion).normalize();
    bottleRightNormal.set(1, 0, 0).applyQuaternion(bottleWorldQuaternion).normalize();
    bottleLeftNormal.set(-1, 0, 0).applyQuaternion(bottleWorldQuaternion).normalize();

    cameraDirection.subVectors(camera.position, bottleWorldPosition).normalize();

    const rawFacing = bottleWorldNormal.dot(cameraDirection);
    const facing = Number.isFinite(rawFacing) ? rawFacing : 1;

    const frontOpacity = THREE.MathUtils.smoothstep(
      facing,
      0.10,
      0.68
    );

    const backOpacity = THREE.MathUtils.smoothstep(
      -facing,
      0.10,
      0.68
    );

    const rawRightFacing = bottleRightNormal.dot(cameraDirection);
    const rightFacing = Number.isFinite(rawRightFacing) ? rawRightFacing : 0;

    const rawLeftFacing = bottleLeftNormal.dot(cameraDirection);
    const leftFacing = Number.isFinite(rawLeftFacing) ? rawLeftFacing : 0;

    // 9. Transición suave basada en el producto punto entre la cámara y las normales laterales (0.25 a 0.82)
    const rightOpacity = THREE.MathUtils.smoothstep(rightFacing, 0.25, 0.82);
    const leftOpacity = THREE.MathUtils.smoothstep(leftFacing, 0.25, 0.82);

    const isUsingBodyMultiview =
      USE_BODY_MULTIVIEW_SHADER &&
      bodyMultiviewMaterial &&
      cuerpoMesh &&
      cuerpoMesh.material === bodyMultiviewMaterial;

    if (isUsingBodyMultiview) {
      if (bodyFrontPhotoProjection) bodyFrontPhotoProjection.visible = false;
      if (bodyBackPhotoProjection) bodyBackPhotoProjection.visible = false;
      if (bodyRightPhotoProjection) bodyRightPhotoProjection.visible = false;
      if (bodyLeftPhotoProjection) bodyLeftPhotoProjection.visible = false;
    } else {
      if (bodyFrontPhotoMaterial) bodyFrontPhotoMaterial.opacity = frontOpacity;
      if (bodyBackPhotoMaterial) bodyBackPhotoMaterial.opacity = backOpacity;
      if (bodyRightPhotoMaterial) bodyRightPhotoMaterial.opacity = rightOpacity;
      if (bodyLeftPhotoMaterial) bodyLeftPhotoMaterial.opacity = leftOpacity;

      if (bodyFrontPhotoProjection) bodyFrontPhotoProjection.visible = frontOpacity > 0.01;
      if (bodyBackPhotoProjection) bodyBackPhotoProjection.visible = backOpacity > 0.01;
      if (bodyRightPhotoProjection) bodyRightPhotoProjection.visible = rightOpacity > 0.01;
      if (bodyLeftPhotoProjection) bodyLeftPhotoProjection.visible = leftOpacity > 0.01;
    }

    const isUsingCapMultiview =
      USE_CAP_MULTIVIEW_SHADER &&
      capMultiviewMaterial &&
      tapaMesh &&
      tapaMesh.material === capMultiviewMaterial;

    if (isUsingCapMultiview) {
      if (capFrontPhotoProjection) capFrontPhotoProjection.visible = false;
      if (capBackPhotoProjection) capBackPhotoProjection.visible = false;
      if (capRightPhotoProjection) capRightPhotoProjection.visible = false;
      if (capLeftPhotoProjection) capLeftPhotoProjection.visible = false;
    } else {
      if (capFrontPhotoMaterial) capFrontPhotoMaterial.opacity = frontOpacity;
      if (capBackPhotoMaterial) capBackPhotoMaterial.opacity = backOpacity;
      if (capFrontPhotoProjection) capFrontPhotoProjection.visible = frontOpacity > 0.01;
      if (capBackPhotoProjection) capBackPhotoProjection.visible = backOpacity > 0.01;

      if (capRightPhotoMaterial) capRightPhotoMaterial.opacity = rightOpacity;
      if (capRightPhotoProjection) capRightPhotoProjection.visible = rightOpacity > 0.01;

      if (capLeftPhotoMaterial) capLeftPhotoMaterial.opacity = leftOpacity;
      if (capLeftPhotoProjection) capLeftPhotoProjection.visible = leftOpacity > 0.01;
    }

    // Manguera interna visible principalmente desde el frente y diagonales frontales
    if (dipTubeGroup && dipTubeMaterial) {
      const tubeFade = THREE.MathUtils.smoothstep(facing, 0.12, 0.65);
      dipTubeMaterial.opacity = 0.38 * tubeFade;
      dipTubeGroup.visible = tubeFade > 0.01;
    }
  }

  // 10. OrbitControls continúa funcionando en todo momento
  controls.update();
  renderer.render(scene, camera);
}

animate();
