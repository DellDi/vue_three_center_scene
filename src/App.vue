<template>
  <div class="app-page">
    <div class="app-head">
      <div>
        <h1>智慧物业数字孪生平台</h1>
        <p>三维可视化场景交互区域，周边指标大屏由现有平台承载。</p>
      </div>
      <div class="switches">
        <button :class="{ active: active === 'iot' }" @click="active = 'iot'">IOT 园区场景</button>
        <button :class="{ active: active === 'robot' }" @click="active = 'robot'">机器人清洁场景</button>
      </div>
    </div>

    <div class="app-shell">
      <iot-center-scene v-if="active === 'iot'" height="720px" @scene-event="handleSceneEvent" />
      <robot-center-scene v-if="active === 'robot'" height="720px" :robot-speed="2" :dwell-scale="1" @scene-event="handleSceneEvent" />
    </div>

    <div class="event-log">
      <b>最近事件：</b>{{ latestEvent || '点击楼栋、房间、设备点位或触发告警联动后，将在这里显示事件。' }}
    </div>
  </div>
</template>

<script>
import IotCenterScene from './components/IotCenterScene.vue'
import RobotCenterScene from './components/RobotCenterScene.vue'

export default {
  name: 'App',
  components: { IotCenterScene, RobotCenterScene },
  data () {
    return { active: 'iot', latestEvent: '' }
  },
  methods: {
    handleSceneEvent (payload) {
      this.latestEvent = `[${payload.type}] ${payload.title || payload.name || ''}`
    }
  }
}
</script>

<style>
html, body { margin: 0; width: 100%; min-height: 100%; background: #020811; font-family: "Microsoft YaHei", "PingFang SC", Arial, sans-serif; color: #d8fbff; }
* { box-sizing: border-box; }
.app-page { min-height: 100vh; padding: 22px; background: radial-gradient(circle at 50% 0%, rgba(0,245,255,.14), transparent 34%), linear-gradient(180deg,#020811,#01050a); }
.app-head { max-width: 1500px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: space-between; }
.app-head h1 { margin: 0; font-size: 25px; letter-spacing: 2px; }
.app-head p { margin: 8px 0 0; color: rgba(210,250,255,.65); }
.switches { display: flex; gap: 10px; }
.switches button { height: 38px; padding: 0 18px; color: #dff; border: 1px solid rgba(0,245,255,.45); background: rgba(0,45,58,.55); cursor: pointer; }
.switches button.active { color: #fff; background: linear-gradient(180deg, rgba(0,245,255,.42), rgba(0,110,130,.55)); box-shadow: 0 0 16px rgba(0,245,255,.35) inset; }
.app-shell { max-width: 1500px; margin: 0 auto; }
.event-log { max-width: 1500px; margin: 12px auto 0; padding: 12px 14px; border: 1px solid rgba(0,245,255,.24); background: rgba(0,22,32,.6); color: rgba(220,255,255,.78); }
</style>
