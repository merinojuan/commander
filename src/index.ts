import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { env } from 'hono/adapter'
import { config } from 'dotenv'
import { Timestamp } from 'firebase-admin/firestore'
import { GoogleGenAI } from '@google/genai'
import { apiKeyAuth } from './middleware/auth.js'
import { getFirestoreData, updateFirestoreData } from './firebase/server.js'
import { getPdfOptions, getPdfBuffer, propmt, isValidDate, type RFAData, type RFABono } from './renta-fija-argentina.js'
import { getDolargData, type DolargData } from './dolarg.js'

config()

const app = new Hono()

app.use('/api/*', apiKeyAuth())

app.get('/', (c) => {
  return c.text('Bienvenid@ a la Api Commander!')
})

app.get('/error', (c) => {
  return c.text('Devolviendo un error 500', 500)
})

app.post('/api/renta-fija-argentina', async (c) => {
  const { GEMINI_API_KEY, RFA_DOC_REF } = env<{ GEMINI_API_KEY: string, RFA_DOC_REF: string }>(c)
  // console.log('Inicio /api/renta-fija-argentina')
  try {
    // console.log('getFirestoreData')
    const firestoreData = await getFirestoreData(RFA_DOC_REF)
    // console.log('getPdfOptions')
    const { pdfUrl, pdfDate } = await getPdfOptions()
  
    if (!pdfUrl || !pdfDate) throw new Error('No se encontraron los datos del PDF: pdfUrl o pdfDate.')
    if (firestoreData?.sincro_pdf_url === pdfUrl) throw new Error('No hay cambios en el PDF, no se actualiza la base de datos.')

    // console.log('getPdfBuffer')
    const pdfBuffer = await getPdfBuffer(pdfUrl)

    const contents = [
      {
        text: propmt
      },
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: Buffer.from(pdfBuffer).toString("base64")
        }
      }
    ]

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })
    // console.log('generateContent')
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: contents,
    })

    if (!response.text) throw new Error('No se obtuvo respuesta IA.')

    const jsonStr = response.text.match(/```json(.*?)```/s)

    if (jsonStr && jsonStr[1]) {
      const json: RFABono[] = JSON.parse(jsonStr[1])
      json.forEach(el => {
        const expirationDate = typeof el.vencimiento === 'string' && new Date(el.vencimiento)
        el.tir_anual = typeof el.tir_anual === 'string' ? parseFloat(el.tir_anual.replace('%', '')) : null
        el.vencimiento = isValidDate(expirationDate) ? Timestamp.fromDate(expirationDate as Date) : null
      })
      // console.log('updateFirestoreData')
      await updateFirestoreData(RFA_DOC_REF, {
        datos: json,
        datos_fecha: pdfDate && Timestamp.fromDate(pdfDate),
        sincro_pdf_url: pdfUrl,
        sincro_error: false,
        sincro_error_mensaje: null,
        sincro_fecha: Timestamp.now()
      } as RFAData)
      return c.text('Proceso completado con éxito. Se actualizaron los datos de renta fija argentina.')
    } else {
      throw new Error('No se encontró el JSON en la respuesta.')
    }
  } catch (e: any) {
    // console.log('ERROR: ', e.message)
    await updateFirestoreData(RFA_DOC_REF, {
      sincro_error: true,
      sincro_error_mensaje: e.message,
      sincro_fecha: Timestamp.now()
    } as RFAData)
    return c.text(`ERROR: ${e.message}`, 500)
  }
})

app.post('/api/dolarg', async (c) => {
  const { DOLARG_DOC_REF } = env<{ DOLARG_DOC_REF: string }>(c)
  // console.log('Inicio /api/dolarg')
  try {
    // console.log('getPdfOptions')
    const { data } = await getDolargData()
  
    if (!data) throw new Error('No se encontraron los datos: data.')

    // console.log('updateFirestoreData')
    await updateFirestoreData(DOLARG_DOC_REF, {
      data,
      syncError: false,
      syncErrorMsg: null,
      syncDate: Timestamp.now()
    } as DolargData)
    return c.text('Proceso completado con éxito. Se actualizaron los datos de dolarg.')
  } catch (e: any) {
    // console.log('ERROR: ', e.message)
    await updateFirestoreData(DOLARG_DOC_REF, {
      syncError: true,
      syncErrorMsg: e.message,
      syncDate: Timestamp.now()
    } as DolargData)
    return c.text(`ERROR: ${e.message}`, 500)
  }
})

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
