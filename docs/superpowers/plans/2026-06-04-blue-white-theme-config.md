# Blue White Theme Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 抽离当前暗色青蓝色系，新增一套参考大屏中部风格的蓝白浅色主题，并让 Vue 面板与 Three.js 场景共用同一份主题配置。

**Architecture:** 主题分为 `css`、`three`、`semantic` 三层：Vue CSS 使用 CSS Variables，Three runtime 和 builders 使用主题对象。先保留暗色默认主题，再新增 `blueWhiteTheme`，通过组件 prop 或运行时默认值选择主题，避免一次性破坏现有演示效果。

**Tech Stack:** Vue 2.7、Vite 5、Three.js 0.165、原生 CSS Variables、ES modules。

---

## File Structure

- Create: `src/theme/sceneThemes.js`
  - 负责导出 `darkTechTheme`、`blueWhiteTheme`、`getSceneTheme()`、`applyThemeVars()`、`resolveToneColor()`。
  - 主题对象同时提供 CSS 字符串色值和 Three 数字色值。
- Modify: `src/App.vue`
  - 引入主题，给页面根节点注入 CSS Variables。
  - 新增 `themeName` 状态，默认先用 `blueWhite`，保留切回 `darkTech` 的能力。
- Modify: `src/components/IotCenterScene.vue`
  - 新增 `themeName` prop。
  - 把硬编码 CSS 改成 `var(--scene-*)`。
  - 创建 `SceneRuntime` 时传入 `themeName`。
- Modify: `src/components/RobotCenterScene.vue`
  - 与 IOT 组件保持一致，新增 `themeName` prop、CSS Variables、runtime theme 注入。
- Modify: `src/three-core/SceneRuntime.js`
  - 接收 `themeName` / `theme` 选项，解析为 `this.theme`。
  - 把 clear color、fog、灯光、扫描环、清洁热力图颜色改为主题值。
  - 把 `theme` 传给 `ModelManager`、`SceneManager`、`ParticleSystem`、`PortalTransition`、`EffectManager`。
- Modify: `src/three-core/ModelManager.js`
  - 接收主题对象，通用材质、边缘线、标签、地面网格读取主题。
- Modify: `src/three-core/SceneManager.js`
  - 在 managers 中保存并传递 `theme` 给 park/floor/robot builders。
- Modify: `src/scene-builders/park.builder.js`
  - 园区地台、道路、楼栋、喷泉、停车位、设备点位改用主题 token。
- Modify: `src/scene-builders/floor.builder.js`
  - 楼层墙体、灯带、区域、设备点位改用主题 token。
- Modify: `src/scene-builders/robot.builder.js`
  - 机器人楼层、路径、机器人模型、状态环、电量颜色改用主题 token。
- Modify: `src/three-core/ParticleSystem.js`
  - 粒子贴图渐变、PointsMaterial 颜色改用主题 token。
- Modify: `src/three-core/PortalTransition.js`
  - 转场遮罩背景和粒子颜色改用主题 token。
- Modify: `src/three-core/EffectManager.js`
  - 告警球颜色改用主题 token。
- Create: `scripts/verify-theme-tokens.mjs`
  - 轻量检查主题对象关键路径存在，防止 runtime 读到 undefined。

---

### Task 1: Add Theme Token Module

**Files:**
- Create: `src/theme/sceneThemes.js`
- Create: `scripts/verify-theme-tokens.mjs`

- [ ] **Step 1: Create the theme module**

Add `src/theme/sceneThemes.js`:

