import { request, chromium } from 'playwright'
import { type Timestamp } from 'firebase-admin/firestore'
import { config } from 'dotenv'

config()

export interface RFAData {
  datos: RFABono[] | null,
  datos_fecha: Timestamp | null,
  sincro_pdf_url: string | null,
  sincro_error: boolean | null,
  sincro_error_mensaje: string | null,
  sincro_fecha: Timestamp | null
}

export interface RFABono {
  encabezado: string | null,
  tipo: string | null,
  categoria: string | null,
  bono: string | null,
  codigo: string | null,
  vencimiento: string | Timestamp | null,
  tir_anual: string | number | null
}

export const isValidDate = (date: any) => {
  return date instanceof Date && !isNaN(date.getTime());
}

export const getPdfOptions = async () => {
  const dataOriginUrl = process.env.RFA_DATA_ORIGIN_URL
  const dataUrl = process.env.RFA_DATA_URL

  if (!dataOriginUrl || !dataUrl) throw new Error('No se encontraron las variables de entorno: RFA_DATA_ORIGIN_URL o RFA_DATA_URL')

  const browser = await chromium.launch()
  const page = await browser.newPage()

  await page.goto(dataUrl)

  await page.waitForSelector('div.contenidoListado')

  const aTagHref = await page.$eval('div.contenidoListado a', (aTag) => aTag.getAttribute('href'))
  const aTagDescription = await page.$eval('div.contenidoListado a div.descripcion', (divTag) => divTag.getHTML())

  let pdfDate = null
  if (aTagDescription) {
    const dateSplit = aTagDescription.split('.')
    if (dateSplit && dateSplit[1] && dateSplit[1].includes('/')) {
      let formatedDate = dateSplit[1].split('/')
      pdfDate = new Date(`${formatedDate[1]}-${formatedDate[0]}-${formatedDate[2]}`)
    }
  }

  const pdfPageUrl = dataOriginUrl + aTagHref

  await page.goto(pdfPageUrl)

  await page.waitForSelector('div.pdfVisualizador')

  const pdfUrl = await page.$eval('div.pdfVisualizador object', (objectTag) => objectTag.getAttribute('data'))

  await browser.close()
  return { pdfUrl, pdfDate }
}

export const getPdfBuffer = async (pdfUrl: string) => {
  const apiRequestContext = await request.newContext({
    ignoreHTTPSErrors: true
  })

  const response = await apiRequestContext.get(pdfUrl)

  if (!response.ok()) throw new Error('Error al obtener el buffer del PDF.')

  const buffer = await response.body()

  if (apiRequestContext) await apiRequestContext.dispose()

  return buffer
}

export const propmt = `
  Dado el pdf adjuntado que lista los distintos títulos públicos argentinos, dame una lista de todos los bonos bajo los encabezados
  "ANÁLISIS DE TÍTULOS PÚBLICOS NACIONALES" y "ANÁLISIS DE OBLIGACIONES NEGOCIABLES" usando la siguiente estructura JSON de ejemplo:

  [
    {
      "encabezado": "TÍTULOS PÚBLICOS NACIONALES",
      "tipo": "BONTE, BONAR Y BONOS DE CONSOLIDACIÓN",
      "categoria": "Títulos emitidos en Pesos a tasa fija",
      "bono": "BONTE OCT-2026 16,50%",
      "codigo": "TO26",
      "vencimiento": "17-Oct-26",
      "tir_anual": "44.85%"
    },
    ...terminar de listar los bonos bajo el enzabezado "ANÁLISIS DE TÍTULOS PÚBLICOS NACIONALES"
    {
      "encabezado": "OBLIGACIONES NEGOCIABLES",
      "tipo": "Obligaciones Negociables Ley Argentina",
      "categoria": "Denominadas y pagaderas en dólares",
      "bono": "IRSA CLASE XIV EN U$S",
      "codigo": "IRCFO",
      "vencimiento": "22-Jun-28",
      "tir_anual": "56.91%"
    },
    ...terminar de listar los bonos bajo el enzabezado "ANÁLISIS DE OBLIGACIONES NEGOCIABLES"
  ]

  Consideraciones por campo:

  1- "encabezado": Encabezado de cada página del PDF y que está definido por un texto en mayúsculas de color celeste. Sólo se deben obtener los datos de los bonos
  cuyo encabezado sea "ANÁLISIS DE TÍTULOS PÚBLICOS NACIONALES" o "ANÁLISIS DE OBLIGACIONES NEGOCIABLES". Se debe omitir las primeras dos palabras del encabezado
  "ANÁLISIS DE", como también los asteriscos entre paréntesis "(*)" o "(**)".

  2- "tipo": Siempre debes definir un nuevo tipo al encontrar un título de color blanco, en mayúsculas y con fondo celeste. Se debe omitir los asteriscos entre
  paréntesis "(*)" o "(**)".

  3- "categoria": Siempre debes definir una nueva categoría al encontrar un título de color negro, en negrita (bold) y subrayado. Se debe omitir la numeración,
  generalmente representados por números romanos seguidos de un punto y un guión (por ejemplo "III. -"), como también los asteriscos entre paréntesis "(*)" o "(**)".

  4- "tir_anual": para evitar errores al momento de seleccionar este valor siempre se debe tomar como referencia la antepenúltima columna de la tabla con nombre
  "TIR Anual", cuyo valor siempre va a estar definido por un número positivo o negativo, en decimales, y seguido de un signo de porcentaje (%), por ejemplo "-3.39%",
  en caso contrario se debe ingresar null.

  Ejemplos de valores válidos para el campo "tir_anual" tomando como referencia las últimas 4 columnas del PDF:

  1- "(espacio en blanco) | - | - | 7.53" -> null
  2- "93.37% | (espacio en blanco) | 0.92 | 0.96" -> null
  3- "97.41% | #N/A | - | 0.00" -> null
  4- "66.48% | *** | 0.02 | 0.28" -> null
  5- "106.55% | -25.99% | 0.24 | 0.21" -> -25.99%
  6- "(espacio en blanco) | 82.31% | 0.00 | 0.13" -> 82.31%
  7- "82.03% | 10.63% | 1.86 | 1.96" -> 10.63%
`
