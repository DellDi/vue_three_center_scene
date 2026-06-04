<template>
  <div class="app-page" :style="themeVars">
    <div class="app-head">
      <div>
        <h1>智慧物业数字孪生平台</h1>
        <p>三维可视化场景交互区域，周边指标大屏由现有平台承载。</p>
      </div>
      <div class="switches">
        <button :class="{ active: active === 'iot' }" @click="active = 'iot'">IOT 园区场景</button>
        <button :class="{ active: active === 'robot' }" @click="active = 'robot'" :disabled="demoRunning">机器人清洁场景</button>
        <button
          v-if="!demoRunning"
          class="demo-btn"
          @click="startDemo"
        >🎬 开始演示</button>
        <div v-else class="demo-progress-bar">
          <div class="demo-progress-fill" :style="{ width: demoProgress + '%' }"></div>
          <span class="demo-progress-label">{{ demoChapter || '演示中...' }}</span>
        </div>
      </div>
    </div>
    <div class="app-shell">
      <iot-center-scene
        v-show="active === 'iot'"
        ref="iotScene"
        height="720px"
        :auto-play="false"
        :disabled="demoRunning"
        :theme-name="themeName"
        @scene-event="handleSceneEvent"
      />
      <robot-center-scene
        v-show="active === 'robot'"
        ref="robotScene"
        height="720px"
        :robot-speed="7"
        :dwell-scale="1"
        :auto-play="false"
        :disabled="demoRunning"
        :theme-name="themeName"
        @scene-event="handleSceneEvent"
      />

      <!-- 章节标题叠加层 -->
      <transition name="chapter">
        <div v-if="chapterTitle" class="chapter-overlay" :key="chapterTitle">
          {{ chapterTitle }}
        </div>
      </transition>
    </div>
    <div class="event-log"><b>最近事件：</b>{{ latestEvent || '点击对象、切换视角、自动导览、告警联动后，会在这里显示事件。' }}</div>
  </div>
</template>

<script>
import IotCenterScene from './components/IotCenterScene.vue'
import RobotCenterScene from './components/RobotCenterScene.vue'
import { applyThemeVars, getSceneTheme } from './theme/sceneThemes'

/** 场景 key → 组件 ref 映射 */
const SCENES = {
  iot: { ref: 'iotScene', label: 'IOT 园区场景' },
  robot: { ref: 'robotScene', label: '机器人清洁场景' }
}

