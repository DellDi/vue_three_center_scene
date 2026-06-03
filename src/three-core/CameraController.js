/**
 * CameraController.js — 镜头运动与视角控制
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │  Three.js 相机核心概念                                     │
 * │                                                          │
 * │  PerspectiveCamera: 透视相机（近大远小，类似人眼）            │
 * │    - fov: 视野角度（45° 常用）                              │
 * │    - aspect: 宽高比（随窗口 resize 更新）                    │
 * │    - near/far: 近裁面/远裁面（超出范围不渲染）                │
 * │                                                          │
 * │  OrbitControls: 轨道控制器（鼠标拖拽旋转/缩放/平移）          │
 * │    - controls.target: 相机围绕的目标点                       │
 * │    - enableDamping: 惯性阻尼（让旋转有惯性手感）              │
 * │    - 每帧必须调用 controls.update() 才能生效                 │
 * │                                                          │
 * │  镜头飞行动画原理：                                         │
 * │    记录起始位置 A 和目标位置 B，每帧用 lerp 插值              │
 * │    camera.position.lerpVectors(A, B, easedProgress)        │
 * │    easedProgress 经过 easeInOutCubic 缓动函数处理            │
 * │    → 开头慢、中间快、结尾慢 = 丝滑感                         │
 * └──────────────────────────────────────────────────────────┘
 *
 * 职责：
 *   - 飞行动画（flyTo + updateFly）
 *   - 预设视角切换（focusPreset / focusNode）
 *   - 机器人跟随模式（startFollow / followUpdate）
 *   - 镜头约束（clampCamera）
 *   - 窗口 resize 适配
 *   - 导览系统（tour start/stop/update）
 *
 * 后续拓展：
 *   - 接入 GSAP 做更复杂的镜头路径动画
 *   - 碰撞检测（防止镜头穿墙）
 *   - 多相机切换（第一人称 / 第三人称 / 俯瞰）
 */
import * as THREE from 'three'

/**
 * 缓动函数：先加速后减速
 * 曲线：慢 → 快 → 慢
 * 用于镜头飞行，让起止平滑
 */
const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

export default class CameraController {
  /**
   * @param {THREE.PerspectiveCamera} camera   透视相机
   * @param {OrbitControls}           controls 轨道控制器
   * @param {THREE.WebGLRenderer}     renderer 渲染器（取 canvas）
   */
  constructor (camera, controls, renderer) {
    this.camera = camera
    this.controls = controls
    this.renderer = renderer

    // ── 飞行状态（重构为多段路径）──
    this.fly = null // { segments: [...], index: 0, holdRemaining: 0, elapsed: 0 }

    // ── 跟随状态（机器人模式）──
    this.followMode = false
    this.followCamPos = null
    this.followCamTar = null

    // ── 当前场景配置（loadScene 时设置）──
    this.currentConfig = null
    this.mode = null // 'iot' | 'robot'

    // ── 导览状态 ──
    this.tour = { active: false, index: -1, wait: 0, paused: false }

    // ── 暂停恢复定时器 ──
    this.resumeTimer = null
  }

  /* ========== 飞行动画 ========== */

  /**
   * 多段路径飞行（新增）
   *
   * @param {Array} segments  段数组，每段 { position, target, duration, hold }
   *   hold: 到达后停留秒数（可选，默认 0）
   */
  flyPath (segments) {
    if (!segments || !segments.length) return
    this.followMode = false
    this.fly = {
      segments: segments.map(s => ({
        toPos: new THREE.Vector3(...s.position),
        toTar: new THREE.Vector3(...s.target),
        duration: Math.max(s.duration, 0.01),
        hold: s.hold || 0
      })),
      index: 0,
      elapsed: 0,
      holdRemaining: 0
    }
  }

