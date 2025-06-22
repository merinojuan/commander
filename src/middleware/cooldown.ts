import { type Context, type Next } from 'hono'
import { env } from 'hono/adapter'
import { Timestamp } from 'firebase-admin/firestore'
import { getFirestoreData } from '../firebase/server.js'
import { type DolargData } from '../dolarg.js'

const COOLDOWN_PERIOD_MS = 10 * 60 * 1000

export const dolargCooldown = () => async (c: Context, next: Next) => {
  const { DOLARG_DOC_REF } = env<{ DOLARG_DOC_REF: string }>(c)
  const firestoreData = await getFirestoreData(DOLARG_DOC_REF) as DolargData
  const now = Timestamp.now()

  if (firestoreData.syncDate && (now.toMillis() - firestoreData.syncDate.toMillis()) < COOLDOWN_PERIOD_MS) {
    const timeLeft = (firestoreData.syncDate!.toMillis() + COOLDOWN_PERIOD_MS - now.toMillis()) / 1000
    return c.text(`Este endpoint está en enfriamiento. Inténtalo de nuevo en ${Math.ceil(timeLeft)} segundos.`, 429)
  }

  await next()
}