export default {
  name: 'App',
  components: { IotCenterScene, RobotCenterScene },
  data () {
    return {
      active: 'iot',
      themeName: 'blueWhite',
      latestEvent: '',
      demoRunning: false,
      demoProgress: 0,
      demoChapter: '',
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
  },
  watch: {
    active (val) {
      this.$nextTick(() => {
        const cfg = SCENES[val]
        if (!cfg) return
        const scene = this.$refs[cfg.ref]
        if (scene && scene.runtime) this._resizeScene(scene)
      })
    }
  },
  methods: {
    /** 获取当前活跃场景的 runtime 引用 */
    _activeRuntime () {
      const cfg = SCENES[this.active]
      return cfg ? this.$refs[cfg.ref]?.runtime : null
    },
    _resizeScene (scene) {
      const host = scene.$el?.querySelector('.host')
      if (!host || !scene.runtime) return
      const w = host.clientWidth || 1
      const h = host.clientHeight || 1
      if (scene.runtime.cameraCtrl) scene.runtime.cameraCtrl.resize(w, h)
      if (scene.runtime.labelRenderer) scene.runtime.labelRenderer.setSize(w, h)
      if (scene.runtime.renderer) scene.runtime.renderer.setSize(w, h)
    },
    handleSceneEvent (event) {
      this.latestEvent = `[${event.type}] ${event.title || event.id || ''}`

      // Demo 事件处理
      if (event.type === 'demo-started') {
        this.demoRunning = true
        this.demoProgress = 0
        // 停止所有场景中可能正在运行的手动导览
        Object.values(SCENES).forEach(cfg => {
          const scene = this.$refs[cfg.ref]
          if (scene && scene.runtime) scene.runtime.execute({ type: 'STOP_TOUR' })
        })
      }
      if (event.type === 'demo-stopped') {
        this.demoRunning = false
        this.demoProgress = 100
      }
      if (event.type === 'demo-progress') {
        this.demoProgress = (event.elapsed / event.total) * 100
        this.demoChapter = this._getChapterName(event.stepIndex)
      }
      if (event.type === 'chapter-title') {
        this.showChapterTitle(event.text)
      }
      if (event.type === 'switch-scene') {
        this.active = event.scene
        this.$nextTick(() => {
          const runtime = this._activeRuntime()
          if (runtime) runtime.execute({ type: 'SCENE_SWITCH_READY' })
        })
      }
      if (event.type === 'act0-opening') {
        this.showChapterTitle('全域感知·数字孪生')
      }
      if (event.type === 'act3-closing') {
        this.showChapterTitle('全域管控')
      }
    },
    async startDemo () {
      this.demoRunning = true
      // 确保演示从 IOT 场景开始
      if (this.active !== 'iot') {
        this.active = 'iot'
        await this.$nextTick()
        await new Promise(r => setTimeout(r, 500))
      }
      const runtime = this._activeRuntime()
      if (runtime) runtime.execute({ type: 'START_DEMO' })
    },
    showChapterTitle (text) {
      this.chapterTitle = text
      clearTimeout(this.chapterTimer)
      this.chapterTimer = setTimeout(() => {
        this.chapterTitle = ''
      }, 2500)
    },
    _getChapterName (stepIndex) {
      const chapters = ['开场', '全域感知', '智慧感知', '自动执行', '全域管控']
      return chapters[Math.min(stepIndex, chapters.length - 1)] || ''
    }
  }
}
</script>

<style>
html,
body {
  margin: 0;
  width: 100%;
  min-height: 100%;
  background: var(--scene-page-bg, #f4f9ff);
  font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif;
  color: var(--scene-text, #17324d);
}

* {
  box-sizing: border-box;
}

.app-page {
  min-height: 100vh;
  padding: 22px;
  color: var(--scene-text, #17324d);
  background: var(--scene-page-gradient, linear-gradient(180deg, #f7fbff 0%, #edf6ff 100%));
}

.app-head {
  max-width: 1500px;
  margin: 0 auto 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.app-head h1 {
  margin: 0;
  font-size: 25px;
  letter-spacing: 2px;
  color: var(--scene-text, #17324d);
}

.app-head p {
  margin: 8px 0 0;
  color: var(--scene-muted, #60708a);
}

.switches {
  display: flex;
  gap: 10px;
}

.switches button {
  height: 38px;
  padding: 0 18px;
  color: var(--scene-button-text, #17456f);
  border: 1px solid var(--scene-panel-border, rgba(45, 140, 255, 0.28));
  background: var(--scene-button-bg, rgba(255, 255, 255, 0.78));
  cursor: pointer;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: all 0.25s;
}

.switches button.active {
  color: #fff;
  background: var(--scene-button-active-bg, linear-gradient(180deg, #2d8cff, #126bff));
  box-shadow: inset 0 0 16px var(--scene-primary-soft, rgba(18, 107, 255, 0.14));
}

.switches button:hover:not(:disabled) {
  border-color: var(--scene-primary, #126bff);
  box-shadow: 0 0 16px var(--scene-primary-soft, rgba(18, 107, 255, 0.14));
}

.switches button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.app-shell {
  max-width: 1500px;
  margin: 0 auto;
  position: relative;
}

.event-log {
  max-width: 1500px;
  margin: 12px auto 0;
  padding: 12px 14px;
  border: 1px solid var(--scene-card-border, rgba(45, 140, 255, 0.22));
  background: var(--scene-card-bg, rgba(255, 255, 255, 0.86));
  color: var(--scene-muted, #60708a);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

/* Demo 按钮 */
.demo-btn {
  color: #fff !important;
  background: var(--scene-button-active-bg, linear-gradient(180deg, #2d8cff, #126bff)) !important;
  border-color: var(--scene-primary, #126bff) !important;
  font-size: 15px;
  letter-spacing: 1px;
  animation: demo-glow 2s ease-in-out infinite;
}

@keyframes demo-glow {
  0%,
  100% {
    box-shadow: 0 0 12px var(--scene-primary-soft, rgba(18, 107, 255, 0.14));
  }

  50% {
    box-shadow: 0 0 24px var(--scene-primary-soft, rgba(18, 107, 255, 0.14));
  }
}

.demo-progress-bar {
  position: relative;
  width: 220px;
  height: 38px;
  border: 1px solid var(--scene-panel-border, rgba(45, 140, 255, 0.28));
  background: var(--scene-card-bg, rgba(255, 255, 255, 0.86));
  overflow: hidden;
  border-radius: 2px;
}

.demo-progress-fill {
  height: 100%;
  background: var(--scene-progress, linear-gradient(90deg, #126bff, #67b7ff));
  transition: width 0.3s linear;
}

.demo-progress-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--scene-button-text, #17456f);
  text-shadow: 0 0 6px var(--scene-primary-soft, rgba(18, 107, 255, 0.14));
}

/* 章节标题叠加层 */
.chapter-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 64px;
  color: var(--scene-primary, #126bff);
  text-shadow: 0 0 40px var(--scene-primary-soft, rgba(18, 107, 255, 0.14));
  pointer-events: none;
  letter-spacing: 8px;
  font-weight: bold;
}

.chapter-enter-active {
  transition: all 0.5s ease-out;
}

.chapter-leave-active {
  transition: all 0.5s ease-in;
}

.chapter-enter,
.chapter-leave-to {
  opacity: 0;
  transform: scale(1.1);
}
</style>