```js
const requiredPaths = [
  'css.pageBg',
  'css.panelBg',
  'css.panelBorder',
  'css.primary',
  'css.text',
  'three.clear',
  'three.fog',
  'three.lights.ambient',
  'three.grid.main',
  'three.grid.sub',
  'three.material.ground',
  'three.effect.primary',
  'semantic.success',
  'semantic.warning',
  'semantic.danger'
]

export const darkTechTheme = {
  name: 'darkTech',
  css: {
    pageBg: '#020811',
    pageGradient: 'radial-gradient(circle at 50% 0%, rgba(0,245,255,.14), transparent 34%), linear-gradient(180deg, #020811, #01050a)',
    panelBg: '#020811',
    panelMask: 'rgba(0,245,255,.035)',
    panelBorder: 'rgba(0,245,255,.46)',
    panelShadow: 'inset 0 0 30px rgba(0,245,255,.08)',
    cardBg: 'rgba(0,22,34,.76)',
    cardBorder: 'rgba(0,245,255,.36)',
    buttonBg: 'rgba(0,35,50,.78)',
    buttonActiveBg: 'rgba(0,110,130,.72)',
    buttonText: '#dff',
    primary: '#00f5ff',
    primarySoft: 'rgba(0,245,255,.18)',
    text: '#d8fbff',
    muted: 'rgba(210,250,255,.65)',
    weak: 'rgba(220,255,255,.48)',
    danger: '#ff6c66',
    dangerBg: 'rgba(82,18,22,.72)',
    success: '#26f2a3',
    progress: 'linear-gradient(90deg, #00c8c6, #70ffff)'
  },
  three: {
    clear: 0x020811,
    fog: 0x020811,
    lights: { ambient: 0xb7f8ff, ambientIntensity: 0.82, directional: 0xffffff, directionalIntensity: 1.25, point: 0x00f5ff, pointIntensity: 4 },
    grid: { main: 0x00ffff, sub: 0x0b4050, opacity: 0.14 },
    material: {
      ground: 0x071520,
      platform: 0x0a1820,
      road: 0x1a2a30,
      wall: 0x1a3a4a,
      wallEmissive: 0x002b34,
      building: 0x0c4d67,
      buildingAlarm: 0x351719,
      buildingEmissive: 0x00384c,
      furniture: 0x2a4a5a,
      ceilingLight: 0xeeffff,
      robotBody: 0xe8f0f0,
      robotDark: 0x0a1a2a,
      wheel: 0x1a1a1a
    },
    effect: {
      primary: 0x00f5ff,
      edge: 0x00eaff,
      route: 0x00f5ff,
      routeDot: 0x8fffff,
      roadMark: 0xffcc00,
      water: 0x00aacc,
      portalBg: '#020811',
      portalBgRgb: '2, 8, 17',
      portalParticle: '#00f5ff'
    }
  },
  semantic: { primary: 0x00f5ff, success: 0x26f2a3, warning: 0xffb642, danger: 0xff554f }
}

export const blueWhiteTheme = {
  name: 'blueWhite',
  css: {
    pageBg: '#f4f9ff',
    pageGradient: 'linear-gradient(180deg, #f7fbff 0%, #edf6ff 100%)',
    panelBg: '#f6fbff',
    panelMask: 'rgba(45,140,255,.055)',
    panelBorder: 'rgba(45,140,255,.28)',
    panelShadow: 'inset 0 0 28px rgba(73,145,255,.08), 0 8px 22px rgba(36,93,170,.08)',
    cardBg: 'rgba(255,255,255,.86)',
    cardBorder: 'rgba(45,140,255,.22)',
    buttonBg: 'rgba(255,255,255,.78)',
    buttonActiveBg: 'linear-gradient(180deg, #2d8cff, #126bff)',
    buttonText: '#17456f',
    primary: '#126bff',
    primarySoft: 'rgba(18,107,255,.14)',
    text: '#17324d',
    muted: '#60708a',
    weak: 'rgba(68,93,124,.58)',
    danger: '#ff4d43',
    dangerBg: 'rgba(255,77,67,.10)',
    success: '#18a869',
    progress: 'linear-gradient(90deg, #126bff, #67b7ff)'
  },
  three: {
    clear: 0xf3f9ff,
    fog: 0xe8f3ff,
    lights: { ambient: 0xffffff, ambientIntensity: 1.05, directional: 0xffffff, directionalIntensity: 1.65, point: 0x2d8cff, pointIntensity: 1.2 },
    grid: { main: 0x7db7ff, sub: 0xc9dff7, opacity: 0.28 },
    material: {
      ground: 0xeaf3fb,
      platform: 0xe8f2fc,
      road: 0xdcecff,
      wall: 0xd7eaff,
      wallEmissive: 0x9cc9ff,
      building: 0xd7ebff,
      buildingAlarm: 0xffdfdc,
      buildingEmissive: 0x7db7ff,
      furniture: 0xc9d9e8,
      ceilingLight: 0xffffff,
      robotBody: 0xffffff,
      robotDark: 0x245377,
      wheel: 0x35495f
    },
    effect: {
      primary: 0x126bff,
      edge: 0x2d8cff,
      route: 0x126bff,
      routeDot: 0x5fb0ff,
      roadMark: 0xffa726,
      water: 0x4bb7ff,
      portalBg: '#f4f9ff',
      portalBgRgb: '244, 249, 255',
      portalParticle: '#126bff'
    }
  },
  semantic: { primary: 0x126bff, success: 0x18a869, warning: 0xff9f1a, danger: 0xff4d43 }
}

export const sceneThemes = {
  darkTech: darkTechTheme,
  blueWhite: blueWhiteTheme
}

export function getSceneTheme (themeName = 'blueWhite') {
  return sceneThemes[themeName] || blueWhiteTheme
}

export function applyThemeVars (theme) {
  return {
    '--scene-page-bg': theme.css.pageBg,
    '--scene-page-gradient': theme.css.pageGradient,
    '--scene-panel-bg': theme.css.panelBg,
    '--scene-panel-mask': theme.css.panelMask,
    '--scene-panel-border': theme.css.panelBorder,
    '--scene-panel-shadow': theme.css.panelShadow,
    '--scene-card-bg': theme.css.cardBg,
    '--scene-card-border': theme.css.cardBorder,
    '--scene-button-bg': theme.css.buttonBg,
    '--scene-button-active-bg': theme.css.buttonActiveBg,
    '--scene-button-text': theme.css.buttonText,
    '--scene-primary': theme.css.primary,
    '--scene-primary-soft': theme.css.primarySoft,
    '--scene-text': theme.css.text,
    '--scene-muted': theme.css.muted,
    '--scene-weak': theme.css.weak,
    '--scene-danger': theme.css.danger,
    '--scene-danger-bg': theme.css.dangerBg,
    '--scene-success': theme.css.success,
    '--scene-progress': theme.css.progress
  }
}

export function resolveToneColor (theme, tone, fallback = 'primary') {
  return theme.semantic[tone] || theme.semantic[fallback] || theme.semantic.primary
}

export function assertThemeComplete (theme) {
  const missing = requiredPaths.filter(path => {
    return path.split('.').reduce((value, key) => value && value[key], theme) === undefined
  })
  if (missing.length) throw new Error(`Theme "${theme.name}" missing tokens: ${missing.join(', ')}`)
}
```

