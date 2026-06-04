/**
 * SceneManager.js — 场景加载、切换、销毁
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │  场景切换流程                                              │
 * │                                                          │
 * │  用户点击楼栋 → drillTo('floor_b1')                       │
 * │    → sceneStack.push('floor_b1')                         │
 * │    → clearScene()  清空旧场景的所有 3D 物体和动画           │
 * │    → buildScene()  调用对应的 builder 构建新场景            │
 * │    → flyTo()       飞到新场景的默认视角                     │
 * │                                                          │
 * │  用户点击返回 → backScene()                                │
 * │    → sceneStack.pop()                                    │
 * │    → 重新加载栈顶场景                                      │
 * └──────────────────────────────────────────────────────────┘
 *
 * 职责：
 *   - 根据 mode + scene type 分发到对应的 builder
 *   - 管理场景栈（支持多级下钻/返回）
 *   - 存储场景构建后的运行时引用（robot、motion 等）
 *
 * 后续拓展：
 *   - 场景预加载（提前构建不可见的场景）
 *   - 场景切换过渡动画（淡入淡出）
 *   - 多场景并行（分屏对比）
 */
import buildParkScene from '../scene-builders/park.builder'
import buildFloorScene from '../scene-builders/floor.builder'
import buildRobotScene from '../scene-builders/robot.builder'

export default class SceneManager {
  /**
   * @param {Object} managers { models, layers, anims, interactions, resources, effects }
   */
  constructor (managers) {
    this.models = managers.models
    this.layers = managers.layers
    this.anims = managers.anims
    this.interactions = managers.interactions
    this.resources = managers.resources
    this.effects = managers.effects
    this.theme = managers.theme

    /** @type {Object} 当前场景配置 */
    this.currentConfig = null

    /** @type {string} 当前场景 ID */
    this.currentSceneId = null

    /** @type {string} 运行模式 'iot' | 'robot' */
    this.mode = null

    /** @type {Object} 全局场景配置（所有场景的 config） */
    this.config = null

    // ── 运行时引用（builder 返回） ──
    this.robot = null
    this.motion = null
    this.waypoints = null
    this.trailBuf = null
    this.trailGeo = null

    /** @type {string[]} 场景栈（支持多级下钻） */
    this.sceneStack = []
  }

  /**
   * 加载并构建场景
   *
   * @param {string}  sceneId   场景 ID
   * @param {Object}  config    全局配置
   * @param {string}  mode      'iot' | 'robot'
   * @param {Object}  options   运行选项
   * @param {boolean} instant   是否瞬间跳转（无飞行动画）
   * @returns {Object|null}     { cameraPreset } 或 null
   */
  loadScene (sceneId, config, mode, options, instant) {
    const cfg = config.scenes[sceneId]
    if (!cfg) return null

    // 清空旧场景
    this.clearScene()

    // 保存当前状态
    this.currentSceneId = sceneId
    this.currentConfig = cfg
    this.mode = mode
    this.config = config

    // 构建新场景
    const managers = {
      models: this.models,
      layers: this.layers,
      anims: this.anims,
      interactions: this.interactions,
      theme: this.theme
    }

    if (mode === 'robot') {
      const result = buildRobotScene(cfg, managers, options)
      this.robot = result.robot
      this.motion = result.motion
      this.waypoints = result.waypoints
      this.trailBuf = result.trailBuf
      this.trailGeo = result.trailGeo
    } else if (cfg.type === 'floor') {
      buildFloorScene(cfg, managers)
    } else {
      buildParkScene(cfg, managers)
    }

    // 返回默认相机预设
    return {
      cameraPreset: cfg.cameraPresets?.default || null,
      instant
    }
  }

  /**
   * 清空当前场景
   * 移除所有 3D 物体、动画、可点击对象
   * 释放 GPU 资源
   */
  clearScene () {
    // 清空活跃告警特效（防止动画回调解引用已销毁的球体）
    if (this.effects) this.effects.clearAllAlarms()

    // 清空图层中的所有子物体（递归 dispose GPU 资源 + CSS2D DOM）
    this.layers.clearAll()

    // 清空动画
    this.anims.clear()

    // 清空可点击对象和索引
    this.interactions.clear()

    // 重置运行时引用
    this.robot = null
    this.motion = null
    this.waypoints = null
    this.trailBuf = null
    this.trailGeo = null
  }

  /** 下钻到子场景 */
  drillTo (sceneId) {
    if (!sceneId) return false
    if (this.sceneStack[this.sceneStack.length - 1] !== sceneId) {
      this.sceneStack.push(sceneId)
    }
    return true
  }

  /** 返回上一级场景 */
  backScene () {
    if (this.sceneStack.length > 1) {
      this.sceneStack.pop()
    }
    return this.sceneStack[this.sceneStack.length - 1]
  }

  /** 初始化场景栈 */
  initStack (sceneId) {
    this.sceneStack = [sceneId]
  }

  /** 获取栈顶场景 ID */
  get topSceneId () {
    return this.sceneStack[this.sceneStack.length - 1]
  }
}
