// 错题重做判定：连续答对 2 次才自动消灭，单次答对只记录进度，答错重新计数。
export const AUTO_FIX_STREAK = 2

// 从 redoHistory 末尾往前数连续答对的次数。
export function correctStreak(history = []) {
  const list = Array.isArray(history) ? history : []
  let streak = 0
  for (let index = list.length - 1; index >= 0; index -= 1) {
    if (!list[index]?.correct) break
    streak += 1
  }
  return streak
}
