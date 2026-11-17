// 学习视频推荐：服务端代理 B 站搜索，按播放量排序，支持「换一换」的原因过滤。
// 浏览器直接请求 B 站接口会被跨域拦住，所以统一走 Express；结果按关键词缓存 15 分钟，
// 避免学生连续换几次就把上游打爆（B 站对高频请求会返回 412 风控页）。

const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Referer: 'https://www.bilibili.com/'
}
const CACHE_TTL = 15 * 60 * 1000
const CACHE_LIMIT = 50
// 搜索一页 20 条，取两页足够支撑 5 次换一换（每次 3 条）。
const POOL_PAGES = 2
const TWO_YEARS = 2 * 365 * 24 * 60 * 60 * 1000
const cache = new Map()

// 不是给学生看的知识讲解：教资面试、试讲、赛课、课件下载等。
const NOISE_PATTERN = /教资|教师资格|招聘|试讲|无生|公开课|优质课|赛课|说课|面试|课件|PPT|教案/i

// 教材版本简称，用于「版本不对」过滤与关键词增强。
const EDITION_TOKENS = {
  人教版: ['人教', '部编', '统编'],
  统编版: ['统编', '部编', '人教'],
  北师大版: ['北师大'],
  苏科版: ['苏科'],
  华师大版: ['华师大', '华师'],
  外研版: ['外研'],
  译林版: ['译林'],
  仁爱版: ['仁爱'],
  沪科版: ['沪科'],
  沪教版: ['沪教'],
  鲁教版: ['鲁教']
}

export function buildVideoKeyword({ grade = '', subject = '', edition = '', chapter = '' } = {}) {
  return [edition, grade, subject, chapter, '同步课程'].map(item => String(item || '').trim()).filter(Boolean).join(' ')
}

export function buildVideoSearchUrl(keyword = '') {
  return `https://search.bilibili.com/all?keyword=${encodeURIComponent(keyword)}`
}

// "18:23" / "112:42" / "1:02:03" 统一换算成秒；解析失败返回 0。
export function parseDuration(text = '') {
  const parts = String(text || '').split(':').map(part => part.trim()).filter(part => part !== '')
  if (!parts.length || parts.some(part => !/^\d+$/.test(part))) return 0
  return parts.reduce((total, part) => total * 60 + Number(part), 0)
}

// B 站标题带 <em class="keyword"> 高亮标签与 HTML 实体，入库前清干净。
export function stripHtml(text = '') {
  return String(text || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

export function normalizeVideo(raw = {}) {
  return {
    bvid: String(raw.bvid || ''),
    title: stripHtml(raw.title),
    author: stripHtml(raw.author),
    play: Number(raw.play) || 0,
    durationSeconds: parseDuration(raw.duration),
    // pubdate 是秒级时间戳，0 表示未知（课程包等）。
    pubdate: Number(raw.pubdate) || 0,
    tag: stripHtml(raw.tag),
    url: raw.bvid ? `https://www.bilibili.com/video/${raw.bvid}` : ''
  }
}

// 只要单集视频：过滤课程包（type=ketang）、广告（is_union_video=1）与试讲/课件类噪声。
export function isTeachingVideo(raw = {}) {
  if (!raw || raw.type !== 'video' || !raw.bvid) return false
  if (Number(raw.is_union_video) === 1) return false
  return !NOISE_PATTERN.test(stripHtml(raw.title))
}

export function editionTokens(edition = '') {
  const key = String(edition || '').trim()
  if (!key) return []
  if (EDITION_TOKENS[key]) return EDITION_TOKENS[key]
  return [key.replace(/版$/, '')]
}

function matchesEdition(item, edition) {
  const tokens = editionTokens(edition)
  if (!tokens.length) return true
  const haystack = `${item.title} ${item.tag || ''}`
  return tokens.some(token => haystack.includes(token))
}

function matchesReason(item, { reason = '', edition = '', now = Date.now() } = {}) {
  if (reason === 'old') return !item.pubdate || now - item.pubdate * 1000 <= TWO_YEARS
  // 「讲得太快」在元数据里无法判断，用时长兜底：8 分钟以内的速成/切片先排除。
  if (reason === 'fast') return !item.durationSeconds || item.durationSeconds >= 8 * 60
  if (reason === 'edition') return matchesEdition(item, edition)
  return true
}

// 章节相关性：B 站搜索会带出同章前后的视频（搜「二次函数」混进「一元二次方程」），
// 所以标题/标签里必须出现章节名，或章节名拆分后的任一片段。
export function isRelevantVideo(item = {}, chapter = '') {
  const keyword = String(chapter || '').trim()
  if (keyword.length < 2) return true
  const haystack = `${item.title || ''} ${item.tag || ''}`
  if (haystack.includes(keyword)) return true
  const tokens = keyword.split(/[与和、及及其的\s]+/).filter(token => token.length >= 2)
  return tokens.some(token => haystack.includes(token))
}

// 纯函数：排除已看过的视频/UP 主，过滤无关章节，按原因过滤，
// 再按「教材版本匹配优先、播放量从高到低」取一批。
export function pickVideoBatch(pool = [], { excludeBvids = [], excludeAuthors = [], reason = '', edition = '', chapter = '', limit = 3, now = Date.now() } = {}) {
  const skippedBvids = new Set(excludeBvids)
  const skippedAuthors = new Set(excludeAuthors)
  return pool
    .filter(item => item && item.bvid && !skippedBvids.has(item.bvid) && !skippedAuthors.has(item.author))
    .filter(item => isRelevantVideo(item, chapter))
    .filter(item => matchesReason(item, { reason, edition, now }))
    .sort((left, right) => {
      const editionGap = Number(matchesEdition(right, edition)) - Number(matchesEdition(left, edition))
      return editionGap || right.play - left.play
    })
    .slice(0, Math.max(1, Number(limit) || 3))
}

async function fetchSearchPage(keyword, page) {
  const url = `https://api.bilibili.com/x/web-interface/wbi/search/type?search_type=video&order=click&keyword=${encodeURIComponent(keyword)}&page=${page}`
  const response = await fetch(url, { headers: REQUEST_HEADERS, signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new Error(`bilibili-search-${response.status}`)
  const payload = await response.json()
  if (payload?.code !== 0) throw new Error(`bilibili-code-${payload?.code}`)
  return Array.isArray(payload.data?.result) ? payload.data.result : []
}

// 抓取并缓存关键词的视频池；两页里有一页成功就算成功。
export async function fetchVideoPool(keyword) {
  const cached = cache.get(keyword)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.items
  const settled = await Promise.allSettled(Array.from({ length: POOL_PAGES }, (_, index) => fetchSearchPage(keyword, index + 1)))
  const pages = settled.filter(result => result.status === 'fulfilled').map(result => result.value)
  if (!pages.length) throw settled.find(result => result.status === 'rejected')?.reason || new Error('bilibili-search-failed')
  const seen = new Set()
  const items = pages.flat()
    .filter(isTeachingVideo)
    .map(normalizeVideo)
    .filter(item => {
      if (!item.bvid || seen.has(item.bvid)) return false
      seen.add(item.bvid)
      return true
    })
  cache.set(keyword, { items, fetchedAt: Date.now() })
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value)
  return items
}

export function clearVideoCache() {
  cache.clear()
}
