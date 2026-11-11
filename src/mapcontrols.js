import * as THREE from "three";
import { clamp, damp } from "./utils.js";

const DEG = Math.PI / 180;

export class MapControls {
  constructor(camera, domElement, options = {}) {
    this.camera = camera;
    this.dom = domElement;
    this.enabled = false;

    this.target = new THREE.Vector3(...(options.target ?? [0, 1.2, 4]));
    this.desiredTarget = this.target.clone();
    this.homeTarget = this.target.clone();
    this.distance = options.distance ?? 158;
    this.desiredDistance = this.distance;
    this.homeDistance = this.distance;
    this.yaw = options.yaw ?? 0.66;
    this.desiredYaw = this.yaw;
    this.homeYaw = this.yaw;
    this.pitch = options.pitch ?? 0.88;
    this.desiredPitch = this.pitch;
    this.homePitch = this.pitch;
    this.minDistance = options.minDistance ?? 32;
    this.maxDistance = options.maxDistance ?? 235;

    this.pointers = new Map();
    this.mode = null;
    this.lastX = 0;
    this.lastY = 0;
    this.pinchDistance = 0;
    this.pinchCenter = { x: 0, y: 0 };
    this.keys = new Set();
    this.moving = false;

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onContextMenu = (event) => event.preventDefault();

    domElement.addEventListener("pointerdown", this.onPointerDown);
    domElement.addEventListener("pointermove", this.onPointerMove);
    domElement.addEventListener("pointerup", this.onPointerUp);
    domElement.addEventListener("pointercancel", this.onPointerUp);
    domElement.addEventListener("wheel", this.onWheel, { passive: false });
    domElement.addEventListener("contextmenu", this.onContextMenu);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);

