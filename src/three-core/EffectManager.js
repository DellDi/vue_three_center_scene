/**
 * EffectManager.js — 视觉特效管理（告警、光圈、扫描线等）
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │  特效的实现思路                                            │
 * │                                                          │
 * │  大部分特效 = 半透明几何体 + 动画                           │
 * │                                                          │
 * │  例如告警光栅球：                                          │
 * │    Mesh(SphereGeometry, wireframe + 半透明红色)             │
 * │    + 每帧 scale.setScalar(1 + sin(t) * 0.2) 脉冲缩放       │
 * │    + 9 秒后自动移除                                        │
 * │                                                          │
 * │  特效通常需要知道目标物体的世界坐标：                        │
 * │    object.getWorldPosition(vector) → 获取世界空间位置       │
 * │    注意：如果物体在嵌套 Group 中，position 是局部坐标        │
 * │    getWorldPosition 才能拿到正确的全局坐标                   │
 * └──────────────────────────────────────────────────────────┘
 *
 * 职责：
 *   - 告警特效（红色光栅球，跟随目标脉冲）
 *   - 后续可扩展：扫描线、粒子、爆炸等
 *
 * 后续拓展：
 *   - 粒子系统（THREE.Points + ShaderMaterial）
 *   - 后处理效果（Bloom 辉光、景深）
 *   - 扫描线 / 全息效果
 */
import * as THREE from 'three'

export default class EffectManager {
  /**
   * @param {LayerManager}     layerManager  图层管理（特效添加到 alarm 层）
   * @param {AnimationManager} animManager   动画管理（注册脉冲动画）
   * @param {Object}           theme         场景主题
   */
  constructor (layerManager, animManager, theme) {
    this.layers = layerManager
    this.anims = animManager
    this.theme = theme

    /**
     * 活跃告警追踪：targetId → { sphere, animKey }
     *
     * 同一目标重复点击告警时，先清理旧的光栅球再创建新的，
     * 防止多个球体叠加残留在场景中形成「残影」。
     */
    this._activeAlarms = new Map()
  }

  /**
   * 显示告警光栅球
   *
   * @param {Object}   item        { object: THREE.Object3D, meta: Object }
   * @param {Object}   robotRef    机器人引用（用于判断是否跟随机器人）
   * @param {Function} flyCallback 飞行回调（告警时自动飞到告警位置）
   *
   * 效果：
   *   - 红色半透明线框球包裹目标
   *   - 持续脉冲缩放
   *   - 如果目标是机器人，球跟随机器人移动
   *   - 9 秒后自动消失
   *   - 重复点击同一目标会先清理旧球再创建新的
   */
  showAlarm (item, robotRef, flyCallback) {
    if (!item) return

    const targetId = item.meta.id || '__unknown__'

    // ── 清理同一目标的旧告警（防止残影叠加） ──
    const existing = this._activeAlarms.get(targetId)
    if (existing) {
      this._disposeAlarm(existing)
    }

    // 创建红色线框球
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(11, 32, 16),
      new THREE.MeshBasicMaterial({
        color: this.theme?.semantic?.danger || 0xff4d43,
        transparent: true,
        opacity: 0.24,
        wireframe: true
      })
    )
    this.layers.addTo('alarm', sphere)

    const key = `alarm_${targetId}`
    const startTime = performance.now()
    const isRobot = item.meta.id === 'robot'
    const worldPos = new THREE.Vector3()

    // 存储活跃告警引用（用于后续重复点击时清理）
    const alarmData = { sphere, animKey: key }
    this._activeAlarms.set(targetId, alarmData)

    // 注册脉冲动画
    this.anims.register(key, (t) => {
      if (isRobot && robotRef) {
        // 机器人模式：每帧更新球的位置
        robotRef.getWorldPosition(worldPos)
        sphere.position.copy(worldPos)
        sphere.position.y += 5
      } else {
        // 静态设备：只设置一次位置
        if (!sphere.userData.positioned) {
          item.object.getWorldPosition(worldPos)
          sphere.position.copy(worldPos)
          sphere.position.y += 4
          sphere.userData.positioned = true
        }
      }
      // 脉冲缩放
      sphere.scale.setScalar(1 + Math.sin(t * 6.5) * 0.2)
      // 9 秒后自动清理
      if (performance.now() - startTime > 9000) {
        this._disposeAlarm(alarmData)
        this._activeAlarms.delete(targetId)
      }
    })

    // 飞到告警位置
    if (flyCallback && item.meta.camera) {
      flyCallback(item.meta.camera.position, item.meta.camera.target)
    }
  }

  /**
   * 清理单个告警特效
   * - 从图层移除球体
   * - dispose geometry + material（释放 GPU 显存）
   * - 注销动画回调
   *
   * @param {{ sphere: THREE.Mesh, animKey: string }} alarmData
   */
  _disposeAlarm (alarmData) {
    const { sphere, animKey } = alarmData
    // 从 alarm 图层移除
    const alarmLayer = this.layers.get('alarm')
    if (alarmLayer && sphere) {
      alarmLayer.remove(sphere)
    }
    // 释放 GPU 资源
    if (sphere) {
      if (sphere.geometry) sphere.geometry.dispose()
      if (sphere.material) sphere.material.dispose()
    }
    // 注销动画
    if (animKey) {
      this.anims.remove(animKey)
    }
  }

  /**
   * 清理所有活跃告警特效（场景切换时调用）
   */
  clearAllAlarms () {
    this._activeAlarms.forEach((alarmData) => {
      this._disposeAlarm(alarmData)
    })
    this._activeAlarms.clear()
  }
}
