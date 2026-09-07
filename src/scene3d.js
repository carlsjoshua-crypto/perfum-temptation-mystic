/* ==========================================================================
   Temptation Mystic - Motor 3D (src/scene3d.js)
   Paridad Estricta 1:1 con model-test.js:
   - Ensamble cerrado exacto de piezas, cotas y jerarquías
   - Materiales físicos (MeshPhysicalMaterial) y shaders multivista
   - Serigrafía fotográfica original (Frontal, Lateral, Dorso, Limpia)
   - MatCap oro champán pulido tipo espejo para atomizador y cuello
   - Conector escalonado y manguera de inmersión procedural
   ========================================================================== */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
// import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
// import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';
import gsap from 'gsap';

// Resolución canónica de rutas públicas en Dev y Producción (MPA)
const BASE_PATH = (import.meta.env.BASE_URL || '/').endsWith('/')
  ? (import.meta.env.BASE_URL || '/')
  : `${import.meta.env.BASE_URL}/`;
const getAssetUrl = (relPath) => `${BASE_PATH}${relPath.replace(/^\.?\//, '')}`;

// ==========================================================================
// Interruptores y Estados de Shaders Multivista
// ==========================================================================
const USE_BODY_MULTIVIEW_SHADER = true;
const USE_CAP_MULTIVIEW_SHADER = true;

export const sceneObjects = {
  scene: null,
  camera: null,
  renderer: null,
  canvas: null,
  modelRoot: null,
  bottleGroup: null,
  capGroup: null,
  atomizerGroup: null,
  dipTubeGroup: null,
  dipTubeConnectorGroup: null,
  cuerpoMesh: null,
  tapaMesh: null,
  cuelloMesh: null,
  pulsadorGroup: null,
  buttonMesh: null,
  ringMesh: null,
  torusMesh: null,
  nozzleOuterMesh: null,
  sprayPinholeMesh: null,
  sprayPoints: null,
  lights: {
    hemisphereLight: null,
    keyLight: null,
    redRimLight: null,
    atomizerAccentLight: null,
  },
  isLoaded: false,
};

// Referencias persistentes para shaders y geometría
let bodyAdvertisingShader = null;
let bodyMultiviewMaterial = null;
let capMultiviewMaterial = null;

let bodyFrontCanvasTexture = null;
let bodyBackCanvasTexture = null;
let bodyRightCanvasTexture = null;
let bodyLeftCanvasTexture = null;
let bodyFrontTexture = null;
let bodyBackTexture = null;

let capFrontCanvasTexture = null;
let capOriginalFrontTexture = null;
let capOriginalBackTexture = null;
let capCleanFrontTexture = null;
let capCleanBackTexture = null;
let capSideClosedTexture = null;
let capSideCleanTexture = null;
let capSideClosedMirroredTexture = null;
let capSideCleanMirroredTexture = null;
let capRightCanvasTexture = null;
let capLeftCanvasTexture = null;

let savedCuerpoMesh = null;
let savedBottleSize = null;
let savedCuerpoBox = null;
let savedLocalBox = null;
let savedLocalSize = null;

let savedTapaMesh = null;
let savedTapaBox = null;
let savedTapaLocalBox = null;
let savedTapaLocalSize = null;
let savedTapaLocalCenter = null;

// Uniformes reactivos para Cuerpo y Tapa
const bodyMultiviewUniforms = {
  uTexFront: { value: null },
  uTexBack: { value: null },
  uTexRight: { value: null },
  uTexLeft: { value: null },
  uLocalBoxMin: { value: new THREE.Vector3() },
  uLocalBoxSize: { value: new THREE.Vector3(1, 1, 1) },
  uBaseBurgundy: { value: new THREE.Color(0x350009) },
};

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
  uBaseRuby: { value: new THREE.Color('#6b0214') },
  uParallax: { value: new THREE.Vector2(0, 0) },
  uCapParallaxShiftFront: { value: 0.0 },
  uCapParallaxShiftBack: { value: 0.0 },
  uCapLateralProgressFront: { value: 0.0 },
  uCapLateralProgressBack: { value: 0.0 },
};

// ==========================================================================
// Textura MatCap de Oro Champán Pulido Tipo Espejo (Optimizado 256x256)
// ==========================================================================
function createAtomizerPieceMatcapTexture(maxAnisotropy = 8) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  const colBase = [206, 176, 120];
  const colDark = [38, 24, 12];
  const colCream = [253, 247, 232];
  const colWarmGold = [228, 196, 138];
  const colShadow = [82, 58, 30];
  const colRim = [112, 78, 36];

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

      let rgb = colBase;
      const shadowFactor = smoothstep(0.05, -0.75, nx);
      rgb = lerpRGB(rgb, colShadow, shadowFactor * 0.55);

      const leftHlDist = Math.abs(nx - (-0.58));
      const leftHl = Math.exp(-(leftHlDist * leftHlDist) / 0.016) * smoothstep(0.04, 0.40, nz);
      rgb = lerpRGB(rgb, colCream, leftHl * 0.72);

      const darkDist = Math.abs(nx - (-0.02));
      const darkStripe = Math.exp(-(darkDist * darkDist) / 0.007) * smoothstep(0.06, 0.45, nz);
      rgb = lerpRGB(rgb, colDark, darkStripe * 0.88);

      const transZone = smoothstep(0.04, 0.16, nx) * (1.0 - smoothstep(0.24, 0.50, nx));
      rgb = lerpRGB(rgb, colWarmGold, transZone * 0.75);

      const rightHlDist = Math.abs(nx - 0.32);
      const rightHl = Math.exp(-(rightHlDist * rightHlDist) / 0.018) * smoothstep(0.05, 0.45, nz);
      rgb = lerpRGB(rgb, colCream, rightHl * 0.94);

      rgb = lerpRGB(rgb, colRim, rimFactor * 0.80);

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

// ==========================================================================
// Calibración de Cotas del Atomizador (Cerrado)
// ==========================================================================
const ATOMIZER_SEALED = {
  ringScaleY: 15.79 / 13.10,
  ringY: 0.037295,
  torusScaleY: 2.41 / 2.00,
  torusScaleXZ: 1.05,
  torusY: 0.046395,
  pulsadorGroupY: 0.04780,
  buttonScaleY: 1.0,
  nozzleY: 0.0068,
};

const ATOMIZER_COMPACT = {
  ringScaleY: 1.0,
  ringY: 0.03595,
  torusScaleY: 1.0,
  torusScaleXZ: 1.0,
  torusY: 0.04350,
  pulsadorGroupY: 0.04450,
  buttonScaleY: 10.12 / 12.20,
  nozzleY: 0.0056,
};

// ==========================================================================
// Materiales Físicos Idénticos a model-test.js
// ==========================================================================
const capMaterial = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color('#6b0214'),
  transmission: 0.0,
  transparent: true,
  opacity: 0.92,
  depthWrite: true,
  attenuationColor: new THREE.Color('#42000b'),
  attenuationDistance: 0.020,
  roughness: 0.10,
  metalness: 0.03,
  thickness: 0.02,
  ior: 1.52,
  specularIntensity: 1.0,
  clearcoat: 1.0,
  clearcoatRoughness: 0.04,
  side: THREE.DoubleSide,
  toneMapped: true,
});

let atomizerPieceMaterial = null;
let dipTubeMaterial = null;
let dipTubeConnectorMaterial = null;

// ==========================================================================
// Shader de Vidrio Rubí Publicitario con Inyección de Serigrafía Frontal
// ==========================================================================
function createBodyAdvertisingShader(horizontalData, verticalData) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uCenterColor: { value: new THREE.Vector3(0.055, 0.001, 0.004) },
      uMidColor: { value: new THREE.Vector3(0.11, 0.002, 0.008) },
      uEdgeColor: { value: new THREE.Vector3(0.22, 0.005, 0.018) },
      uHighlightColor: { value: new THREE.Vector3(0.55, 0.055, 0.09) },
      uFresnelColor: { value: new THREE.Vector3(0.32, 0.012, 0.04) },
      uHighlightStrength: { value: 0.06 },
      uFresnelStrength: { value: 0.08 },
      uHorizontalAxis: { value: horizontalData.axis },
      uVerticalAxis: { value: verticalData.axis },
      uHorizontalMin: { value: horizontalData.min },
      uHorizontalMax: { value: horizontalData.max },
      uVerticalMin: { value: verticalData.min },
      uVerticalMax: { value: verticalData.max },
      uTexFront: { value: null },
      uHasTexFront: { value: 0 },
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
      uniform sampler2D uTexFront;
      uniform int uHasTexFront;

      varying vec3 vLocalPosition;
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;

      float verticalHighlight(float position, float center, float width) {
        float distanceValue = (position - center) / width;
        return exp(-(distanceValue * distanceValue));
      }

      void main() {
        float horizontalPosition = dot(vLocalPosition, uHorizontalAxis);
        float x01 = clamp(
          (horizontalPosition - uHorizontalMin) /
          max(uHorizontalMax - uHorizontalMin, 0.00001),
          0.0,
          1.0
        );

        float edgeDistance = abs(x01 - 0.5) * 2.0;
        float midMix = smoothstep(0.15, 0.72, edgeDistance);
        float edgeMix = smoothstep(0.68, 1.0, edgeDistance);

        vec3 finalColor = mix(uCenterColor, uMidColor, midMix);
        finalColor = mix(finalColor, uEdgeColor, edgeMix);

        float verticalPosition = dot(vLocalPosition, uVerticalAxis);
        float y01 = clamp(
          (verticalPosition - uVerticalMin) /
          max(uVerticalMax - uVerticalMin, 0.00001),
          0.0,
          1.0
        );

        float centerDepth = 1.0 - smoothstep(0.0, 0.72, abs(x01 - 0.5) * 2.0);
        finalColor *= mix(1.0, 0.82, centerDepth);

        float topGlow = smoothstep(0.78, 0.97, y01) * 0.025;
        finalColor += uMidColor * topGlow;

        float leftHighlightCenter = 0.075;
        float leftHighlightWidth = 0.012;
        float rightHighlightCenter = 0.925;
        float rightHighlightWidth = 0.009;

        float verticalMask = smoothstep(0.06, 0.18, y01) * (1.0 - smoothstep(0.82, 0.96, y01));
        float hlLeft = verticalHighlight(x01, leftHighlightCenter, leftHighlightWidth) * verticalMask * uHighlightStrength;
        float hlRight = verticalHighlight(x01, rightHighlightCenter, rightHighlightWidth) * verticalMask * (uHighlightStrength * 0.60);
        finalColor += uHighlightColor * (hlLeft + hlRight);

        vec3 normal = normalize(vViewNormal);
        vec3 viewDirection = normalize(vViewPosition);
        float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.8);
        finalColor += uFresnelColor * fresnel * uFresnelStrength;

        vec3 lightDir = normalize(vec3(0.35, 0.55, 0.75));
        float diffuseFactor = max(dot(normal, lightDir), 0.0);
        finalColor *= mix(0.94, 1.06, diffuseFactor);

        // Inyección de la Serigrafía Frontal de Yanbal (+Z)
        if (uHasTexFront == 1 && normal.z > 0.0) {
          vec2 uvFront = vec2(
            (x01 - 0.5) / 0.985 + 0.5,
            (y01 - 0.5) / 1.015 + 0.485
          );
          if (uvFront.x >= 0.0 && uvFront.x <= 1.0 && uvFront.y >= 0.0 && uvFront.y <= 1.0) {
            vec4 labelTex = texture2D(uTexFront, uvFront);
            float frontWeight = pow(max(0.0, normal.z), 2.6);
            finalColor = mix(finalColor, labelTex.rgb, labelTex.a * frontWeight);
          }
        }

        // Penumbra y absorción en la cara posterior (-Z) para mantener densidad rubí/borgoña sombría
        if (vLocalPosition.z < 0.0) {
          finalColor = mix(finalColor, finalColor * 0.72, smoothstep(0.0, -0.018, vLocalPosition.z));
        }

        finalColor = clamp(finalColor, vec3(0.0), vec3(0.62, 0.12, 0.15));

        gl_FragColor = vec4(finalColor, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    depthTest: true,
    side: THREE.FrontSide,
    toneMapped: true,
  });
}

