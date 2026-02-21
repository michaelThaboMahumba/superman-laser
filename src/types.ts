
import * as THREE from 'three';

export interface Point {
  x: number;
  y: number;
  z: number;
}

export interface DetectionResult {
  faceLandmarks: Point[][];
  handLandmarks: Point[][];
}

export const VIDEO_WIDTH = 1280;
export const VIDEO_HEIGHT = 720;
