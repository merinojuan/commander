import { type Context, type Next } from 'hono'
import { env } from 'hono/adapter'

export const apiKeyAuth = () => async (c: Context, next: Next) => {
  const { COMMANDER_API_KEY } = env<{ COMMANDER_API_KEY: string }>(c)
  const requestApiKey = c.req.header('X-API-Key')

  if (!requestApiKey || COMMANDER_API_KEY !== requestApiKey) {
    return c.text('Unauthorized', 401)
  }

  await next()
}