// ==========================================================================
// Shader Multivista Proyectivo para el Cuerpo (Fotografías Frontal/Lateral/Trasera)
// ==========================================================================
function tryInitBodyMultiviewShader(cMesh, bSize, cBox, lBox, lSize) {
  if (cMesh) savedCuerpoMesh = cMesh;
  if (bSize) savedBottleSize = bSize;
  if (cBox) savedCuerpoBox = cBox;
  if (lBox) savedLocalBox = lBox;
  if (lSize) savedLocalSize = lSize;

  const targetMesh = savedCuerpoMesh;
  if (!targetMesh || !targetMesh.geometry) return;

  if (!targetMesh.geometry.attributes.normal) {
    targetMesh.geometry.computeVertexNormals();
  }

  if (!USE_BODY_MULTIVIEW_SHADER) {
    if (bodyAdvertisingShader && targetMesh.material !== bodyAdvertisingShader) {
      targetMesh.material = bodyAdvertisingShader;
      targetMesh.material.needsUpdate = true;
    }
    return;
  }

  if (
    !bodyFrontCanvasTexture ||
    !bodyBackCanvasTexture ||
    !bodyRightCanvasTexture ||
    !bodyLeftCanvasTexture
  ) {
    return;
  }

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
        transparent: true,
        opacity: 1.0,
        depthWrite: false,
        depthTest: true,
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

vec2 uvFront = vec2(
  (normPos.x - 0.5) / 0.985 + 0.5,
  (normPos.y - 0.5) / 1.015 + 0.485
);
vec4 colFront = sampleMultiviewPhoto(uTexFront, uvFront);

vec2 uvBack = vec2(1.0 - ((normPos.x - 0.5) / 0.985 + 0.5) + 0.012, (normPos.y - 0.5) / 0.992 + 0.5);
vec4 colBack = sampleMultiviewPhoto(uTexBack, uvBack);

vec2 uvRight = vec2(
  1.0 - ((normPos.z - 0.5) / 0.98 + 0.5),
  (normPos.y - 0.5) / 1.03 + 0.480
);
vec4 colRight = sampleMultiviewPhoto(uTexRight, uvRight);

vec2 uvLeft = vec2(
  ((normPos.z - 0.5) / 0.98 + 0.5),
  (normPos.y - 0.5) / 1.03 + 0.480
);
vec4 colLeft = sampleMultiviewPhoto(uTexLeft, uvLeft);

vec3 n = normalize(vMultiviewLocalNormal);
float wFront = max(0.0, n.z);
float wBack  = max(0.0, -n.z);
float wRight = max(0.0, n.x);
float wLeft  = max(0.0, -n.x);

vec4 dirWeights = vec4(wFront, wBack, wRight, wLeft);
vec4 weights = pow(dirWeights, vec4(4.0));
float totalWeight = weights.x + weights.y + weights.z + weights.w;
weights /= max(totalWeight, 0.0001);

vec3 cFront = mix(uBaseBurgundy, colFront.rgb, colFront.a);
vec3 cBack  = mix(uBaseBurgundy, colBack.rgb, colBack.a);
vec3 cRight = mix(uBaseBurgundy, colRight.rgb, colRight.a);
vec3 cLeft  = mix(uBaseBurgundy, colLeft.rgb, colLeft.a);

vec3 blendedPhoto = cFront * weights.x +
                    cBack  * weights.y +
                    cRight * weights.z +
                    cLeft  * weights.w;

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
    targetMesh.renderOrder = 2;
    targetMesh.material.needsUpdate = true;
  } catch (err) {
    console.error('Error al inicializar shader multivista del cuerpo:', err);
    if (bodyAdvertisingShader) {
      targetMesh.material = bodyAdvertisingShader;
    }
  }
}

