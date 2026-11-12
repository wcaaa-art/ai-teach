import test from 'node:test'
import assert from 'node:assert/strict'
import { buildVideoKeyword, buildVideoSearchUrl, fetchVideoPool, isTeachingVideo, normalizeVideo, parseDuration, pickVideoBatch, stripHtml } from './videos.js'

const NOW = Date.UTC(2026, 10, 11)
const YEARS = 365 * 24 * 60 * 60 * 1000

const pool = [
  { bvid: 'BV1', title: '二次函数 基础讲解', author: '甲老师', play: 3000, durationSeconds: 1500, pubdate: (NOW - YEARS) / 1000, tag: '人教 初三数学' },
  { bvid: 'BV2', title: '二次函数 中考冲刺', author: '乙老师', play: 120000, durationSeconds: 360, pubdate: (NOW - 30 * 24 * 60 * 60 * 1000) / 1000, tag: '中考数学' },
  { bvid: 'BV3', title: '北师大 二次函数 同步课', author: '甲老师', play: 80000, durationSeconds: 2400, pubdate: (NOW - 20 * 24 * 60 * 60 * 1000) / 1000, tag: '北师大版 初三' },
  { bvid: 'BV4', title: '二次函数 全章复习', author: '丙老师', play: 150000, durationSeconds: 3000, pubdate: (NOW - 3 * YEARS) / 1000, tag: '人教版 九年级' },
  { bvid: 'BV5', title: '二次函数 速成', author: '丁老师', play: 50000, durationSeconds: 300, pubdate: (NOW - 10 * 24 * 60 * 60 * 1000) / 1000, tag: '' }
]

test('搜索关键词按版本、年级、科目、章节拼接', () => {
  assert.equal(buildVideoKeyword({ edition: '人教版', grade: '初三', subject: '数学', chapter: '二次函数' }), '人教版 初三 数学 二次函数 同步课程')
  assert.equal(buildVideoKeyword({ chapter: '二次函数' }), '二次函数 同步课程')
})

test('兜底搜索链接对中文关键词编码', () => {
  const url = buildVideoSearchUrl('人教版 初三 数学')
  assert.ok(url.startsWith('https://search.bilibili.com/all?keyword='))
  assert.ok(url.includes(encodeURIComponent('人教版 初三 数学')))
})

test('时长字符串统一换算成秒', () => {
  assert.equal(parseDuration('18:23'), 18 * 60 + 23)
  assert.equal(parseDuration('112:42'), 112 * 60 + 42)
  assert.equal(parseDuration('1:02:03'), 3723)
  assert.equal(parseDuration(''), 0)
  assert.equal(parseDuration('abc'), 0)
})

test('标题里的 <em> 高亮与 HTML 实体被清掉', () => {
  assert.equal(stripHtml('<em class="keyword">二次函数</em> &amp; 图像'), '二次函数 & 图像')
})

test('只保留单集讲解视频，课程包、广告与试讲类被过滤', () => {
  assert.equal(isTeachingVideo({ type: 'video', bvid: 'BV1', title: '二次函数 精讲' }), true)
  assert.equal(isTeachingVideo({ type: 'ketang', bvid: '', title: '二次函数课程包' }), false)
  assert.equal(isTeachingVideo({ type: 'video', bvid: 'BV2', title: '二次函数', is_union_video: 1 }), false)
  assert.equal(isTeachingVideo({ type: 'video', bvid: 'BV3', title: '初中数学教师资格证试讲' }), false)
})

test('归一化丢掉 B 站原始字段并生成可访问链接', () => {
  const item = normalizeVideo({ bvid: 'BV1ztjo6MEdY', title: '<em class="keyword">二次函数</em>', author: '名师', play: '1273484', duration: '112:42', pubdate: 1745670209, tag: '数学' })
  assert.equal(item.title, '二次函数')
  assert.equal(item.play, 1273484)
  assert.equal(item.durationSeconds, 112 * 60 + 42)
  assert.equal(item.url, 'https://www.bilibili.com/video/BV1ztjo6MEdY')
})

