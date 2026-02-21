
import * as THREE from 'three';

export class ExplosionEffect {
  private particles: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  private active: boolean = false;
  private startTime: number = 0;
  private duration: number = 1000; // ms

  constructor(scene: THREE.Scene) {
    const count = 500;
    this.geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 0.05 + Math.random() * 0.15;
      
      velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      velocities[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed;
      velocities[i * 3 + 2] = Math.cos(phi) * speed;

      colors[i * 3] = 1; // R
      colors[i * 3 + 1] = 0.5 + Math.random() * 0.5; // G
      colors[i * 3 + 2] = 0; // B
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.material = new THREE.PointsMaterial({
      size: 0.2,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
    });

    this.particles = new THREE.Points(this.geometry, this.material);
    this.particles.visible = false;
    scene.add(this.particles);
  }

  trigger(position: THREE.Vector3) {
    this.active = true;
    this.startTime = Date.now();
    this.particles.visible = true;
    this.particles.position.copy(position);
    
    // Reset positions
    const posAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < posAttr.count; i++) {
      posAttr.setXYZ(i, 0, 0, 0);
    }
    posAttr.needsUpdate = true;
    this.material.opacity = 1;
  }

  update() {
    if (!this.active) return;

    const elapsed = Date.now() - this.startTime;
    const progress = elapsed / this.duration;

    if (progress >= 1) {
      this.active = false;
      this.particles.visible = false;
      return;
    }

    const posAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const velAttr = this.geometry.getAttribute('velocity') as THREE.BufferAttribute;

    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i) + velAttr.getX(i);
      const y = posAttr.getY(i) + velAttr.getY(i);
      const z = posAttr.getZ(i) + velAttr.getZ(i);
      posAttr.setXYZ(i, x, y, z);
    }
    posAttr.needsUpdate = true;
    
    this.material.opacity = 1 - progress;
    this.particles.scale.setScalar(1 + progress * 2);
  }
}
