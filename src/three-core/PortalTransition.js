/**
 * PortalTransition.js — 场景间传送门转场（Canvas 2D 粒子漩涡）
 *
 * 在 Vue 场景切换（IOT ↔ Robot）时播放粒子漩涡动画：
 *   定格 → 粒子螺旋汇聚 → 画面变黑 → 切换场景 → 粒子炸开 → 新场景显现
 *
 * 使用 Canvas 2D overlay，不操作 Three.js 场景，避免 GPU 状态污染。
 */
const DEFAULT_PORTAL_BG_RGB = '2, 8, 17'
const DEFAULT_PORTAL_PARTICLE = 'rgb(0, 245, 255)'

export default class PortalTransition {
  /**
   * @param {HTMLElement} container  场景容器元素（用于插入 overlay canvas）
   * @param {Object}      theme      场景主题
   */
  constructor (container, theme) {
    this.container = container
    this.theme = theme
    this.portalBg = theme?.three?.effect?.portalBg || `rgb(${DEFAULT_PORTAL_BG_RGB})`
    this.portalBgRgb = theme?.three?.effect?.portalBgRgb || DEFAULT_PORTAL_BG_RGB
    this.portalParticle = theme?.three?.effect?.portalParticle || DEFAULT_PORTAL_PARTICLE
    this.canvas = null
    this.ctx = null
    this.particles = []
    this.running = false
  }

  /**
   * 执行传送门转场
   *
   * @param {Function} switchFn  场景切换回调（同步或异步）
   *   在此期间，overlay 覆盖画面、播放漩涡动画
   * @returns {Promise<void>}
   */
  async execute (switchFn) {
    if (this.running) return
    this.running = true

    this._createOverlay()
    const W = this.canvas.width
    const H = this.canvas.height
    const cx = W / 2
    const cy = H / 2

    // ── Phase 1: 粒子从随机位置向中心螺旋汇聚（1.2s）──
    this._spawnRandomParticles(100, W, H)
    await this._animate(1.2, (progress) => {
      this._clear()
      this.particles.forEach(p => {
        const angle = p.startAngle + progress * Math.PI * 3
        const radius = p.startRadius * (1 - progress * 0.97)
        p.x = cx + Math.cos(angle) * radius
        p.y = cy + Math.sin(angle) * radius * 0.7
        p.size = p.startSize * (1 - progress * 0.5)
        p.opacity = 0.2 + progress * 0.6
        this._drawParticle(p)
      })
    })

    // ── Phase 2: 坍缩 — 所有粒子缩到中心（0.5s）──
    await this._animate(0.5, (progress) => {
      this._clear()
      this.ctx.fillStyle = `rgba(${this.portalBgRgb}, ${progress})`
      this.ctx.fillRect(0, 0, W, H)
      this.particles.forEach(p => {
        p.x = cx + (p.x - cx) * (1 - progress)
        p.y = cy + (p.y - cy) * (1 - progress)
        p.size *= 0.96
        p.opacity *= 0.92
        this._drawParticle(p)
      })
    })

    // ── 切换场景 ──
    this._clear()
    this.ctx.fillStyle = this.portalBg
    this.ctx.fillRect(0, 0, W, H)
    await switchFn()

    // ── Phase 3: 粒子从中心向外螺旋炸开（1.2s）──
    this._spawnCenterParticles(100, cx, cy)
    await this._animate(1.2, (progress) => {
      this._clear()
      this.ctx.fillStyle = `rgba(${this.portalBgRgb}, ${1 - progress})`
      this.ctx.fillRect(0, 0, W, H)
      this.particles.forEach(p => {
        const angle = p.startAngle + progress * Math.PI * 3
        const radius = progress * p.targetRadius
        p.x = cx + Math.cos(angle) * radius
        p.y = cy + Math.sin(angle) * radius * 0.7
        p.size = p.startSize * (1 - progress * 0.4)
        p.opacity = 0.8 * (1 - progress)
        this._drawParticle(p)
      })
    })

    // ── 清理 ──
    this._removeOverlay()
    this.running = false
  }

  /* ========== 内部方法 ========== */

  _createOverlay () {
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = 'position:absolute;inset:0;z-index:100;pointer-events:none'
    const rect = this.container.getBoundingClientRect()
    this.canvas.width = rect.width
    this.canvas.height = rect.height
    this.container.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')
  }

  _removeOverlay () {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas)
    }
    this.canvas = null
    this.ctx = null
  }

  _spawnRandomParticles (count, W, H) {
    this.particles = []
    const cx = W / 2
    const cy = H / 2
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = 80 + Math.random() * Math.max(W, H) * 0.8
      this.particles.push({
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius * 0.7,
        startAngle: angle,
        startRadius: radius,
        startSize: 1.5 + Math.random() * 3,
        size: 1.5 + Math.random() * 3,
        opacity: 0.1 + Math.random() * 0.3
      })
    }
  }

  _spawnCenterParticles (count, cx, cy) {
    this.particles = []
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      this.particles.push({
        x: cx,
        y: cy,
        startAngle: angle,
        targetRadius: 100 + Math.random() * Math.max(this.canvas.width, this.canvas.height) * 0.7,
        startSize: 2 + Math.random() * 4,
        size: 2 + Math.random() * 4,
        opacity: 0.3 + Math.random() * 0.5
      })
    }
  }

  _drawParticle (p) {
    if (p.opacity <= 0.01 || p.size <= 0.1) return
    const ctx = this.ctx
    ctx.save()
    ctx.globalAlpha = p.opacity
    ctx.fillStyle = this.portalParticle
    ctx.shadowColor = this.portalParticle
    ctx.shadowBlur = p.size * 2
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  _clear () {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  _animate (duration, drawFn) {
    return new Promise(resolve => {
      const start = performance.now()
      const tick = () => {
        const elapsed = (performance.now() - start) / 1000
        const progress = Math.min(1, elapsed / duration)
        drawFn(progress)
        if (progress < 1) {
          requestAnimationFrame(tick)
        } else {
          resolve()
        }
      }
      tick()
    })
  }

  dispose () {
    this._removeOverlay()
    this.particles = []
  }
}
