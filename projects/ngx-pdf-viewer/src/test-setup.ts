/**
 * Global test setup: minimal shims for canvas geometry APIs that the rendering
 * paths under test touch but that jsdom does not implement.
 */

class DOMMatrixShim {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;

  constructor(init?: string | number[]) {
    if (typeof init === 'string') return;
    if (Array.isArray(init)) {
      const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = init;
      this.a = a;
      this.b = b;
      this.c = c;
      this.d = d;
      this.e = e;
      this.f = f;
    }
  }

  static fromMatrix(matrix?: DOMMatrixShim): DOMMatrixShim {
    const next = new DOMMatrixShim();
    if (matrix) Object.assign(next, matrix);
    return next;
  }

  multiply(): DOMMatrixShim {
    return new DOMMatrixShim();
  }

  translate(): DOMMatrixShim {
    return new DOMMatrixShim();
  }

  scale(): DOMMatrixShim {
    return new DOMMatrixShim();
  }

  rotate(): DOMMatrixShim {
    return new DOMMatrixShim();
  }

  inverse(): DOMMatrixShim {
    return new DOMMatrixShim();
  }

  transformPoint(point?: { x?: number; y?: number }): { x: number; y: number; z: number; w: number } {
    return { x: point?.x ?? 0, y: point?.y ?? 0, z: 0, w: 1 };
  }
}

class Path2DShim {
  addPath(): void {}
  moveTo(): void {}
  lineTo(): void {}
  bezierCurveTo(): void {}
  quadraticCurveTo(): void {}
  closePath(): void {}
  rect(): void {}
  arc(): void {}
  arcTo(): void {}
  ellipse(): void {}
}

const globals = globalThis as unknown as Record<string, unknown>;
globals['DOMMatrix'] ??= DOMMatrixShim;
globals['Path2D'] ??= Path2DShim;

export {};
