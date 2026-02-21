
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useMediaPipe } from '../hooks/useMediaPipe';
import { VIDEO_WIDTH, VIDEO_HEIGHT } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Hand, Loader2, Settings, X, Activity, Cpu, Fingerprint } from 'lucide-react';

export default function NeuralInterface() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { faceLandmarker, handLandmarker, isLoaded } = useMediaPipe();
  
  const [faceDetected, setFaceDetected] = useState(false);
  const [handsDetected, setHandsDetected] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [currentExpression, setCurrentExpression] = useState("Neutral");
  
  // Sensitivity Settings (Now for expression detection)
  const [expressionSensitivity, setExpressionSensitivity] = useState(0.5);

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

  // Remove Three.js initialization as we'll focus on 2D canvas for detailed masking
  
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

      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
          
          // --- Draw Face Mesh ---
          if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
            setFaceDetected(true);
            const landmarks = faceResult.faceLandmarks[0];
            const blendshapes = faceResult.faceBlendshapes?.[0]?.categories || [];

            // Analyze Expression
            const smile = blendshapes.find(c => c.categoryName === 'mouthSmileLeft')?.score || 0;
            const surprise = blendshapes.find(c => c.categoryName === 'eyeWideLeft')?.score || 0;
            const frown = blendshapes.find(c => c.categoryName === 'browDownLeft')?.score || 0;

            let color = 'rgba(0, 255, 255, 0.4)'; // Default Cyan
            let expression = "Neutral";

            if (smile > expressionSensitivity) {
              color = 'rgba(0, 255, 0, 0.6)'; // Green
              expression = "Positive";
            } else if (surprise > expressionSensitivity) {
              color = 'rgba(255, 255, 0, 0.6)'; // Yellow
              expression = "Surprised";
            } else if (frown > expressionSensitivity) {
              color = 'rgba(255, 0, 0, 0.6)'; // Red
              expression = "Focused/Negative";
            }
            setCurrentExpression(expression);

            // Draw Mesh Connections (simplified for performance/visuals)
            ctx.strokeStyle = color;
            ctx.lineWidth = 0.5;
            
            // Draw points
            landmarks.forEach((landmark, i) => {
              if (i % 2 === 0) { // Sparse mesh for "tech" look
                ctx.beginPath();
                ctx.arc(landmark.x * VIDEO_WIDTH, landmark.y * VIDEO_HEIGHT, 1, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
              }
            });

            // Draw specific features (eyes, mouth)
            const drawFeature = (indices: number[]) => {
              ctx.beginPath();
              ctx.moveTo(landmarks[indices[0]].x * VIDEO_WIDTH, landmarks[indices[0]].y * VIDEO_HEIGHT);
              indices.forEach(idx => {
                ctx.lineTo(landmarks[idx].x * VIDEO_WIDTH, landmarks[idx].y * VIDEO_HEIGHT);
              });
              ctx.closePath();
              ctx.stroke();
            };

            // Lips
            drawFeature([61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291]);
            // Eyes
            drawFeature([33, 7, 163, 144, 145, 153, 154, 155, 133]);
            drawFeature([362, 382, 381, 380, 374, 373, 390, 249, 263]);
          } else {
            setFaceDetected(false);
            setCurrentExpression("None");
          }

          // --- Draw Hand Skeleton ---
          if (handResult.landmarks && handResult.landmarks.length > 0) {
            setHandsDetected(handResult.landmarks.length);
            handResult.landmarks.forEach((handLandmarks) => {
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
              ctx.lineWidth = 2;
              
              // Draw connections
              const connections = [
                [0, 1, 2, 3, 4], // Thumb
                [0, 5, 6, 7, 8], // Index
                [0, 9, 10, 11, 12], // Middle
                [0, 13, 14, 15, 16], // Ring
                [0, 17, 18, 19, 20], // Pinky
                [5, 9, 13, 17] // Palm
              ];

              connections.forEach(chain => {
                ctx.beginPath();
                ctx.moveTo(handLandmarks[chain[0]].x * VIDEO_WIDTH, handLandmarks[chain[0]].y * VIDEO_HEIGHT);
                chain.forEach(idx => {
                  ctx.lineTo(handLandmarks[idx].x * VIDEO_WIDTH, handLandmarks[idx].y * VIDEO_HEIGHT);
                });
                ctx.stroke();
              });

              // Draw joints
              handLandmarks.forEach(landmark => {
                ctx.beginPath();
                ctx.arc(landmark.x * VIDEO_WIDTH, landmark.y * VIDEO_HEIGHT, 3, 0, Math.PI * 2);
                ctx.fillStyle = '#00ffff';
                ctx.fill();
              });
            });
          } else {
            setHandsDetected(0);
          }
        }
      }

      animationFrameId = requestAnimationFrame(detect);
    };

    detect();
    return () => cancelAnimationFrame(animationFrameId);
  }, [faceLandmarker, handLandmarker, isLoaded, expressionSensitivity]);

  // Start Camera
  useEffect(() => {
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
        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
        className="absolute left-0 w-full h-[1px] bg-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.3)] z-20 pointer-events-none"
      />

      {/* Main Canvas Overlay */}
      <canvas
        ref={canvasRef}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        className="absolute w-full h-full pointer-events-none z-30"
        style={{ transform: 'scaleX(-1)' }}
      />

      {/* UI Overlay */}
      <div className="absolute top-0 left-0 w-full p-8 flex justify-between items-start pointer-events-none">
        <motion.div 
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="flex flex-col gap-2"
        >
          <h1 className="text-4xl font-black text-cyan-500 tracking-tighter uppercase italic flex items-center gap-3">
            <Cpu className="text-cyan-400" /> Neural Interface
          </h1>
          <div className="flex items-center gap-2 text-cyan-500/70 font-mono text-xs uppercase tracking-widest">
            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            Biometric Stream Active
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
            label="Face Mesh" 
            color="bg-cyan-600"
          />
          <StatusIndicator 
            active={currentExpression !== "None" && currentExpression !== "Neutral"} 
            icon={<Activity size={16} />} 
            label="Expression" 
            color="bg-purple-600"
            subLabel={currentExpression}
          />
          <StatusIndicator 
            active={handsDetected > 0} 
            icon={<Fingerprint size={16} />} 
            label="Hand Tracking" 
            color="bg-emerald-500"
            subLabel={`${handsDetected} Active`}
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
              <h3 className="text-sm font-bold uppercase tracking-widest text-cyan-500">System Calibration</h3>
              <button onClick={() => setShowSettings(false)} className="text-white/30 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-8">
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-white/50">Expression Sensitivity</label>
                  <span className="text-[10px] font-mono text-cyan-500">{(expressionSensitivity * 100).toFixed(0)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0.1" 
                  max="0.9" 
                  step="0.05"
                  value={expressionSensitivity}
                  onChange={(e) => setExpressionSensitivity(parseFloat(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-cyan-600"
                />
                <p className="text-[9px] text-white/30 italic">Determines how intense an expression must be to trigger a color shift.</p>
              </div>
            </div>

            <button 
              onClick={() => {
                setExpressionSensitivity(0.5);
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
            <p className="text-cyan-500 font-mono text-sm tracking-widest uppercase">
              Initializing Neural Interface...
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 pointer-events-none z-40"
          >
            {/* Expression Label Floating */}
            {faceDetected && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute top-1/4 left-1/2 -translate-x-1/2 px-6 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full backdrop-blur-xl"
              >
                <span className="text-cyan-400 font-mono text-xs uppercase tracking-[0.5em]">{currentExpression}</span>
              </motion.div>
            )}
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
              className="px-6 py-3 bg-cyan-900/20 border border-cyan-500/50 rounded-xl backdrop-blur-xl"
            >
              <p className="text-cyan-400 font-mono text-xs uppercase tracking-[0.3em] animate-pulse">
                Scanning for Biometric Data...
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
              <div className="px-4 py-2 bg-black/50 border border-cyan-900/30 rounded-full backdrop-blur-md">
                <p className="text-white/70 font-mono text-[10px] uppercase tracking-widest text-center">
                  Smile, Frown, or Look Surprised to shift Neural Mesh
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StatusIndicator({ active, icon, label, color, subLabel }: { active: boolean, icon: React.ReactNode, label: string, color: string, subLabel?: string }) {
  return (
    <motion.div 
      animate={{ 
        scale: active ? 1.05 : 1,
        backgroundColor: active ? 'rgba(6, 182, 212, 0.1)' : 'rgba(0, 0, 0, 0.5)'
      }}
      className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${active ? 'border-cyan-500/50' : 'border-white/10'} backdrop-blur-md transition-colors min-w-[160px]`}
    >
      <div className={`p-1.5 rounded-md ${active ? color : 'bg-white/10'} text-white`}>
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-widest text-white/50 font-bold">{label}</span>
        <span className={`text-xs font-mono ${active ? 'text-white' : 'text-white/30'}`}>
          {subLabel || (active ? 'ACTIVE' : 'STANDBY')}
        </span>
      </div>
    </motion.div>
  );
}