- [ ] **Step 2: Create token verification script**

Add `scripts/verify-theme-tokens.mjs`:

```js
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const sourcePath = path.join(root, 'src/theme/sceneThemes.js')
const tempDir = path.join(root, 'node_modules/.cache/theme-verify')
const tempPath = path.join(tempDir, 'sceneThemes.mjs')

fs.mkdirSync(tempDir, { recursive: true })
fs.copyFileSync(sourcePath, tempPath)

const mod = await import(pathToFileURL(tempPath))
;[mod.darkTechTheme, mod.blueWhiteTheme].forEach(theme => mod.assertThemeComplete(theme))

const vars = mod.applyThemeVars(mod.blueWhiteTheme)
const requiredCssVars = ['--scene-panel-bg', '--scene-primary', '--scene-text', '--scene-progress']
const missingVars = requiredCssVars.filter(key => !vars[key])
if (missingVars.length) throw new Error(`Missing CSS vars: ${missingVars.join(', ')}`)

console.log('Theme tokens verified')
```

- [ ] **Step 3: Run token verification**

Run:

```bash
node scripts/verify-theme-tokens.mjs
```

Expected:

```text
Theme tokens verified
```

- [ ] **Step 4: Commit**

Run:

```bash
git add src/theme/sceneThemes.js scripts/verify-theme-tokens.mjs
git commit -m "feat: add scene theme tokens"
```

---

### Task 2: Wire Theme Into App And Vue Components

**Files:**
- Modify: `src/App.vue`
- Modify: `src/components/IotCenterScene.vue`
- Modify: `src/components/RobotCenterScene.vue`

- [ ] **Step 1: Update App.vue script to expose theme vars**

In `src/App.vue`, import theme helpers and add `themeName`, `theme`, `themeVars`.

```js
import { applyThemeVars, getSceneTheme } from './theme/sceneThemes'

export default {
  name: 'App',
  data () {
    return {
      mode: 'iot',
      themeName: 'blueWhite',
      eventLogs: [],
      demoRunning: false,
      demoProgress: 0,
      chapterTitle: '',
      chapterTimer: null
    }
  },
  computed: {
    theme () {
      return getSceneTheme(this.themeName)
    },
    themeVars () {
      return applyThemeVars(this.theme)
    }
  }
}
```

Keep the existing data fields that are already present in the file; merge the new `themeName`, `theme`, and `themeVars` into the current component rather than replacing methods.

- [ ] **Step 2: Apply theme vars in App.vue template**

Set the root page style and pass `theme-name` to both scene components:

```vue
<div class="app-page" :style="themeVars">
  <header class="app-head">
    ...
  </header>
  <main class="app-shell">
    <IotCenterScene
      v-if="mode === 'iot'"
      :theme-name="themeName"
      @scene-event="handleSceneEvent"
    />
    <RobotCenterScene
      v-else
      :theme-name="themeName"
      @scene-event="handleSceneEvent"
    />
  </main>
</div>
```

If the existing component tags have other props such as `disabled` or `auto-play`, keep them and add only `:theme-name="themeName"`.

- [ ] **Step 3: Replace App.vue global CSS colors with variables**

Update the color-bearing selectors in `src/App.vue`:

```css
html,
body {
  margin: 0;
  width: 100%;
  min-height: 100%;
  background: var(--scene-page-bg, #f4f9ff);
  font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
  color: var(--scene-text, #17324d);
}

.app-page {
  min-height: 100vh;
  padding: 22px;
  background: var(--scene-page-gradient, linear-gradient(180deg, #f7fbff, #edf6ff));
}

.app-head p {
  margin: 8px 0 0;
  color: var(--scene-muted, #60708a);
}

.switches button {
  height: 38px;
  padding: 0 18px;
  color: var(--scene-button-text, #17456f);
  border: 1px solid var(--scene-panel-border, rgba(45,140,255,.28));
  background: var(--scene-button-bg, rgba(255,255,255,.78));
  cursor: pointer;
}

.switches button.active {
  color: #fff;
  background: var(--scene-button-active-bg, linear-gradient(180deg, #2d8cff, #126bff));
  box-shadow: 0 0 16px var(--scene-primary-soft, rgba(18,107,255,.14)) inset;
}

.event-log {
  max-width: 1500px;
  margin: 12px auto 0;
  padding: 12px 14px;
  border: 1px solid var(--scene-card-border, rgba(45,140,255,.22));
  background: var(--scene-card-bg, rgba(255,255,255,.86));
  color: var(--scene-muted, #60708a);
}
```