// ==========================================================================
// Shader Multivista Proyectivo para la Tapa
// ==========================================================================
function tryInitCapMultiviewShader(tMesh, tBox, lBox, lSize) {
  if (tMesh) savedTapaMesh = tMesh;
  if (tBox) savedTapaBox = tBox;
  if (lBox) savedTapaLocalBox = lBox;
  if (lSize) savedTapaLocalSize = lSize;

  const targetMesh = savedTapaMesh;
  if (!targetMesh || !targetMesh.geometry) return;

  if (!targetMesh.geometry.attributes.normal) {
    targetMesh.geometry.computeVertexNormals();
  }

  if (!USE_CAP_MULTIVIEW_SHADER) {
    if (capMaterial && targetMesh.material !== capMaterial) {
      targetMesh.material = capMaterial;
      targetMesh.material.needsUpdate = true;
    }
    return;
  }

  if (!capOriginalFrontTexture && !capCleanFrontTexture) {
    return;
  }

  if (!savedTapaLocalBox || !savedTapaLocalSize) {
    targetMesh.geometry.computeBoundingBox();
    savedTapaLocalBox = targetMesh.geometry.boundingBox;
    savedTapaLocalSize = savedTapaLocalBox.getSize(new THREE.Vector3());
    savedTapaLocalCenter = savedTapaLocalBox.getCenter(new THREE.Vector3());
  } else if (!savedTapaLocalCenter) {
    savedTapaLocalCenter = savedTapaLocalBox.getCenter(new THREE.Vector3());
  }

  const frontOrig = capOriginalFrontTexture || capCleanFrontTexture;
  const frontClean = capCleanFrontTexture || frontOrig;
  const backOrig = capOriginalBackTexture || frontOrig;
  const backClean = capCleanBackTexture || backOrig;
  const sideClosedRight = capSideClosedTexture || capRightCanvasTexture || frontOrig;
  const sideCleanRight = capSideCleanTexture || sideClosedRight;
  const sideClosedLeft = capSideClosedMirroredTexture || capLeftCanvasTexture || frontOrig;
  const sideCleanLeft = capSideCleanMirroredTexture || sideClosedLeft;

  capMultiviewUniforms.uCapOrigFront.value = frontOrig;
  capMultiviewUniforms.uCapOrigBack.value = backOrig;
  capMultiviewUniforms.uCapCleanFront.value = frontClean;
  capMultiviewUniforms.uCapCleanBack.value = backClean;
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
        color: new THREE.Color('#6b0214'),
        transmission: 0.0,
        transparent: true,
        opacity: 0.92,
        depthWrite: true,
        attenuationColor: new THREE.Color('#42000b'),
        attenuationDistance: 0.020,
        roughness: 0.10,
        metalness: 0.03,
        thickness: 0.02,
        ior: 1.52,
        specularIntensity: 1.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
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

// 1. Proyección frontal (+Z): reflejos reales fotográficos del asset de referencia en reposo
vec2 uvFront = vec2(
  (normPos.x - 0.5) / 1.085 + 0.5,
  (normPos.y - 0.5) / 0.94 + 0.46
);
vec4 colOrigF = sampleCapPhoto(uCapOrigFront, uvFront);
vec4 colCleanF = sampleCapPhoto(uCapCleanFront, uvFront);
vec4 colFront = mix(colOrigF, colCleanF, uCapCleanMix);
if (colFront.a < 0.05 && colOrigF.a > 0.05) {
  colFront = colOrigF;
}

// 2. Proyección posterior (-Z)
vec2 uvBack = vec2(
  1.0 - ((normPos.x - 0.5) / 1.085 + 0.5),
  (normPos.y - 0.5) / 0.94 + 0.46
);
vec4 colOrigB = sampleCapPhoto(uCapOrigBack, uvBack);
vec4 colCleanB = sampleCapPhoto(uCapCleanBack, uvBack);
vec4 colBack = mix(colOrigB, colCleanB, uCapCleanMix);
if (colBack.a < 0.05 && colOrigB.a > 0.05) {
  colBack = colOrigB;
}

// 3. Proyección lateral derecha (+X)
vec2 uvRight = vec2(
  1.0 - ((normPos.z - 0.5) / 1.095 + 0.5),
  (normPos.y - 0.5) / 0.98 + 0.5
);
vec4 sideRClosed = sampleCapPhoto(uCapSideClosedRight, uvRight);
vec4 sideRClean = sampleCapPhoto(uCapSideCleanRight, uvRight);
vec4 sideRightColor = mix(sideRClosed, sideRClean, uCapCleanMix);
if (sideRightColor.a < 0.05 && sideRClosed.a > 0.05) {
  sideRightColor = sideRClosed;
}

// 4. Proyección lateral izquierda (-X)
vec2 uvLeft = vec2(
  ((normPos.z - 0.5) / 1.095 + 0.5),
  (normPos.y - 0.5) / 0.98 + 0.5
);
vec4 sideLClosed = sampleCapPhoto(uCapSideClosedLeft, uvLeft);
vec4 sideLClean = sampleCapPhoto(uCapSideCleanLeft, uvLeft);
vec4 sideLeftColor = mix(sideLClosed, sideLClean, uCapCleanMix);
if (sideLeftColor.a < 0.05 && sideLClosed.a > 0.05) {
  sideLeftColor = sideLClosed;
}

// 5. Pesos de normales para transición suave
vec3 n = normalize(vCapLocalNormal);
float wFront = max(0.0, n.z);
float wBack  = max(0.0, -n.z);
float wRight = max(0.0, n.x);
float wLeft  = max(0.0, -n.x);

vec4 dirWeights = vec4(wFront, wBack, wRight, wLeft);
vec4 weights = pow(dirWeights, vec4(4.0));
float totalWeight = weights.x + weights.y + weights.z + weights.w;
weights /= max(totalWeight, 0.0001);

vec3 cFront = mix(uBaseRuby, colFront.rgb, colFront.a);
vec3 cBack  = mix(uBaseRuby, colBack.rgb, colBack.a);
vec3 cRight = mix(uBaseRuby, sideRightColor.rgb, sideRightColor.a);
vec3 cLeft  = mix(uBaseRuby, sideLeftColor.rgb, sideLeftColor.a);

vec3 blendedPhoto = cFront * weights.x +
                    cBack  * weights.y +
                    cRight * weights.z +
                    cLeft  * weights.w;

float horizFactor = smoothstep(0.92, 0.65, abs(n.y));
vec3 finalCapColor = mix(uBaseRuby, blendedPhoto, horizFactor);

diffuseColor.rgb = finalCapColor;
diffuseColor.a = 0.92;`
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
  } catch (err) {
    console.error('Error al inicializar shader multivista de la tapa:', err);
  }
}

// ==========================================================================
// Carga y Recorte Fotográfico de Serigrafía y Referencias (Pipeline model-test)
// ==========================================================================
function setupFrontPhotoProjection(cuerpoMesh, bottleSize, cuerpoCenter, cuerpoBox) {
  if (!cuerpoMesh || !cuerpoMesh.geometry) return;

  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(
    getAssetUrl('assets/models/temptation-mystic-front-reference.png'),
    (loadedTexture) => {
      try {
        if (!loadedTexture.image || !loadedTexture.image.width || !loadedTexture.image.height) return;

        loadedTexture.colorSpace = THREE.SRGBColorSpace;
        loadedTexture.minFilter = THREE.LinearMipmapLinearFilter;
        loadedTexture.magFilter = THREE.LinearFilter;
        loadedTexture.generateMipmaps = true;

        const img = loadedTexture.image;
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = 1024;
        cropCanvas.height = 1344;
        const ctx = cropCanvas.getContext('2d');
        if (!ctx) return;

        // Recorte normalizado que aísla la silueta y serigrafía dorada YANBAL
        const sx = img.width * 0.300;
        const sy = img.height * 0.458;
        const sWidth = img.width * 0.395;
        const sHeight = img.height * 0.485;

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

        bodyFrontCanvasTexture = new THREE.CanvasTexture(cropCanvas);
        bodyFrontCanvasTexture.colorSpace = THREE.SRGBColorSpace;
        bodyFrontCanvasTexture.needsUpdate = true;
        bodyFrontTexture = bodyFrontCanvasTexture;

        if (bodyAdvertisingShader) {
          bodyAdvertisingShader.uniforms.uTexFront.value = bodyFrontTexture;
          bodyAdvertisingShader.uniforms.uHasTexFront.value = 1;
          bodyAdvertisingShader.needsUpdate = true;
        }

        bodyMultiviewUniforms.uTexFront.value = bodyFrontTexture;
        tryInitBodyMultiviewShader();
      } catch (err) {
        console.error('Error al procesar textura frontal:', err);
      }
    }
  );
}

function setupCapFrontPhotoProjection(targetCapGroup, capMesh) {
  if (!capMesh) return;

  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(
    getAssetUrl('assets/models/temptation-mystic-front-reference.png'),
    (loadedTexture) => {
      try {
        if (!loadedTexture.image || !loadedTexture.image.width) return;

        const img = loadedTexture.image;
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = 1024;
        cropCanvas.height = 308;
        const ctx = cropCanvas.getContext('2d');
        if (!ctx) return;

        const sx = img.width * 0.325;
        const sy = img.height * 0.300;
        const sWidth = img.width * 0.350;
        const sHeight = img.height * 0.105;

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

        capFrontCanvasTexture = new THREE.CanvasTexture(cropCanvas);
        capFrontCanvasTexture.colorSpace = THREE.SRGBColorSpace;
        capFrontCanvasTexture.needsUpdate = true;
        capOriginalFrontTexture = capFrontCanvasTexture;

        capMultiviewUniforms.uCapOrigFront.value = capOriginalFrontTexture;
        tryInitCapMultiviewShader();
      } catch (err) {
        console.error('Error al procesar textura frontal de la tapa:', err);
      }
    }
  );
}

function setupCapCleanTextures() {
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(
    getAssetUrl('assets/models/temptation-mystic-cap-clean-reference.png'),
    (loadedTexture) => {
      try {
        if (!loadedTexture.image || !loadedTexture.image.width || !loadedTexture.image.height) return;

        const img = loadedTexture.image;
        const minX = 352;
        const maxX = 672;
        const minY = 463;
        const maxY = 561;

        const cropW = maxX - minX + 1;
        const cropH = maxY - minY + 1;

        const cleanFrontCanvas = document.createElement('canvas');
        cleanFrontCanvas.width = 1024;
        cleanFrontCanvas.height = Math.round(1024 * (cropH / cropW));
        const ctxF = cleanFrontCanvas.getContext('2d');
        if (ctxF) {
          ctxF.drawImage(img, minX, minY, cropW, cropH, 0, 0, cleanFrontCanvas.width, cleanFrontCanvas.height);
          capCleanFrontTexture = new THREE.CanvasTexture(cleanFrontCanvas);
          capCleanFrontTexture.colorSpace = THREE.SRGBColorSpace;
          capCleanFrontTexture.flipY = true;
          capCleanFrontTexture.needsUpdate = true;
          capMultiviewUniforms.uCapCleanFront.value = capCleanFrontTexture;
        }

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
          capCleanBackTexture.flipY = true;
          capCleanBackTexture.needsUpdate = true;
          capMultiviewUniforms.uCapCleanBack.value = capCleanBackTexture;
        }

        tryInitCapMultiviewShader();
      } catch (err) {
        console.error('Error procesando referencia limpia de la tapa:', err);
      }
    }
  );
}

function setupBackPhotoProjections() {
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(
    getAssetUrl('assets/models/temptation-mystic-back-reference.png'),
    (loadedTexture) => {
      try {
        if (!loadedTexture.image) return;
        const img = loadedTexture.image;

        // Cuerpo trasero (recorte con máscara suave idéntico a model-test.js)
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = 1024;
        cropCanvas.height = 1320;
        const ctxBody = cropCanvas.getContext('2d');
        if (ctxBody) {
          const sx = img.width * 0.300;
          const sy = img.height * 0.465;
          const sWidth = img.width * 0.380;
          const sHeight = img.height * 0.490;

          const cornerRadius = 36;
          ctxBody.save();
          ctxBody.beginPath();
          ctxBody.moveTo(cornerRadius, 0);
          ctxBody.lineTo(cropCanvas.width - cornerRadius, 0);
          ctxBody.quadraticCurveTo(cropCanvas.width, 0, cropCanvas.width, cornerRadius);
          ctxBody.lineTo(cropCanvas.width, cropCanvas.height - cornerRadius);
          ctxBody.quadraticCurveTo(cropCanvas.width, cropCanvas.height, cropCanvas.width - cornerRadius, cropCanvas.height);
          ctxBody.lineTo(cornerRadius, cropCanvas.height);
          ctxBody.quadraticCurveTo(0, cropCanvas.height, 0, cropCanvas.height - cornerRadius);
          ctxBody.lineTo(0, cornerRadius);
          ctxBody.quadraticCurveTo(0, 0, cornerRadius, 0);
          ctxBody.closePath();
          ctxBody.clip();

          ctxBody.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, cropCanvas.width, cropCanvas.height);
          ctxBody.restore();

          bodyBackCanvasTexture = new THREE.CanvasTexture(cropCanvas);
          bodyBackCanvasTexture.colorSpace = THREE.SRGBColorSpace;
          bodyBackCanvasTexture.needsUpdate = true;
          bodyBackTexture = bodyBackCanvasTexture;
          bodyMultiviewUniforms.uTexBack.value = bodyBackTexture;
          tryInitBodyMultiviewShader();
        }

        // Tapa trasera (proyección idéntica a model-test.js con máscara suave de bordes)
        const capCanvas = document.createElement('canvas');
        capCanvas.width = 1024;
        capCanvas.height = 336;
        const ctxCap = capCanvas.getContext('2d');
        if (ctxCap) {
          const sx = img.width * 0.325;
          const sy = img.height * 0.295;
          const sWidth = img.width * 0.350;
          const sHeight = img.height * 0.115;

          const cornerRadius = 14;
          ctxCap.save();
          ctxCap.beginPath();
          ctxCap.moveTo(cornerRadius, 0);
          ctxCap.lineTo(capCanvas.width - cornerRadius, 0);
          ctxCap.quadraticCurveTo(capCanvas.width, 0, capCanvas.width, cornerRadius);
          ctxCap.lineTo(capCanvas.width, capCanvas.height - cornerRadius);
          ctxCap.quadraticCurveTo(capCanvas.width, capCanvas.height, capCanvas.width - cornerRadius, capCanvas.height);
          ctxCap.lineTo(cornerRadius, capCanvas.height);
          ctxCap.quadraticCurveTo(0, capCanvas.height, 0, capCanvas.height - cornerRadius);
          ctxCap.lineTo(0, cornerRadius);
          ctxCap.quadraticCurveTo(0, 0, cornerRadius, 0);
          ctxCap.closePath();
          ctxCap.clip();

          ctxCap.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, capCanvas.width, capCanvas.height);
          ctxCap.restore();

          capBackCanvasTexture = new THREE.CanvasTexture(capCanvas);
          capBackCanvasTexture.colorSpace = THREE.SRGBColorSpace;
          capBackCanvasTexture.flipY = true;
          capBackCanvasTexture.needsUpdate = true;
          capOriginalBackTexture = capBackCanvasTexture;
          capMultiviewUniforms.uCapOrigBack.value = capOriginalBackTexture;
          tryInitCapMultiviewShader();
        }
      } catch (e) {}
    }
  );
}

function setupSidePhotoProjections() {
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(
    getAssetUrl('assets/models/temptation-mystic-side-reference.png'),
    (loadedTexture) => {
      try {
        if (!loadedTexture.image) return;
        const img = loadedTexture.image;

        const sx = img.width * 0.414;
        const sy = img.height * 0.463;
        const sWidth = img.width * 0.170;
        const sHeight = img.height * 0.490;

        const canvasW = 512;
        const canvasH = Math.round(canvasW * (sHeight / sWidth));

        // Lateral derecho
        const bodyRightCanvas = document.createElement('canvas');
        bodyRightCanvas.width = canvasW;
        bodyRightCanvas.height = canvasH;
        const ctxR = bodyRightCanvas.getContext('2d');
        if (ctxR) {
          ctxR.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, canvasW, canvasH);
          bodyRightCanvasTexture = new THREE.CanvasTexture(bodyRightCanvas);
          bodyRightCanvasTexture.colorSpace = THREE.SRGBColorSpace;
          bodyRightCanvasTexture.needsUpdate = true;
          bodyMultiviewUniforms.uTexRight.value = bodyRightCanvasTexture;
        }

        // Lateral izquierdo reflejado
        const bodyLeftCanvas = document.createElement('canvas');
        bodyLeftCanvas.width = canvasW;
        bodyLeftCanvas.height = canvasH;
        const ctxL = bodyLeftCanvas.getContext('2d');
        if (ctxL) {
          ctxL.save();
          ctxL.scale(-1, 1);
          ctxL.drawImage(img, sx, sy, sWidth, sHeight, -canvasW, 0, canvasW, canvasH);
          ctxL.restore();
          bodyLeftCanvasTexture = new THREE.CanvasTexture(bodyLeftCanvas);
          bodyLeftCanvasTexture.colorSpace = THREE.SRGBColorSpace;
          bodyLeftCanvasTexture.needsUpdate = true;
          bodyMultiviewUniforms.uTexLeft.value = bodyLeftCanvasTexture;
        }

        tryInitBodyMultiviewShader();
      } catch (e) {}
    }
  );
}

function setupCapSideTextures() {
  const textureLoader = new THREE.TextureLoader();
  let closedImg = null;
  let cleanImg = null;

  function processCapSideTextures() {
    if (!closedImg || !cleanImg) return;

    try {
      const minX = 510;
      const maxX = 744;
      const minY = 556;
      const maxY = 697;

      const cropW = maxX - minX + 1;
      const cropH = maxY - minY + 1;

      const canvasW = 512;
      const canvasH = Math.round(canvasW * (cropH / cropW));

      // 1. Lateral derecho cerrada
      const canvasClosed = document.createElement('canvas');
      canvasClosed.width = canvasW;
      canvasClosed.height = canvasH;
      const ctxClosed = canvasClosed.getContext('2d');
      ctxClosed.drawImage(closedImg, minX, minY, cropW, cropH, 0, 0, canvasW, canvasH);

      capSideClosedTexture = new THREE.CanvasTexture(canvasClosed);
      capSideClosedTexture.colorSpace = THREE.SRGBColorSpace;
      capSideClosedTexture.flipY = true;
      capSideClosedTexture.needsUpdate = true;
      capMultiviewUniforms.uCapSideClosedRight.value = capSideClosedTexture;

      // 2. Lateral derecho limpia
      const canvasClean = document.createElement('canvas');
      canvasClean.width = canvasW;
      canvasClean.height = canvasH;
      const ctxClean = canvasClean.getContext('2d');
      ctxClean.drawImage(cleanImg, minX, minY, cropW, cropH, 0, 0, canvasW, canvasH);

      capSideCleanTexture = new THREE.CanvasTexture(canvasClean);
      capSideCleanTexture.colorSpace = THREE.SRGBColorSpace;
      capSideCleanTexture.flipY = true;
      capSideCleanTexture.needsUpdate = true;
      capMultiviewUniforms.uCapSideCleanRight.value = capSideCleanTexture;

      // 3. Lateral izquierdo cerrada (reflejada)
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
      capSideClosedMirroredTexture.flipY = true;
      capSideClosedMirroredTexture.needsUpdate = true;
      capMultiviewUniforms.uCapSideClosedLeft.value = capSideClosedMirroredTexture;

      // 4. Lateral izquierdo limpia (reflejada)
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
      capSideCleanMirroredTexture.flipY = true;
      capSideCleanMirroredTexture.needsUpdate = true;
      capMultiviewUniforms.uCapSideCleanLeft.value = capSideCleanMirroredTexture;

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
    getAssetUrl('assets/models/temptation-mystic-cap-side-closed.png'),
    (tex) => {
      closedImg = tex.image;
      processCapSideTextures();
    }
  );

  textureLoader.load(
    getAssetUrl('assets/models/temptation-mystic-cap-side-clean.png'),
    (tex) => {
      cleanImg = tex.image;
      processCapSideTextures();
    }
  );
}

// ==========================================================================
// Constructores del Atomizador Procedural y Manguera (model-test.js exacto)
// ==========================================================================
function buildDipTube() {
  const group = new THREE.Group();
  group.name = 'dipTubeGroup';
  group.renderOrder = 1;

  dipTubeMaterial = new THREE.MeshBasicMaterial({
    color: 0x4e4944,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    depthTest: true,
    side: THREE.FrontSide,
    toneMapped: true,
  });

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
  tubeMesh.renderOrder = 1;
  group.add(tubeMesh);

  const endCapGeo = new THREE.SphereGeometry(0.00055, 12, 12);
  const endCapMesh = new THREE.Mesh(endCapGeo, dipTubeMaterial);
  endCapMesh.position.copy(points[points.length - 1]);
  endCapMesh.renderOrder = 1;
  group.add(endCapMesh);

  return group;
}

function buildDipTubeConnector() {
  const group = new THREE.Group();
  group.name = 'dipTubeConnectorGroup';
  group.renderOrder = 1;

  dipTubeConnectorMaterial = new THREE.MeshBasicMaterial({
    color: 0x625e58,
    transparent: true,
    opacity: 0.38,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: true,
  });

  const profilePoints = [
    new THREE.Vector2(0.00075, 0.02375),
    new THREE.Vector2(0.00140, 0.02595),
    new THREE.Vector2(0.00190, 0.02595),
    new THREE.Vector2(0.00190, 0.02775),
    new THREE.Vector2(0.00260, 0.02775),
    new THREE.Vector2(0.00260, 0.02935),
    new THREE.Vector2(0.00000, 0.02935),
  ];

  const connectorGeo = new THREE.LatheGeometry(profilePoints, 32);
  connectorGeo.computeVertexNormals();

  const connectorMesh = new THREE.Mesh(connectorGeo, dipTubeConnectorMaterial);
  connectorMesh.name = 'connectorLevel1';
  connectorMesh.position.set(0, 0, 0.0034);
  connectorMesh.renderOrder = 1;
  group.add(connectorMesh);

  return group;
}

function buildProceduralAtomizer(goldMaterial) {
  const group = new THREE.Group();
  group.name = 'atomizerGroup';
  group.renderOrder = 0;

  const ringRadius = 0.0116;
  const ringHeight = 0.0131;
  const ringHalfH = ringHeight / 2;

  const ringPoints = [
    new THREE.Vector2(0.0070, -ringHalfH),
    new THREE.Vector2(0.0111, -ringHalfH),
    new THREE.Vector2(0.0115, -ringHalfH + 0.00020),
    new THREE.Vector2(ringRadius, -ringHalfH + 0.00055),
    new THREE.Vector2(ringRadius, ringHalfH - 0.00055),
    new THREE.Vector2(0.0115, ringHalfH - 0.00020),
    new THREE.Vector2(0.0111, ringHalfH),
    new THREE.Vector2(0.0091, ringHalfH),
    new THREE.Vector2(0.0089, ringHalfH - 0.00030),
    new THREE.Vector2(0.0089, -0.00300),
    new THREE.Vector2(0.0070, -0.00350),
    new THREE.Vector2(0.0070, -ringHalfH),
  ];

  const ringGeo = new THREE.LatheGeometry(ringPoints, 64);
  ringGeo.computeVertexNormals();
  const ringMesh = new THREE.Mesh(ringGeo, goldMaterial);
  ringMesh.name = 'atomizerRing';
  ringMesh.position.set(0, ATOMIZER_SEALED.ringY, 0);
  ringMesh.scale.set(1, ATOMIZER_SEALED.ringScaleY, 1);
  ringMesh.renderOrder = 0;
  group.add(ringMesh);
  sceneObjects.ringMesh = ringMesh;

  const torusRadius = 0.0098;
  const torusTube = 0.0010;
  const torusGeo = new THREE.TorusGeometry(torusRadius, torusTube, 20, 64);
  torusGeo.rotateX(Math.PI / 2);
  torusGeo.computeVertexNormals();
  const torusMesh = new THREE.Mesh(torusGeo, goldMaterial);
  torusMesh.name = 'atomizerBevelRing';
  torusMesh.position.set(0, ATOMIZER_SEALED.torusY, 0);
  torusMesh.scale.set(ATOMIZER_SEALED.torusScaleXZ, ATOMIZER_SEALED.torusScaleY, ATOMIZER_SEALED.torusScaleXZ);
  torusMesh.renderOrder = 0;
  group.add(torusMesh);
  sceneObjects.torusMesh = torusMesh;

  const pulsadorGroup = new THREE.Group();
  pulsadorGroup.name = 'pulsadorGroup';
  pulsadorGroup.position.set(0, ATOMIZER_SEALED.pulsadorGroupY, 0);
  pulsadorGroup.renderOrder = 0;
  sceneObjects.pulsadorGroup = pulsadorGroup;

  const buttonRadius = 0.0083;
  const buttonPoints = [
    new THREE.Vector2(0.0001, -0.0035),
    new THREE.Vector2(buttonRadius, -0.0035),
    new THREE.Vector2(buttonRadius, 0.0116),
    new THREE.Vector2(0.0081, 0.0119),
    new THREE.Vector2(0.0078, 0.0121),
    new THREE.Vector2(0.0074, 0.0122),
    new THREE.Vector2(0.0001, 0.0122),
  ];

  const buttonGeo = new THREE.LatheGeometry(buttonPoints, 64);
  buttonGeo.computeVertexNormals();
  const buttonMesh = new THREE.Mesh(buttonGeo, goldMaterial);
  buttonMesh.name = 'atomizerButton';
  buttonMesh.scale.set(1, ATOMIZER_SEALED.buttonScaleY, 1);
  buttonMesh.renderOrder = 0;
  pulsadorGroup.add(buttonMesh);
  sceneObjects.buttonMesh = buttonMesh;

  const nozzleOuterGeo = new THREE.CylinderGeometry(0.0011, 0.0011, 0.0006, 32);
  nozzleOuterGeo.rotateX(Math.PI / 2);
  nozzleOuterGeo.computeVertexNormals();
  const nozzleOuterMesh = new THREE.Mesh(nozzleOuterGeo, goldMaterial);
  nozzleOuterMesh.name = 'sprayNozzleOuter';
  nozzleOuterMesh.position.set(0, ATOMIZER_SEALED.nozzleY, buttonRadius + 0.00015);
  nozzleOuterMesh.renderOrder = 0;
  pulsadorGroup.add(nozzleOuterMesh);
  sceneObjects.nozzleOuterMesh = nozzleOuterMesh;

  // Orificio oscuro central de la boquilla (punto de emisión del spray)
  const pinholeGeo = new THREE.CircleGeometry(0.00045, 32);
  const pinholeMat = new THREE.MeshBasicMaterial({
    color: 0x181008,
    side: THREE.FrontSide,
    depthTest: true,
    depthWrite: true,
  });
  const sprayPinholeMesh = new THREE.Mesh(pinholeGeo, pinholeMat);
  sprayPinholeMesh.name = 'sprayPinhole';
  sprayPinholeMesh.position.set(0, ATOMIZER_SEALED.nozzleY, buttonRadius + 0.00025);
  sprayPinholeMesh.renderOrder = 0;
  pulsadorGroup.add(sprayPinholeMesh);
  sceneObjects.sprayPinholeMesh = sprayPinholeMesh;

  group.add(pulsadorGroup);
  return group;
}

// ==========================================================================
// Sistema de Partículas de Perfume (Spray Cinemático de Lujo)
// ==========================================================================
const PARTICLE_COUNT = 550;
const SPRAY_TRAVEL_DISTANCE = 0.28;
let sprayPoints = null;
let sprayGeometry = null;
let sprayMaterial = null;
let particleData = [];

const sprayOrigin = new THREE.Vector3();
const sprayForward = new THREE.Vector3();
const sprayRight = new THREE.Vector3();
const sprayUp = new THREE.Vector3();

const sprayState = {
  progress: 0,
  active: false,
};

// Estado del spray paramétrico de scroll (bidireccional)
const scrollSpray = {
  active: false,           // true cuando el progress está en la ventana 0.35-0.50
  originCaptured: false,   // ¿se capturó el origen del atomizador para esta ventana?
  origin: new THREE.Vector3(),
  forward: new THREE.Vector3(),
  right: new THREE.Vector3(),
  up: new THREE.Vector3(),
};

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

function initSprayParticleSystem(targetScene) {
  if (sprayPoints) return;
  const currentScene = targetScene || sceneObjects.scene;
  if (!currentScene) return;

  sprayGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const scales = new Float32Array(PARTICLE_COUNT);

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

    scales[i] = THREE.MathUtils.lerp(0.4, 2.2, Math.pow(Math.random(), 1.4));

    const angle = Math.random() * Math.PI * 2;
    const rType = Math.random();
    let coneSpread;
    if (rType < 0.4) {
      coneSpread = THREE.MathUtils.lerp(0.12, 0.24, Math.random());
    } else if (rType < 0.8) {
      coneSpread = THREE.MathUtils.lerp(0.24, 0.44, Math.random());
    } else {
      coneSpread = THREE.MathUtils.lerp(0.44, 0.64, Math.random());
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
  currentScene.add(sprayPoints);
  sceneObjects.sprayPoints = sprayPoints;
}

function prepareSprayTrajectory() {
  if (!sprayGeometry || !sceneObjects.pulsadorGroup) return;

  if (sceneObjects.sprayPinholeMesh) {
    sceneObjects.sprayPinholeMesh.getWorldPosition(sprayOrigin);
  } else {
    sceneObjects.pulsadorGroup.getWorldPosition(sprayOrigin);
    sprayOrigin.y += ATOMIZER_SEALED.nozzleY;
    sprayOrigin.z += 0.0085;
  }

  const localForward = new THREE.Vector3(0, 0, 1);
  const worldQuaternion = new THREE.Quaternion();
  sceneObjects.pulsadorGroup.getWorldQuaternion(worldQuaternion);

  const worldDirection = localForward
    .clone()
    .applyQuaternion(worldQuaternion)
    .normalize();

  sprayForward.copy(worldDirection);

  const tempUp = Math.abs(sprayForward.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  sprayRight.crossVectors(tempUp, sprayForward).normalize();
  sprayUp.crossVectors(sprayForward, sprayRight).normalize();

  const positions = sprayGeometry.attributes.position.array;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    positions[i * 3 + 0] = sprayOrigin.x;
    positions[i * 3 + 1] = sprayOrigin.y;
    positions[i * 3 + 2] = sprayOrigin.z;
  }
  sprayGeometry.attributes.position.needsUpdate = true;
}

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
    const easeAdvance = 1.0 - Math.pow(1.0 - t, 1.8);
    const forwardDist = SPRAY_TRAVEL_DISTANCE * p.distFactor * easeAdvance;

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
// Spray Paramétrico de Scroll (Bidireccional / Rebobinable)
// Ventana activa: progress global 0.35 → 0.50
// scrollSprayProgress = 0.0 → 1.0 dentro de esa ventana
// Al retroceder el scroll, las partículas se contraen de vuelta al origen.
// ==========================================================================
function captureScrollSprayOrigin() {
  if (!sprayGeometry || !sceneObjects.pulsadorGroup) return;

  if (sceneObjects.sprayPinholeMesh) {
    sceneObjects.sprayPinholeMesh.getWorldPosition(scrollSpray.origin);
  } else {
    sceneObjects.pulsadorGroup.getWorldPosition(scrollSpray.origin);
    scrollSpray.origin.y += ATOMIZER_SEALED.nozzleY;
    scrollSpray.origin.z += 0.0085;
  }

  const localForward = new THREE.Vector3(0, 0, 1);
  const worldQuaternion = new THREE.Quaternion();
  sceneObjects.pulsadorGroup.getWorldQuaternion(worldQuaternion);

  scrollSpray.forward.copy(localForward.clone().applyQuaternion(worldQuaternion).normalize());

  const tempUp = Math.abs(scrollSpray.forward.y) > 0.95
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 1, 0);
  scrollSpray.right.crossVectors(tempUp, scrollSpray.forward).normalize();
  scrollSpray.up.crossVectors(scrollSpray.forward, scrollSpray.right).normalize();

  // Inicializar todas las posiciones al origen para evitar artefactos visuales
  const positions = sprayGeometry.attributes.position.array;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    positions[i * 3 + 0] = scrollSpray.origin.x;
    positions[i * 3 + 1] = scrollSpray.origin.y;
    positions[i * 3 + 2] = scrollSpray.origin.z;
  }
  sprayGeometry.attributes.position.needsUpdate = true;

  scrollSpray.originCaptured = true;
}

function updateParticlesParametric(scrollSprayProgress) {
  // scrollSprayProgress: flotante 0.0 (comienzo del spray) a 1.0 (máxima expansión)
  if (!sprayPoints || !sprayGeometry || !scrollSpray.originCaptured) return;

  const positions = sprayGeometry.attributes.position.array;
  const o = scrollSpray.origin;
  const fwd = scrollSpray.forward;
  const rgt = scrollSpray.right;
  const up  = scrollSpray.up;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const pd = particleData[i];

    // Cada partícula tiene un stagger normalizado [0.0, 0.28];
    // Sólo avanza cuando su stagger haya sido superado por scrollSprayProgress
    const localT = Math.max(0.0, (scrollSprayProgress - pd.stagger) / (1.0 - pd.stagger));
    const ease = 1.0 - Math.pow(1.0 - Math.min(1.0, localT), 1.8);
    const forwardDist = SPRAY_TRAVEL_DISTANCE * pd.distFactor * ease;

    const coneRadius = forwardDist * pd.spread;
    const radialX = Math.cos(pd.angle) * coneRadius + pd.jitterX * ease;
    const radialY = Math.sin(pd.angle) * coneRadius + pd.jitterY * ease + pd.driftY * ease;

    positions[i * 3 + 0] = o.x + fwd.x * forwardDist + rgt.x * radialX + up.x * radialY;
    positions[i * 3 + 1] = o.y + fwd.y * forwardDist + rgt.y * radialX + up.y * radialY;
    positions[i * 3 + 2] = o.z + fwd.z * forwardDist + rgt.z * radialX + up.z * radialY;
  }

  sprayGeometry.attributes.position.needsUpdate = true;
}

let isSprayingSequence = false;

export function triggerSpraySequence(coords = null) {
  if (!sceneObjects.camera || !sceneObjects.bottleGroup) return;

  // Si se pasaron coordenadas de pantalla, verificar intersección con Raycaster
  if (coords) {
    raycaster.setFromCamera(coords, sceneObjects.camera);
    const intersects = raycaster.intersectObject(sceneObjects.bottleGroup, true);
    if (!intersects || intersects.length === 0) {
      return; // Clic o toque fuera del frasco
    }
  }

  // Evitar disparos solapados si ya se está ejecutando la secuencia
  if (isSprayingSequence) return;
  isSprayingSequence = true;

  if (!sprayPoints || !sprayGeometry || !sceneObjects.pulsadorGroup) {
    isSprayingSequence = false;
    return;
  }

  // Matar tweens activos previos
  if (sceneObjects.capGroup) {
    gsap.killTweensOf(sceneObjects.capGroup.position);
    gsap.killTweensOf(sceneObjects.capGroup.rotation);
  }
  gsap.killTweensOf(sceneObjects.pulsadorGroup.position);
  gsap.killTweensOf(sprayState);
  if (sprayMaterial) gsap.killTweensOf(sprayMaterial);

  const basePulsadorY = sceneObjects.pulsadorGroup.position.y;

  const tl = gsap.timeline({
    onComplete: () => {
      isSprayingSequence = false;
      sprayState.active = false;
      if (sprayPoints) sprayPoints.visible = false;
      if (sceneObjects.capGroup) {
        sceneObjects.capGroup.position.set(0, 0, 0);
        sceneObjects.capGroup.rotation.set(0, 0, 0);
      }
      if (sceneObjects.pulsadorGroup) {
        sceneObjects.pulsadorGroup.position.y = ATOMIZER_SEALED.pulsadorGroupY;
      }
    }
  });

  // 1. Apertura elegante de la tapa (se eleva y rota)
  if (sceneObjects.capGroup) {
    tl.to(sceneObjects.capGroup.position, {
      y: 0.052,
      x: 0.0012,
      duration: 0.38,
      ease: 'power2.out',
    }, 0)
    .to(sceneObjects.capGroup.rotation, {
      y: 0.16,
      z: 0.038,
      duration: 0.38,
      ease: 'power2.out',
    }, 0);
  }

  // 2. Preparar trayectoria del spray en la orientación 3D actual del frasco
  tl.add(() => {
    prepareSprayTrajectory();
    sprayPoints.visible = true;
    sprayState.active = true;
    sprayState.progress = 0;
    if (sprayMaterial) sprayMaterial.opacity = 0;
  }, 0.35)

  // 3. Presión táctil del pulsador metálico
  .to(sceneObjects.pulsadorGroup.position, {
    y: basePulsadorY - 0.0028,
    duration: 0.12,
    yoyo: true,
    repeat: 1,
    ease: 'power2.out',
  }, 0.38)

  // 4. Emisión y dispersión cinemática del spray
  .to(sprayState, {
    progress: 1.0,
    duration: 1.45,
    ease: 'power1.out',
  }, 0.40)
  .to(sprayMaterial, {
    opacity: 0.95,
    duration: 0.20,
    ease: 'power2.out',
  }, 0.40)
  .to(sprayMaterial, {
    opacity: 0.0,
    duration: 0.60,
    ease: 'power2.in',
  }, 1.25);

  // 5. Cierre y re-encaje suave de la tapa al terminar la pulverización
  if (sceneObjects.capGroup) {
    tl.to(sceneObjects.capGroup.position, {
      y: 0.0,
      x: 0.0,
      duration: 0.42,
      ease: 'power2.inOut',
    }, 1.38)
    .to(sceneObjects.capGroup.rotation, {
      y: 0.0,
      z: 0.0,
      duration: 0.42,
      ease: 'power2.inOut',
    }, 1.38);
  }
}

// Alias de retrocompatibilidad
export const triggerSpray = triggerSpraySequence;

// ==========================================================================
// Control de Cámara, Encuadre sin Recortes y Coreografía de 3 Actos
// ==========================================================================
let lastScrollProgress = 0;
let scrollBaseRotY = 0;
let scrollBaseRotX = -0.015;
let scrollBaseRotZ = 0;
let scrollBasePosX = 0;
let scrollBasePosY = 0;
let hasTriggeredScrollSpray = false;

const cameraTargetLookAt = new THREE.Vector3(0, 0.006, 0);
const currentLookAt = new THREE.Vector3(0, 0.006, 0);

function clamp(val, min = 0, max = 1) {
  return Math.min(Math.max(val, min), max);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Cálculo dinámico de encuadre idéntico a model-test.html (Cero recortes)
export function calculateCameraFraming(aspect) {
  const isMobile = aspect < 1.0;
  const lookAtY = 0.006;
  const camY = 0.008;
  let camZ = 0.305;

  if (isMobile) {
    camZ = Math.max(0.35, 0.175 / (Math.max(aspect, 0.38) * 0.76));
  }

  return { camY, camZ, lookAtY };
}

// ==========================================================================
// Scroll-Telling UI: Referencias DOM y helper de sincronización de opacidad
// ==========================================================================
const stDOMRefs = {
  intro: null,
  ritual: null,
  deep: null,
  nota1: null,
  nota2: null,
  nota3: null,
  bgIntro: null,
  bgFinal: null,
};

/**
 * Asigna la opacidad directamente (sin CSS transition extra cuando se mueve a 60 fps).
 * La propiedad transition: 0.18s en CSS actuará como suavizado de seguridad
 * en dispositivos lentos donde los frames JS son escasos.
 */
function setTextOpacity(key, opacity) {
  // Resolución perezosa — el DOM puede no existir en el primer frame del init
  if (!stDOMRefs[key]) {
    const idMap = { intro: 'text-intro', ritual: 'text-spray-ritual', deep: 'text-deep-mystic' };
    stDOMRefs[key] = document.getElementById(idMap[key]);
  }
  const el = stDOMRefs[key];
  if (!el) return;
  el.style.opacity = opacity;
}

/**
 * Transiciones asimétricas editoriales por scroll estilo Vela Armon:
 * - Acto 1: Aparece deslizando suavemente desde la izquierda (translateX(-40px) -> 0).
 * - Acto 2: Las tres notas olfativas aparecen de forma escalonada (nota-1 desde arriba, nota-2 desde la derecha, nota-3 desde abajo).
 * - Acto 3: Aparece levitando suavemente desde abajo (translateY(30px) -> 0).
 */
function updateEditorialStoryCards(p) {
  if (!stDOMRefs.intro) stDOMRefs.intro = document.getElementById('text-intro');
  if (!stDOMRefs.ritual) stDOMRefs.ritual = document.getElementById('text-spray-ritual');
  if (!stDOMRefs.deep) stDOMRefs.deep = document.getElementById('text-deep-mystic');
  if (!stDOMRefs.nota1) stDOMRefs.nota1 = document.querySelector('.nota-olfativa.nota-1');
  if (!stDOMRefs.nota2) stDOMRefs.nota2 = document.querySelector('.nota-olfativa.nota-2');
  if (!stDOMRefs.nota3) stDOMRefs.nota3 = document.querySelector('.nota-olfativa.nota-3');

  // Acto 1: Identidad visible desde el inicio (p = 0.0 -> 0.14) y desvanecimiento suave al salir (p = 0.14 -> 0.22)
  if (stDOMRefs.intro) {
    let introOpacity = 0;
    let introX = 0;
    if (p < 0.25) {
      if (p <= 0.14) {
        introOpacity = 1.0;
        introX = 0;
      } else if (p <= 0.22) {
        const tExit = clamp((p - 0.14) / 0.08, 0, 1);
        introOpacity = 1.0 - tExit;
        introX = -20 * tExit;
      }
    }
    stDOMRefs.intro.style.opacity = introOpacity.toFixed(3);
    stDOMRefs.intro.style.transform = `translate3d(${introX.toFixed(1)}px, -50%, 0)`;
    stDOMRefs.intro.style.pointerEvents = introOpacity > 0.01 ? 'auto' : 'none';
  }

  // Acto 2: Tres notas olfativas con entrada previa secuencial y convergencia magnética hacia el núcleo del frasco
  const isAct2 = p >= 0.21 && p < 0.58;
  if (stDOMRefs.ritual) {
    stDOMRefs.ritual.style.opacity = isAct2 ? '1' : '0';
    stDOMRefs.ritual.style.pointerEvents = isAct2 ? 'auto' : 'none';
  }

  if (stDOMRefs.nota1 || stDOMRefs.nota2 || stDOMRefs.nota3) {
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

    if (p < 0.22 || p >= 0.57) {
      if (stDOMRefs.nota1) {
        stDOMRefs.nota1.style.opacity = '0';
        stDOMRefs.nota1.classList.remove('visible');
      }
      if (stDOMRefs.nota2) {
        stDOMRefs.nota2.style.opacity = '0';
        stDOMRefs.nota2.classList.remove('visible');
      }
      if (stDOMRefs.nota3) {
        stDOMRefs.nota3.style.opacity = '0';
        stDOMRefs.nota3.classList.remove('visible');
      }
    } else if (p >= 0.48) {
      // Fase de Convergencia (Cierre del ciclo: p = 0.48 -> 0.56):
      // Justo cuando la animación del spray culmina y la tapa desciende para cerrarse,
      // interpolación magnética donde los tres elementos se desplazan y funden directamente hacia
      // el núcleo del frasco ruby, con desvanecimiento simultáneo (opacity -> 0, scale -> 0.3).
      const t = clamp((p - 0.48) / 0.08, 0, 1);
      const tEase = t * t * (3.0 - 2.0 * t);
      const absorbOpacity = Math.max(1.0 - tEase, 0.0);
      const scale = (1.0 - (tEase * 0.7)).toFixed(3); // Escala 1.0 -> 0.3
      const moveVw = isMobile ? 18 : 28;
      const moveVh = isMobile ? 12 : 20;

      if (stDOMRefs.nota1) {
        stDOMRefs.nota1.style.opacity = absorbOpacity.toFixed(3);
        stDOMRefs.nota1.style.transform = `translate(${(tEase * moveVw).toFixed(2)}vw, ${(tEase * moveVh).toFixed(2)}vh) scale(${scale}) rotate(${(-3 * (1 - tEase)).toFixed(1)}deg)`;
        if (absorbOpacity > 0.05) stDOMRefs.nota1.classList.add('visible');
        else stDOMRefs.nota1.classList.remove('visible');
      }
      if (stDOMRefs.nota2) {
        stDOMRefs.nota2.style.opacity = absorbOpacity.toFixed(3);
        stDOMRefs.nota2.style.transform = `translate(${(-tEase * moveVw).toFixed(2)}vw, 0) scale(${scale})`;
        if (absorbOpacity > 0.05) stDOMRefs.nota2.classList.add('visible');
        else stDOMRefs.nota2.classList.remove('visible');
      }
      if (stDOMRefs.nota3) {
        stDOMRefs.nota3.style.opacity = absorbOpacity.toFixed(3);
        stDOMRefs.nota3.style.transform = `translate(${(tEase * moveVw).toFixed(2)}vw, ${(-tEase * moveVh).toFixed(2)}vh) scale(${scale}) rotate(${(2 * (1 - tEase)).toFixed(1)}deg)`;
        if (absorbOpacity > 0.05) stDOMRefs.nota3.classList.add('visible');
        else stDOMRefs.nota3.classList.remove('visible');
      }
    } else if (p >= 0.34) {
      // Fase de Rocío y Permanencia: p = 0.34 -> 0.48
      // Plena visibilidad y protagonismo alrededor del frasco mientras el spray rocía
      if (stDOMRefs.nota1) {
        stDOMRefs.nota1.style.opacity = '1';
        stDOMRefs.nota1.style.transform = 'translate3d(0, 0, 0) rotate(-3deg) scale(1)';
        stDOMRefs.nota1.classList.add('visible');
      }
      if (stDOMRefs.nota2) {
        stDOMRefs.nota2.style.opacity = '1';
        stDOMRefs.nota2.style.transform = 'translate3d(0, 0, 0) scale(1)';
        stDOMRefs.nota2.classList.add('visible');
      }
      if (stDOMRefs.nota3) {
        stDOMRefs.nota3.style.opacity = '1';
        stDOMRefs.nota3.style.transform = 'translate3d(0, 0, 0) rotate(2deg) scale(1)';
        stDOMRefs.nota3.classList.add('visible');
      }
    } else {
      // Fase de Aparición (Previo al spray: p = 0.22 -> 0.34)
      // Entrada secuencial previa para que ganen protagonismo antes del atomizador
      // Nota 1 (Cereza Jugosa): entrada 0.22 -> 0.27
      if (stDOMRefs.nota1) {
        const op1 = clamp((p - 0.22) / 0.05, 0, 1);
        const y1 = -24 * (1.0 - op1);
        stDOMRefs.nota1.style.opacity = op1.toFixed(3);
        stDOMRefs.nota1.style.transform = `translate3d(0, ${y1.toFixed(1)}px, 0) rotate(-3deg) scale(1)`;
        if (op1 > 0.05) stDOMRefs.nota1.classList.add('visible');
        else stDOMRefs.nota1.classList.remove('visible');
      }
      // Nota 2 (Café): entrada 0.25 -> 0.30
      if (stDOMRefs.nota2) {
        const op2 = clamp((p - 0.25) / 0.05, 0, 1);
        const x2 = (isMobile ? 12 : 26) * (1.0 - op2);
        stDOMRefs.nota2.style.opacity = op2.toFixed(3);
        stDOMRefs.nota2.style.transform = `translate3d(${x2.toFixed(1)}px, 0, 0) scale(1)`;
        if (op2 > 0.05) stDOMRefs.nota2.classList.add('visible');
        else stDOMRefs.nota2.classList.remove('visible');
      }
      // Nota 3 (Amberwood): entrada 0.28 -> 0.33
      if (stDOMRefs.nota3) {
        const op3 = clamp((p - 0.28) / 0.05, 0, 1);
        const y3 = 24 * (1.0 - op3);
        stDOMRefs.nota3.style.opacity = op3.toFixed(3);
        stDOMRefs.nota3.style.transform = `translate3d(0, ${y3.toFixed(1)}px, 0) rotate(2deg) scale(1)`;
        if (op3 > 0.05) stDOMRefs.nota3.classList.add('visible');
        else stDOMRefs.nota3.classList.remove('visible');
      }
    }
  }

  // Acto 3: Aparece levitando suavemente desde abajo (translateY(20px) -> 0)
  if (stDOMRefs.deep) {
    let deepOpacity = 0;
    let deepY = 20;
    if (p >= 0.58) {
      if (p <= 0.68) {
        deepOpacity = clamp((p - 0.58) / 0.10, 0, 1);
      } else {
        deepOpacity = 1.0;
      }
      const tEnter3 = clamp((p - 0.58) / 0.10, 0, 1);
      deepY = 20 * (1.0 - tEnter3);
    }
    stDOMRefs.deep.style.opacity = deepOpacity.toFixed(3);
    stDOMRefs.deep.style.transform = `translate3d(0, calc(-50% + ${deepY.toFixed(1)}px), 0)`;
    stDOMRefs.deep.style.pointerEvents = deepOpacity > 0.01 ? 'auto' : 'none';
  }
}

/**
 * Sincroniza la opacidad de los fondos independientes con el scroll:
 * - bg-intro: Visible desde el inicio, se desvanece suavemente hasta la mitad del scroll (p = 0.50).
 * - bg-final: Empieza a aparecer sutilmente desde la mitad (p = 0.45) para un crossfade sin cortes estilo Vela Armon.
 */
function updateBackgroundsOnScroll(p) {
  if (!stDOMRefs.bgIntro) stDOMRefs.bgIntro = document.getElementById('bg-intro');
  if (!stDOMRefs.bgFinal) stDOMRefs.bgFinal = document.getElementById('bg-final');

  // bg-intro: Visible desde el inicio, se desvanece suavemente hasta la mitad del scroll (p = 0.50)
  if (stDOMRefs.bgIntro) {
    const tIntro = Math.min(Math.max(p / 0.50, 0), 1);
    stDOMRefs.bgIntro.style.opacity = (0.35 * (1.0 - tIntro)).toFixed(3);
  }

  // bg-final: Empieza a aparecer sutilmente desde la mitad (p = 0.45) para un crossfade sin cortes
  if (stDOMRefs.bgFinal) {
    const tFinal = Math.min(Math.max((p - 0.45) / 0.55, 0), 1);
    stDOMRefs.bgFinal.style.opacity = (0.25 * tFinal).toFixed(3);
  }
}

export function updateSceneOnScroll(progress) {
  if (isFreeMode) return;
  const p = clamp(progress, 0, 1);
  lastScrollProgress = p;

  // Actualizar opacidad de fondos fotográficos independientes
  updateBackgroundsOnScroll(p);

  // Transiciones asimétricas editoriales de tarjetas y notas por scroll
  updateEditorialStoryCards(p);

  if (!sceneObjects.camera || !sceneObjects.bottleGroup) return;

  const aspect = sceneObjects.camera.aspect || (window.innerWidth / window.innerHeight);
  const framing = calculateCameraFraming(aspect);

  // Helper Hermite para interpolación continua y sedosa
  const smooth = (minVal, maxVal, val) => {
    const t = clamp((val - minVal) / (maxVal - minVal), 0, 1);
    return t * t * (3.0 - 2.0 * t);
  };

  // Helper para interpolar cotas y escalas de piezas del atomizador
  const updateAtomizerMorph = (tUncapped) => {
    const { pulsadorGroup, buttonMesh, ringMesh, torusMesh, nozzleOuterMesh, sprayPinholeMesh } = sceneObjects;
    if (pulsadorGroup) {
      pulsadorGroup.position.y = lerp(ATOMIZER_SEALED.pulsadorGroupY, ATOMIZER_COMPACT.pulsadorGroupY, tUncapped);
    }
    if (buttonMesh) {
      buttonMesh.scale.y = lerp(ATOMIZER_SEALED.buttonScaleY, ATOMIZER_COMPACT.buttonScaleY, tUncapped);
    }
    if (ringMesh) {
      ringMesh.position.y = lerp(ATOMIZER_SEALED.ringY, ATOMIZER_COMPACT.ringY, tUncapped);
      ringMesh.scale.y = lerp(ATOMIZER_SEALED.ringScaleY, ATOMIZER_COMPACT.ringScaleY, tUncapped);
    }
    if (torusMesh) {
      torusMesh.position.y = lerp(ATOMIZER_SEALED.torusY, ATOMIZER_COMPACT.torusY, tUncapped);
      const sc = lerp(ATOMIZER_SEALED.torusScaleXZ, ATOMIZER_COMPACT.torusScaleXZ, tUncapped);
      torusMesh.scale.set(sc, lerp(ATOMIZER_SEALED.torusScaleY, ATOMIZER_COMPACT.torusScaleY, tUncapped), sc);
    }
    if (nozzleOuterMesh) {
      nozzleOuterMesh.position.y = lerp(ATOMIZER_SEALED.nozzleY, ATOMIZER_COMPACT.nozzleY, tUncapped);
    }
    if (sprayPinholeMesh) {
      sprayPinholeMesh.position.y = lerp(ATOMIZER_SEALED.nozzleY, ATOMIZER_COMPACT.nozzleY, tUncapped);
    }
  };

  // =========================================================================
  // ACTO 1: progress 0.0 -> 0.25 (Ascenso Heroico y Barrido Especular)
  // =========================================================================
  if (p < 0.25) {
    const t1 = smooth(0.0, 0.25, p);

    // 1. Ascenso vertical del frasco: de Y = -0.04 a su cota base Y = 0.0
    scrollBasePosY = lerp(-0.04, 0.0, t1);
    scrollBasePosX = 0.0;

    // 2. Inclinación sutil de cámara que se endereza suavemente hacia el plano frontal
    const camY = framing.camY + lerp(0.016, 0.0, t1);
    const lookAtY = framing.lookAtY + lerp(-0.020, 0.0, t1);
    sceneObjects.camera.position.set(0, camY, framing.camZ);
    cameraTargetLookAt.set(0, lookAtY, 0);

    // 3. Barrido horizontal de luz especular sobre arista y serigrafía YANBAL
    if (sceneObjects.lights.keyLight) {
      const sweepX = lerp(-3.0, 4.0, t1);
      sceneObjects.lights.keyLight.position.set(sweepX, 5.0, 6.0);
    }

    // Orientación frontal estable
    scrollBaseRotY = 0.0;
    scrollBaseRotX = lerp(-0.035, -0.015, t1);
    scrollBaseRotZ = 0.0;

    // Tapa y atomizador cerrados
    if (sceneObjects.capGroup) {
      sceneObjects.capGroup.position.set(0, 0, 0);
      sceneObjects.capGroup.rotation.set(0, 0, 0);
    }
    updateAtomizerMorph(0.0);
    // Limpiar estado del spray paramétrico al volver al Acto 1
    if (scrollSpray.originCaptured || scrollSpray.active) {
      scrollSpray.active = false;
      scrollSpray.originCaptured = false;
      if (sprayPoints) sprayPoints.visible = false;
      if (sprayMaterial) sprayMaterial.opacity = 0;
    }
    hasTriggeredScrollSpray = false;
  }

  // =========================================================================
  // ACTO 2: progress 0.25 -> 0.60 (Ritual de Aplicación: Destapado, Spray, Cierre)
  // =========================================================================
  else if (p >= 0.25 && p < 0.60) {
    scrollBasePosY = 0.0;
    scrollBasePosX = 0.0;
    scrollBaseRotY = 0.0;
    scrollBaseRotX = -0.015;
    scrollBaseRotZ = 0.0;

    // Cámara frontal estabilizada
    sceneObjects.camera.position.set(0, framing.camY, framing.camZ);
    cameraTargetLookAt.set(0, framing.lookAtY, 0);

    // Luz principal fija en posición de estudio
    if (sceneObjects.lights.keyLight) {
      sceneObjects.lights.keyLight.position.set(4.0, 5.0, 6.0);
    }

    // --- Sub-fase 2A: 0.25 -> 0.35 (Destapado con Rotación Flotante Orgánica) ---
    if (p < 0.35) {
      const t2a = smooth(0.25, 0.35, p);

      if (sceneObjects.capGroup) {
        sceneObjects.capGroup.position.y = lerp(0.0, 0.048, t2a);
        sceneObjects.capGroup.position.x = Math.sin(t2a * Math.PI) * 0.0018;
        sceneObjects.capGroup.rotation.y = lerp(0.0, 0.14, t2a);
        sceneObjects.capGroup.rotation.z = Math.sin(t2a * Math.PI) * 0.038;
      }
      updateAtomizerMorph(t2a);
      hasTriggeredScrollSpray = false;
    }

    // --- Sub-fase 2B: 0.35 -> 0.50 (Momento del Rocío: Spray Paramétrico Bidireccional) ---
    else if (p >= 0.35 && p < 0.50) {
      const p2b = (p - 0.35) / 0.10;           // Pulsación física en 0.35–0.45
      const sprayLocalP = (p - 0.35) / 0.15;    // Progreso del spray 0.0–1.0 en 0.35–0.50

      // La tapa flota suavemente suspendida
      if (sceneObjects.capGroup) {
        sceneObjects.capGroup.position.y = 0.048 + Math.sin(Math.min(p2b, 1.0) * Math.PI) * 0.0015;
        sceneObjects.capGroup.position.x = 0.0;
        sceneObjects.capGroup.rotation.y = 0.14;
        sceneObjects.capGroup.rotation.z = 0.0;
      }
      updateAtomizerMorph(1.0);

      // Descenso y pulsación física del pulsador metálico (solo en 0.35–0.45)
      const pressDepth = Math.sin(clamp(Math.min(p2b, 1.0) / 0.85, 0.0, 1.0) * Math.PI) * 0.0028;
      if (sceneObjects.pulsadorGroup) {
        sceneObjects.pulsadorGroup.position.y = ATOMIZER_COMPACT.pulsadorGroupY - pressDepth;
      }

      // --- Spray paramétrico bidireccional vinculado al scroll ---
      // Capturar origen en la primera entrada a esta ventana
      if (!scrollSpray.originCaptured) {
        captureScrollSprayOrigin();
      }

      // Mostrar y actualizar el spray proporcional al scroll
      if (sprayPoints && scrollSpray.originCaptured) {
        scrollSpray.active = true;
        sprayPoints.visible = true;

        // Opacidad: sube rápido en 0.35-0.38 y cae suavemente en 0.44-0.50
        const fadeIn  = clamp((p - 0.35) / 0.03, 0.0, 1.0);
        const fadeOut = 1.0 - clamp((p - 0.44) / 0.06, 0.0, 1.0);
        const sprayOpacity = fadeIn * fadeOut * 0.92;
        if (sprayMaterial) sprayMaterial.opacity = sprayOpacity;

        // Posiciones de vértices parametrizadas al scroll (0–1 dentro de la ventana)
        updateParticlesParametric(sprayLocalP);
      }

      hasTriggeredScrollSpray = true;   // marca para que el Acto 1 pueda resetear
    }

    // --- Sub-fase 2C: 0.50 -> 0.55 (Cierre y Re-encaje de la Tapa) ---
    else if (p >= 0.50 && p < 0.55) {
      const t2c = smooth(0.50, 0.55, p);

      // Apagar spray paramétrico al salir de la ventana
      if (sprayPoints && scrollSpray.active) {
        scrollSpray.active = false;
        scrollSpray.originCaptured = false;
        sprayPoints.visible = false;
        if (sprayMaterial) sprayMaterial.opacity = 0;
      }

      if (sceneObjects.capGroup) {
        sceneObjects.capGroup.position.y = lerp(0.048, 0.0, t2c);
        sceneObjects.capGroup.position.x = Math.sin((1.0 - t2c) * Math.PI) * 0.0018;
        sceneObjects.capGroup.rotation.y = lerp(0.14, 0.0, t2c);
        sceneObjects.capGroup.rotation.z = Math.sin((1.0 - t2c) * Math.PI) * 0.038;
      }
      updateAtomizerMorph(1.0 - t2c);
    }

    // --- Sub-fase 2D: 0.55 -> 0.60 (Pausa de Contemplación Sellada) ---
    else {
      if (sceneObjects.capGroup) {
        sceneObjects.capGroup.position.set(0, 0, 0);
        sceneObjects.capGroup.rotation.set(0, 0, 0);
      }
      updateAtomizerMorph(0.0);
    }
  }

  // =========================================================================
  // ACTO 3: progress 0.60 -> 1.0 (Giro Escultural Multi-Eje y Presentación Final)
  // =========================================================================
  else {
    const t3 = smooth(0.60, 1.0, p);

    scrollBasePosY = 0.0;
    scrollBasePosX = 0.0;

    // 1. Rotación completa en Y exhibiendo laterales, dorso en penumbra y retorno al frente
    scrollBaseRotY = -t3 * Math.PI * 2;

    // 2. Oscilación cinematográfica multi-eje (pitch y roll de ±2° / ~0.035 rad)
    const pitchRobotic = Math.sin(t3 * Math.PI * 2) * 0.035;
    const rollRobotic  = Math.sin(t3 * Math.PI) * -0.032;
    scrollBaseRotX = -0.015 + pitchRobotic;
    scrollBaseRotZ = rollRobotic;

    // 3. Encuadre final impecable frente al botón de catálogo
    const dynamicZ = framing.camZ + Math.sin(t3 * Math.PI) * -0.010;
    const dynamicY = framing.camY + Math.sin(t3 * Math.PI) * 0.004;
    sceneObjects.camera.position.set(0, dynamicY, dynamicZ);
    cameraTargetLookAt.set(0, framing.lookAtY, 0);

    if (sceneObjects.lights.keyLight) {
      sceneObjects.lights.keyLight.position.set(4.0, 5.0, 6.0);
    }

    if (sceneObjects.capGroup) {
      sceneObjects.capGroup.position.set(0, 0, 0);
      sceneObjects.capGroup.rotation.set(0, 0, 0);
    }
    updateAtomizerMorph(0.0);
  }

  // Suavizado del punto de mira de la cámara
  currentLookAt.lerp(cameraTargetLookAt, 0.22);
  sceneObjects.camera.lookAt(currentLookAt);

}

// ==========================================================================
// Ajuste Responsivo
// ==========================================================================
export function onWindowResize() {
  if (!sceneObjects.camera || !sceneObjects.renderer || !sceneObjects.canvas) return;

  const width = sceneObjects.canvas.clientWidth || window.innerWidth;
  const height = sceneObjects.canvas.clientHeight || window.innerHeight;
  const aspect = width / height;

  sceneObjects.camera.aspect = aspect;
  sceneObjects.camera.updateProjectionMatrix();

  sceneObjects.renderer.setSize(width, height, false);
  sceneObjects.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));

  // Sincronizar resolución del compositor con la del canvas
  if (composer) composer.setSize(width, height);

  updateSceneOnScroll(lastScrollProgress);
}

// ==========================================================================
// Inicialización Principal de la Escena 3D
// ==========================================================================
let isInitialized = false;
let animationFrameId = null;
let composer = null;  // EffectComposer del pipeline de post-procesado
let isFreeMode = false;

// Variables de control temporal para interacción táctil móvil
let lastTapTime = 0;
let touchMoved = false;

// Raycaster global e interacción del cursor
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

export function initScene3D(canvasElement) {
  if (isInitialized && sceneObjects.renderer) {
    return sceneObjects;
  }

  const canvas = canvasElement || document.getElementById('webgl-canvas');
  if (!canvas) {
    console.error('Error: canvas #webgl-canvas no encontrado.');
    return null;
  }

  sceneObjects.canvas = canvas;

  // 1. Configuración de Renderer: alpha: true para revelar fondos fotográficos #bg-intro y #bg-final
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });

  const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  const width = canvas.clientWidth || window.innerWidth;
  const height = canvas.clientHeight || window.innerHeight;

  renderer.setSize(width, height, false);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  // outputColorSpace lo maneja OutputPass al final del pipeline de post-procesado
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.84;

  sceneObjects.renderer = renderer;

  // El compositor se inicializa después de crear scene y camera (ver bloque 3b)

  // 2. Escena 3D: fondo transparente en WebGL para que el borgoña y fotos de fondo se muestren con fidelidad
  const scene = new THREE.Scene();
  scene.background = null;
  scene.fog = null;
  scene.environment = null;
  sceneObjects.scene = scene;

  // Inicializar sistema de partículas de spray
  initSprayParticleSystem(scene);

  // 3. Cámara inicial con encuadre completo (Cero recortes, idéntico a model-test.html)
  const aspect = width / height;
  const framing = calculateCameraFraming(aspect);

  const camera = new THREE.PerspectiveCamera(44, aspect, 0.01, 50);
  camera.position.set(0, framing.camY, framing.camZ);
  camera.lookAt(0, framing.lookAtY, 0);
  sceneObjects.camera = camera;

  // Controles OrbitControls para el modo libre 360°
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enabled = false; // Apagados por defecto durante el scroll
  controls.enableDamping = true; // Rotación con inercia suave
  controls.dampingFactor = 0.05;
  controls.target.set(0, framing.lookAtY, 0);
  sceneObjects.controls = controls;

  // Vincular botón de activación de modo libre 360°
  document.getElementById('btn-free-mode')?.addEventListener('click', () => {
    isFreeMode = true;
    controls.enabled = true;

    // Bloquear el scroll del navegador
    document.body.style.overflow = 'hidden';
    // Ocultar textos para limpiar la vista
    const storyCards = document.querySelector('.story-cards');
    if (storyCards) storyCards.style.opacity = '0';
    const storyFooter = document.querySelector('.story-footer');
    if (storyFooter) storyFooter.style.opacity = '0';

    const stickyStage = document.querySelector('.sticky-stage');
    if (stickyStage) stickyStage.style.pointerEvents = 'auto';
    canvas.style.pointerEvents = 'auto';
    canvas.style.cursor = 'grab';

    // Revelar botón de salida hacia el catálogo
    const btnExit = document.getElementById('btn-exit-free-mode');
    if (btnExit) {
      btnExit.style.opacity = '1';
      btnExit.style.pointerEvents = 'auto';
    }
  });

  // Vincular botón de salida del modo libre 360°
  document.getElementById('btn-exit-free-mode')?.addEventListener('click', () => {
    // Apagar controles y modo libre
    isFreeMode = false;
    controls.enabled = false;

    // Restaurar el scroll y la UI original
    document.body.style.overflow = 'auto';
    const storyCards = document.querySelector('.story-cards');
    if (storyCards) storyCards.style.opacity = '1';
    const storyFooter = document.querySelector('.story-footer');
    if (storyFooter) storyFooter.style.opacity = '1'; // Esto revela el botón original de Yanbal

    // Restaurar eventos de puntero y cursor del canvas
    const stickyStage = document.querySelector('.sticky-stage');
    if (stickyStage) stickyStage.style.pointerEvents = '';
    canvas.style.pointerEvents = '';
    canvas.style.cursor = 'default';

    // Ocultar este botón de salida
    const btnExit = document.getElementById('btn-exit-free-mode');
    if (btnExit) {
      btnExit.style.opacity = '0';
      btnExit.style.pointerEvents = 'none';
    }

    // Asegurar que el usuario esté al final de la página para ver el catálogo
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  });

  // 3b. Pipeline de Post-Procesado Cinemático
  //     Inicializado aquí para que RenderPass reciba scene y camera reales.
  composer = new EffectComposer(renderer);

  // Pase 1: escena base con fondo transparente (clearAlpha: 0)
  const renderPass = new RenderPass(scene, camera);
  renderPass.clearColor = new THREE.Color(0x000000);
  renderPass.clearAlpha = 0;
  composer.addPass(renderPass);

  // Pase 2: UnrealBloom — calibración de estudio refinada para evitar expansión sobre el texto dorado
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    0.20,   // strength  — resplandor más contenido y sobrio
    0.30,   // radius    — difusión más cerrada para perfiles limpios y definidos
    0.90    // threshold — recorte estricto: solo reflejos de oro puro y puntos blancos intensos
  );
  composer.addPass(bloomPass);
  sceneObjects.bloomPass = bloomPass;

  // Pase 3: OutputPass — conversión HDR → sRGB (obligatorio desde Three r155+)
  // (Nota: VignetteShader eliminado para erradicar el halo gris y preservar transparencia pura)
  composer.addPass(new OutputPass());

  // 4. Iluminación exacta de model-test.js
  const hemisphereLight = new THREE.HemisphereLight(0xffd1cb, 0x120004, 0.68);
  scene.add(hemisphereLight);
  sceneObjects.lights.hemisphereLight = hemisphereLight;

  const keyLight = new THREE.DirectionalLight(0xffc5b8, 0.42);
  keyLight.position.set(4, 5, 6);
  scene.add(keyLight);
  sceneObjects.lights.keyLight = keyLight;

  const redRimLight = new THREE.DirectionalLight(0xa00028, 0.38);
  redRimLight.position.set(-4, 2.5, -5);
  scene.add(redRimLight);
  sceneObjects.lights.redRimLight = redRimLight;

  // 5. Material MatCap de Oro Champán para Atomizador y Cuello
  const goldMatcap = createAtomizerPieceMatcapTexture(renderer.capabilities.getMaxAnisotropy());
  atomizerPieceMaterial = new THREE.MeshMatcapMaterial({
    color: 0xffffff,
    matcap: goldMatcap,
    transparent: false,
    opacity: 1.0,
    depthTest: true,
    depthWrite: true,
    side: THREE.DoubleSide,
  });

  // 6. Carga Asíncrona del Modelo GLTF y Ensamble Exacto
  const MODEL_PATH = getAssetUrl('assets/models/temptation-mystic-perforado.glb');

  // LoadingManager: controla el progreso de todas las cargas (GLTF + texturas embebidas)
  const manager = new THREE.LoadingManager();

  // Progreso real de LoadingManager (GLTF, texturas, buffers)
  manager.onProgress = (url, itemsLoaded, itemsTotal) => {
    const pct = itemsTotal > 0 ? Math.round((itemsLoaded / itemsTotal) * 100) : 0;
    if (window.__updatePreloaderProgress) {
      window.__updatePreloaderProgress(pct);
    }
  };

  manager.onLoad = () => {
    if (window.__updatePreloaderProgress) {
      window.__updatePreloaderProgress(100);
    }
  };

  manager.onError = (url) => {
    console.warn('Error cargando asset:', url);
    if (window.__updatePreloaderProgress) {
      window.__updatePreloaderProgress(100);
    }
  };

  const loader = new GLTFLoader(manager);

  loader.load(
    MODEL_PATH,
    (gltf) => {
      const modelRoot = gltf.scene;
      sceneObjects.modelRoot = modelRoot;

      const meshes = [];
      modelRoot.traverse((child) => {
        if (child.isMesh && child.geometry) {
          meshes.push(child);
        }
      });

      meshes.sort((a, b) => {
        const countA = a.geometry.attributes.position ? a.geometry.attributes.position.count : 0;
        const countB = b.geometry.attributes.position ? b.geometry.attributes.position.count : 0;
        return countB - countA;
      });

      const cuerpoMesh = meshes[0];
      const tapaMesh = meshes[1];
      const cuelloMesh = meshes[2];

      sceneObjects.cuerpoMesh = cuerpoMesh;
      sceneObjects.tapaMesh = tapaMesh;
      sceneObjects.cuelloMesh = cuelloMesh;

      [cuerpoMesh, tapaMesh, cuelloMesh].forEach((mesh) => {
        if (mesh && mesh.geometry) {
          if (mesh.geometry.getAttribute('color')) {
            mesh.geometry.deleteAttribute('color');
          }
          mesh.geometry.deleteAttribute('normal');
          mesh.geometry.computeVertexNormals();
        }
      });

      // Centrado del modelo anclado a Y = 0.0600 m sobre la base del cuerpo
      const cuerpoBoxRaw = new THREE.Box3().setFromObject(cuerpoMesh);
      const cuerpoCenterRaw = cuerpoBoxRaw.getCenter(new THREE.Vector3());
      const targetModelCenter = new THREE.Vector3(cuerpoCenterRaw.x, cuerpoBoxRaw.min.y + 0.0600, cuerpoCenterRaw.z);
      modelRoot.position.sub(targetModelCenter);
      modelRoot.updateMatrixWorld(true);

      const bottleGroup = new THREE.Group();
      bottleGroup.name = 'bottleGroup';
      scene.add(bottleGroup);
      sceneObjects.bottleGroup = bottleGroup;

      bottleGroup.attach(cuerpoMesh);

      // Grupo de la tapa con compensación espacial exacta
      const capGroup = new THREE.Group();
      capGroup.name = 'capGroup';
      bottleGroup.add(capGroup);
      sceneObjects.capGroup = capGroup;

      capGroup.attach(tapaMesh);
      tapaMesh.material = capMaterial;
      tapaMesh.material.depthWrite = true;
      tapaMesh.material.depthTest = true;
      tapaMesh.name = 'tapa';
      tapaMesh.renderOrder = 0;

      const currentTapaCenter = new THREE.Box3().setFromObject(tapaMesh).getCenter(new THREE.Vector3());
      const desiredTapaCenter = new THREE.Vector3(0, 0.05162058, 0);
      const capOffset = desiredTapaCenter.clone().sub(currentTapaCenter);
      if (capOffset.lengthSq() > 0.00001) {
        tapaMesh.position.add(capOffset);
        tapaMesh.updateMatrixWorld(true);
      }

      // Cuello metálico
      bottleGroup.attach(cuelloMesh);
      cuelloMesh.material = atomizerPieceMaterial;
      cuelloMesh.material.depthWrite = true;
      cuelloMesh.material.depthTest = true;
      cuelloMesh.name = 'cuello';
      cuelloMesh.renderOrder = 0;

      scene.add(modelRoot);
      modelRoot.visible = true;

      // Calcular cotas locales del cuerpo para shader publicitario
      cuerpoMesh.geometry.computeBoundingBox();
      const localBox = cuerpoMesh.geometry.boundingBox;
      const localSize = localBox.getSize(new THREE.Vector3());

      const extents = [
        { axis: new THREE.Vector3(1, 0, 0), length: localSize.x, min: localBox.min.x, max: localBox.max.x, name: 'X' },
        { axis: new THREE.Vector3(0, 1, 0), length: localSize.y, min: localBox.min.y, max: localBox.max.y, name: 'Y' },
        { axis: new THREE.Vector3(0, 0, 1), length: localSize.z, min: localBox.min.z, max: localBox.max.z, name: 'Z' },
      ];
      extents.sort((a, b) => b.length - a.length);
      const verticalData = extents[0];
      const horizontalData = extents[1];

      bodyAdvertisingShader = createBodyAdvertisingShader(horizontalData, verticalData);
      cuerpoMesh.material = bodyAdvertisingShader;
      cuerpoMesh.material.transparent = true;
      cuerpoMesh.material.depthWrite = false;
      cuerpoMesh.material.depthTest = true;
      cuerpoMesh.renderOrder = 2;
      cuerpoMesh.name = 'bodyOuterGlass';

      const cuerpoBox = new THREE.Box3().setFromObject(cuerpoMesh);
      const cuerpoCenter = cuerpoBox.getCenter(new THREE.Vector3());
      const cuerpoSize = cuerpoBox.getSize(new THREE.Vector3());

      savedCuerpoMesh = cuerpoMesh;
      savedBottleSize = cuerpoSize;
      savedCuerpoBox = cuerpoBox;
      savedLocalBox = localBox;
      savedLocalSize = localSize;

      keyLight.target.position.copy(cuerpoCenter);
      scene.add(keyLight.target);
      redRimLight.target.position.copy(cuerpoCenter);
      scene.add(redRimLight.target);

      // Montaje del atomizador procedural y manguera
      requestAnimationFrame(() => {
        const atomizerGroup = buildProceduralAtomizer(atomizerPieceMaterial);
        bottleGroup.add(atomizerGroup);
        sceneObjects.atomizerGroup = atomizerGroup;

        const dipTubeGroup = buildDipTube();
        bottleGroup.add(dipTubeGroup);
        sceneObjects.dipTubeGroup = dipTubeGroup;

        const dipTubeConnectorGroup = buildDipTubeConnector();
        bottleGroup.add(dipTubeConnectorGroup);
        sceneObjects.dipTubeConnectorGroup = dipTubeConnectorGroup;

        const atomizerAccentLight = new THREE.PointLight(0xffc66b, 0.32, 0.75, 2);
        atomizerAccentLight.position.set(0.024, 0.035, 0.032);
        bottleGroup.add(atomizerAccentLight);
        sceneObjects.lights.atomizerAccentLight = atomizerAccentLight;

        // Inicialización de shaders multivista
        tapaMesh.geometry.computeBoundingBox();
        const tapaLocalBox = tapaMesh.geometry.boundingBox;
        const tapaLocalSize = tapaLocalBox.getSize(new THREE.Vector3());
        const tapaBox = new THREE.Box3().setFromObject(tapaMesh);

        tryInitCapMultiviewShader(tapaMesh, tapaBox, tapaLocalBox, tapaLocalSize);
        tryInitBodyMultiviewShader(cuerpoMesh, cuerpoSize, cuerpoBox, localBox, localSize);

        // Proyecciones fotográficas con serigrafía YANBAL
        setTimeout(() => {
          setupFrontPhotoProjection(cuerpoMesh, cuerpoSize, cuerpoCenter, cuerpoBox);
          setupCapFrontPhotoProjection(capGroup, tapaMesh);
        }, 16);

        setTimeout(() => {
          setupCapCleanTextures();
          setupBackPhotoProjections();
          setupSidePhotoProjections();
          setupCapSideTextures();
        }, 60);
      });

      sceneObjects.isLoaded = true;
      updateSceneOnScroll(lastScrollProgress);
    },
    undefined,
    (error) => {
      console.error('Error al cargar el modelo 3D GLTF:', error);
    }
  );

  // 7. Bucle de Renderizado con Micro-Animación Viva (Idle Float)
  const clock = new THREE.Clock();

  // Vectores auxiliares para el cálculo de atenuación angular sin GC overhead
  const _tubeFwd = new THREE.Vector3();
  const _camToBottle = new THREE.Vector3();
  const _bottleWorld = new THREE.Vector3();

  /**
   * Atenuación angular simétrica del tubo interior y conector:
   * - Utiliza Math.abs(angle) para simetría idéntica entre izquierda y derecha.
   * - Totalmente visible hasta 35° (frontal estricto).
   * - Desvanecimiento progresivo entre 35° y 50°.
   * - Opacidad 0 (y visible = false) a partir de los 50° (desaparece antes del perfil).
   */
  function updateDipTubeAngularFade() {
    if (!sceneObjects.bottleGroup || !sceneObjects.camera) return;
    if (!dipTubeMaterial && !sceneObjects.dipTubeGroup) return;

    // Vector normal frontal local (+Z) del frasco en coordenadas del mundo
    sceneObjects.bottleGroup.getWorldDirection(_tubeFwd);
    _tubeFwd.y = 0;
    _tubeFwd.normalize();

    // Vector desde el frasco hacia la cámara en el plano horizontal (XZ)
    sceneObjects.bottleGroup.getWorldPosition(_bottleWorld);
    _camToBottle.subVectors(sceneObjects.camera.position, _bottleWorld);
    _camToBottle.y = 0;
    _camToBottle.normalize();

    // Producto escalar entre el frente del frasco y la dirección a la cámara
    const dot = Math.max(-1.0, Math.min(1.0, _tubeFwd.dot(_camToBottle)));

    // Ángulo absoluto en grados (garantiza simetría perfecta 100% en ambos lados)
    const angleRad = Math.acos(dot);
    const angleDeg = Math.abs(angleRad * (180 / Math.PI));

    // Desvanecimiento angular progresivo según umbrales:
    let tubeOpacityFactor = 1.0;
    if (angleDeg <= 35.0) {
      tubeOpacityFactor = 1.0;
    } else if (angleDeg >= 50.0) {
      tubeOpacityFactor = 0.0;
    } else {
      const t = (angleDeg - 35.0) / (50.0 - 35.0);
      const smooth = t * t * (3.0 - 2.0 * t);
      tubeOpacityFactor = 1.0 - smooth;
    }

    const isTubeVisible = tubeOpacityFactor > 0.001;
    const targetOpacity = 0.38 * tubeOpacityFactor;

    if (dipTubeMaterial) {
      dipTubeMaterial.opacity = targetOpacity;
      dipTubeMaterial.visible = isTubeVisible;
    }
    if (dipTubeConnectorMaterial) {
      dipTubeConnectorMaterial.opacity = targetOpacity;
      dipTubeConnectorMaterial.visible = isTubeVisible;
    }
    if (sceneObjects.dipTubeGroup) {
      sceneObjects.dipTubeGroup.visible = isTubeVisible;
    }
    if (sceneObjects.dipTubeConnectorGroup) {
      sceneObjects.dipTubeConnectorGroup.visible = isTubeVisible;
    }
  }

  function render() {
    animationFrameId = requestAnimationFrame(render);

    if (isFreeMode) {
      controls.update();
    }

    if (!isFreeMode && sceneObjects.bottleGroup) {
      const time = clock.getElapsedTime();
      const idleRotY = Math.sin(time * 0.8) * 0.025;
      const idleRotX = Math.cos(time * 0.6) * 0.008;
      const idleFloatY = Math.sin(time * 0.9) * 0.0008;

      sceneObjects.bottleGroup.rotation.y = scrollBaseRotY + idleRotY;
      sceneObjects.bottleGroup.rotation.x = scrollBaseRotX + idleRotX;
      sceneObjects.bottleGroup.rotation.z = scrollBaseRotZ;
      sceneObjects.bottleGroup.position.x = scrollBasePosX;
      sceneObjects.bottleGroup.position.y = scrollBasePosY + idleFloatY;
    }

    // Atenuación angular reactiva y simétrica en cada frame
    updateDipTubeAngularFade();

    // Spray de clic manual (GSAP, unidireccional)
    if (sprayState.active) {
      updateParticles(sprayState.progress);
    }
    // El spray paramétrico de scroll se actualiza en updateSceneOnScroll() directamente
    // y sus posiciones ya han sido escritas en la geometría antes del render.

    // Pipeline de post-procesado (Bloom + Viñeta + OutputPass)
    if (composer) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
  }
  render();

  // 8. Interacción Unificada de Spray por Doble Clic (PC) y Doble Toque (Móvil)
  // Escritorio: dblclick
  renderer.domElement.addEventListener('dblclick', (event) => {
    if (!isFreeMode) return;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    triggerSpraySequence(mouse);
  });

  // Móvil: touchstart / touchmove / touchend
  let touchStartX = 0;
  let touchStartY = 0;

  renderer.domElement.addEventListener('touchstart', (e) => {
    touchMoved = false;
    if (e.touches && e.touches[0]) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  renderer.domElement.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches[0]) {
      const dx = e.touches[0].clientX - touchStartX;
      const dy = e.touches[0].clientY - touchStartY;
      if (dx * dx + dy * dy > 64) {
        touchMoved = true;
      }
    } else {
      touchMoved = true;
    }
  }, { passive: true });

  renderer.domElement.addEventListener('touchend', (e) => {
    const currentTime = performance.now();
    if (!touchMoved) {
      const timeSinceLastTap = currentTime - lastTapTime;
      if (timeSinceLastTap < 300 && timeSinceLastTap > 0 && isFreeMode) {
        const touch = e.changedTouches && e.changedTouches[0];
        if (touch) {
          const rect = renderer.domElement.getBoundingClientRect();
          mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
          mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
          triggerSpraySequence(mouse);
        }
      }
      lastTapTime = currentTime;
    }
  }, { passive: true });

  const pointerCoords = mouse;
  let pointerDownTime = 0;
  let pointerDownX = 0;
  let pointerDownY = 0;

  canvas.addEventListener('pointerdown', (e) => {
    pointerDownTime = performance.now();
    pointerDownX = e.clientX;
    pointerDownY = e.clientY;
  });

  canvas.addEventListener('pointerup', (e) => {
    if (isFreeMode) return;
    const elapsed = performance.now() - pointerDownTime;
    const dx = e.clientX - pointerDownX;
    const dy = e.clientY - pointerDownY;
    const distSq = dx * dx + dy * dy;

    // Solo activar si fue un clic o tap puntual (no un arrastre de scroll)
    if (elapsed > 400 || distSq > 64) return;

    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    pointerCoords.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerCoords.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointerCoords, sceneObjects.camera);

    const interactiveTargets = [];
    if (sceneObjects.bottleGroup) interactiveTargets.push(sceneObjects.bottleGroup);

    const hits = raycaster.intersectObjects(interactiveTargets, true);
    if (hits && hits.length > 0) {
      triggerSpray();
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!sceneObjects.camera || !sceneObjects.bottleGroup) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    pointerCoords.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerCoords.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointerCoords, sceneObjects.camera);
    const interactiveTargets = [];
    if (sceneObjects.bottleGroup) interactiveTargets.push(sceneObjects.bottleGroup);

    const hits = raycaster.intersectObjects(interactiveTargets, true);
    canvas.style.cursor = hits && hits.length > 0 ? 'pointer' : 'default';
  });

  window.addEventListener('resize', onWindowResize, { passive: true });
  isInitialized = true;

  return sceneObjects;
}
