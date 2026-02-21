
import * as THREE from 'three';

export class LaserEffect {
  private group: THREE.Group;
  private beams: THREE.Mesh[] = [];
  private glow: THREE.Mesh[] = [];
  private active: boolean = false;
  private intensity: number = 0;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    // Create two beams (one for each eye)
    for (let i = 0; i < 2; i++) {
      const beamGeom = new THREE.CylinderGeometry(0.05, 0.05, 100, 8);
      beamGeom.rotateX(Math.PI / 2);
      beamGeom.translate(0, 0, 50);
      
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.8,
      });
      
      const beam = new THREE.Mesh(beamGeom, beamMat);
      this.beams.push(beam);
      this.group.add(beam);

      // Outer glow
      const glowGeom = new THREE.CylinderGeometry(0.15, 0.15, 100, 8);
      glowGeom.rotateX(Math.PI / 2);
      glowGeom.translate(0, 0, 50);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xff3300,
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
      });
      const g = new THREE.Mesh(glowGeom, glowMat);
      this.glow.push(g);
      this.group.add(g);
    }

    this.group.visible = false;
  }

  update(eyePositions: THREE.Vector3[], isActive: boolean) {
    this.active = isActive;
    
    if (this.active) {
      this.intensity = THREE.MathUtils.lerp(this.intensity, 1, 0.1);
    } else {
      this.intensity = THREE.MathUtils.lerp(this.intensity, 0, 0.2);
    }

    this.group.visible = this.intensity > 0.01;
    
    if (this.group.visible && eyePositions.length >= 2) {
      for (let i = 0; i < 2; i++) {
        this.beams[i].position.copy(eyePositions[i]);
        this.glow[i].position.copy(eyePositions[i]);
        
        const scale = this.intensity * (1 + Math.sin(Date.now() * 0.05) * 0.1);
        this.beams[i].scale.set(scale, scale, 1);
        this.glow[i].scale.set(scale * 1.5, scale * 1.5, 1);
        
        // Point lasers forward (away from the face)
        // In this coordinate system, Z decreases as we go "into" the screen
        this.beams[i].lookAt(eyePositions[i].x, eyePositions[i].y, eyePositions[i].z - 10);
        this.glow[i].lookAt(eyePositions[i].x, eyePositions[i].y, eyePositions[i].z - 10);
      }
    }
  }
}
