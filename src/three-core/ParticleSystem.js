/**
 * ParticleSystem.js — 园区场景浮动数据粒子
 *
 * 在场景上空生成数百个缓慢浮动的光点，暗示"万物互联、数据流动"。
 * 使用 THREE.Points 单次渲染，对性能无影响。
 */
import * as THREE from 'three'

const DEFAULT_PARTICLE_STYLE = 'rgb(0, 245, 255)'
const DEFAULT_PARTICLE_COLOR = new THREE.Color(DEFAULT_PARTICLE_STYLE).getHex()

export default class ParticleSystem {
  /**
   * @param {THREE.Scene} scene  主场景
   * @param {Object}      opts   { count: 250, bounds: { x: 110, y: [12, 55], z: 60 } }
   */
  constructor (scene, opts = {}) {
    this.scene = scene
    this.count = opts.count || 250
    this.bounds = opts.bounds || { x: 110, y: [12, 55], z: 60 }
    this.theme = opts.theme
    this.points = null
    this._phaseData = null
  }

  /** 创建粒子并添加到场景 */
  start () {
    if (this.points) return

    const positions = new Float32Array(this.count * 3)
    this._phaseData = new Float32Array(this.count * 2) // [speed, phase]

    const { x: bx, y: [yMin, yMax], z: bz } = this.bounds

    for (let i = 0; i < this.count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * bx * 2       // x
      positions[i * 3 + 1] = yMin + Math.random() * (yMax - yMin) // y
      positions[i * 3 + 2] = (Math.random() - 0.5) * bz * 2       // z
      this._phaseData[i * 2] = 0.15 + Math.random() * 0.4     // speed
      this._phaseData[i * 2 + 1] = Math.random() * Math.PI * 2  // phase
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    // Canvas 生成径向渐变圆点贴图
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const ctx = canvas.getContext('2d')
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16)
    const particleCssColor = this.theme?.css?.primary || DEFAULT_PARTICLE_STYLE
    gradient.addColorStop(0, this._toRgba(particleCssColor, 1))
    gradient.addColorStop(0.25, this._toRgba(particleCssColor, 0.6))
    gradient.addColorStop(0.6, this._toRgba(particleCssColor, 0.08))
    gradient.addColorStop(1, this._toRgba(particleCssColor, 0))
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 32, 32)
    const texture = new THREE.CanvasTexture(canvas)

    const material = new THREE.PointsMaterial({
      size: 2.2,
      map: texture,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.6,
      color: this.theme?.three?.effect?.primary || DEFAULT_PARTICLE_COLOR
    })

    this.points = new THREE.Points(geometry, material)
    this.scene.add(this.points)
  }

  /**
   * 每帧更新粒子位置（由 SceneRuntime._loop 调用）
   * @param {number} t  绝对时间（秒）
   */
  update (t) {
    if (!this.points || !this._phaseData) return
    const pos = this.points.geometry.attributes.position.array
    const { y: [yMin, yMax] } = this.bounds
    for (let i = 0; i < this.count; i++) {
      const speed = this._phaseData[i * 2]
      const phase = this._phaseData[i * 2 + 1]
      const mid = (yMin + yMax) / 2
      const amp = (yMax - yMin) / 2
      pos[i * 3 + 1] = mid + Math.sin(t * speed + phase) * amp
    }
    this.points.geometry.attributes.position.needsUpdate = true
  }

  /** 显隐粒子（传送门转场时隐藏） */
  setVisible (v) {
    if (this.points) this.points.visible = v
  }

  _toRgba (color, alpha) {
    try {
      const c = new THREE.Color(color)
      const r = Math.round(c.r * 255)
      const g = Math.round(c.g * 255)
      const b = Math.round(c.b * 255)
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
    } catch (e) {
      return `rgba(0, 245, 255, ${alpha})`
    }
  }

  /** 释放 GPU 资源 */
  dispose () {
    if (this.points) {
      this.scene.remove(this.points)
      if (this.points.geometry) this.points.geometry.dispose()
      if (this.points.material) {
        if (this.points.material.map) this.points.material.map.dispose()
        this.points.material.dispose()
      }
      this.points = null
    }
    this._phaseData = null
  }
}
