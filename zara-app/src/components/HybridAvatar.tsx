import { useEffect, useRef } from 'react';
import type { ZaraStatus } from '../types';

interface Props {
  status: ZaraStatus;
}

type Mesh = { vertices: Float32Array; normals: Float32Array; indices: Uint16Array };

function createSphere(): Mesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const rows = 28;
  const columns = 36;

  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    const theta = v * Math.PI;
    for (let column = 0; column <= columns; column += 1) {
      const u = column / columns;
      const phi = u * Math.PI * 2;
      const x = Math.sin(theta) * Math.cos(phi);
      const y = Math.cos(theta);
      const z = Math.sin(theta) * Math.sin(phi);
      positions.push(x, y, z);
      normals.push(x, y, z);
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = row * (columns + 1) + column;
      const b = a + columns + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }

  return {
    vertices: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
  };
}

function identity(): Float32Array {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function multiply(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[column * 4 + row] =
        a[row] * b[column * 4] +
        a[4 + row] * b[column * 4 + 1] +
        a[8 + row] * b[column * 4 + 2] +
        a[12 + row] * b[column * 4 + 3];
    }
  }
  return out;
}

function translation(x: number, y: number, z: number): Float32Array {
  const out = identity();
  out[12] = x;
  out[13] = y;
  out[14] = z;
  return out;
}

function scaling(x: number, y: number, z: number): Float32Array {
  const out = identity();
  out[0] = x;
  out[5] = y;
  out[10] = z;
  return out;
}

function rotationX(angle: number): Float32Array {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
}

function rotationY(angle: number): Float32Array {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
}

function rotationZ(angle: number): Float32Array {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function modelMatrix(
  x: number, y: number, z: number,
  sx: number, sy: number, sz: number,
  rx = 0, ry = 0, rz = 0,
): Float32Array {
  let out = translation(x, y, z);
  out = multiply(out, rotationY(ry));
  out = multiply(out, rotationX(rx));
  out = multiply(out, rotationZ(rz));
  return multiply(out, scaling(sx, sy, sz));
}

function perspective(fov: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1 / Math.tan(fov / 2);
  const range = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (near + far) * range, -1,
    0, 0, near * far * range * 2, 0,
  ]);
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Could not create the ZARA avatar shader.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'Avatar shader compilation failed.';
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, [
    'attribute vec3 aPosition;',
    'attribute vec3 aNormal;',
    'uniform mat4 uMvp;',
    'uniform mat4 uModel;',
    'varying vec3 vNormal;',
    'varying vec3 vPosition;',
    'void main(){',
    ' vec4 world = uModel * vec4(aPosition, 1.0);',
    ' vPosition = world.xyz;',
    ' vNormal = normalize(mat3(uModel) * aNormal);',
    ' gl_Position = uMvp * vec4(aPosition, 1.0);',
    '}',
  ].join('\n'));
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, [
    'precision mediump float;',
    'uniform vec3 uColor;',
    'uniform float uGlow;',
    'varying vec3 vNormal;',
    'varying vec3 vPosition;',
    'void main(){',
    ' vec3 n = normalize(vNormal);',
    ' vec3 light = normalize(vec3(-0.45, 0.75, 1.0));',
    ' float diffuse = max(dot(n, light), 0.0);',
    ' vec3 viewDir = normalize(vec3(0.0, 0.35, 6.0) - vPosition);',
    ' vec3 halfDir = normalize(light + viewDir);',
    ' float specular = pow(max(dot(n, halfDir), 0.0), 34.0);',
    ' float rim = pow(1.0 - max(dot(n, viewDir), 0.0), 2.0);',
    ' vec3 color = uColor * (0.34 + diffuse * 0.76);',
    ' color += vec3(0.42, 0.66, 1.0) * (specular * 0.72 + rim * 0.35);',
    ' color += uColor * uGlow;',
    ' gl_FragColor = vec4(color, 1.0);',
    '}',
  ].join('\n'));
  const program = gl.createProgram();
  if (!program) throw new Error('Could not create the ZARA avatar program.');
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || 'Avatar program linking failed.');
  }
  return program;
}

