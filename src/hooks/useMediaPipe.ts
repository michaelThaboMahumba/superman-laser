
import { useEffect, useRef, useState } from 'react';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export function useMediaPipe() {
  const [handLandmarker, setHandLandmarker] = useState<HandLandmarker | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function init() {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      const hands = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 2
      });

      setHandLandmarker(hands);
      setIsLoaded(true);
    }
    init();
  }, []);

  return { handLandmarker, isLoaded };
}
