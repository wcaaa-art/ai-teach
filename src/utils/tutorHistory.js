// 答疑会话的历史裁剪：图片不进库，但要把"上一轮看的是哪道题"带进下一轮。
// 抽成纯函数便于测试——这里出错的后果是学生追问时模型答非所问。

/**
 * 从当前消息列表构造发给模型的历史（不含最新一条）。
 * @param {Array<{role:string, content:string, imageContext?:string}>} messages
 * @param {number} limit 最多保留多少条消息（含最新一条）
 */
export function buildTutorHistory(messages = [], limit = 13) {
  // slice(-13, -1)：取最近 13 条并去掉刚追加的那条用户消息。
  return messages.slice(-limit, -1).map(message => ({
    role: message.role,
    content: message.imageContext ? `${message.content}\n（上一轮图片题的要点：${message.imageContext}）` : message.content
  }))
}

/**
 * 图片答复要点：只截文本、压空白，控制长度，避免上下文被一张图撑爆。
 * 只在模型真正答复成功时调用，兜底话术不进上下文。
 * @param {string} answer
 * @param {number} max
 */
export function clipImageContext(answer = '', max = 240) {
  const text = String(answer || '').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max)}…` : text
}
