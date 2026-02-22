import * as cheerio from 'cheerio'
import { type Timestamp } from 'firebase-admin/firestore'
import { config } from 'dotenv'
import { GoogleGenAI } from '@google/genai'

config()

export interface DolargData {
  data: Dolarg[] | null,
  syncError: boolean | null,
  syncErrorMsg: string | null,
  syncDate: Timestamp | null
}

export interface Dolarg {
  name: string | null,
  buyPrice: string | null,
  sellPrice: string | null,
  sellPercentage: string | null,
  buyPriceFormated: number | null,
  sellPriceFormated: number | null,
  sellPercentageFormated: number | null
}

export interface DolargOthersData {
  data: DolargOthers[] | null,
  syncError: boolean | null,
  syncErrorMsg: string | null,
  syncDate: Timestamp | null
}

export interface DolargOthers {
  name: string | null,
  value: number | null,
  variation: number | null,
  emoji: string | null
}

export const getDolargData = async () => {
  const dataUrl = process.env.DOLARG_DATA_URL

  if (!dataUrl) throw new Error('No se encontraron las variables de entorno: DOLARG_DATA_URL')

  const parentSelector = 'div.tile.is-parent.is-7.is-vertical'
  const childSelector = 'div.tile.is-child'

  const $ = await cheerio.fromURL(dataUrl)

  const $childElements = $(parentSelector + ' ' + childSelector)

  const data: Dolarg[] = []
  if ($childElements.length) {
    for (const el of $childElements.toArray()) {
      const $el = $(el)
      const name = $el.find('.title .titleText').text() || null
      const $valuesElement = $el.find('.values')
  
      if ($valuesElement) {
        const $buyElement = $valuesElement.find('.compra')
        const $sellElement = $valuesElement.find('.venta')

        const buyPrice = $buyElement.find('.val').text() || null
        // const buyPercentage = $buyElement.find('.var-porcentaje div').text() || null
        const sellPrice = $sellElement.find('.venta-wrapper .val').text() || null
        const sellPercentage = $sellElement.find('.var-porcentaje div').text() || null

        data.push({
          name,
          buyPrice,
          // buyPercentage,
          sellPrice,
          sellPercentage,
          buyPriceFormated: typeof buyPrice === 'string' && buyPrice.includes('$') ? (!isNaN(parseFloat(buyPrice.replace('$', ''))) ? parseFloat(buyPrice.replace('$', '').replace(/\./g, '').replace(',', '.')) : null) : null,
          // buyPercentageFormated: typeof buyPercentage === 'string' && buyPercentage.includes('%') ? (!isNaN(parseFloat(buyPercentage.replace('%', ''))) ? parseFloat(buyPercentage.replace('%', '')) : null) : null,
          sellPriceFormated: typeof sellPrice === 'string' && sellPrice.includes('$') ? (!isNaN(parseFloat(sellPrice.replace('$', ''))) ? parseFloat(sellPrice.replace('$', '').replace(/\./g, '').replace(',', '.')) : null) : null,
          sellPercentageFormated: typeof sellPercentage === 'string' && sellPercentage.includes('%') ? (!isNaN(parseFloat(sellPercentage.replace('%', ''))) ? parseFloat(sellPercentage.replace('%', '')) : null) : null,
        })
      }
    }
  }

  return { data }
}

export const getDolargOthersData = async (requestData: string) => {
  const gmApiKey = process.env.GEMINI_API_KEY

  if (!gmApiKey) throw new Error('No se encontraron las variables de entorno: GEMINI_API_KEY')

  const ai = new GoogleGenAI({ apiKey: gmApiKey })
  const contents = [
    {
      text: `
        ${requestData}

        Según el texto anterior que representa una tabla con diferentes indicadores del mercado mundial,
        dame una lista de todos los indicadores que puedas identificar,
        con su respectivo valor y variación de cambio (si está disponible),
        además de un emoji que represente al indicador según su nombre,
        usando la siguiente estructura JSON de ejemplo:​

        [
          {
            "name": "Merval", (formato string, ejemplo: "Dólar MEP", "Merval", "Bitcoin", etc)
            "value": 2839106, (formato numérico, ejemplo: 1409, 2839106, 66761, etc)
            "variation": 4.26, (formato numérico respetando los valores negativos, ejemplo: 1.49, -0.28, 4.26, etc -si no hay variación disponible, dejar como null-)
            "emoji": "" (emoji representativo del indicador, teniendo en cuenta "Lista de emojis + claves" que te proporcionaré en "Consideraciones por campo")
          },
          ...terminar de listar aquí los indicadores
        ]

        Consideraciones por campo:

        -Si consideras que no hay información suficiente para completar un campo, debes ingresar null.
        -Lista de emojis + claves:
          1-riesgo: 🧨
          2-dolar: 💵
          3-merval: 🧉
          4-sp500: 🏉
          5-shanghai: ​🍙
          6-bovespa: 🪇
          7-euro: 💶
          8-nikkei: 🎌
          9-oro: ​🏅​
          10-petroleo: 🛢️
          11-soja: 🌿
          12-tesoro: 🏦
          13-bitcoin: 🪙
      `
    }
  ]

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: contents,
  })

  const jsonStr = response.text?.match(/```json(.*?)```/s)

  if (!Array.isArray(jsonStr) || !jsonStr[1]) throw new Error('No se encontró el JSON en la respuesta.')

  const data = JSON.parse(jsonStr[1]) as DolargOthers[]

  return { data }
}
