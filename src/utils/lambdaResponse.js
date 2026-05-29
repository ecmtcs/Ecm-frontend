/**
 * Parse Lambda Function URL responses (direct JSON or API Gateway wrapper).
 */
export function parseLambdaJson(rawText, response) {
  if (!rawText?.trim()) {
    throw new Error(
      response?.status
        ? `Empty response (HTTP ${response.status}).`
        : 'Empty response from server.'
    )
  }

  let parsed
  try {
    parsed = JSON.parse(rawText)
  } catch {
    throw new Error('Invalid JSON from server.')
  }

  if (parsed && typeof parsed === 'object' && 'statusCode' in parsed && 'body' in parsed) {
    const statusCode = parsed.statusCode
    const inner =
      typeof parsed.body === 'string' ? JSON.parse(parsed.body) : parsed.body

    if (statusCode >= 400) {
      throw new Error(inner?.error || `Request failed (${statusCode}).`)
    }
    return inner
  }

  return parsed
}
