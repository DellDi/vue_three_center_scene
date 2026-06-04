/**
 * ModelManager.js — Three.js 模型 / 几何体 / 材质 工厂
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │  核心概念：Mesh = Geometry + Material                      │
 * │                                                          │
 * │  每个可见的 3D 物体都是一个 THREE.Mesh：                     │
 * │    Geometry → 形状数据（顶点、面、UV）                       │
 * │    Material → 外观（颜色、透明度、金属感、粗糙度）            │
 * │                                                          │
 * │  常用 Geometry：                                           │
 * │    BoxGeometry(w, h, d)        方块                        │
 * │    CylinderGeometry(rT, rB, h) 圆柱（可锥化）               │
 * │    SphereGeometry(r)           球体                        │
 * │    PlaneGeometry(w, h)         平面（常用于地面/标签）        │
 * │    RingGeometry(rIn, rOut)     圆环（地面光圈）              │
 * │    ConeGeometry(r, h)          锥体（箭头/树冠）             │
 * │    TorusGeometry(r, tube)      环面（保险杠）               │
 * │                                                          │
 * │  常用 Material：                                           │
 * │    MeshStandardMaterial → PBR 材质（受光照影响）             │
 * │      color, roughness(粗糙度), metalness(金属度)            │
 * │      emissive(自发光色), emissiveIntensity(自发光强度)       │
 * │      transparent + opacity → 半透明                         │
 * │                                                          │
 * │    MeshBasicMaterial → 不受光照（常用于 UI/特效）            │
 * │    LineBasicMaterial → 线段材质                            │
 * │    LineDashedMaterial → 虚线材质（需 computeLineDistances） │
 * └──────────────────────────────────────────────────────────┘
 *
 * 职责：
 *   - 提供常用的材质/几何体工厂方法
 *   - 创建 CSS2D 标签、边缘高亮、地面网格等通用元素
 *   - 后续加载 GLB 模型时也在此管理模型缓存
 *
 * 后续拓展：
 *   - loadGLTF(path) → 加载 .glb/.gltf 模型
 *   - 模型缓存池（相同模型复用实例）
 *   - LOD（Level of Detail，远距离用简化模型）
 *   - 纹理贴图加载与管理
 */
import * as THREE from 'three'
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { getSceneTheme } from '../theme/sceneThemes'

export default class ModelManager {
  constructor (theme) {
    this.theme = theme || getSceneTheme()
    /**
     * GLB 模型缓存
     * key: 模型路径  value: GLTF scene
     * 后续接入 GLTFLoader 时使用
     */
    this.modelCache = new Map()
  }

  /* ========== 材质工厂 ========== */

  /**
   * 创建 PBR 标准材质
   *
   * @param {number} color      颜色（十六进制，如 0x0c4d67）
   * @param {number} opacity    透明度 0~1
   * @param {number} emissive   自发光颜色
   *
   * MeshStandardMaterial 基于物理的渲染：
   *   roughness 0=镜面 1=粗糙  → 控制反射清晰度
   *   metalness 0=非金属 1=金属 → 控制金属质感
   *   emissive → 自发光（不受场景灯光影响）
   */
  createStandardMaterial (color, opacity = 0.78, emissive) {
    const material = this.theme.three.material
    return new THREE.MeshStandardMaterial({
      color: color ?? material.building,
      transparent: true,
      opacity,
      roughness: 0.46,
      metalness: 0.22,
      emissive: emissive ?? material.buildingEmissive,
      emissiveIntensity: 0.5
    })
  }

  /* ========== 边缘高亮 ========== */

