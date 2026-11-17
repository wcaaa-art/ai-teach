import test from 'node:test'
import assert from 'node:assert/strict'
import { detectPlanTask, planTaskBadge } from './planRoute.js'

test('练习类 → practice', () => {
  assert.equal(detectPlanTask({ subject: '数学', name: '一元二次方程 · 8 道练习' }).kind, 'practice')
  assert.equal(detectPlanTask({ subject: '物理', name: '浮力练习 4 道' }).kind, 'practice')
  assert.equal(detectPlanTask({ subject: '数学', name: '因式分解 · 12 道' }).kind, 'practice')
})

test('普通知识点计划也走 practice（默认做题）', () => {
  assert.equal(detectPlanTask({ subject: '物理', name: '压强复习' }).kind, 'practice')
  assert.equal(detectPlanTask({ subject: '生物', name: '光合作用流程图' }).kind, 'practice')
})

test('背诵类 → recite 且带 mode', () => {
  const r = detectPlanTask({ subject: '语文', name: '《诫子书》背诵' })
  assert.equal(r.kind, 'recite')
  assert.equal(r.mode, 'text')
})

test('英语单词 → recite words', () => {
  const r = detectPlanTask({ subject: '英语', name: 'Unit 4 单词' })
  assert.equal(r.kind, 'recite')
  assert.equal(r.mode, 'words')
})

test('英语听写 → recite dictation', () => {
  const r = detectPlanTask({ subject: '英语', name: '错词听写' })
  assert.equal(r.kind, 'recite')
  assert.equal(r.mode, 'dictation')
})

test('化学方程式默写 → recite text', () => {
  const r = detectPlanTask({ subject: '化学', name: '化学方程式默写' })
  assert.equal(r.kind, 'recite')
  assert.equal(r.mode, 'text')
})

test('错题复习 → mistakes（优先于背诵/练习）', () => {
  assert.equal(detectPlanTask({ subject: '数学', name: '复习错题' }).kind, 'mistakes')
  assert.equal(detectPlanTask({ subject: '物理', name: '错题重做' }).kind, 'mistakes')
  // 即使名称里同时有「练习」和「错题」，错题优先
  assert.equal(detectPlanTask({ subject: '数学', name: '错题练习' }).kind, 'mistakes')
})

test('空计划名 → practice 兜底', () => {
  assert.equal(detectPlanTask({ subject: '数学', name: '' }).kind, 'practice')
})

test('planTaskBadge 返回正确标记', () => {
  assert.equal(planTaskBadge({ subject: '数学', name: '8 道练习' }), '做题')
  assert.equal(planTaskBadge({ subject: '语文', name: '背诵' }), '背诵')
  assert.equal(planTaskBadge({ subject: '英语', name: '单词' }), '背单词')
  assert.equal(planTaskBadge({ subject: '数学', name: '错题' }), '复习错题')
})
