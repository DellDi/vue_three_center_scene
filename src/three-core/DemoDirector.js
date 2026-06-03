/**
 * DemoDirector.js — 演示时间线导演
 *
 * 按预设时间线自动推进演示流程，替代手动操作。
 * 通过 SceneRuntime 的 execute / emit 接口控制整个演示。
 */

/** 演示时间线定义（秒） */
const DEMO_TIMELINE = [
  { at: 0,   action: 'ACT0_OPENING' },
  { at: 5,   action: 'CHAPTER_TITLE', text: '全域感知·数字孪生' },
  { at: 7,   action: 'START_TOUR' },
  { at: 32,  action: 'CHAPTER_TITLE', text: '智慧感知' },
  { at: 34,  action: 'STOP_TOUR' },
  { at: 35,  action: 'DRILL_TO', sceneId: 'floor_b4', fromNodeId: 'b4' },
  { at: 50,  action: 'SHOW_ALARM', deviceId: 'f-water' },
  { at: 62,  action: 'BACK_SCENE' },
  { at: 72,  action: 'CHAPTER_TITLE', text: '自动执行' },
  { at: 73,  action: 'PORTAL_TRANSITION', targetScene: 'robot' },
  { at: 85,  action: 'START_TOUR' },
  { at: 108, action: 'STOP_TOUR' },
  { at: 110, action: 'SHOW_ALARM', deviceId: 'robot' },
  { at: 125, action: 'ACT3_CLOSING' },
]

export default class DemoDirector {
  /**
   * @param {Object}   deps
   * @param {Function} deps.execute      命令执行 (cmd) => void
   * @param {Function} deps.emit         事件发射 (type, payload) => void
   * @param {Function} deps.onTransition 传送门转场 (targetScene) => Promise<void>
   */
  constructor ({ execute, emit, onTransition }) {
    this.execute = execute
    this.emit = emit
    this.onTransition = onTransition

    this.active = false
    this.elapsed = 0
    this.nextStepIndex = 0
    this.totalDuration = DEMO_TIMELINE[DEMO_TIMELINE.length - 1].at + 10
  }

  /** 开始演示 */
  start () {
    this.active = true
    this.elapsed = 0
    this.nextStepIndex = 0
    this.emit('demo-started', { totalDuration: this.totalDuration })
  }

  /** 停止演示 */
  stop () {
    this.active = false
    this.emit('demo-stopped')
  }

  /**
   * 每帧推进时间线（由 SceneRuntime._loop 调用）
   * @param {number} dt 帧间隔（秒）
   */
  tick (dt) {
    if (!this.active) return

    this.elapsed += dt

    // 检查是否到达下一步
    while (
      this.nextStepIndex < DEMO_TIMELINE.length &&
      this.elapsed >= DEMO_TIMELINE[this.nextStepIndex].at
    ) {
      const step = DEMO_TIMELINE[this.nextStepIndex]
      this._executeStep(step)
      this.nextStepIndex++
    }

    // 检查是否结束
    if (this.elapsed >= this.totalDuration) {
      this.stop()
    }

    // 发射进度事件
    this.emit('demo-progress', {
      elapsed: this.elapsed,
      total: this.totalDuration,
      stepIndex: this.nextStepIndex
    })
  }

  /** 执行单步动作 */
  async _executeStep (step) {
    switch (step.action) {
      case 'ACT0_OPENING':
        this.emit('act0-opening')
        break

      case 'CHAPTER_TITLE':
        this.emit('chapter-title', { text: step.text })
        break

      case 'START_TOUR':
        this.execute({ type: 'START_TOUR' })
        break

      case 'STOP_TOUR':
        this.execute({ type: 'STOP_TOUR' })
        break

      case 'DRILL_TO':
        this.execute({ type: 'DRILL_TO', sceneId: step.sceneId, fromNodeId: step.fromNodeId })
        break

      case 'SHOW_ALARM':
        this.execute({ type: 'SHOW_ALARM', deviceId: step.deviceId })
        break

      case 'BACK_SCENE':
        this.execute({ type: 'BACK_SCENE' })
        break

      case 'PORTAL_TRANSITION':
        if (this.onTransition) {
          await this.onTransition(step.targetScene)
        }
        break

      case 'ACT3_CLOSING':
        this.emit('act3-closing')
        break

      default:
        break
    }
  }
}
