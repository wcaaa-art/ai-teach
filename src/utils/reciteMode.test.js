import test from 'node:test'
import assert from 'node:assert/strict'
import { detectReciteMode, reciteBadge, RECITE_BADGES } from './reciteMode.js'

test('语文记忆类计划走逐句背诵', () => {
  assert.equal(detectReciteMode({ subject: '语文', name: '《诫子书》背诵' }).mode, 'text')
  assert.equal(detectReciteMode({ subject: '语文', name: '文言实词 10 个' }).mode, 'text')
  // 同样是语文，但刷题任务仍然进专注计时器，不能被误抓。
  assert.equal(detectReciteMode({ subject: '语文', name: '病句修改 5 道' }).mode, null)
  assert.equal(detectReciteMode({ subject: '语文', name: '阅读理解两篇' }).mode, null)
})

test('英语单词与听写区分开，听写优先命中', () => {
  assert.equal(detectReciteMode({ subject: '英语', name: 'Unit 4 单词' }).mode, 'words')
  assert.equal(detectReciteMode({ subject: '英语', name: '错词听写' }).mode, 'dictation')
  // 同时出现「单词」和「听写」时按听写处理，因为听写是更具体的形态。
  assert.equal(detectReciteMode({ subject: '英语', name: '第三单元单词听写' }).mode, 'dictation')
  assert.equal(detectReciteMode({ subject: '英语', name: '听力两段对话' }).mode, null)
  assert.equal(detectReciteMode({ subject: '英语', name: '语法填空 10 题' }).mode, null)
})

test('其他文科的背诵也识别，理科一律不算', () => {
  assert.equal(detectReciteMode({ subject: '历史', name: '朝代更替口诀' }).mode, 'text')
  assert.equal(detectReciteMode({ subject: '道德与法治', name: '核心价值观要点' }).mode, 'text')
  assert.equal(detectReciteMode({ subject: '数学', name: '一元二次方程 · 8 道练习' }).mode, null)
  assert.equal(detectReciteMode({ subject: '物理', name: '浮力练习 4 道' }).mode, null)
  assert.equal(detectReciteMode({ subject: '化学', name: '化学方程式默写' }).mode, 'text')
})

test('缺失字段与空名称不会报错', () => {
  assert.deepEqual(detectReciteMode(), { mode: null, reason: 'empty' })
  assert.equal(detectReciteMode({ subject: '语文' }).mode, null)
  // 没有学科但名称本身写明「背诵」，仍然按记忆类任务处理。
  assert.equal(detectReciteMode({ name: '背诵' }).mode, 'text')
})

test('徽标文案与模式一一对应', () => {
  assert.equal(reciteBadge({ subject: '英语', name: '错词听写' }), RECITE_BADGES.dictation)
  assert.equal(reciteBadge({ subject: '数学', name: '二次函数图像' }), '')
})
