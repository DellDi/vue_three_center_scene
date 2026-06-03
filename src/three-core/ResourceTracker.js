/**
 * ResourceTracker.js — GPU / DOM 资源生命周期追踪
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │  为什么需要这个模块？                                       │
 * │                                                          │
 * │  Three.js 创建的 Geometry、Material、Texture 都占用 GPU     │
 * │  显存。仅仅从 Scene 中 remove() 并不会释放显存——必须显式      │
 * │  调用 .dispose()。CSS2DObject 创建的 DOM 元素也需要手动       │
 * │  从页面中移除，否则会一直残留在 <body> 里。                    │
 * │                                                          │
 * │  忘记 dispose = 内存泄漏 = 页面越用越卡直到崩溃               │
 * └──────────────────────────────────────────────────────────┘
 *
 * 职责：
 *   - 追踪所有被创建的 GPU 资源（几何体、材质、纹理）
 *   - 追踪 DOM 元素（CSS2DObject 标签）
 *   - 提供统一的 dispose() 一次性释放所有资源
 *
 * 后续拓展：
 *   - 加载 GLB 模型时，GLTFLoader 返回的资源也应注册到这里
 *   - 加载 Texture 贴图时，同样需要追踪以便释放
 */
import * as THREE from 'three'

export default class ResourceTracker {
  constructor () {
    /** @type {Set<THREE.BufferGeometry>} 几何体集合 */
    this.geometries = new Set()
    /** @type {Set<THREE.Material>} 材质集合（含数组材质） */
    this.materials = new Set()
    /** @type {Set<THREE.Texture>} 纹理贴图集合 */
    this.textures = new Set()
    /** @type {Set<THREE.WebGLRenderTarget>} 渲染目标集合 */
    this.renderTargets = new Set()
    /** @type {Set<HTMLElement>} CSS2DObject 的 DOM 元素 */
    this.domElements = new Set()
  }

  /**
   * 注册一个几何体
   * 在创建 BufferGeometry / BoxGeometry 等之后调用
   */
  trackGeometry (geometry) {
    if (geometry) this.geometries.add(geometry)
    return geometry
  }

  /**
   * 注册一个材质（支持单材质和材质数组）
   */
  trackMaterial (material) {
    if (!material) return material
    if (Array.isArray(material)) {
      material.forEach(m => this.materials.add(m))
    } else {
      this.materials.add(material)
    }
    return material
  }

  /**
   * 注册一张纹理贴图
   */
  trackTexture (texture) {
    if (texture) this.textures.add(texture)
    return texture
  }

  /**
   * 注册一个 CSS2DObject 的 DOM 元素
   */
  trackDOMElement (element) {
    if (element) this.domElements.add(element)
    return element
  }

  /**
   * 递归遍历 Object3D 树，收集所有可释放资源
   *
   * Three.js 对象是一棵树：
   *   Scene → Group → Mesh → Geometry + Material
   *                       → CSS2DObject → DOM element
   *
   * 这个方法从根节点向下遍历，把所有叶子资源收集起来
   */
  trackDeep (object) {
    if (!object) return
    if (object.geometry) this.trackGeometry(object.geometry)
    if (object.material) this.trackMaterial(object.material)
    if (object.element) this.trackDOMElement(object.element)
    if (object.children) {
      object.children.forEach(child => this.trackDeep(child))
    }
  }

  /**
   * 释放所有已追踪的资源
   *
   * 调用时机：
   *   - 场景切换时（clearScene）
   *   - 组件销毁时（dispose）
   *   - 热更新重新加载时
   */
  disposeAll () {
    this.geometries.forEach(g => g.dispose())
    this.materials.forEach(m => m.dispose?.())
    this.textures.forEach(t => t.dispose())
    this.renderTargets.forEach(rt => rt.dispose())
    this.domElements.forEach(el => {
      if (el.parentNode) el.parentNode.removeChild(el)
    })

    const count = this.geometries.size + this.materials.size + this.textures.size
    this.geometries.clear()
    this.materials.clear()
    this.textures.clear()
    this.renderTargets.clear()
    this.domElements.clear()

    return count // 返回释放数量，方便调试
  }

  /**
   * 统计当前追踪的资源数量（调试用）
   */
  getStats () {
    return {
      geometries: this.geometries.size,
      materials: this.materials.size,
      textures: this.textures.size,
      domElements: this.domElements.size
    }
  }
}
