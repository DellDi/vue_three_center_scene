/**
 * LayerManager.js — 场景图层管理
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │  图层概念                                                  │
 * │                                                          │
 * │  Three.js 的 Scene 里所有物体默认平铺在一起。                │
 * │  为了方便管理（如：一键隐藏所有标签、批量清理路线），            │
 * │  我们用 THREE.Group 创建分层容器：                           │
 * │                                                          │
 * │  Scene                                                   │
 * │   ├─ base    → 地面、网格、墙体、建筑结构                    │
 * │   ├─ device  → 设备点位、机器人                             │
 * │   ├─ label   → CSS2D 文字标签                              │
 * │   ├─ route   → 路径线、轨迹、流动粒子                        │
 * │   ├─ alarm   → 告警特效（红色光栅球等）                      │
 * │   └─ effect  → 装饰特效（旋转光圈、光柱等）                   │
 * │                                                          │
 * │  每个图层是一个空的 THREE.Group，创建物体时                    │
 * │  添加到对应的图层里即可。                                     │
 * └──────────────────────────────────────────────────────────┘
 *
 * 后续拓展：
 *   - 按需添加新图层（如 'heatmap'、'video'）
 *   - 图层透明度渐变（淡入淡出效果）
 *   - 图层独立后处理（如给 device 层加 Bloom 辉光）
 */
import * as THREE from 'three'

/** 默认图层列表 */
const DEFAULT_LAYERS = ['base', 'device', 'label', 'route', 'alarm', 'effect']

export default class LayerManager {
  /**
   * @param {THREE.Scene} scene 主场景对象
   */
  constructor (scene) {
    this.scene = scene
    /** @type {Object<string, THREE.Group>} 图层名 → Group */
    this.layers = {}

    DEFAULT_LAYERS.forEach(name => {
      const group = new THREE.Group()
      group.name = `layer_${name}` // 方便 DevTools 调试
      this.layers[name] = group
      scene.add(group)
    })
  }

  /** 获取图层 Group */
  get (name) {
    return this.layers[name]
  }

  /** 将物体添加到指定图层 */
  addTo (layerName, object) {
    const layer = this.layers[layerName]
    if (layer) layer.add(object)
  }

  /** 显示/隐藏图层 */
  setVisible (layerName, visible) {
    const layer = this.layers[layerName]
    if (layer) layer.visible = visible
  }

  /**
   * 清空所有图层中的子物体
   *
   * 场景切换时调用：
   *   - 递归 dispose 所有 Geometry、Material（释放 GPU 显存）
   *   - 移除 CSS2DObject 的 DOM 元素（防止 DOM 泄漏）
   *   - 移除场景中的 3D 物体
   *   - 保留图层 Group 结构，新场景直接往里加
   */
  clearAll () {
    Object.values(this.layers).forEach(group => {
      while (group.children.length > 0) {
        const child = group.children[0]
        this._disposeRecursive(child)
        group.remove(child)
      }
    })
  }

  /**
   * 递归释放 Object3D 树中的所有 GPU 资源和 DOM 元素
   *
   * @param {THREE.Object3D} object 要递归清理的根对象
   *
   * 遍历所有子节点，对每个节点：
   *   1. dispose geometry → 释放顶点/索引缓冲区（GPU 显存）
   *   2. dispose material → 释放着色器程序和纹理引用（GPU 显存）
   *   3. 移除 CSS2DObject DOM 元素 → 从页面 DOM 中删除标签 div
   *
   * 注意：共享的 geometry/material 会被多次调用 dispose()，
   * Three.js 的 dispose 方法是幂等的，多次调用安全。
   */
  _disposeRecursive (object) {
    if (!object) return

    // 释放几何体（顶点缓冲、索引缓冲 → GPU 显存）
    if (object.geometry) {
      object.geometry.dispose()
    }

    // 释放材质（着色器程序、纹理引用 → GPU 显存）
    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach(m => {
          if (m && typeof m.dispose === 'function') m.dispose()
        })
      } else if (typeof object.material.dispose === 'function') {
        object.material.dispose()
      }
    }

    // 移除 CSS2DObject 创建的 DOM 元素
    // CSS2DRenderer 内部会管理元素缓存，但直接 removeChild 确保 DOM 干净
    if (object.element && object.element.parentNode) {
      object.element.parentNode.removeChild(object.element)
    }

    // 递归处理子物体（从后往前遍历，避免移除时索引错乱）
    const children = object.children
    if (children && children.length > 0) {
      for (let i = children.length - 1; i >= 0; i--) {
        this._disposeRecursive(children[i])
      }
    }
  }

  /** 注册新图层（拓展用） */
  addLayer (name) {
    if (this.layers[name]) return this.layers[name]
    const group = new THREE.Group()
    group.name = `layer_${name}`
    this.layers[name] = group
    this.scene.add(group)
    return group
  }
}
