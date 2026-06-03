<template>
  <div class="app-page">
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
        @scene-event="handleSceneEvent"
      />
      <robot-center-scene
        v-show="active === 'robot'"
        ref="robotScene"
        height="720px"
        :robot-speed="7"
        :dwell-scale="1"
        :auto-play="false"
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

export default {
  name: 'App',
  components: { IotCenterScene, RobotCenterScene },
  data () {
    return {
      active: 'iot',
      latestEvent: '',
      demoRunning: false,
      demoProgress: 0,
      demoChapter: '',
      chapterTitle: '',
      chapterTimer: null
    }
  },
  methods: {
    handleSceneEvent (event) {
      this.latestEvent = `[${event.type}] ${event.title || event.id || ''}`

      // Demo 事件处理
      if (event.type === 'demo-started') {
        this.demoRunning = true
        this.demoProgress = 0
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
          const runtime = this.active === 'iot'
            ? this.$refs.iotScene?.runtime
            : this.$refs.robotScene?.runtime
          if (runtime) {
            runtime.execute({ type: 'SCENE_SWITCH_READY' })
          }
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
      if (this.active !== 'iot') {
        this.active = 'iot'
        await this.$nextTick()
        await new Promise(r => setTimeout(r, 500))
      }
      const runtime = this.$refs.iotScene?.runtime
      if (runtime) {
        runtime.execute({ type: 'START_DEMO' })
      }
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
html,body{margin:0;width:100%;min-height:100%;background:#020811;font-family:"Microsoft YaHei","PingFang SC",Arial,sans-serif;color:#d8fbff}*{box-sizing:border-box}.app-page{min-height:100vh;padding:22px;background:radial-gradient(circle at 50% 0%,rgba(0,245,255,.14),transparent 34%),linear-gradient(180deg,#020811,#01050a)}.app-head{max-width:1500px;margin:0 auto 16px;display:flex;align-items:center;justify-content:space-between}.app-head h1{margin:0;font-size:25px;letter-spacing:2px}.app-head p{margin:8px 0 0;color:rgba(210,250,255,.65)}.switches{display:flex;gap:10px}.switches button{height:38px;padding:0 18px;color:#dff;border:1px solid rgba(0,245,255,.45);background:rgba(0,45,58,.55);cursor:pointer}.switches button.active{color:#fff;background:linear-gradient(180deg,rgba(0,245,255,.42),rgba(0,110,130,.55));box-shadow:0 0 16px rgba(0,245,255,.35) inset}.app-shell{max-width:1500px;margin:0 auto;position:relative}.event-log{max-width:1500px;margin:12px auto 0;padding:12px 14px;border:1px solid rgba(0,245,255,.24);background:rgba(0,22,32,.6);color:rgba(220,255,255,.78)}

/* Demo 按钮 */
.demo-btn{background:linear-gradient(135deg,rgba(0,245,255,.35),rgba(0,130,150,.45)) !important;border-color:rgba(0,245,255,.7) !important;font-size:15px;letter-spacing:1px;animation:demo-glow 2s ease-in-out infinite}
@keyframes demo-glow{0%,100%{box-shadow:0 0 12px rgba(0,245,255,.2)}50%{box-shadow:0 0 24px rgba(0,245,255,.45)}}
.demo-progress-bar{position:relative;width:220px;height:38px;border:1px solid rgba(0,245,255,.5);background:rgba(0,22,32,.75);overflow:hidden;border-radius:2px}
.demo-progress-fill{height:100%;background:linear-gradient(90deg,rgba(0,245,255,.5),rgba(0,200,220,.35));transition:width .3s linear}
.demo-progress-label{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:12px;color:#dff;text-shadow:0 0 6px rgba(0,245,255,.3)}

/* 章节标题叠加层 */
.chapter-overlay{position:absolute;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;font-size:64px;color:rgba(0,245,255,.75);text-shadow:0 0 40px rgba(0,245,255,.4);pointer-events:none;letter-spacing:8px;font-weight:bold}
.chapter-enter-active{transition:all .5s ease-out}
.chapter-leave-active{transition:all .5s ease-in}
.chapter-enter,.chapter-leave-to{opacity:0;transform:scale(1.1)}

/* 毛玻璃增强 */
.switches button{backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);transition:all .25s}
.switches button:hover:not(:disabled){box-shadow:0 0 16px rgba(0,245,255,.2);border-color:rgba(0,245,255,.7)}
.switches button:disabled{opacity:.5;cursor:not-allowed}
.event-log{backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
</style>
