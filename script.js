/* ==========================================================================
   Temptation Mystic - Interactive Cinematic Scroll Experience
   Pure CSS/HTML/JS — No Canvas, No WebGL, No Three.js
   ========================================================================== */

import introDesktopUrl from "./assets/intro-desktop.mp4";
import introMobileUrl from "./assets/intro-mobile.mp4";
import ambientAudioUrl from "./assets/ethereal-pulse.mp3";

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const introScreen = document.getElementById("intro");
  const playButton = document.getElementById("playButton");
  const videoScreen = document.getElementById("videoScreen");
  const introVideo = document.getElementById("introVideo");
  const skipButton = document.getElementById("skipButton");
  const story = document.getElementById("story");

  const bgOne = document.getElementById("bgOne");
  const bgTwo = document.getElementById("bgTwo");
  // Elementos 2D retirados en Fase 1 (integración de WebGL Canvas)
  // const photoStage = document.getElementById("photoStage");
  // const productMain = document.getElementById("productMain");
  // const productExploded = document.getElementById("productExploded");
  // const sprayMist = document.getElementById("sprayMist");
  const card1 = document.getElementById("card1");
  const card2 = document.getElementById("card2");
  const scrollHint = document.getElementById("scrollHint");

  let targetProgress = 0;
  let currentProgress = 0;
  let storyStarted = false;

  // Ambient Audio
  const ambientAudio = new Audio(ambientAudioUrl);
  ambientAudio.loop = true;
  ambientAudio.volume = 0.16;

  // Math Utilities
  function clamp(value, min = 0, max = 1) {
    return Math.min(Math.max(value, min), max);
  }

  function smoothstep(start, end, value) {
    const t = clamp((value - start) / (end - start));
    return t * t * (3 - 2 * t);
  }

  // Video Source Selector
  function getVideoSrc() {
    const isMobile = window.matchMedia("(max-width: 768px), (orientation: portrait)").matches;
    return isMobile ? introMobileUrl : introDesktopUrl;
  }

  // Show Main Story View
  function showStory() {
    if (introVideo) {
      introVideo.pause();
      introVideo.currentTime = 0;
      introVideo.removeAttribute("src");
      introVideo.load();
    }

    videoScreen?.classList.add("is-hidden");
    introScreen?.classList.add("is-hidden");
    story?.classList.remove("is-hidden");
    document.body.classList.add("story-active");
    window.scrollTo(0, 0);
    storyStarted = true;
    updateTargetProgress();

    ambientAudio.currentTime = 0;
    ambientAudio.play().catch(() => {
      ambientAudio.muted = true;
      ambientAudio.play().catch(() => {});
    });
  }

  playButton?.addEventListener("click", () => {
    if (!introVideo || !videoScreen || !introScreen) return;

    introVideo.src = getVideoSrc();
    introVideo.muted = false;
    introScreen.classList.add("is-fading");

    setTimeout(() => {
      introScreen.classList.add("is-hidden");
      videoScreen.classList.remove("is-hidden");
      introVideo.play().catch(() => {
        introVideo.muted = true;
        introVideo.play();
      });
    }, 450);
  });

  introVideo?.addEventListener("ended", showStory);
  skipButton?.addEventListener("click", showStory);

  // -------------------------------------------------------------
  // MAIN SCROLL SCENE ENGINE
  // -------------------------------------------------------------
  function updateTargetProgress() {
    if (!storyStarted && story?.classList.contains("is-hidden")) return;
    const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    targetProgress = clamp(window.scrollY / maxScroll);
  }

  function applyScrollScene(progress) {
    const backgroundSwap = smoothstep(0.1, 0.38, progress);
    const finalReveal = smoothstep(0.68, 0.92, progress);

    // 1. Fondos Parallax
    if (bgOne && bgTwo) {
      bgOne.style.opacity = (1 - backgroundSwap * 0.82).toFixed(3);
      bgTwo.style.opacity = (0.12 + backgroundSwap * 0.88).toFixed(3);
      bgOne.style.transform = `scale(${1.03 + progress * 0.12}) translate3d(0, ${progress * -70}px, 0)`;
      bgTwo.style.transform = `scale(${1.11 - progress * 0.05}) translate3d(0, ${progress * -34}px, 0)`;
    }

    // 2. Transición 3D (Se integrará en la siguiente fase de Scrollytelling)

    // 4. Tarjetas Informativas Narrativas
    if (card1 && card2) {
      const cardOne = smoothstep(0.02, 0.16, progress) * (1 - smoothstep(0.27, 0.38, progress));
      const cardTwo = smoothstep(0.34, 0.48, progress) * (1 - smoothstep(0.7, 0.82, progress));
      card1.style.opacity = cardOne.toFixed(3);
      card1.style.transform = `translate3d(0, ${24 - cardOne * 24}px, 0)`;
      card2.style.opacity = cardTwo.toFixed(3);
      card2.style.transform = `translate3d(0, ${24 - cardTwo * 24}px, 0)`;
    }

    if (scrollHint) {
      scrollHint.style.opacity = progress < 0.04 ? "0.8" : "0";
    }

    document.documentElement.style.setProperty("--footer-opacity", finalReveal.toFixed(3));
  }

  function animate() {
    currentProgress += (targetProgress - currentProgress) * 0.12;
    applyScrollScene(currentProgress);
    requestAnimationFrame(animate);
  }

  window.addEventListener("scroll", updateTargetProgress, { passive: true });
  window.addEventListener("resize", updateTargetProgress, { passive: true });
  updateTargetProgress();
  animate();
});
