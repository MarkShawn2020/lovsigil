/**
 * WebGL Renderer for real-time video processing
 * - Mirror effect
 * - Person segmentation with warm color grading
 * - Background darkening
 * - Edge glow effect based on spirit color
 */

const VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`

const FRAGMENT_SHADER = `
precision mediump float;

uniform sampler2D u_video;
uniform sampler2D u_mask;
uniform vec2 u_resolution;
uniform vec3 u_glowColor;
uniform float u_edgeGlow;

varying vec2 v_texCoord;

void main() {
  // Mirror horizontally
  vec2 mirrorUV = vec2(1.0 - v_texCoord.x, v_texCoord.y);

  vec4 color = texture2D(u_video, mirrorUV);
  float mask = texture2D(u_mask, mirrorUV).r;

  // mask = 0 means person, mask > 0 means background
  if (mask < 0.5) {
    // Person: warm color grading + slight brightening
    color.r = min(1.0, color.r * 1.1 + 0.059);
    color.g = min(1.0, color.g * 1.05 + 0.039);
    color.b = min(1.0, color.b * 0.95 + 0.020);
  } else {
    // Background: darken but keep some visibility
    color.rgb *= 0.25;
    color.b *= 1.2; // Slight blue tint
  }

  // Edge detection and glow
  float edgeGlowRadius = u_edgeGlow;
  vec2 texelSize = 1.0 / u_resolution;

  // Check if current pixel is person and has background neighbor
  if (mask < 0.5) {
    float isEdge = 0.0;

    // Sample neighbors for edge detection
    for (float dy = -1.0; dy <= 1.0; dy += 1.0) {
      for (float dx = -1.0; dx <= 1.0; dx += 1.0) {
        if (dx == 0.0 && dy == 0.0) continue;
        vec2 neighborUV = mirrorUV + vec2(dx, dy) * texelSize;
        float neighborMask = texture2D(u_mask, neighborUV).r;
        if (neighborMask >= 0.5) {
          isEdge = 1.0;
          break;
        }
      }
      if (isEdge > 0.5) break;
    }

    // Apply glow if edge pixel
    if (isEdge > 0.5) {
      color.rgb = mix(color.rgb, u_glowColor, 0.5);
    }
  }

  // Also add glow to nearby background pixels
  if (mask >= 0.5) {
    float glowIntensity = 0.0;

    for (float dy = -3.0; dy <= 3.0; dy += 1.0) {
      for (float dx = -3.0; dx <= 3.0; dx += 1.0) {
        vec2 neighborUV = mirrorUV + vec2(dx, dy) * texelSize;
        float neighborMask = texture2D(u_mask, neighborUV).r;
        if (neighborMask < 0.5) {
          float dist = length(vec2(dx, dy));
          if (dist <= edgeGlowRadius) {
            glowIntensity = max(glowIntensity, (1.0 - dist / edgeGlowRadius) * 0.7);
          }
        }
      }
    }

    if (glowIntensity > 0.0) {
      color.rgb += u_glowColor * glowIntensity;
    }
  }

  gl_FragColor = color;
}
`

export interface WebGLRendererOptions {
  canvas: HTMLCanvasElement
}

export class WebGLRenderer {
  private gl: WebGLRenderingContext
  private program: WebGLProgram
  private videoTexture: WebGLTexture
  private maskTexture: WebGLTexture
  private positionBuffer: WebGLBuffer
  private texCoordBuffer: WebGLBuffer

  // Uniform locations
  private uVideo: WebGLUniformLocation
  private uMask: WebGLUniformLocation
  private uResolution: WebGLUniformLocation
  private uGlowColor: WebGLUniformLocation
  private uEdgeGlow: WebGLUniformLocation

  // Attribute locations
  private aPosition: number
  private aTexCoord: number

  constructor(options: WebGLRendererOptions) {
    const gl = options.canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    })

    if (!gl) {
      throw new Error('WebGL not supported')
    }

    this.gl = gl

    // Create shaders and program
    this.program = this.createProgram(VERTEX_SHADER, FRAGMENT_SHADER)
    gl.useProgram(this.program)

    // Get attribute locations
    this.aPosition = gl.getAttribLocation(this.program, 'a_position')
    this.aTexCoord = gl.getAttribLocation(this.program, 'a_texCoord')

    // Get uniform locations
    this.uVideo = gl.getUniformLocation(this.program, 'u_video')!
    this.uMask = gl.getUniformLocation(this.program, 'u_mask')!
    this.uResolution = gl.getUniformLocation(this.program, 'u_resolution')!
    this.uGlowColor = gl.getUniformLocation(this.program, 'u_glowColor')!
    this.uEdgeGlow = gl.getUniformLocation(this.program, 'u_edgeGlow')!

    // Create buffers
    this.positionBuffer = this.createBuffer(new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      -1, 1,
      1, -1,
      1, 1,
    ]))

    this.texCoordBuffer = this.createBuffer(new Float32Array([
      0, 1,
      1, 1,
      0, 0,
      0, 0,
      1, 1,
      1, 0,
    ]))

    // Create textures
    this.videoTexture = this.createTexture()
    this.maskTexture = this.createTexture()

    // Set texture units
    gl.uniform1i(this.uVideo, 0)
    gl.uniform1i(this.uMask, 1)
  }

  private createShader(type: number, source: string): WebGLShader {
    const gl = this.gl
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader)
      gl.deleteShader(shader)
      throw new Error(`Shader compile error: ${info}`)
    }

    return shader
  }

  private createProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
    const gl = this.gl
    const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexSource)
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentSource)

    const program = gl.createProgram()!
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program)
      gl.deleteProgram(program)
      throw new Error(`Program link error: ${info}`)
    }

    return program
  }

  private createBuffer(data: Float32Array): WebGLBuffer {
    const gl = this.gl
    const buffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    return buffer
  }

  private createTexture(): WebGLTexture {
    const gl = this.gl
    const texture = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    return texture
  }

  /**
   * Render a frame with video and segmentation mask
   */
  render(
    video: HTMLVideoElement,
    mask: Uint8Array,
    width: number,
    height: number,
    glowColor: [number, number, number] = [0.83, 0.69, 0.22], // Default gold
    edgeGlow: number = 3.0
  ): void {
    const gl = this.gl

    // Resize canvas if needed
    if (gl.canvas.width !== width || gl.canvas.height !== height) {
      gl.canvas.width = width
      gl.canvas.height = height
      gl.viewport(0, 0, width, height)
    }

    // Update video texture
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.videoTexture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)

    // Update mask texture (convert to RGBA)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.maskTexture)
    // Create RGBA mask data
    const maskRGBA = new Uint8Array(width * height * 4)
    for (let i = 0; i < mask.length; i++) {
      const v = mask[i]! * 255
      maskRGBA[i * 4] = v
      maskRGBA[i * 4 + 1] = v
      maskRGBA[i * 4 + 2] = v
      maskRGBA[i * 4 + 3] = 255
    }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, maskRGBA)

    // Set uniforms
    gl.uniform2f(this.uResolution, width, height)
    gl.uniform3f(this.uGlowColor, glowColor[0], glowColor[1], glowColor[2])
    gl.uniform1f(this.uEdgeGlow, edgeGlow)

    // Set up attributes
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
    gl.enableVertexAttribArray(this.aPosition)
    gl.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, false, 0, 0)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer)
    gl.enableVertexAttribArray(this.aTexCoord)
    gl.vertexAttribPointer(this.aTexCoord, 2, gl.FLOAT, false, 0, 0)

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  /**
   * Draw Lanna-style border on 2D canvas overlay
   */
  drawBorder(ctx: CanvasRenderingContext2D, width: number, height: number, color: string = '#CC785C'): void {
    ctx.strokeStyle = color
    ctx.lineWidth = 4
    ctx.strokeRect(2, 2, width - 4, height - 4)
  }

  dispose(): void {
    const gl = this.gl
    gl.deleteProgram(this.program)
    gl.deleteTexture(this.videoTexture)
    gl.deleteTexture(this.maskTexture)
    gl.deleteBuffer(this.positionBuffer)
    gl.deleteBuffer(this.texCoordBuffer)
  }
}

/**
 * Convert hex color to normalized RGB [0-1]
 */
export function hexToNormalizedRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [
        Number.parseInt(result[1]!, 16) / 255,
        Number.parseInt(result[2]!, 16) / 255,
        Number.parseInt(result[3]!, 16) / 255,
      ]
    : [0.83, 0.69, 0.22] // Default gold
}
