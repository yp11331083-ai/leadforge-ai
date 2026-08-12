/**
 * 判斷是否為 rate limit 錯誤
 */
export function isRateLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return msg.includes('429') || msg.includes('Too many requests')
}

/**
 * 將後端錯誤訊息轉成使用者友善的訊息
 */
export function friendlyError(error: string): string {
  if (error.includes('429') || error.includes('Too many requests')) {
    return 'AI 服務配額已用完（429 Too Many Requests）。這通常是每日配額限制，請過 1-2 小時再試，或明天再使用。不影響已儲存的名單與設定。'
  }
  if (error.includes('ENETUNREACH') || error.includes('ECONNREFUSED')) {
    return '無法連接到 AI 服務，請檢查網路連線。'
  }
  if (error.includes('ETIMEDOUT')) {
    return 'AI 服務回應超時，請稍後再試。'
  }
  return error
}

/**
 * 估算冷卻時間（用於 UI 顯示）
 * 第一次 429：建議等 5 分鐘
 * 持續 429：建議等 1-2 小時
 */
export function suggestCooldown(firstFailureAt: number | null): string {
  if (!firstFailureAt) return '5 分鐘'
  const elapsed = Date.now() - firstFailureAt
  if (elapsed < 5 * 60 * 1000) return '5 分鐘'
  if (elapsed < 30 * 60 * 1000) return '30 分鐘'
  if (elapsed < 60 * 60 * 1000) return '1 小時'
  return '明日重置（UTC 0:00）'
}