  /**
   * 平滑飞到目标位置和朝向
   *
   * @param {number[]} position  目标坐标 [x, y, z]
   * @param {number[]} target    相机注视目标 [x, y, z]
   * @param {number}   duration  飞行时长（秒），默认 1.2s
   *
   * 原理：
   *   每帧在 updateFly 中计算 progress（0→1）
   *   经过 easeInOutCubic 缓动后
   *   用 lerpVectors 在起点和终点之间插值
   */
  flyTo (position, target, duration = 1.2) {
    this.flyPath([{ position, target, duration }])
  }

  /**
   * 每帧更新飞行动画（多段路径版）
   */
  updateFly (dt) {
    if (!this.fly) return
    const segs = this.fly.segments
    if (this.fly.index >= segs.length) { this.fly = null; return }

    const cur = segs[this.fly.index]

    // 停留阶段
    if (this.fly.holdRemaining > 0) {
      this.fly.holdRemaining -= dt
      if (this.fly.holdRemaining <= 0) {
        this.fly.index++
        this.fly.elapsed = 0
      }
      return
    }

    // 飞行阶段
    this.fly.elapsed += dt
    const p = Math.min(1, this.fly.elapsed / cur.duration)
    const e = easeInOutCubic(p)

    // 段起点：上一段的终点，或当前相机位置
    const fromPos = this.fly.index === 0 && this.fly.elapsed <= dt + 0.001
      ? this.camera.position.clone()
      : (this._lastSegmentEndPos || this.camera.position.clone())
    const fromTar = this.fly.index === 0 && this.fly.elapsed <= dt + 0.001
      ? this.controls.target.clone()
      : (this._lastSegmentEndTar || this.controls.target.clone())

    if (p < 1) {
      this.camera.position.lerpVectors(fromPos, cur.toPos, e)
      this.controls.target.lerpVectors(fromTar, cur.toTar, e)
    }

    if (p >= 1) {
      // 精确到达
      this.camera.position.copy(cur.toPos)
      this.controls.target.copy(cur.toTar)
      this._lastSegmentEndPos = cur.toPos.clone()
      this._lastSegmentEndTar = cur.toTar.clone()
      // 进入停留或下一段
      if (cur.hold > 0) {
        this.fly.holdRemaining = cur.hold
        this.fly.elapsed = 0
      } else {
        this.fly.index++
        this.fly.elapsed = 0
      }
    }
  }

  /* ========== 跟随模式 ========== */

  /**
   * 开始跟随机器人
   * 相机固定在机器人身后 28 单位、上方 20 单位
   * 注视点：机器人位置 + Y偏移 2
   *
   * getRobotBackDir() 根据机器人朝向算出"背后"方向
   * 这样无论机器人朝哪转，相机始终在背后
   */
  startFollow (robot) {
    this.followMode = true
    this.fly = null
    if (robot) {
      const dir = this.getBackDir(robot)
      this.followCamPos = robot.position.clone().add(dir.clone().multiplyScalar(28))
      this.followCamPos.y += 20
      this.followCamTar = robot.position.clone()
      this.followCamTar.y += 2
    }
  }

  /** 退出跟随 */
  stopFollow () {
    this.followMode = false
  }

  /**
   * 根据物体 rotation.y（偏航角）计算其"背后"方向
   *
   * Three.js 物体默认朝 -Z 方向
   * rotation.y 是绕 Y 轴旋转的角度
   * 背后方向 = (-sin(yaw), 0, -cos(yaw))
   */
  getBackDir (robot) {
    const yaw = robot ? robot.rotation.y : 0
    return new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
  }

  /**
   * 每帧更新跟随位置（由 loop 调用）
   *
   * 使用双重 lerp 实现「电影级延迟跟随」：
   *   - 先算出理想位置 desired（机器人正后方）
   *   - 相机位置 lerp 向 desired（系数 0.12，慢跟）
   *   - 注视目标 lerp 向 desiredTar（系数 0.25，稍快）
   * → 相机总是慢半拍，产生电影感的惯性
   */
  followUpdate (robot) {
    if (!this.followMode || !robot) return

    const dir = this.getBackDir(robot)
    const desired = robot.position.clone().add(dir.clone().multiplyScalar(28))
    desired.y += 20
    const desiredTar = robot.position.clone()
    desiredTar.y += 2

    if (!this.followCamPos) {
      this.followCamPos = desired.clone()
      this.followCamTar = desiredTar.clone()
    }

    this.followCamPos.lerp(desired, 0.12)
    this.followCamTar.lerp(desiredTar, 0.25)

    this.camera.position.copy(this.followCamPos)
    this.controls.target.copy(this.followCamTar)
  }

