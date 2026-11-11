import * as THREE from "three";
import { clamp, lerp } from "./utils.js";

const EASE_IN_OUT = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export class IslandControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.dom = domElement;

    this.current = { theta: 0.08, phi: 0.93, radius: 101 };
    this.desired = { theta: 0.08, phi: 0.93, radius: 101 };
    this.target = new THREE.Vector3(0, 7, 3);
    this.desiredTarget = this.target.clone();

    this.flight = null;
    this.autoSpin = false;
    this.enabled = true;
    this.pointers = new Map();
    this.pinchDistance = 0;
    this.dragging = false;

    this._previous = { theta: 0, phi: 0, radius: 0 };
    this._firstFrame = true;
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onWheel = this._onWheel.bind(this);

    this.dom.addEventListener("pointerdown", this._onPointerDown);
    this.dom.addEventListener("pointermove", this._onPointerMove);
    this.dom.addEventListener("pointerup", this._onPointerUp);
    this.dom.addEventListener("pointercancel", this._onPointerUp);
    this.dom.addEventListener("wheel", this._onWheel, { passive: false });
    this.dom.addEventListener("contextmenu", (event) => event.preventDefault());

    this.applyCamera();
  }

  setPose(pose, instant = true) {
    this.flight = null;
    this._readPose(pose);
    if (instant) {
      this.current.theta = this.desired.theta;
      this.current.phi = this.desired.phi;
      this.current.radius = this.desired.radius;
      this.target.copy(this.desiredTarget);
      this._firstFrame = true;
      this.applyCamera();
    }
  }

  flyTo(pose, duration = 1.85) {
    if (this.flight) this.flight = null;

    let endTheta = pose.theta ?? this.current.theta;
    while (endTheta - this.current.theta > Math.PI) endTheta -= Math.PI * 2;
    while (endTheta - this.current.theta < -Math.PI) endTheta += Math.PI * 2;

    const endTarget = pose.target
      ? new THREE.Vector3().fromArray(pose.target)
      : this.target.clone();

    this.autoSpin = false;
    this.flight = {
      time: 0,
      duration,
      start: {
        theta: this.current.theta,
        phi: this.current.phi,
        radius: this.current.radius,
        target: this.target.clone(),
      },
      end: {
        theta: endTheta,
        phi: pose.phi ?? this.current.phi,
        radius: pose.radius ?? this.current.radius,
        target: endTarget,
      },
      arc: clamp(this.target.distanceTo(endTarget) * 0.1, 1.2, 9),
    };
    this.desired.theta = endTheta;
    this.desired.phi = this.flight.end.phi;
    this.desired.radius = this.flight.end.radius;
    this.desiredTarget.copy(endTarget);
    this._firstFrame = true;
  }

  _readPose(pose) {
    if (pose.target) this.desiredTarget.fromArray(pose.target);
    if (pose.theta !== undefined) this.desired.theta = pose.theta;
    if (pose.phi !== undefined) this.desired.phi = clamp(pose.phi, 0.32, 1.22);
    if (pose.radius !== undefined) this.desired.radius = clamp(pose.radius, 30, 138);
  }

  update(dt) {
    if (!this.enabled) return false;

    const previousTheta = this.current.theta;
    const previousPhi = this.current.phi;
    const previousRadius = this.current.radius;
    const previousTarget = this.target.clone();

    if (this.flight) {
      const flight = this.flight;
      flight.time += dt;
      const raw = clamp(flight.time / flight.duration, 0, 1);
      const eased = EASE_IN_OUT(raw);
      this.current.theta = lerp(flight.start.theta, flight.end.theta, eased);
      this.current.phi = lerp(flight.start.phi, flight.end.phi, eased);
      this.current.radius =
        lerp(flight.start.radius, flight.end.radius, eased) +
        Math.sin(eased * Math.PI) * flight.arc;
      this.target.lerpVectors(flight.start.target, flight.end.target, eased);

      if (raw >= 1) {
        this.current.theta = flight.end.theta;
        this.current.phi = flight.end.phi;
        this.current.radius = flight.end.radius;
        this.target.copy(flight.end.target);
        this.desired.theta = this.current.theta;
        this.desired.phi = this.current.phi;
        this.desired.radius = this.current.radius;
        this.desiredTarget.copy(this.target);
        this.flight = null;
      }
    } else {
      if (this.autoSpin) {
        this.desired.theta += dt * 0.028;
      }

      const ease = 1 - Math.exp(-7.5 * dt);
      this.current.theta = lerp(this.current.theta, this.desired.theta, ease);
      this.current.phi = lerp(this.current.phi, this.desired.phi, ease);
      this.current.radius = lerp(this.current.radius, this.desired.radius, ease);
      this.target.lerp(this.desiredTarget, ease);

      if (Math.abs(this.current.theta - this.desired.theta) < 1e-4) {
        this.current.theta = this.desired.theta;
      }
      if (Math.abs(this.current.phi - this.desired.phi) < 1e-4) {
        this.current.phi = this.desired.phi;
      }
      if (Math.abs(this.current.radius - this.desired.radius) < 1e-3) {
        this.current.radius = this.desired.radius;
      }
      if (this.target.distanceToSquared(this.desiredTarget) < 1e-6) {
        this.target.copy(this.desiredTarget);
      }
    }

    this.applyCamera();

    const moved =
      this._firstFrame ||
      Math.abs(this.current.theta - previousTheta) > 1e-6 ||
      Math.abs(this.current.phi - previousPhi) > 1e-6 ||
      Math.abs(this.current.radius - previousRadius) > 1e-5 ||
      this.target.distanceToSquared(previousTarget) > 1e-100;

    if (this._firstFrame) this._firstFrame = false;
    return moved;
  }

  applyCamera() {
    const sinPhi = Math.sin(this.current.phi);
    const x = this.target.x + this.current.radius * sinPhi * Math.sin(this.current.theta);
    const y = this.target.y + this.current.radius * Math.cos(this.current.phi);
    const z = this.target.z + this.current.radius * sinPhi * Math.cos(this.current.theta);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.target);
  }

  _cancelFlight() {
    if (!this.flight) return;
    this.desired.theta = this.current.theta;
    this.desired.phi = this.current.phi;
    this.desired.radius = this.current.radius;
    this.desiredTarget.copy(this.target);
    this.flight = null;
  }

  _onPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    this._cancelFlight();
    this.autoSpin = false;
    this.dom.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    this.dragging = true;
    this.dom.classList.add("is-dragging");
    this.pinchDistance = 0;
  }

  _onPointerMove(event) {
    const pointer = this.pointers.get(event.pointerId);
    if (!pointer) return;

    const previousX = pointer.x;
    const previousY = pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;

    if (this.pointers.size === 2) {
      const [first, second] = [...this.pointers.values()];
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      if (this.pinchDistance > 0) {
        const scale = this.pinchDistance / Math.max(distance, 1);
        this.desired.radius = clamp(this.desired.radius * scale, 30, 138);
      }
      this.pinchDistance = distance;
      this._cancelFlight();
      return;
    }

    if (this.pointers.size === 1 && this.dragging) {
      const dx = event.clientX - previousX;
      const dy = event.clientY - previousY;
      this.desired.theta -= dx * 0.0042;
      this.desired.phi = clamp(this.desired.phi - dy * 0.0034, 0.3, 1.2);
      this._cancelFlight();
    }
  }

  _onPointerUp(event) {
    this.pointers.delete(event.pointerId);
    if (this.pointers.size === 0) {
      this.dragging = false;
      this.pinchDistance = 0;
      this.dom.classList.remove("is-dragging");
    }
    if (this.pointers.size < 2) this.pinchDistance = 0;
    if (this.dom.hasPointerCapture(event.pointerId)) {
      this.dom.releasePointerCapture(event.pointerId);
    }
  }

  _onWheel(event) {
    event.preventDefault();
    this._cancelFlight();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : 1);
    this.desired.radius = clamp(this.desired.radius * Math.exp(delta * 0.0011), 30, 138);
  }

  dispose() {
    this.dom.removeEventListener("pointerdown", this._onPointerDown);
    this.dom.removeEventListener("pointermove", this._onPointerMove);
    this.dom.removeEventListener("pointerup", this._onPointerUp);
    this.dom.removeEventListener("pointercancel", this._onPointerUp);
    this.dom.removeEventListener("wheel", this._onWheel);
  }
}