    this.updateCamera();
  }

  screenDelta(dx, dy) {
    const height = Math.max(window.innerHeight, 1);
    const scale = (2 * this.distance * Math.tan(this.camera.fov * 0.5 * DEG)) / height;
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    right.y = 0;
    right.normalize();
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    this.desiredTarget.addScaledVector(right, -dx * scale);
    this.desiredTarget.addScaledVector(forward, dy * scale);
  }

  onPointerDown(event) {
    if (!this.enabled) return;
    if (event.pointerType === "mouse" && event.button !== 0 && event.button !== 2) return;
    this.dom.setPointerCapture?.(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.dom.classList.add("is-dragging");
    this.mode = this.pointers.size >= 2 ? "pinch" : event.button === 2 || event.shiftKey ? "rotate" : "pan";
    this.lastX = event.clientX;
    this.lastY = event.clientY;

    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
      this.pinchCenter = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  }

  onPointerMove(event) {
    if (!this.enabled || !this.pointers.has(event.pointerId)) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (this.pinchDistance > 0) {
        const ratio = this.pinchDistance / Math.max(distance, 1);
        this.desiredDistance = clamp(
          this.desiredDistance * ratio,
          this.minDistance,
          this.maxDistance,
        );
        this.screenDelta(center.x - this.pinchCenter.x, center.y - this.pinchCenter.y);
      }
      this.pinchDistance = distance;
      this.pinchCenter = center;
      return;
    }

    const dx = event.clientX - this.lastX;
    const dy = event.clientY - this.lastY;
    this.lastX = event.clientX;
    this.lastY = event.clientY;

    if (this.mode === "rotate") {
      this.desiredYaw -= dx * 0.006;
      this.desiredPitch = clamp(this.desiredPitch + dy * 0.0045, 0.45, 1.28);
    } else {
      this.screenDelta(dx, dy);
    }
  }

  onPointerUp(event) {
    this.pointers.delete(event.pointerId);
    this.dom.releasePointerCapture?.(event.pointerId);
    if (this.pointers.size === 0) {
      this.mode = null;
      this.dom.classList.remove("is-dragging");
    } else if (this.pointers.size === 1) {
      const [remaining] = [...this.pointers.values()];
      this.lastX = remaining.x;
      this.lastY = remaining.y;
      this.mode = "pan";
      this.pinchDistance = 0;
    }
  }

  onWheel(event) {
    if (!this.enabled) return;
    event.preventDefault();
    this.desiredDistance = clamp(
      this.desiredDistance * Math.exp(event.deltaY * 0.00115),
      this.minDistance,
      this.maxDistance,
    );
  }

  onKeyDown(event) {
    if (!this.enabled) return;
    const target = event.target;
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable)
    ) {
      return;
    }
    const key = event.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      event.preventDefault();
      this.keys.add(key);
    }
  }

  onKeyUp(event) {
    this.keys.delete(event.key.toLowerCase());
  }

  zoomBy(factor) {
    this.desiredDistance = clamp(this.desiredDistance * factor, this.minDistance, this.maxDistance);
  }

  flyTo(target, distance = this.distance, { instant = false } = {}) {
    this.desiredTarget.set(target[0], target[1], target[2]);
    this.desiredDistance = clamp(distance, this.minDistance, this.maxDistance);
    if (instant) {
      this.target.copy(this.desiredTarget);
      this.distance = this.desiredDistance;
      this.updateCamera();
    }
  }

  setPose(pose, { instant = false } = {}) {
    this.homeTarget.set(pose.target[0], pose.target[1], pose.target[2]);
    this.homeDistance = pose.distance;
    this.homeYaw = pose.yaw ?? this.homeYaw;
    this.homePitch = pose.pitch ?? this.homePitch;
    this.yaw = this.desiredYaw = this.homeYaw;
    this.pitch = this.desiredPitch = this.homePitch;
    this.flyTo(pose.target, pose.distance, { instant });
    if (instant) {
      this.target.copy(this.desiredTarget);
      this.distance = this.desiredDistance;
      this.yaw = this.desiredYaw;
      this.pitch = this.desiredPitch;
      this.updateCamera();
    }
  }

  reset({ instant = false } = {}) {
    this.desiredYaw = this.homeYaw;
    this.desiredPitch = this.homePitch;
    this.flyTo(this.homeTarget.toArray(), this.homeDistance, { instant });
    if (instant) {
      this.yaw = this.desiredYaw;
      this.pitch = this.desiredPitch;
      this.updateCamera();
    }
  }

  update(dt) {
    if (!this.enabled) {
      this.moving = false;
      return;
    }

    const keySpeed = this.distance * 0.75 * dt;
    if (this.keys.size > 0) {
      const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
      right.y = 0;
      right.normalize();
      const forward = new THREE.Vector3();
      this.camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      if (this.keys.has("w") || this.keys.has("arrowup")) this.desiredTarget.addScaledVector(forward, keySpeed);
      if (this.keys.has("s") || this.keys.has("arrowdown")) this.desiredTarget.addScaledVector(forward, -keySpeed);
      if (this.keys.has("a") || this.keys.has("arrowleft")) this.desiredTarget.addScaledVector(right, -keySpeed);
      if (this.keys.has("d") || this.keys.has("arrowright")) this.desiredTarget.addScaledVector(right, keySpeed);
    }

    const previous = this.target.clone();
    const previousDistance = this.distance;
    this.target.x = damp(this.target.x, this.desiredTarget.x, 9, dt);
    this.target.y = damp(this.target.y, this.desiredTarget.y, 9, dt);
    this.target.z = damp(this.target.z, this.desiredTarget.z, 9, dt);
    this.distance = damp(this.distance, this.desiredDistance, 8, dt);
    this.yaw = damp(this.yaw, this.desiredYaw, 10, dt);
    this.pitch = damp(this.pitch, this.desiredPitch, 10, dt);

    this.moving =
      previous.distanceToSquared(this.target) > 0.0001 ||
      Math.abs(previousDistance - this.distance) > 0.01 ||
      this.pointers.size > 0 ||
      this.keys.size > 0;

    this.updateCamera();
  }

  updateCamera() {
    const horizontal = Math.cos(this.pitch) * this.distance;
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * horizontal,
      this.target.y + Math.sin(this.pitch) * this.distance,
      this.target.z + Math.cos(this.yaw) * horizontal,
    );
    this.camera.lookAt(this.target);
  }

  dispose() {
    this.dom.removeEventListener("pointerdown", this.onPointerDown);
    this.dom.removeEventListener("pointermove", this.onPointerMove);
    this.dom.removeEventListener("pointerup", this.onPointerUp);
    this.dom.removeEventListener("pointercancel", this.onPointerUp);
    this.dom.removeEventListener("wheel", this.onWheel);
    this.dom.removeEventListener("contextmenu", this.onContextMenu);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }
}