  /* ========== 镜头约束 ========== */

  /**
   * 每帧约束相机位置
   *   1. Y 不低于 8 → 防止镜头钻入地面以下
   *   2. 距离不超过 maxDistance → 防止拉太远看不见
   */
  clampCamera () {
    this.camera.position.y = Math.max(this.camera.position.y, 8)
    if (this.followMode) return
    const max = this.controls.maxDistance || 180
    const dist = this.camera.position.distanceTo(this.controls.target)
    if (dist > max + 4) {
      const dir = this.camera.position.clone().sub(this.controls.target).normalize()
      this.camera.position.copy(this.controls.target.clone().add(dir.multiplyScalar(max)))
    }
  }

  /* ========== 视角预设 ========== */

  /**
   * 切换到预设视角
   * @param {string} name 预设名（如 'default', 'top', 'follow', 'fire'）
   *
   * 在 robot 模式下，'follow' 特殊处理为启动跟随模式
   */
  focusPreset (name) {
    if (this.mode === 'robot' && name === 'follow') {
      return '__follow__' // 返回特殊标记，由 SceneRuntime 处理
    }
    const p = this.currentConfig?.cameraPresets?.[name]
    if (p) this.flyTo(p.position, p.target, 1.2)
  }

  /**
   * 聚焦到某个节点/设备
   * @param {Object} item { meta: { camera: { position, target } } }
   */
  focusNode (item) {
    if (item?.meta?.camera) {
      this.flyTo(item.meta.camera.position, item.meta.camera.target, 1.1)
    }
  }

  /* ========== 窗口适配 ========== */

  /**
   * 窗口尺寸变化时更新相机宽高比和渲染器尺寸
   * 必须在 resize 时调用，否则画面会变形
   */
  resize (width, height) {
    const w = width || 1
    const h = height || 1
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  /* ========== 导览系统 ========== */

  /**
   * 开始自动导览
   * 按 scene-config 中定义的 tours 数组依次执行命令
   */
  startTour () {
    this.tour = { active: true, index: -1, wait: 0, paused: false }
  }

  /** 停止导览 */
  stopTour () {
    this.tour.active = false
    this.tour.paused = false
  }

  /**
   * 推进到导览下一步
   * @param {Function} executeCommand 执行命令的回调
   * @param {Function} emit 事件发射回调
   */
  nextTourStep (executeCommand, emit) {
    const steps = this.currentConfig?._tourSteps || []
    if (!steps.length) return
    this.tour.index = (this.tour.index + 1) % steps.length
    const step = steps[this.tour.index]
    executeCommand(step.command)
    this.tour.wait = step.hold || 4
    emit('tour-view', { title: step.title })
  }

  /**
   * 每帧更新导览计时器
   * 倒计时结束后自动推进到下一步
   */
  updateTour (dt, executeCommand, emit) {
    if (!this.tour.active || this.tour.paused) return
    this.tour.wait -= dt
    if (this.tour.wait <= 0) this.nextTourStep(executeCommand, emit)
  }

  /**
   * 用户交互时暂停导览
   * 10 秒后自动恢复
   */
  pauseTourOnInteraction () {
    if (this.tour.active) {
      this.tour.paused = true
      clearTimeout(this.resumeTimer)
      this.resumeTimer = setTimeout(() => { this.tour.paused = false }, 10000)
    }
    if (this.followMode) {
      this.followMode = false
    }
  }
}
