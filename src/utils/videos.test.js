import test from 'node:test'
import assert from 'node:assert/strict'
import { bilibiliSearchUrl, formatDuration, formatPlayCount, remainingVideoSwaps, VIDEO_SWAP_LIMIT, VIDEO_SWAP_LIMIT_TEXT } from './videos.js'

test('B 站搜索链接带上版本、年级、科目与章节', () => {
  const url = bilibiliSearchUrl({ edition: '人教版', grade: '初三', subject: '数学', chapter: '二次函数' })
  assert.ok(url.includes(encodeURIComponent('人教版 初三 数学 二次函数 同步课程')))
})

test('播放量按中文习惯缩写', () => {
  assert.equal(formatPlayCount(960), '960')
  assert.equal(formatPlayCount(19972), '2.0万')
  assert.equal(formatPlayCount(1273484), '127万')
  assert.equal(formatPlayCount(123456789), '1.2亿')
})

test('时长显示成分钟或小时', () => {
  assert.equal(formatDuration(0), '时长未知')
  assert.equal(formatDuration(45), '45秒')
  assert.equal(formatDuration(1080), '18分钟')
  assert.equal(formatDuration(6762), '1小时53分')
  assert.equal(formatDuration(3600), '1小时')
})

test('换一换上限为 5 次，用完给出兜底提示', () => {
  assert.equal(VIDEO_SWAP_LIMIT, 5)
  assert.equal(remainingVideoSwaps(0), 5)
  assert.equal(remainingVideoSwaps(3), 2)
  assert.equal(remainingVideoSwaps(5), 0)
  assert.equal(remainingVideoSwaps(9), 0)
  assert.ok(VIDEO_SWAP_LIMIT_TEXT.includes('去 B 站'))
})
