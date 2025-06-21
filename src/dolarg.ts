import * as cheerio from 'cheerio'
import { type Timestamp } from 'firebase-admin/firestore'
import { config } from 'dotenv'

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