- [ ] **Step 4: Add `themeName` prop to both scene components**

In `src/components/IotCenterScene.vue`:

```js
props: {
  height: { type: String, default: '620px' },
  autoPlay: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  themeName: { type: String, default: 'blueWhite' }
}
```

In `src/components/RobotCenterScene.vue`:

```js
props: {
  height: { type: String, default: '620px' },
  robotSpeed: { type: Number, default: 7 },
  dwellScale: { type: Number, default: 1 },
  autoPlay: { type: Boolean, default: true },
  disabled: { type: Boolean, default: false },
  themeName: { type: String, default: 'blueWhite' }
}
```

- [ ] **Step 5: Pass themeName into SceneRuntime**

In `IotCenterScene.vue`:

```js
this.runtime = new SceneRuntime({
  container: this.$refs.host,
  config,
  mode: 'iot',
  themeName: this.themeName,
  onEvent: this.handleRuntimeEvent
})
```

In `RobotCenterScene.vue`:

```js
this.runtime = new SceneRuntime({
  container: this.$refs.host,
  config,
  mode: 'robot',
  themeName: this.themeName,
  options: { robotSpeed: this.robotSpeed, dwellScale: this.dwellScale },
  onEvent: this.handleRuntimeEvent
})
```

- [ ] **Step 6: Replace scene component CSS colors with variables**

For both component CSS blocks, use the same variable mapping:

```css
.scene-panel {
  border: 1px solid var(--scene-panel-border);
  background: var(--scene-panel-bg);
  box-shadow: var(--scene-panel-shadow);
}

.scene-panel:before {
  background:
    repeating-linear-gradient(90deg, transparent 0 38px, var(--scene-panel-mask) 39px 40px),
    repeating-linear-gradient(0deg, transparent 0 38px, var(--scene-panel-mask) 39px 40px);
}

.head b {
  color: var(--scene-primary);
  text-shadow: 0 0 10px var(--scene-primary-soft);
}

.head span,
.hint {
  color: var(--scene-weak);
}

.badges i,
.toolbar button,
.tip,
.side,
.task {
  border-color: var(--scene-card-border);
  background: var(--scene-card-bg);
}

.toolbar button {
  color: var(--scene-button-text);
  background: var(--scene-button-bg);
}

.toolbar button.active {
  color: #fff;
  background: var(--scene-button-active-bg);
}

.toolbar .danger {
  color: var(--scene-danger);
  border-color: color-mix(in srgb, var(--scene-danger) 52%, transparent);
  background: var(--scene-danger-bg);
}

.host {
  background: var(--scene-panel-bg);
}

.tip h4,
.task strong,
.side h4 {
  color: var(--scene-primary);
}

.tip p {
  color: var(--scene-text);
}

.tip em {
  color: var(--scene-danger);
}

.tip small {
  color: var(--scene-muted);
}

.task b,
.side b {
  color: var(--scene-success);
}

.bar i {
  background: var(--scene-progress);
}
```

Use direct `rgba(...)` fallback instead of `color-mix(...)` if the target browser set does not support `color-mix`.

- [ ] **Step 7: Build check**

Run:

```bash
pnpm build
```

Expected:

```text
✓ built in
```

- [ ] **Step 8: Commit**

Run:

```bash
git add src/App.vue src/components/IotCenterScene.vue src/components/RobotCenterScene.vue
git commit -m "feat: apply scene theme variables to vue shell"
```

---

### Task 3: Inject Theme Through Three Runtime

**Files:**
- Modify: `src/three-core/SceneRuntime.js`
- Modify: `src/three-core/SceneManager.js`
- Modify: `src/three-core/ModelManager.js`

- [ ] **Step 1: Resolve theme in SceneRuntime**

At the top of `src/three-core/SceneRuntime.js`:

```js
import { getSceneTheme } from '../theme/sceneThemes'
```

Change the constructor signature and initialization:

```js
constructor ({ container, config, mode, onEvent, options, themeName, theme }) {
  this.container = container
  this.config = config
  this.mode = mode
  this.options = options || {}
  this.theme = theme || getSceneTheme(themeName)
  this.onEvent = onEvent || (() => {})
```

- [ ] **Step 2: Use theme for scene background, fog, and lights**

Replace the current hard-coded values:

