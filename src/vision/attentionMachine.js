// 注意力状态机：把每帧的人脸数、眼睛开合与头部角度收敛成一个稳定状态。
// 纯函数式输入输出，所有阈值可覆盖，方便单测与真机标定。

export const ATTENTION_STATE = {
  FOCUSED: 'focused',
  AWAY: 'away',
  MULTIPLE: 'multiple',
  DROWSY: 'drowsy',
  LOOKING_AWAY: 'looking-away',
  HEAD_DOWN: 'head-down'
}

export const ATTENTION_LABELS = {
  focused: '专注中',
  away: '离岗',
  multiple: '多人',
  drowsy: '犯困',
  'looking-away': '分心',
  'head-down': '低头'
}

// 数值越小优先级越高：离岗 > 多人 > 犯困 > 扭头 > 低头 > 专注。
const PRIORITY = {
  away: 0,
  multiple: 1,
  drowsy: 2,
  'looking-away': 3,
  'head-down': 4,
  focused: 5
}

export const DEFAULT_CONFIG = {
  // 无人脸或人脸占比低于 8%，持续 10 秒才算离岗；检测到人脸立即恢复。
  minFaceRatio: 0.08,
  absentMs: 10000,
  // 多人需要持续 2 秒，避免身后路人一闪而过就提示。
  multipleMs: 2000,
  // 闭眼程度低于 0.35 持续 1.5 秒算犯困。
  drowsyEyeOpen: 0.35,
  drowsyMs: 1500,
  // 扭头/低头超过角度持续 2 秒进入分心；60 秒内累计 10 秒才提示。
  gazeYawDeg: 25,
  gazePitchDeg: 20,
  gazeMs: 2000,
  gazeWindowMs: 60000,
  gazeCumulativeMs: 10000,
  // 低头姿势单独一类，只提示坐直，不判定“玩手机”。
  headDownPitchDeg: 25,
  headDownMs: 5000,
  // 退出状态需要恢复条件持续 1 秒，抑制边界抖动。
  exitMs: 1000,
  // 同类温和提示 60 秒冷却；离岗每次事件只提醒一次。
  cooldownMs: 60000,
  messages: {
    away: '我们暂时没有检测到你在屏幕前，计时已经暂停',
    multiple: '画面里出现了多个人，尽量保持独立专注的环境',
    drowsy: '看起来有点困了，起来活动一下再继续吧',
    'looking-away': '注意力有点飘，回到屏幕前继续吧',
    'head-down': '头有点低了，坐直一点更舒服'
  }
}