export default function HybridAvatar({ status }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const gl = canvas.getContext('webgl', { alpha: true, antialias: true });
    if (!gl) return undefined;

    let program: WebGLProgram;
    try {
      program = createProgram(gl);
    } catch {
      return undefined;
    }

    const mesh = createSphere();
    const vertexBuffer = gl.createBuffer();
    const normalBuffer = gl.createBuffer();
    const indexBuffer = gl.createBuffer();
    if (!vertexBuffer || !normalBuffer || !indexBuffer) return undefined;

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.normals, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'aPosition');
    const normalLocation = gl.getAttribLocation(program, 'aNormal');
    const mvpLocation = gl.getUniformLocation(program, 'uMvp');
    const modelLocation = gl.getUniformLocation(program, 'uModel');
    const colorLocation = gl.getUniformLocation(program, 'uColor');
    const glowLocation = gl.getUniformLocation(program, 'uGlow');
    const view = translation(0, -0.04, -5.15);
    const start = performance.now();
    let frame = 0;
    let disposed = false;

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 0);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 1.8);
      const width = Math.max(1, Math.round(rect.width * ratio));
      const height = Math.max(1, Math.round(rect.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const drawPart = (
      projection: Float32Array,
      x: number, y: number, z: number,
      sx: number, sy: number, sz: number,
      color: [number, number, number],
      glow = 0,
      rx = 0, ry = 0, rz = 0,
    ) => {
      const model = modelMatrix(x, y, z, sx, sy, sz, rx, ry, rz);
      const mvp = multiply(projection, multiply(view, model));
      gl.uniformMatrix4fv(modelLocation, false, model);
      gl.uniformMatrix4fv(mvpLocation, false, mvp);
      gl.uniform3fv(colorLocation, color);
      gl.uniform1f(glowLocation, glow);
      gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
    };

    const render = (now: number) => {
      if (disposed) return;
      resize();
      const seconds = (now - start) / 1000;
      const currentStatus = statusRef.current;
      const speaking = currentStatus === 'speaking';
      const thinking = currentStatus === 'thinking';
      const listening = currentStatus === 'listening';
      const aspect = canvas.width / Math.max(1, canvas.height);
      const projection = perspective(0.58, aspect, 0.1, 30);
      const breath = Math.sin(seconds * 1.7) * 0.025;
      const headTurn = Math.sin(seconds * 0.62) * 0.08 + (listening ? -0.07 : 0);
      const mouthOpen = speaking ? 0.045 + Math.abs(Math.sin(seconds * 9)) * 0.085 : 0.025;
      const eyeGlow = listening ? 0.65 : thinking ? 0.42 : speaking ? 0.72 : 0.35;

      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
      gl.enableVertexAttribArray(normalLocation);
      gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

      // Neck and layered black-silver chest armor.
      drawPart(projection, 0, -0.26 + breath, 0, 0.27, 0.53, 0.27, [0.55, 0.62, 0.75], 0.08);
      drawPart(projection, 0, -1.04 + breath, 0, 1.02, 0.72, 0.48, [0.09, 0.13, 0.23], 0.08);
      drawPart(projection, 0, -0.83 + breath, 0.37, 0.62, 0.48, 0.19, [0.42, 0.49, 0.62], 0.12, 0.08);
      drawPart(projection, 0, -0.93 + breath, 0.53, 0.22, 0.25, 0.07, [0.08, 0.67, 0.96], 0.9);
      drawPart(projection, -0.78, -0.68 + breath, 0, 0.42, 0.43, 0.49, [0.27, 0.34, 0.49], 0.13, 0, 0, -0.2);
      drawPart(projection, 0.78, -0.68 + breath, 0, 0.42, 0.43, 0.49, [0.27, 0.34, 0.49], 0.13, 0, 0, 0.2);
      drawPart(projection, -0.82, -0.68, 0.36, 0.16, 0.2, 0.13, [0.08, 0.67, 0.96], 0.62);
      drawPart(projection, 0.82, -0.68, 0.36, 0.16, 0.2, 0.13, [0.08, 0.67, 0.96], 0.62);
      drawPart(projection, 0, -0.38, 0.23, 0.42, 0.15, 0.3, [0.12, 0.17, 0.29], 0.2);

      // Face, jaw, ears, and dark swept-back hair.
      drawPart(projection, 0, 0.55, 0, 0.66, 0.91, 0.49, [0.76, 0.59, 0.51], 0.02, 0, headTurn);
      drawPart(projection, 0, 0.13, 0.08, 0.49, 0.36, 0.42, [0.72, 0.53, 0.46], 0.01, 0, headTurn);
      drawPart(projection, -0.62, 0.57, -0.02, 0.19, 0.75, 0.42, [0.035, 0.05, 0.09], 0.05, 0, 0, -0.08);
      drawPart(projection, 0.62, 0.57, -0.02, 0.19, 0.75, 0.42, [0.035, 0.05, 0.09], 0.05, 0, 0, 0.08);
      drawPart(projection, 0, 1.23, -0.03, 0.69, 0.39, 0.52, [0.035, 0.05, 0.09], 0.12, 0, headTurn);
      drawPart(projection, 0, 1.37, 0.08, 0.58, 0.14, 0.45, [0.31, 0.38, 0.52], 0.2, 0, headTurn);
      drawPart(projection, 0, 1.37, 0.46, 0.11, 0.1, 0.055, [0.1, 0.72, 1], 1);

      // Brows, expressive luminous eyes, nose and animated mouth.
      drawPart(projection, -0.25, 0.78, 0.424, 0.22, 0.045, 0.045, [0.18, 0.13, 0.15], 0, 0, 0, -0.08);
      drawPart(projection, 0.25, 0.78, 0.424, 0.22, 0.045, 0.045, [0.18, 0.13, 0.15], 0, 0, 0, 0.08);
      drawPart(projection, -0.25, 0.62, 0.445, 0.13, 0.075, 0.055, [0.12, 0.72, 1], eyeGlow);
      drawPart(projection, 0.25, 0.62, 0.445, 0.13, 0.075, 0.055, [0.12, 0.72, 1], eyeGlow);
      drawPart(projection, -0.25, 0.62, 0.49, 0.035, 0.045, 0.022, [0.015, 0.08, 0.16], 0.12);
      drawPart(projection, 0.25, 0.62, 0.49, 0.035, 0.045, 0.022, [0.015, 0.08, 0.16], 0.12);
      drawPart(projection, 0, 0.42, 0.47, 0.075, 0.17, 0.08, [0.79, 0.61, 0.53], 0.02);
      drawPart(projection, 0, 0.18, 0.49, 0.19, mouthOpen, 0.045, [0.28, 0.055, 0.12], speaking ? 0.18 : 0.02);

      // Silver cheek plates, temple details, and the signature ZARA blue core.
      drawPart(projection, -0.53, 0.32, 0.19, 0.13, 0.28, 0.18, [0.38, 0.45, 0.58], 0.18, 0, 0, -0.18);
      drawPart(projection, 0.53, 0.32, 0.19, 0.13, 0.28, 0.18, [0.38, 0.45, 0.58], 0.18, 0, 0, 0.18);
      drawPart(projection, -0.67, 0.75, 0.05, 0.12, 0.26, 0.2, [0.18, 0.24, 0.37], 0.3);
      drawPart(projection, 0.67, 0.75, 0.05, 0.12, 0.26, 0.2, [0.18, 0.24, 0.37], 0.3);
      drawPart(projection, 0, -0.55, 0.47, 0.095, 0.095, 0.045, [0.1, 0.72, 1], 0.95);

      frame = window.requestAnimationFrame(render);
    };

    frame = window.requestAnimationFrame(render);
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      gl.deleteBuffer(vertexBuffer);
      gl.deleteBuffer(normalBuffer);
      gl.deleteBuffer(indexBuffer);
      gl.deleteProgram(program);
    };
  }, []);

  return (
    <div className="hybrid-avatar">
      <div className="hybrid-avatar-aura" />
      <div className={'hybrid-avatar-ring ' + status} />
      <canvas ref={canvasRef} aria-label="ZARA's animated three-dimensional hybrid AI avatar" role="img" />
      <div className={'hybrid-avatar-state ' + status}>
        <i />
        {status === 'idle' ? 'STANDBY' : status.toUpperCase()}
      </div>
    </div>
  );
}