```js
this.scene = new THREE.Scene()
this.scene.fog = new THREE.Fog(this.theme.three.fog, 96, 310)

this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
this.renderer.setClearColor(this.theme.three.clear, 1)
this.renderer.outputColorSpace = THREE.SRGBColorSpace
```

Replace lights:

```js
const lightTheme = this.theme.three.lights
this.scene.add(new THREE.AmbientLight(lightTheme.ambient, lightTheme.ambientIntensity))
const dirLight = new THREE.DirectionalLight(lightTheme.directional, lightTheme.directionalIntensity)
dirLight.position.set(80, 130, 70)
this.scene.add(dirLight)
const pointLight = new THREE.PointLight(lightTheme.point, lightTheme.pointIntensity, 180)
pointLight.position.set(0, 48, 0)
this.scene.add(pointLight)
```

- [ ] **Step 3: Pass theme to managers**

Replace manager construction:

```js
const models = new ModelManager(this.theme)
const resources = new ResourceTracker()
const anims = new AnimationManager()
const layers = new LayerManager(this.scene)
const camera = new CameraController(this.camera, this.controls, this.renderer)
const interactions = new InteractionManager(this.camera, this.renderer.domElement)
const effects = new EffectManager(layers, anims, this.theme)

const particles = new ParticleSystem(this.scene, {
  count: 250,
  bounds: { x: 110, y: [12, 55], z: 60 },
  theme: this.theme
})

const portal = new PortalTransition(this.container, this.theme)
const sceneManager = new SceneManager({ models, layers, anims, interactions, resources, effects, theme: this.theme })
```

- [ ] **Step 4: Theme runtime effects**

In `_playFloorScanRing()`:

```js
const ringMat = new THREE.MeshBasicMaterial({
  color: this.theme.three.effect.primary,
  transparent: true,
  opacity: 0.36,
  depthWrite: false
})
```

In `_updateHeatMap()`:

```js
new THREE.MeshBasicMaterial({
  color: this.theme.three.effect.primary,
  transparent: true,
  opacity: 0.12,
  side: THREE.DoubleSide,
  depthWrite: false
})
```

- [ ] **Step 5: Pass theme through SceneManager**

In `src/three-core/SceneManager.js`, save theme in constructor:

```js
this.theme = managers.theme
```

Add it to the local `managers` object in `loadScene()`:

```js
const managers = {
  models: this.models,
  layers: this.layers,
  anims: this.anims,
  interactions: this.interactions,
  theme: this.theme
}
```

- [ ] **Step 6: Update ModelManager constructor and base methods**

At the top of `src/three-core/ModelManager.js`:

```js
import { getSceneTheme } from '../theme/sceneThemes'
```

Add constructor:

```js
constructor (theme) {
  this.theme = theme || getSceneTheme()
}
```

Update defaults:

```js
createStandardMaterial (color, opacity = 0.78, emissive = this.theme.three.material.buildingEmissive) {
  return new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity,
    roughness: 0.46,
    metalness: 0.22,
    emissive,
    emissiveIntensity: 0.22
  })
}

addEdges (mesh, color = this.theme.three.effect.edge, opacity = 0.7) {
  const edgesGeo = new THREE.EdgesGeometry(mesh.geometry)
  const edgesMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  const lineSegments = new THREE.LineSegments(edgesGeo, edgesMat)
  mesh.add(lineSegments)
  return lineSegments
}

createRing (radius, color = this.theme.three.effect.primary) {
  ...
}

createGrid (size, w = 220, h = 220) {
  const group = new THREE.Group()
  const grid = new THREE.GridHelper(size, 40, this.theme.three.grid.main, this.theme.three.grid.sub)
  grid.material.transparent = true
  grid.material.opacity = this.theme.three.grid.opacity
  group.add(grid)

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({
      color: this.theme.three.material.ground,
      roughness: 0.82,
      metalness: 0.04,
      transparent: true,
      opacity: 0.98
    })
  )
  ground.rotation.x = -Math.PI / 2
  group.add(ground)
  return group
}
```

- [ ] **Step 7: Theme ModelManager labels**

Replace `createLabel()` CSS string with theme CSS:

```js
createLabel (text, alarm = false) {
  const el = document.createElement('div')
  el.textContent = text
  const css = this.theme.css
  el.style.cssText = [
    `color:${alarm ? css.danger : css.text}`,
    'font-size:12px',
    'white-space:nowrap',
    'letter-spacing:1px',
    `background:${css.cardBg}`,
    `border:1px solid ${alarm ? css.danger : css.cardBorder}`,
    'padding:4px 10px',
    `box-shadow:0 0 12px ${alarm ? 'rgba(255,77,67,.18)' : css.primarySoft}`,
    'backdrop-filter:blur(2px)',
    'pointer-events:none',
    'border-radius:4px'
  ].join(';')
  return new CSS2DObject(el)
}
```

- [ ] **Step 8: Verify runtime compiles**

Run:

```bash
pnpm build
```