export class AttentionMachine {
  constructor(config = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      messages: { ...DEFAULT_CONFIG.messages, ...(config.messages || {}) }
    }
    this.reset(0)
  }

  reset(now = 0) {
    this.state = ATTENTION_STATE.FOCUSED
    this.previousState = null
    this.stateSince = now
    this.lastNow = null
    this.awaySince = null
    this.multipleSince = null
    this.drowsySince = null
    this.gazeSince = null
    this.headDownSince = null
    this.pendingState = null
    this.pendingSince = null
    this.gazeSegments = []
    this.gazeActive = false
    this.lastPromptAt = {}
    this.awayPrompted = false
  }

  setState(next, now) {
    if (next === this.state) return false
    this.previousState = this.state
    this.state = next
    this.stateSince = now
    this.pendingState = null
    this.pendingSince = null
    if (next === ATTENTION_STATE.AWAY) this.awayPrompted = false
    return true
  }

  // 同方向条件从 false 变 true 时开始计时，返回该条件的起始时间。
  track(condition, since, now) {
    if (!condition) return null
    return since == null ? now : since
  }

  gazeOverlap(now) {
    const start = now - this.config.gazeWindowMs
    this.gazeSegments = this.gazeSegments.filter(segment => segment.end >= start)
    return this.gazeSegments.reduce((total, segment) => {
      const from = Math.max(segment.start, start)
      const to = Math.min(segment.end, now)
      return total + Math.max(0, to - from)
    }, 0)
  }

  buildPrompt(type) {
    return {
      type,
      label: ATTENTION_LABELS[type] || '',
      message: this.config.messages[type] || ''
    }
  }

  maybePrompt(now, gazeCumulativeMs) {
    if (this.state === ATTENTION_STATE.FOCUSED) return null
    if (this.state === ATTENTION_STATE.AWAY) {
      if (this.awayPrompted) return null
      this.awayPrompted = true
      return this.buildPrompt(ATTENTION_STATE.AWAY)
    }
    // 扭头要先攒够 60 秒窗口内的 10 秒，避免偶尔看一眼旁边就提示。
    if (this.state === ATTENTION_STATE.LOOKING_AWAY && gazeCumulativeMs < this.config.gazeCumulativeMs) return null
    const last = this.lastPromptAt[this.state] ?? -Infinity
    if (now - last < this.config.cooldownMs) return null
    this.lastPromptAt[this.state] = now
    return this.buildPrompt(this.state)
  }

  update(sample = {}) {
    const now = Number.isFinite(sample.now) ? sample.now : Date.now()
    const config = this.config
    const faceCount = Math.max(0, Number(sample.faceCount) || 0)
    const faceRatio = Number(sample.faceRatio) || 0
    const present = faceCount > 0 && faceRatio >= config.minFaceRatio
    const eyeOpen = sample.eyeOpen === undefined ? 1 : Number(sample.eyeOpen)
    const yaw = Number(sample.yaw) || 0
    const pitch = Number(sample.pitch) || 0

    if (present) this.awayPrompted = false

    this.awaySince = this.track(!present, this.awaySince, now)
    this.multipleSince = this.track(present && faceCount >= 2, this.multipleSince, now)
    this.drowsySince = this.track(present && eyeOpen < config.drowsyEyeOpen, this.drowsySince, now)
    this.headDownSince = this.track(present && pitch > config.headDownPitchDeg, this.headDownSince, now)

    // 低头单独归入 head-down，分心只看左右扭头与仰头，避免两类状态互相覆盖。
    const gazeAway = present && (
      Math.abs(yaw) > config.gazeYawDeg || pitch < -config.gazePitchDeg
    )
    this.gazeSince = this.track(gazeAway, this.gazeSince, now)
    if (gazeAway) {
      const lastSegment = this.gazeSegments[this.gazeSegments.length - 1]
      if (this.gazeActive && lastSegment) lastSegment.end = now
      else this.gazeSegments.push({ start: now, end: now })
    }
    this.gazeActive = gazeAway
    const gazeCumulativeMs = this.gazeOverlap(now)

    const eligible = []
    if (this.awaySince != null && now - this.awaySince >= config.absentMs) eligible.push(ATTENTION_STATE.AWAY)
    if (this.multipleSince != null && now - this.multipleSince >= config.multipleMs) eligible.push(ATTENTION_STATE.MULTIPLE)
    if (this.drowsySince != null && now - this.drowsySince >= config.drowsyMs) eligible.push(ATTENTION_STATE.DROWSY)
    if (this.gazeSince != null && now - this.gazeSince >= config.gazeMs) eligible.push(ATTENTION_STATE.LOOKING_AWAY)
    if (this.headDownSince != null && now - this.headDownSince >= config.headDownMs) eligible.push(ATTENTION_STATE.HEAD_DOWN)
    eligible.push(ATTENTION_STATE.FOCUSED)

    const candidate = eligible.reduce((best, item) => (
      PRIORITY[item] < PRIORITY[best] ? item : best
    ), ATTENTION_STATE.FOCUSED)

    let changed = false
    if (candidate === this.state) {
      this.pendingState = null
      this.pendingSince = null
    } else if (PRIORITY[candidate] < PRIORITY[this.state]) {
      changed = this.setState(candidate, now)
    } else if (this.state === ATTENTION_STATE.AWAY) {
      // 人脸回来后不等待迟滞，立即退出离岗。
      changed = this.setState(candidate, now)
    } else if (this.pendingState !== candidate) {
      this.pendingState = candidate
      this.pendingSince = now
    } else if (now - this.pendingSince >= config.exitMs) {
      changed = this.setState(candidate, now)
    }

    return {
      now,
      present,
      faceCount,
      eyeOpen,
      yaw,
      pitch,
      state: this.state,
      label: ATTENTION_LABELS[this.state] || '',
      previousState: this.previousState,
      changed,
      stateSince: this.stateSince,
      awaySeconds: this.awaySince == null ? 0 : Math.max(0, Math.floor((now - this.awaySince) / 1000)),
      gazeCumulativeMs,
      prompt: this.maybePrompt(now, gazeCumulativeMs)
    }
  }
}