  /**
   * 给 Mesh 添加科技感边缘线框
   *
   * 原理：
   *   EdgesGeometry 从原始几何体中提取边缘线
   *   LineSegments 用线段材质渲染这些边
   *   作为子物体添加到 mesh 上
   *
   * 这是科幻/科技风大屏最常见的视觉效果
   *
   * @param {THREE.Mesh} mesh    目标网格
   * @param {number}     color   线框颜色
   * @param {number}     opacity 线框透明度
   */
  addEdges (mesh, color = this.theme.three.effect.edge, opacity = 0.7) {
    const edgesGeo = new THREE.EdgesGeometry(mesh.geometry)
    const edgesMat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity
    })
    const lineSegments = new THREE.LineSegments(edgesGeo, edgesMat)
    mesh.add(lineSegments)
    return lineSegments
  }

  /* ========== CSS2D 标签 ========== */

  /**
   * 创建悬浮文字标签
   *
   * CSS2DObject 原理：
   *   创建一个普通 DOM 元素，通过 CSS2DRenderer
   *   将它投影到 3D 空间中。标签始终面向相机（billboard）
   *   且不受 3D 光照影响，文字清晰可读。
   *
   * @param {string}  text   显示文字
   * @param {boolean} alarm  是否告警样式（红色边框）
   * @returns {CSS2DObject}
   */
  createLabel (text, alarm = false) {
    const el = document.createElement('div')
    el.textContent = text
    const css = this.theme.css
    el.style.cssText = [
      `color:${alarm ? css.dangerText || css.danger : css.text}`,
      'font-size:12px',
      'white-space:nowrap',
      'letter-spacing:1px',
      `background:${alarm ? css.dangerBg : css.cardBg}`,
      `border:1px solid ${alarm ? css.danger : css.panelBorder}`,
      `padding:4px 10px`,
      `box-shadow:0 0 12px ${alarm ? css.dangerBg : css.primarySoft}`,
      'backdrop-filter:blur(2px)',
      'pointer-events:none',
      'border-radius:2px'
    ].join(';')
    return new CSS2DObject(el)
  }

  /* ========== 地面光圈 ========== */

  /**
   * 创建旋转地面光圈
   *
   * @returns {{ group: THREE.Group, animKey: string, update: Function }}
   *   group  → 添加到场景的 Group
   *   animKey → 注册到 AnimationManager 的 key
   *   update  → 每帧调用 update(t) 驱动旋转
   */
  createRing (radius, color = this.theme.three.effect.primary) {
    const group = new THREE.Group()
    const ringMesh = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.64, radius, 64),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.24,
        side: THREE.DoubleSide
      })
    )
    ringMesh.rotation.x = -Math.PI / 2
    group.add(ringMesh)

    return {
      group,
      animKey: `ring_${Math.random().toString(36).slice(2, 8)}`,
      update: (t) => { ringMesh.rotation.z = t * 0.6 }
    }
  }

  /* ========== 地面网格 ========== */

  /**
   * 创建地面网格 + 底板
   *
   * @param {number} size 网格边长
   * @param {number} w    底板宽度
   * @param {number} h    底板深度
   * @returns {THREE.Group} 包含 GridHelper + 地面 Mesh
   *
   * GridHelper：Three.js 内置的网格辅助线
   * PlaneGeometry + rotation.x = -PI/2 → 水平放置的平面
   */
  createGrid (size, w = 220, h = 220) {
    const group = new THREE.Group()

    const gridTheme = this.theme.three.grid
    const grid = new THREE.GridHelper(size, 40, gridTheme.main, gridTheme.sub)
    grid.material.transparent = true
    grid.material.opacity = gridTheme.opacity
    group.add(grid)

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({
        color: this.theme.three.material.ground,
        roughness: 0.82,
        metalness: 0.12,
        transparent: true,
        opacity: 0.96
      })
    )
    ground.rotation.x = -Math.PI / 2 // 水平放置
    group.add(ground)

    return group
  }

  /* ========== 墙体段 ========== */

  /**
   * 创建一段 3D 墙体（从 A 点到 B 点）
   *
   * @param {Object} w     墙体定义 { ax, az, bx, by, h, thick }
   * @param {number} color 区域颜色（用于顶部发光条）
   * @returns {THREE.Group} 包含墙体 + 顶部发光条
   *
   * 原理：
   *   计算 A→B 的距离和角度
   *   创建一个 BoxGeometry(thick, h, length)
   *   放到 A 和 B 的中点，旋转对齐方向
   */
  createWallSegment (w, color) {
    const group = new THREE.Group()
    const material = this.theme.three.material
    const wallAccent = color ?? this.theme.three.effect.edge
    const dx = w.bx - w.ax
    const dz = w.by - w.az
    const len = Math.sqrt(dx * dx + dz * dz)
    const angle = Math.atan2(dx, dz)

    const wallMat = new THREE.MeshStandardMaterial({
      color: material.wall, transparent: true, opacity: 0.7,
      roughness: 0.4, metalness: 0.3,
      emissive: color ?? material.wallEmissive, emissiveIntensity: 0.06
    })
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w.thick, w.h, len),
      wallMat
    )
    mesh.position.set((w.ax + w.bx) / 2, w.h / 2, (w.az + w.by) / 2)
    mesh.rotation.y = angle
    this.addEdges(mesh, wallAccent, 0.38)
    group.add(mesh)

    // 顶部发光条
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(w.thick + 0.1, 0.18, len),
      new THREE.MeshBasicMaterial({ color: wallAccent, transparent: true, opacity: 0.45 })
    )
    strip.position.copy(mesh.position)
    strip.position.y = w.h + 0.09
    strip.rotation.y = angle
    group.add(strip)

    return group
  }

  /* ========== 家具 / 道具 ========== */

  /**
   * 创建家具物体（方块或圆柱）
   *
   * @param {Object} f 家具定义 { shape, w/h/d | r/h, color, x, y, z }
   * @returns {THREE.Mesh}
   */
  createFurnitureItem (f) {
    let mesh
    const furnitureColor = f.color ?? this.theme.three.material.furniture
    if (f.shape === 'cyl') {
      mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(f.r, f.r * 1.1, f.h, 16),
        new THREE.MeshStandardMaterial({
          color: furnitureColor, roughness: 0.6, metalness: 0.15,
          emissive: furnitureColor, emissiveIntensity: 0.08
        })
      )
    } else {
      mesh = new THREE.Mesh(
        new THREE.BoxGeometry(f.w, f.h, f.d),
        new THREE.MeshStandardMaterial({
          color: furnitureColor, roughness: 0.5, metalness: 0.2,
          emissive: furnitureColor, emissiveIntensity: 0.05
        })
      )
    }
    mesh.position.set(f.x, f.y, f.z)
    this.addEdges(mesh, this.theme.three.effect.edge, 0.2)
    return mesh
  }

  /* ========== GLB 模型加载（预留接口） ========== */

  /**
   * 加载 GLB/GLTF 模型
   *
   * TODO: 接入 GLTFLoader 后实现
   *
   * 使用方式：
   *   const model = await modelManager.loadGLTF('/models/building.glb')
   *   model.position.set(x, y, z)
   *   layer.add(model)
   *
   * GLTFLoader 返回结构：
   *   { scene: THREE.Group, animations: [...], cameras: [...] }
   *
   * 后续还需接入：
   *   - DRACOLoader（压缩模型解码）
   *   - KTX2Loader（压缩纹理）
   *   - 进度回调（loading bar）
   */
  async loadGLTF (path) {
    if (this.modelCache.has(path)) {
      return this.modelCache.get(path).clone()
    }
    // TODO: 实现 GLTFLoader 加载逻辑
    // const loader = new GLTFLoader()
    // const gltf = await loader.loadAsync(path)
    // this.modelCache.set(path, gltf.scene)
    // return gltf.scene.clone()
    throw new Error(`GLTF loading not yet implemented: ${path}`)
  }
}
