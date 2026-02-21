
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useMediaPipe } from '../hooks/useMediaPipe';
import { LaserEffect } from '../effects/LaserEffect';
import { ExplosionEffect } from '../effects/ExplosionEffect';
import { audioService } from '../services/AudioService';
import { VIDEO_WIDTH, VIDEO_HEIGHT } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Hand, Loader2, Settings, X } from 'lucide-react';

export default function KryptonianOverlay() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const threeCanvasRef = useRef<HTMLCanvasElement>(null);
  const { faceLandmarker, handLandmarker, isLoaded } = useMediaPipe();
  
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const laserEffectRef = useRef<LaserEffect | null>(null);
  const explosionEffectRef = useRef<ExplosionEffect | null>(null);
  
  const [isClapping, setIsClapping] = useState(false);
  const [isLaserActive, setIsLaserActive] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  // Sensitivity Settings
  const [squintThreshold, setSquintThreshold] = useState(0.4);
  const [clapThreshold, setClapThreshold] = useState(0.1);

  const lastClapTime = useRef(0);
  const laserStateRef = useRef({ active: false, positions: [] as THREE.Vector3[] });

  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: VIDEO_WIDTH }, 
          height: { ideal: VIDEO_HEIGHT },
          facingMode: "user"
        }
      });
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    } catch (err: any) {
      console.error("Camera error:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError("Camera access denied. Please click the button below or check your browser settings to allow camera access.");
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError("No camera found on this device. Please connect a camera to continue.");
      } else {
        setCameraError("Could not access camera. Please ensure no other application is using it and try again.");
      }
    }
  }, []);

  // Initialize Three.js
  useEffect(() => {
    if (!threeCanvasRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, VIDEO_WIDTH / VIDEO_HEIGHT, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({
      canvas: threeCanvasRef.current,
      alpha: true,
      antialias: true
    });
    renderer.setSize(VIDEO_WIDTH, VIDEO_HEIGHT);
    renderer.setPixelRatio(window.devicePixelRatio);

    camera.position.z = 5;

    const laserEffect = new LaserEffect(scene);
    const explosionEffect = new ExplosionEffect(scene);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    laserEffectRef.current = laserEffect;
    explosionEffectRef.current = explosionEffect;

    const animate = () => {
      requestAnimationFrame(animate);
      if (laserEffectRef.current) {
        laserEffectRef.current.update(laserStateRef.current.positions, laserStateRef.current.active);
      }
      explosionEffectRef.current?.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      renderer.dispose();
    };
  }, []);

  // Detection Loop
  useEffect(() => {
    if (!isLoaded || !faceLandmarker || !handLandmarker || !videoRef.current) return;

    let animationFrameId: number;

    const detect = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        animationFrameId = requestAnimationFrame(detect);
        return;
      }

      const startTimeMs = performance.now();
      const faceResult = faceLandmarker.detectForVideo(videoRef.current, startTimeMs);
      const handResult = handLandmarker.detectForVideo(videoRef.current, startTimeMs);

      // Draw Face Mask on 2D Canvas
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
          if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.lineWidth = 1;
            faceResult.faceLandmarks[0].forEach((landmark, i) => {
              // Draw small points for mask
              if (i % 5 === 0) {
                ctx.beginPath();
                ctx.arc(landmark.x * VIDEO_WIDTH, landmark.y * VIDEO_HEIGHT, 1, 0, Math.PI * 2);
                ctx.stroke();
              }
            });
          }
        }
      }

      // Handle Face / Lasers
      if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
        setFaceDetected(true);
        const landmarks = faceResult.faceLandmarks[0];
        
        // Eye landmarks (approximate indices for center of eyes)
        // Left eye: 468, Right eye: 473 (Iris centers)
        const leftEye = landmarks[468];
        const rightEye = landmarks[473];

        if (leftEye && rightEye) {
          // Convert normalized coordinates to Three.js space
          // Normalized is 0-1, we want -X to +X and -Y to +Y
          const toThree = (p: { x: number, y: number, z: number }) => {
            const x = (p.x - 0.5) * 10; // Scale factor for camera view
            const y = -(p.y - 0.5) * 10 * (VIDEO_HEIGHT / VIDEO_WIDTH);
            const z = -p.z * 10;
            return new THREE.Vector3(x, y, z);
          };

          const leftPos = toThree(leftEye);
          const rightPos = toThree(rightEye);

          // Check for "focus" - maybe based on eye blendshapes (squinting)
          // Blendshape 19: eyeSquintLeft, 20: eyeSquintRight
          const blendshapes = faceResult.faceBlendshapes?.[0]?.categories;
          const squintLeft = blendshapes?.find(c => c.categoryName === 'eyeSquintLeft')?.score || 0;
          const squintRight = blendshapes?.find(c => c.categoryName === 'eyeSquintRight')?.score || 0;
          
          const active = squintLeft > squintThreshold && squintRight > squintThreshold;
          
          if (active && !isLaserActive) {
            audioService.playLaserCharge();
          } else if (active && isLaserActive) {
            // Occasional firing sound while active
            if (Math.random() > 0.95) audioService.playLaserFire();
          }

          setIsLaserActive(active);
          laserStateRef.current = { active, positions: [leftPos, rightPos] };
        }
      } else {
        setFaceDetected(false);
        setIsLaserActive(false);
        laserStateRef.current = { active: false, positions: [] };
      }

      // Handle Hands / Claps
      if (handResult.landmarks && handResult.landmarks.length >= 2) {
        const hand1 = handResult.landmarks[0][0]; // Wrist or palm center
        const hand2 = handResult.landmarks[1][0];
        
        const dist = Math.sqrt(
          Math.pow(hand1.x - hand2.x, 2) + 
          Math.pow(hand1.y - hand2.y, 2)
        );

        // Clap detection: distance threshold + cooldown
        if (dist < clapThreshold && Date.now() - lastClapTime.current > 1000) {
          lastClapTime.current = Date.now();
          
          // Trigger explosion at midpoint
          const midX = (hand1.x + hand2.x) / 2;
          const midY = (hand1.y + hand2.y) / 2;
          const midZ = (hand1.z + hand2.z) / 2;
          
          const explosionPos = new THREE.Vector3(
            (midX - 0.5) * 10,
            -(midY - 0.5) * 10 * (VIDEO_HEIGHT / VIDEO_WIDTH),
            -midZ * 10
          );
          
          explosionEffectRef.current?.trigger(explosionPos);
          audioService.playExplosion();
          setIsClapping(true);
          setTimeout(() => setIsClapping(false), 500);
        }
      }

      animationFrameId = requestAnimationFrame(detect);
    };

    detect();
    return () => cancelAnimationFrame(animationFrameId);
  }, [faceLandmarker, handLandmarker, isLoaded, squintThreshold, clapThreshold]);

  // Start Camera
  useEffect(() => {
    const handleFirstClick = () => {
      audioService.playLaserCharge(); // Just to initialize
      window.removeEventListener('click', handleFirstClick);
    };
    window.addEventListener('click', handleFirstClick);

    startCamera();
  }, [startCamera]);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden flex items-center justify-center">
      {/* Background Video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute w-full h-full object-cover opacity-100"
        style={{ transform: 'scaleX(-1)' }} // Mirror mode
      />

      {/* 2D Mask Overlay */}
      <canvas
        ref={canvasRef}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        className="absolute w-full h-full pointer-events-none opacity-50"
        style={{ transform: 'scaleX(-1)' }}
      />

      {/* Scanning Line */}
      <motion.div 
        animate={{ top: ['0%', '100%', '0%'] }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        className="absolute left-0 w-full h-[2px] bg-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.5)] z-20 pointer-events-none"
      />

      {/* Three.js Overlay */}
      <canvas
        ref={threeCanvasRef}
        className="absolute w-full h-full pointer-events-none"
        style={{ transform: 'scaleX(-1)' }}
      />

      {/* UI Overlay */}
      <div className="absolute top-0 left-0 w-full p-8 flex justify-between items-start pointer-events-none">
        <motion.div 
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="flex flex-col gap-2"
        >
          <h1 className="text-4xl font-black text-red-600 tracking-tighter uppercase italic">
            Kryptonian Protocol
          </h1>
          <div className="flex items-center gap-2 text-red-500/70 font-mono text-xs uppercase tracking-widest">
            <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
            Neural Link Active
          </div>
        </motion.div>

        <div className="flex flex-col gap-4 items-end pointer-events-auto">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-full bg-black/50 border border-white/10 text-white/50 hover:text-white hover:border-white/30 transition-all mb-2"
          >
            <Settings size={20} />
          </button>

          <StatusIndicator 
            active={faceDetected} 
            icon={<Loader2 size={16} className={faceDetected ? "" : "animate-spin"} />} 
            label="Face Tracking" 
            color="bg-blue-600"
          />
          <StatusIndicator 
            active={isLaserActive} 
            icon={<Zap size={16} />} 
            label="Heat Vision" 
            color="bg-red-600"
          />
          <StatusIndicator 
            active={isClapping} 
            icon={<Hand size={16} />} 
            label="Kinetic Burst" 
            color="bg-orange-500"
          />
        </div>
      </div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className="absolute right-8 top-48 w-72 bg-black/80 border border-white/10 rounded-2xl p-6 backdrop-blur-xl z-50"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-bold uppercase tracking-widest text-red-500">Sensitivity Calibration</h3>
              <button onClick={() => setShowSettings(false)} className="text-white/30 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-8">
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/50">Heat Vision (Squint)</label>
                  <span className="text-[10px] font-mono text-red-500">{(100 - squintThreshold * 100).toFixed(0)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0.1" 
                  max="0.9" 
                  step="0.05"
                  value={squintThreshold}
                  onChange={(e) => setSquintThreshold(parseFloat(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-red-600"
                />
                <p className="text-[9px] text-white/30 italic">Lower value = easier to trigger</p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/50">Kinetic Burst (Clap)</label>
                  <span className="text-[10px] font-mono text-orange-500">{(clapThreshold * 100).toFixed(0)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0.02" 
                  max="0.3" 
                  step="0.01"
                  value={clapThreshold}
                  onChange={(e) => setClapThreshold(parseFloat(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
                <p className="text-[9px] text-white/30 italic">Higher value = easier to trigger</p>
              </div>
            </div>

            <button 
              onClick={() => {
                setSquintThreshold(0.4);
                setClapThreshold(0.1);
              }}
              className="mt-8 w-full py-2 border border-white/5 rounded-lg text-[10px] uppercase tracking-widest text-white/30 hover:text-white hover:bg-white/5 transition-all"
            >
              Reset to Default
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instructions */}
      <AnimatePresence>
        {cameraError ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center z-[60] p-8 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-red-600/20 flex items-center justify-center mb-6 border border-red-600/50">
              <X className="text-red-600" size={32} />
            </div>
            <h2 className="text-2xl font-black text-red-600 uppercase italic mb-4 tracking-tighter">Access Denied</h2>
            <p className="text-white/70 font-mono text-sm max-w-md leading-relaxed mb-8">
              {cameraError}
            </p>
            <button 
              onClick={() => startCamera()}
              className="px-8 py-3 bg-red-600 text-white font-bold uppercase tracking-widest text-xs rounded-lg hover:bg-red-700 transition-colors"
            >
              Enable Camera
            </button>
          </motion.div>
        ) : !isLoaded ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50"
          >
            <Loader2 className="w-12 h-12 text-red-600 animate-spin mb-4" />
            <p className="text-red-500 font-mono text-sm tracking-widest uppercase">
              Initializing Neural Interface...
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 pointer-events-none z-40"
          >
            {/* Optional: Add a subtle overlay or just let it be */}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 pointer-events-none">
        <AnimatePresence mode="wait">
          {!faceDetected ? (
            <motion.div
              key="no-face"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="px-6 py-3 bg-red-900/20 border border-red-500/50 rounded-xl backdrop-blur-xl"
            >
              <p className="text-red-400 font-mono text-xs uppercase tracking-[0.3em] animate-pulse">
                Searching for Kryptonian DNA...
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="face-found"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="flex flex-col items-center gap-2"
            >
              <div className="px-4 py-2 bg-black/50 border border-red-900/30 rounded-full backdrop-blur-md">
                <p className="text-white/70 font-mono text-[10px] uppercase tracking-widest text-center">
                  Squint to fire heat vision • Clap to trigger kinetic burst
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Screen Flash on Clap */}
      <AnimatePresence>
        {isClapping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white pointer-events-none z-10"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusIndicator({ active, icon, label, color }: { active: boolean, icon: React.ReactNode, label: string, color: string }) {
  return (
    <motion.div 
      animate={{ 
        scale: active ? 1.1 : 1,
        backgroundColor: active ? 'rgba(220, 38, 38, 0.2)' : 'rgba(0, 0, 0, 0.5)'
      }}
      className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${active ? 'border-red-500' : 'border-white/10'} backdrop-blur-md transition-colors`}
    >
      <div className={`p-1.5 rounded-md ${active ? color : 'bg-white/10'} text-white`}>
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-widest text-white/50 font-bold">{label}</span>
        <span className={`text-xs font-mono ${active ? 'text-white' : 'text-white/30'}`}>
          {active ? 'ENGAGED' : 'STANDBY'}
        </span>
      </div>
    </motion.div>
  );
}
