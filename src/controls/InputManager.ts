import { KeyboardControls } from './KeyboardControls';

export interface TouchInputState {
  throttle: boolean;
  brake: boolean;
  steerLeft: boolean;
  steerRight: boolean;
  wheelie: boolean;
}

export class InputManager {
  public readonly keyboard = new KeyboardControls();
  private touchState: TouchInputState = {
    throttle: false,
    brake: false,
    steerLeft: false,
    steerRight: false,
    wheelie: false,
  };

  attach(): void {
    this.keyboard.attach();
  }

  detach(): void {
    this.keyboard.detach();
    this.clearTouch();
  }

  setTouchControl(control: keyof TouchInputState, pressed: boolean): void {
    this.touchState[control] = pressed;
  }

  clearAll(): void {
    this.keyboard.clearHeld();
    this.clearTouch();
  }

  clearTouch(): void {
    this.touchState.throttle = false;
    this.touchState.brake = false;
    this.touchState.steerLeft = false;
    this.touchState.steerRight = false;
    this.touchState.wheelie = false;
  }

  getThrottle(): boolean {
    return this.touchState.throttle || this.keyboard.isThrottle();
  }

  getBrake(): boolean {
    return this.touchState.brake || this.keyboard.isBrake();
  }

  getSteerLeft(): boolean {
    return this.touchState.steerLeft || this.keyboard.isSteerLeft();
  }

  getSteerRight(): boolean {
    return this.touchState.steerRight || this.keyboard.isSteerRight();
  }

  getWheelie(): boolean {
    return this.touchState.wheelie || this.keyboard.isWheelie();
  }
}