Expected:

```text
✓ built in
```

- [ ] **Step 9: Commit**

Run:

```bash
git add src/three-core/SceneRuntime.js src/three-core/SceneManager.js src/three-core/ModelManager.js
git commit -m "feat: inject theme into three runtime"
```

---

### Task 4: Theme Park, Floor, And Robot Builders

**Files:**
- Modify: `src/scene-builders/park.builder.js`
- Modify: `src/scene-builders/floor.builder.js`
- Modify: `src/scene-builders/robot.builder.js`

- [ ] **Step 1: Read theme from managers in each builder**

In each default builder function:

```js
const { models, layers, anims, interactions, theme } = managers
```

Pass `theme` into helper functions that currently define materials.

- [ ] **Step 2: Replace park base colors**

In `src/scene-builders/park.builder.js`, use these replacements:

```js
new THREE.MeshStandardMaterial({
  color: theme.three.material.platform,
  roughness: 0.9,
  metalness: 0.05,
  transparent: true,
  opacity: 0.94
})

models.addEdges(platform, theme.three.grid.sub, 0.22)

new THREE.MeshStandardMaterial({
  color: theme.three.material.road,
  roughness: 0.92,
  metalness: 0.05,
  transparent: true,
  opacity: 0.9,
  side: THREE.DoubleSide
})

const edgeColor = theme.three.effect.edge
const roadMarkColor = theme.three.effect.roadMark
```

- [ ] **Step 3: Replace park building and device colors**

In `createBuilding()`:

```js
const tone = alarm ? theme.semantic.danger : theme.three.effect.edge
const bodyMat = new THREE.MeshStandardMaterial({
  color: alarm ? theme.three.material.buildingAlarm : theme.three.material.building,
  transparent: true,
  opacity: alarm ? 0.82 : 0.86,
  roughness: 0.42,
  metalness: 0.12,
  emissive: alarm ? theme.semantic.danger : theme.three.material.buildingEmissive,
  emissiveIntensity: alarm ? 0.28 : 0.08
})
models.addEdges(body, tone, alarm ? 0.72 : 0.5)
```

In device creation:

```js
const c = d.alarm ? theme.semantic.danger : theme.three.effect.primary
```

Keep red/orange/green semantic colors for status meaning; only replace palette-level blue/cyan and surface colors.

- [ ] **Step 4: Replace floor builder colors**

In `src/scene-builders/floor.builder.js`:

```js
new THREE.MeshStandardMaterial({
  color: theme.three.material.wall,
  transparent: true,
  opacity: 0.58,
  roughness: 0.38,
  metalness: 0.12,
  emissive: theme.three.material.wallEmissive,
  emissiveIntensity: 0.06
})

models.addEdges(m, theme.three.effect.edge, 0.38)

new THREE.MeshBasicMaterial({
  color: theme.three.material.ceilingLight,
  transparent: true,
  opacity: 0.16,
  side: THREE.DoubleSide
})

const glowColor = alarm ? theme.semantic.danger : r.color
const c = d.alarm ? theme.semantic.danger : theme.three.effect.primary
```

- [ ] **Step 5: Replace robot builder colors**

In `src/scene-builders/robot.builder.js`, use theme tokens:

```js
const glowColor = r.status === '已完成'
  ? theme.semantic.success
  : active
    ? theme.three.effect.primary
    : theme.semantic.warning

new THREE.MeshStandardMaterial({
  color: theme.three.material.furniture,
  roughness: 0.3,
  metalness: 0.24,
  emissive: theme.three.material.wallEmissive,
  emissiveIntensity: 0.08
})

new THREE.LineDashedMaterial({
  color: theme.three.effect.route,
  transparent: true,
  opacity: 0.42,
  dashSize: 2,
  gapSize: 1.5
})

new THREE.MeshStandardMaterial({
  color: theme.three.material.robotBody,
  roughness: 0.32,
  metalness: 0.18,
  emissive: theme.three.material.wallEmissive,
  emissiveIntensity: 0.08
})
```

In battery color animation:

```js
if (battery > 50) color = new THREE.Color(theme.semantic.success)
else if (battery > 30) color = new THREE.Color(theme.semantic.warning)
else color = new THREE.Color(theme.semantic.danger)
```

- [ ] **Step 6: Verify no primary dark-cyan tokens remain in builders**

Run:

```bash
rg -n "0x00f5ff|0x00eaff|0x020811|0x071520|0x0a1820|0x1a3a4a|0x00384c" src/scene-builders src/three-core
```

Expected: Matches only in `src/theme/sceneThemes.js`, or no matches outside intentionally preserved docs/comments.

- [ ] **Step 7: Build check**

Run:

```bash
pnpm build
```

Expected:

```text
✓ built in
```

- [ ] **Step 8: Commit**

Run:

```bash
git add src/scene-builders/park.builder.js src/scene-builders/floor.builder.js src/scene-builders/robot.builder.js
git commit -m "feat: theme scene builders"
```