test('按播放量从高到低取一批', () => {
  const batch = pickVideoBatch(pool, { limit: 2, now: NOW })
  assert.deepEqual(batch.map(item => item.bvid), ['BV4', 'BV2'])
})

test('已看过的视频与指定 UP 主不再出现', () => {
  const batch = pickVideoBatch(pool, { excludeBvids: ['BV4', 'BV2'], excludeAuthors: ['甲老师'], limit: 3, now: NOW })
  assert.deepEqual(batch.map(item => item.bvid), ['BV5'])

  const editionOnly = pickVideoBatch(pool, { excludeBvids: ['BV1', 'BV2', 'BV4', 'BV5'], limit: 3, now: NOW })
  assert.deepEqual(editionOnly.map(item => item.bvid), ['BV3'])
})

test('章节相关性：同章前后的视频不会混进来', () => {
  const mixed = [
    { bvid: 'BVX', title: '二次函数 图像与性质', tag: '', play: 100 },
    { bvid: 'BVY', title: '一元二次方程 精讲', tag: '', play: 999999 }
  ]
  const batch = pickVideoBatch(mixed, { chapter: '二次函数', limit: 3, now: NOW })
  assert.deepEqual(batch.map(item => item.bvid), ['BVX'])
  const split = pickVideoBatch([{ bvid: 'BVZ', title: '二次函数与一元二次方程 专题', tag: '', play: 1 }], { chapter: '二次函数的图像与性质', limit: 3, now: NOW })
  assert.deepEqual(split.map(item => item.bvid), ['BVZ'])
})

test('学段过滤：初中章节不混入高中视频', () => {
  const mixed = [
    { bvid: 'BVA', title: '二次函数 高中 高考专题', tag: '', play: 999999 },
    { bvid: 'BVB', title: '二次函数 初中 中考专题', tag: '', play: 100 }
  ]
  const junior = pickVideoBatch(mixed, { chapter: '二次函数', grade: '初三', limit: 3, now: NOW })
  assert.deepEqual(junior.map(item => item.bvid), ['BVB'])
  const senior = pickVideoBatch(mixed, { chapter: '二次函数', grade: '高二', limit: 3, now: NOW })
  assert.deepEqual(senior.map(item => item.bvid), ['BVA'])
})

test('教材版本匹配优先，其次才按播放量', () => {
  const mixed = [
    { bvid: 'BVA', title: '二次函数 精讲', tag: '冀教版', play: 999999 },
    { bvid: 'BVB', title: '二次函数 精讲', tag: '人教版', play: 1000 }
  ]
  const batch = pickVideoBatch(mixed, { chapter: '二次函数', edition: '人教版', limit: 3, now: NOW })
  assert.deepEqual(batch.map(item => item.bvid), ['BVB', 'BVA'])
})

test('太旧：只保留两年内发布的视频', () => {
  const batch = pickVideoBatch(pool, { reason: 'old', limit: 6, now: NOW })
  assert.deepEqual(batch.map(item => item.bvid), ['BV2', 'BV3', 'BV5', 'BV1'])
})

test('讲得太快：过滤 8 分钟以内的速成视频', () => {
  const batch = pickVideoBatch(pool, { reason: 'fast', limit: 6, now: NOW })
  assert.deepEqual(batch.map(item => item.bvid), ['BV4', 'BV3', 'BV1'])
})

test('版本不对：标题或标签必须命中教材版本', () => {
  const batch = pickVideoBatch(pool, { reason: 'edition', edition: '北师大版', limit: 6, now: NOW })
  assert.deepEqual(batch.map(item => item.bvid), ['BV3'])
  const renjiao = pickVideoBatch(pool, { reason: 'edition', edition: '人教版', limit: 6, now: NOW })
  assert.deepEqual(renjiao.map(item => item.bvid), ['BV4', 'BV1'])
})

test('上游连续失败时抛出错误，交给路由返回兜底链接', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({ ok: false, status: 412, json: async () => ({}) })
  try {
    await assert.rejects(() => fetchVideoPool('不会命中的缓存关键词'), /bilibili-search-412/)
  } finally {
    globalThis.fetch = originalFetch
  }
})
