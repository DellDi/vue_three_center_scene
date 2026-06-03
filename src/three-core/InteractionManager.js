/**
 * InteractionManager.js — 3D 场景交互（点击拾取）
 *
 * ┌──────────────────────────────────────────────────────────┐
 * │  Raycasting（射线投射）原理                                │
 * │                                                          │
 * │  用户点击屏幕上的一个像素点 →                               │
 * │    1. 将屏幕坐标转换为 NDC（标准化设备坐标 -1~1）            │
 * │    2. 从相机位置向该 NDC 方向发射一条射线                   │
 * │    3. 检测射线与场景中物体的交点                             │
 * │    4. 最近的交点就是用户"点击到的物体"                       │
 * │                                                          │
 * │  关键 API：                                               │
 * │    raycaster.setFromCamera(ndc, camera) → 设定射线方向      │
 * │    raycaster.intersectObjects(list)     → 检测交点          │
 * │                                                          │
 * │  每个可点击物体在 userData.meta 中存储业务数据               │
 * │  拾取到后向上查找 parent 链，找到带 meta 的祖先节点          │
 * └──────────────────────────────────────────────────────────┘
 *
 * 职责：
 *   - 管理可点击物体列表
 *   - 维护节点/设备索引（用于 focusNode、showAlarm 等）
 *   - 处理 pointerdown 事件 → 射线拾取 → 发射 select 事件
 *
 * 后续拓展：
 *   - hover 高亮效果（pointermove + 描边后处理）
 *   - 框选 / 多选
 *   - 拖拽移动物体
 *   - 触摸手势（pinch zoom 等）
 */
import * as THREE from 'three'

export default class InteractionManager {
  /**
   * @param {THREE.PerspectiveCamera} camera  相机
   * @param {HTMLCanvasElement}       domElement 渲染器 canvas
   */
  constructor (camera, domElement) {
    this.camera = camera
    this.domElement = domElement

    /**
     * 射线投射器
     * 用于将屏幕点击转化为 3D 空间中的碰撞检测
     */
    this.raycaster = new THREE.Raycaster()

    /**
     * NDC 坐标（Normalized Device Coordinates）
     * x: -1(左) ~ +1(右)
     * y: -1(下) ~ +1(上)
     */
    this.pointer = new THREE.Vector2()

    /**
     * 所有可被射线检测的物体列表
     * @type {THREE.Object3D[]}
     */
    this.clickables = []

    /**
     * 节点索引：id → { object, meta }
     * 节点 = 楼栋、房间等非设备类可点击对象
     */
    this.nodes = new Map()

    /**
     * 设备索引：id → { object, meta }
     * 设备 = 传感器、摄像头、机器人等
     */
    this.devices = new Map()

    /**
     * 事件回调：(eventType, payload) => void
     */
    this.onEvent = () => {}
  }

  /** 设置事件回调 */
  setEventCallback (fn) {
    this.onEvent = fn
  }

  /**
   * 注册一个可点击物体
   *
   * @param {THREE.Object3D} object  3D 对象（通常是 Group）
   * @param {Object}         meta    业务数据（title, type, camera 等）
   * @param {string}         bucket  'device' | undefined
   *
   * 注册后：
   *   - object.userData.meta = meta （供 pick 时读取）
   *   - 加入 clickables 列表（参与射线检测）
   *   - 根据 bucket 加入 nodes 或 devices 索引
   */
  addClickable (object, meta, bucket) {
    object.userData.meta = meta
    this.clickables.push(object)
    if (bucket === 'device') {
      this.devices.set(meta.id, { object, meta })
    } else {
      this.nodes.set(meta.id, { object, meta })
    }
  }

  /** 获取节点 */
  getNode (id) {
    return this.nodes.get(id)
  }

  /** 获取设备 */
  getDevice (id) {
    return this.devices.get(id)
  }

  /** 获取所有设备 */
  getAllDevices () {
    return [...this.devices.values()]
  }

  /**
   * 处理点击事件（射线拾取）
   *
   * 流程：
   *   1. 屏幕坐标 → NDC
   *   2. 从相机发射射线
   *   3. 检测与 clickables 的交点
   *   4. 沿 parent 链找到带 userData.meta 的祖先
   *   5. 发射 select 事件（携带 meta 数据）
   */
  pick (event) {
    const rect = this.domElement.getBoundingClientRect()

    // 屏幕坐标 → NDC (-1 ~ 1)
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    // 从相机位置向 NDC 方向发射射线
    this.raycaster.setFromCamera(this.pointer, this.camera)

    // 检测所有可点击物体（true = 递归检测子物体）
    const hits = this.raycaster.intersectObjects(this.clickables, true)
    if (!hits.length) {
      this.onEvent('empty-click')
      return
    }

    // 沿 parent 链查找带 meta 的节点
    let o = hits[0].object
    while (o && !o.userData.meta) o = o.parent
    if (!o) return

    const m = o.userData.meta
    this.onEvent('select', {
      title: m.title,
      payload: m,
      pointer: { x: event.clientX - rect.left, y: event.clientY - rect.top }
    })

    return m // 返回 meta 供后续处理（如 drillTo）
  }

  /** 清空所有可点击物体和索引 */
  clear () {
    this.clickables = []
    this.nodes.clear()
    this.devices.clear()
  }
}