---

### Task 5: Theme Particles, Transitions, And Alarm Effects

**Files:**
- Modify: `src/three-core/ParticleSystem.js`
- Modify: `src/three-core/PortalTransition.js`
- Modify: `src/three-core/EffectManager.js`

- [ ] **Step 1: Add theme to ParticleSystem**

Change constructor:

```js
constructor (scene, opts = {}) {
  this.scene = scene
  this.count = opts.count || 250
  this.bounds = opts.bounds || { x: 110, y: [12, 55], z: 60 }
  this.theme = opts.theme
  this.points = null
  this._phaseData = null
}
```

Replace gradient and material:

```js
const cssPrimary = this.theme?.css?.primary || '#126bff'
gradient.addColorStop(0, cssPrimary)
gradient.addColorStop(0.25, 'rgba(18, 107, 255, 0.45)')
gradient.addColorStop(0.6, 'rgba(18, 107, 255, 0.08)')
gradient.addColorStop(1, 'rgba(18, 107, 255, 0)')

const material = new THREE.PointsMaterial({
  size: 2.2,
  map: texture,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  transparent: true,
  opacity: 0.42,
  color: this.theme?.three?.effect?.primary || 0x126bff
})
```

- [ ] **Step 2: Add theme to PortalTransition**

Change constructor:

```js
constructor (container, theme) {
  this.container = container
  this.theme = theme
  this.canvas = null
  this.ctx = null
  this.particles = []
  this.running = false
}
```

Replace overlay fills:

```js
const bgRgb = this.theme?.three?.effect?.portalBgRgb || '244, 249, 255'
this.ctx.fillStyle = `rgba(${bgRgb}, ${progress})`
```

Replace solid fill:

```js
this.ctx.fillStyle = this.theme?.three?.effect?.portalBg || '#f4f9ff'
```

Replace particle drawing:

```js
const particleColor = this.theme?.three?.effect?.portalParticle || '#126bff'
ctx.fillStyle = particleColor
ctx.shadowColor = particleColor
```

- [ ] **Step 3: Add theme to EffectManager**

Change constructor to accept theme:

```js
constructor (layers, anims, theme) {
  this.layers = layers
  this.anims = anims
  this.theme = theme
  this._activeAlarms = new Map()
}
```

Replace alarm sphere material:

```js
new THREE.MeshBasicMaterial({
  color: this.theme?.semantic?.danger || 0xff4d43,
  transparent: true,
  opacity: 0.24,
  wireframe: true
})
```

- [ ] **Step 4: Build check**

Run:

```bash
pnpm build
```

Expected:

```text
✓ built in
```

- [ ] **Step 5: Commit**

Run:

```bash
git add src/three-core/ParticleSystem.js src/three-core/PortalTransition.js src/three-core/EffectManager.js
git commit -m "feat: theme scene effects"
```

---

### Task 6: Tune Scene Config Semantic Colors

**Files:**
- Modify: `src/scene-config/iotScene.config.js`
- Modify: `src/scene-config/robotScene.config.js`
- Modify: `src/theme/sceneThemes.js`

- [ ] **Step 1: Add semantic tone resolver for scene-config objects**

In `src/theme/sceneThemes.js`, keep `resolveToneColor()` from Task 1 and use it from builders where a config object has `tone`:

```js
const roomColor = r.tone ? resolveToneColor(theme, r.tone) : r.color
```

Import it in builders:

```js
import { resolveToneColor } from '../theme/sceneThemes'
```

- [ ] **Step 2: Add tone fields without deleting existing color fields**

In `src/scene-config/iotScene.config.js`, add semantic tones:

```js
{ id: 'corridor', title: '公共走廊', position: [18, -2], size: [94, 18], color: 0x00f5ff, tone: 'primary' }
{ id: 'pump', title: '水泵房', position: [48, -26], size: [28, 24], color: 0xff554f, tone: 'danger', alarm: true }
{ id: 'power', title: '配电房', position: [-42, 26], size: [36, 24], color: 0xffb642, tone: 'warning', alarm: true }
{ id: 'monitor', title: '监控室', position: [50, 24], size: [28, 24], color: 0x2d8cff, tone: 'primary' }
```

In `src/scene-config/robotScene.config.js`, add:

```js
{ id: 'lobby', title: '大堂前厅', position: [-56, -28], size: [42, 28], color: 0x00f5ff, tone: 'success', status: '已完成' }
{ id: 'corridor', title: '公共走廊', position: [38, -6], size: [82, 20], color: 0x00f5ff, tone: 'primary', status: '执行中' }
{ id: 'charge', title: '充电区周边', position: [58, 32], size: [48, 24], color: 0xffb642, tone: 'warning', status: '待执行' }
```

- [ ] **Step 3: Use semantic tone in floor and robot room creation**

In `floor.builder.js`:

```js
const roomColor = r.tone ? resolveToneColor(theme, r.tone) : r.color
const floorMat = new THREE.MeshStandardMaterial({
  color: roomColor,
  transparent: true,
  opacity: alarm ? 0.24 : 0.18,
  roughness: 0.32,
  metalness: 0.18,
  emissive: roomColor,
  emissiveIntensity: alarm ? 0.08 : 0.035
})
models.addEdges(floor, roomColor, alarm ? 0.7 : 0.45)
```

In `robot.builder.js`:

```js
const roomColor = r.tone ? resolveToneColor(theme, r.tone) : r.color
const floorMat = new THREE.MeshStandardMaterial({
  color: roomColor,
  transparent: true,
  opacity: active ? 0.28 : 0.16,
  roughness: 0.32,
  metalness: 0.18,
  emissive: roomColor,
  emissiveIntensity: active ? 0.08 : 0.03
})
models.addEdges(floor, roomColor, active ? 0.72 : 0.4)
```

- [ ] **Step 4: Build and token verification**

Run:

```bash
node scripts/verify-theme-tokens.mjs
pnpm build
```

Expected:

```text
Theme tokens verified
✓ built in
```

- [ ] **Step 5: Commit**

Run:

```bash
git add src/theme/sceneThemes.js src/scene-config/iotScene.config.js src/scene-config/robotScene.config.js src/scene-builders/floor.builder.js src/scene-builders/robot.builder.js
git commit -m "feat: map scene status colors through theme tones"
```

---

### Task 7: Visual Verification And Final Polish

**Files:**
- Modify as needed: `src/theme/sceneThemes.js`
- Modify as needed: `src/components/IotCenterScene.vue`
- Modify as needed: `src/components/RobotCenterScene.vue`

- [ ] **Step 1: Run local dev server**

Run:

```bash
pnpm dev
```

Expected:

```text
Local:
```

Use the printed localhost URL for visual checks.

- [ ] **Step 2: Verify IOT scene visually**

Open the local URL and inspect IOT mode:

```text
Expected visual result:
- Page and scene panel are light blue-white, not dark navy.
- Toolbar buttons use white/light-blue default style and solid blue active style.
- Three canvas background is pale blue-white.
- Building/road/grid edges remain readable.
- Alarm devices remain red/orange and visually prominent.
- CSS2D labels are readable on the light scene.
```

- [ ] **Step 3: Verify Robot scene visually**

Switch to robot mode:

```text
Expected visual result:
- Floor grid and room blocks are visible on light background.
- Route path is medium blue and readable.
- Robot body remains white/gray and does not disappear into the ground.
- Status ring uses green/yellow/red according to battery.
- Tooltip/task cards use white translucent surfaces and blue accents.
```

- [ ] **Step 4: Tune only theme values for contrast issues**

If the scene is too washed out, update `blueWhiteTheme` only:

```js
grid: { main: 0x5aa4ff, sub: 0xb5d2ee, opacity: 0.34 },
material: {
  ground: 0xe3effa,
  platform: 0xdfeefa,
  road: 0xd0e4fa,
  building: 0xcbe4ff,
  buildingEmissive: 0x5aa4ff
},
effect: {
  primary: 0x0a64ea,
  edge: 0x126bff,
  route: 0x0a64ea
}
```

If text contrast is weak, update CSS tokens only:

```js
text: '#102a43',
muted: '#52677f',
weak: 'rgba(47,73,103,.66)',
cardBg: 'rgba(255,255,255,.92)',
cardBorder: 'rgba(45,140,255,.30)'
```

- [ ] **Step 5: Final validation**

Run:

```bash
node scripts/verify-theme-tokens.mjs
pnpm build
rg -n "background:#020811|background: #020811|0x020811|#00f5ff|0x00f5ff" src/App.vue src/components src/three-core src/scene-builders
```

Expected:

```text
Theme tokens verified
✓ built in
```

The `rg` command should not report unthemed hard-coded primary/background colors outside `src/theme/sceneThemes.js`. If it reports a preserved semantic alarm/status color, leave it only when the color represents business state rather than theme surface.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/theme/sceneThemes.js src/App.vue src/components/IotCenterScene.vue src/components/RobotCenterScene.vue src/three-core src/scene-builders
git commit -m "chore: polish blue white scene theme"
```

---

## Self-Review

**Spec coverage:** 本计划覆盖色系抽离、蓝白浅色主题、Vue UI、Three 场景、粒子/转场/告警特效、状态语义色、构建验证和人工视觉验收。

**Placeholder scan:** 计划没有保留 `TBD`、空泛错误处理、未定义函数或“照上面做”类步骤；所有新增函数名都在 Task 1 或后续任务中定义。

**Type consistency:** `themeName` 从 Vue 组件传入 `SceneRuntime`，`SceneRuntime` 解析 `theme` 后传入 `ModelManager`、`SceneManager`、`EffectManager`、`ParticleSystem`、`PortalTransition`，builder 通过 `managers.theme` 使用同一对象。
