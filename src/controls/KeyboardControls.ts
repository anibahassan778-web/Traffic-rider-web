export class KeyboardControls {
  private held = new Set<string>();
  private pauseJustPressed = false;
  private startJustPressed = false;
  private muteJustPressed = false;
  private hornJustPressed = false;

  private onKeyDown = (e: KeyboardEvent): void => {
    const code = e.code;
    if (
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight' ||
      code === 'Space'
    ) {
      e.preventDefault();
    }

    if (!e.repeat) {
      if (code === 'Escape' || code === 'KeyP') {
        this.pauseJustPressed = true;
      }
      if (code === 'Enter' || code === 'Space') {
        this.startJustPressed = true;
      }
      if (code === 'KeyM') {
        this.muteJustPressed = true;
      }
      if (code === 'KeyH') {
        this.hornJustPressed = true;
      }
    }

    this.held.add(code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.held.delete(e.code);
  };

  private onBlurOrHide = (): void => {
    this.held.clear();
  };

  attach(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlurOrHide);
    document.addEventListener('visibilitychange', this.onBlurOrHide);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlurOrHide);
    document.removeEventListener('visibilitychange', this.onBlurOrHide);
    this.held.clear();
  }

  clearHeld(): void {
    this.held.clear();
  }

  isThrottle(): boolean {
    return this.held.has('KeyW') || this.held.has('ArrowUp');
  }

  isBrake(): boolean {
    return this.held.has('KeyS') || this.held.has('ArrowDown');
  }

  isSteerLeft(): boolean {
    return this.held.has('KeyA') || this.held.has('ArrowLeft');
  }

  isSteerRight(): boolean {
    return this.held.has('KeyD') || this.held.has('ArrowRight');
  }

  isWheelie(): boolean {
    return (
      this.held.has('Space') ||
      this.held.has('ShiftLeft') ||
      this.held.has('ShiftRight')
    );
  }

  consumePause(): boolean {
    const v = this.pauseJustPressed;
    this.pauseJustPressed = false;
    return v;
  }

  consumeStart(): boolean {
    const v = this.startJustPressed;
    this.startJustPressed = false;
    return v;
  }

  consumeMute(): boolean {
    const v = this.muteJustPressed;
    this.muteJustPressed = false;
    return v;
  }

  consumeHorn(): boolean {
    const v = this.hornJustPressed;
    this.hornJustPressed = false;
    return v;
  }
}
