// One Euro 滤波器：低延迟去抖，抖动越大截止频率越高，适合头部角度与眼睛开合这类实时信号。
// 参考 https://gery.casiez.net/1euro/ ，这里只保留标量版本，够摄像头模块用。

const MIN_DT = 1 / 60
const MAX_DT = 0.2

function smoothingAlpha(cutoff, dt) {
  const tau = 1 / (2 * Math.PI * Math.max(cutoff, 0.0001))
  return 1 / (1 + tau / dt)
}

export class OneEuroFilter {
  constructor({ minCutoff = 1, beta = 0.007, dCutoff = 1 } = {}) {
    this.minCutoff = minCutoff
    this.beta = beta
    this.dCutoff = dCutoff
    this.reset()
  }

  reset() {
    this.value = undefined
    this.derivative = 0
  }

  filter(input, dt) {
    const value = Number(input)
    if (!Number.isFinite(value)) return this.value ?? 0
    const step = Number.isFinite(dt) ? Math.min(MAX_DT, Math.max(MIN_DT, dt)) : MIN_DT
    if (this.value === undefined) {
      this.value = value
      this.derivative = 0
      return value
    }
    const derivative = (value - this.value) / step
    const alphaDerivative = smoothingAlpha(this.dCutoff, step)
    this.derivative += alphaDerivative * (derivative - this.derivative)
    const cutoff = this.minCutoff + this.beta * Math.abs(this.derivative)
    const alpha = smoothingAlpha(cutoff, step)
    this.value += alpha * (value - this.value)
    return this.value
  }
}

// 一组角度/比例信号需要独立滤波，逐个 new OneEuroFilter 即可；这里只做一个批量复位的辅助。
export function resetAll(filters) {
  for (const filter of filters) filter?.reset?.()
}
