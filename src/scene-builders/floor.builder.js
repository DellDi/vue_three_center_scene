/**
 * floor.builder.js — 楼层内部场景构建器
 *
 * 构建楼层内部视角：
 *   - 外围墙体结构
 *   - 天花板灯带
 *   - 各功能区（立体地台 + 3D 墙体 + 家具道具）
 *   - 设备点位
 *
 * 数据来源：scene-config/iotScene.config.js 的 floor_bX 场景
 *
 * 后续拓展：
 *   - 接入楼层平面图（Texture 贴图）
 *   - 接入室内定位系统（蓝牙 / UWB）
 *   - 视频监控画面叠加（VideoTexture）
 */
import * as THREE from 'three'

/**
 * 构建楼层场景
 *
 * @param {Object} cfg      场景配置（rooms, devices 等）
 * @param {Object} managers { models, layers, anims, interactions, theme }
 * @returns {Object}        { robot: null }
 */
export default function buildFloorScene (cfg, managers) {
  const { models, layers, anims, interactions, theme } = managers

  // ── 1. 地面网格 ──
  layers.addTo('base', models.createGrid(145, 150, 96))

  // ── 2. 外围墙体 ──
  addPerimeterWalls(models, layers, theme)

  // ── 3. 天花板灯带 ──
  addCeilingLights(layers, theme)

  // ── 4. 功能区 ──
  cfg.rooms.forEach(r => createRoom(r, cfg.title, models, layers, anims, interactions, theme))

  // ── 5. 设备点位 ──
  cfg.devices.forEach(d => createDevice(d, models, layers, anims, interactions, theme))

  return { robot: null }
}

/* ========== 外围墙体 ========== */

function addPerimeterWalls (models, layers, theme) {
  const { material, effect } = theme.three
  const perim = [
    [-74, 0, 1.4, 96, 8], [74, 0, 1.4, 96, 8],
    [0, -48, 150, 1.4, 8], [0, 48, 150, 1.4, 8]
  ]
  perim.forEach(([x, z, w, d, h]) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({
        color: material.wall, transparent: true, opacity: 0.55,
        roughness: 0.35, metalness: 0.4,
        emissive: material.wallEmissive, emissiveIntensity: 0.08
      })
    )
    m.position.set(x, h / 2, z)
    models.addEdges(m, effect.edge, 0.42)
    layers.addTo('base', m)
  })
}

/* ========== 天花板灯带 ========== */

function addCeilingLights (layers, theme) {
  const ceilLights = [[0, -20, 80, 2], [0, 20, 80, 2], [-40, 0, 2, 60], [30, 0, 2, 60]]
  ceilLights.forEach(([x, z, w, d]) => {
    const lp = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ color: theme.three.material.ceilingLight, transparent: true, opacity: 0.08, side: THREE.DoubleSide })
    )
    lp.rotation.x = Math.PI / 2
    lp.position.set(x, 9.5, z)
    layers.addTo('base', lp)
  })
}

/* ========== 功能区 ========== */

function createRoom (r, sceneTitle, models, layers, anims, interactions, theme) {
  const g = new THREE.Group()
  const [rx, rz] = r.position
  const [w, d] = r.size
  const alarm = r.alarm
  const h = 0.5

  // 立体地台
  const floorMat = new THREE.MeshStandardMaterial({
    color: r.color, transparent: true,
    opacity: alarm ? 0.28 : 0.2,
    roughness: 0.32, metalness: 0.38,
    emissive: r.color, emissiveIntensity: alarm ? 0.12 : 0.05
  })
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), floorMat)
  floor.position.set(rx, h / 2, rz)
  models.addEdges(floor, r.color, alarm ? 0.82 : 0.55)
  g.add(floor)

  // 状态发光层
  const glowColor = alarm ? theme.semantic.danger : r.color
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.92, d * 0.92),
    new THREE.MeshBasicMaterial({
      color: glowColor, transparent: true,
      opacity: alarm ? 0.14 : 0.06, side: THREE.DoubleSide
    })
  )
  glow.rotation.x = -Math.PI / 2
  glow.position.set(rx, h + 0.04, rz)
  g.add(glow)

  // 墙体
  if (r.walls) {
    r.walls.forEach(w => {
      g.add(models.createWallSegment(w, r.color))
    })
  }

  // 家具
  if (r.furniture) {
    r.furniture.forEach(f => {
      g.add(models.createFurnitureItem(f))
    })
  }

  // 标签
  const lab = models.createLabel(`${r.title}${alarm ? ' ⚠' : ''}`, alarm)
  lab.position.set(rx, 9, rz)
  layers.addTo('label', lab)

  // 告警脉冲
  if (alarm) {
    anims.register(`glow_${r.id}`, t => {
      glow.material.opacity = 0.06 + Math.sin(t * 3) * 0.08
    })
  }

  const meta = {
    ...r,
    type: '楼层房间 / 区域',
    location: sceneTitle,
    status: alarm ? '存在异常' : '正常',
    desc: '楼层内部区域，可查看房间设备点位、告警、视频与工单。',
    camera: { position: [rx + 18, 34, rz + 22], target: [rx, 0, rz] }
  }
  layers.addTo('base', g)
  interactions.addClickable(g, meta)
}

/* ========== 设备点位 ========== */

function createDevice (d, models, layers, anims, interactions, theme) {
  const g = new THREE.Group()
  const [dx, dy, dz] = d.position
  g.position.set(dx, dy, dz)
  const c = d.alarm ? theme.semantic.danger : theme.three.effect.primary

  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(2, 32, 16),
    new THREE.MeshStandardMaterial({
      color: c, emissive: c,
      emissiveIntensity: d.alarm ? 1.7 : 1.05,
      transparent: true, opacity: 0.92
    })
  )
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(2.8, 24, 12),
    new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: d.alarm ? 0.18 : 0.08, wireframe: true })
  )
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 10, 8),
    new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.28 })
  )
  beam.position.y = -5

  const baseRing = new THREE.Mesh(
    new THREE.RingGeometry(2, 3.2, 32),
    new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.2, side: THREE.DoubleSide })
  )
  baseRing.rotation.x = -Math.PI / 2
  baseRing.position.y = -dy + 0.25

  const innerRing = new THREE.Mesh(
    new THREE.RingGeometry(1.2, 1.8, 24),
    new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.15, side: THREE.DoubleSide })
  )
  innerRing.rotation.x = -Math.PI / 2
  innerRing.position.y = -dy + 0.3

  const lab = models.createLabel(`${d.icon || '●'} ${d.title}`, d.alarm)
  lab.position.set(0, 6.5, 0)

  g.add(ball, shell, beam, baseRing, innerRing, lab)
  layers.addTo('device', g)

  const meta = {
    ...d,
    desc: d.alarm ? '设备异常，支持联动视频、派单、复位与趋势查看。' : '设备在线，运行状态正常。',
    camera: { position: [dx + 20, dy + 20, dz + 22], target: [dx, dy, dz] }
  }
  interactions.addClickable(g, meta, 'device')

  anims.register(`dev_${d.id}`, t => {
    ball.scale.setScalar(1 + Math.sin(t * (d.alarm ? 7 : 3)) * (d.alarm ? 0.22 : 0.08))
    shell.scale.setScalar(1 + Math.sin(t * 2) * 0.12)
    baseRing.rotation.z = t * 0.4
    innerRing.rotation.z = -t * 0.6
  })
}
