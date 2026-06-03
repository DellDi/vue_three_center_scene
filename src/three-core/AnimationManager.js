/**
 * AnimationManager.js — 帧循环动画注册与管理
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │  Three.js 动画核心原理                                     │
 * │                                                          │
 * │  Three.js 没有内置动画系统。所有动画都是通过                  │
 * │  requestAnimationFrame 循环实现的：                         │
 * │                                                          │
 * │  function loop() {                                       │
 * │    requestAnimationFrame(loop)  // 每秒约调用 60 次         │
 * │    updateAllAnimations()        // 修改物体属性             │
 * │    renderer.render(scene, camera) // 渲染一帧              │
 * │  }                                                       │
 * │                                                          │
 * │  每一帧，动画回调收到两个参数：                               │
 * │    t  = performance.now() / 1000  → 绝对时间（秒）          │
 * │       用于周期性动画：Math.sin(t * speed)                   │
 * │    dt = clock.getDelta()          → 距上帧的间隔（秒）       │
 * │       用于累加型动画：position.x += speed * dt              │
 * └──────────────────────────────────────────────────────────┘
 *
 * 职责：
 *   - 注册 / 移除 / 暂停动画回调
 *   - 每帧由 SceneRuntime.loop() 调用 tick() 驱动所有动画
 *
 * 当前注册的动画示例：
 *   - 'dev_xxx'     设备点位脉冲
 *   - 'halo'        机器人检测光环缩放
 *   - 'lidar'       LiDAR 旋转
 *   - 'brush'       边刷旋转
 *   - 'dot_0~15'    路径上的流动粒子
 *   - 'beacon_xxx'  告警楼栋顶部信标
 *   - 'tree_xxx'    树木微风摇摆
 *
 * 后续拓展：
 *   - 支持动画优先级（UI 动画 > 场景动画）
 *   - 支持动画组（暂停某一组而不影响其他）
 *   - 接入 AnimationMixer（用于 GLB 骨骼动画）
 */
import * as THREE from 'three'

export default class AnimationManager {
  constructor () {
    /**
     * 动画注册表：key → callback(t, dt)
     * @type {Map<string, Function>}
     */
    this.animations = new Map()

    /**
     * THREE.Clock 用于计算帧间隔
     * getDelta() 返回距上次调用的秒数，用于时间无关的物理计算
     */
    this.clock = new THREE.Clock()
  }

  /**
   * 注册一个动画回调
   *
   * @param {string} key 唯一标识（重复注册会覆盖旧的）
   * @param {Function} fn 每帧调用 fn(t, dt)
   *   - t:  number  自页面加载以来的秒数
   *   - dt: number  距上一帧的秒数（上限 0.05s）
   *
   * @example
   *   // 呼吸缩放
   *   anim.register('breath', (t) => {
   *     mesh.scale.setScalar(1 + Math.sin(t * 3) * 0.1)
   *   })
   *
   *   // 匀速旋转
   *   anim.register('spin', (t, dt) => {
   *     mesh.rotation.y += dt * 2  // 每秒转 2 弧度
   *   })
   */
  register (key, fn) {
    this.animations.set(key, fn)
  }

  /**
   * 移除动画
   * @param {string} key
   */
  remove (key) {
    this.animations.delete(key)
  }

  /**
   * 是否存在某动画
   */
  has (key) {
    return this.animations.has(key)
  }

  /**
   * 每帧驱动 —— 由 SceneRuntime._loop() 调用
   *
   * 注意：dt 和 t 由 SceneRuntime 统一计算后传入
   * 不要在本模块内再次调用 clock.getDelta()，否则会导致帧时间不准
   *
   * @param {number} t  绝对时间（秒）
   * @param {number} dt 帧间隔（秒，已做上限处理）
   */
  tick (t, dt) {
    this.animations.forEach(fn => fn(t, dt))
  }

  /**
   * 清空所有动画（场景切换时调用）
   */
  clear () {
    this.animations.clear()
  }

  /**
   * 当前动画数量（调试用）
   */
  get size () {
    return this.animations.size
  }
}
