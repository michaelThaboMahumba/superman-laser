
import { useEffect, useState } from 'react';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-converter';

export function useTFJS() {
  const [detector, setDetector] = useState<faceLandmarksDetection.FaceLandmarksDetector | null>(null);
  const [isTFJSLoaded, setIsTFJSLoaded] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
        const detectorConfig = {
          runtime: 'tfjs', // or 'mediapipe'
          refineLandmarks: true,
        };
        const newDetector = await faceLandmarksDetection.createDetector(model, detectorConfig as any);
        setDetector(newDetector);
        setIsTFJSLoaded(true);
      } catch (error) {
        console.error("TFJS Initialization Error:", error);
      }
    }
    init();
  }, []);

  return { detector, isTFJSLoaded };
}
