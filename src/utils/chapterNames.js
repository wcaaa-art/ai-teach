// 章节展示名：去掉「七上：」「八下：」这类学期前缀。
// 年级已经由页面选择限定，前缀只会挤掉真正的知识点名；历史记录里存下的旧名字也在展示层统一裁掉。
const BOOK_PREFIX = /[七八九][上下]：/g

export function stripBookPrefix(text = '') {
  return String(text).replace(BOOK_PREFIX, '')
}
