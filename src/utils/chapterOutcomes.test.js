import test from 'node:test'
import assert from 'node:assert/strict'
import { describeMastery, UNTESTED_HINT } from './chapterOutcomes.js'

test('动作级文案按真实专题名命中', () => {
  assert.equal(describeMastery({ chapterName: '一元一次方程', mastery: 1 }), '会移项，去分母时漏乘不含分母的项')
  assert.equal(describeMastery({ chapterName: '整式加减', mastery: 2 }), '去括号会做，括号前有系数只乘第一项')
})

test('没有动作级文案的专题退回档位通用句，不冒充实测结论', () => {
  assert.equal(describeMastery({ chapterName: '二次函数', mastery: 0 }), '基础概念还没建立，需要从概念课重新过一遍')
  assert.equal(describeMastery({ chapterName: '二次函数', mastery: 3 }), '本专题已达标，可以进入迁移练习')
})

test('越界掌握度按 0–3 收敛', () => {
  assert.equal(describeMastery({ chapterName: '有理数与数轴', mastery: -2 }), '正负数概念还混，数轴上的点会标反')
  assert.equal(describeMastery({ chapterName: '有理数与数轴', mastery: 9 }), '四则与混合运算都稳，能自己查符号')
})

test('未测提示文案不是空串', () => {
  assert.ok(UNTESTED_HINT.length > 0)
})
