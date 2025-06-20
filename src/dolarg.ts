import { chromium } from 'playwright'
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

  const browser = await chromium.launch()
  const page = await browser.newPage()

  await page.goto(dataUrl, { timeout: 60000 })

  const parentSelector = 'div.tile.is-parent.is-7.is-vertical'
  const childSelector = 'div.tile.is-child'

  await page.waitForSelector(parentSelector)

  const childElements = await page.$$(parentSelector + ' ' + childSelector)

  const data: Dolarg[] = []
  if (childElements.length) {
    for (const el of childElements) {
      const name = await el.evaluate(node => node.getElementsByClassName('title')[0].getElementsByClassName('titleText')[0].textContent?.trim() || null)
      const valuesElement = await el.$('.values')

      if (valuesElement) {
        const buyElement = await valuesElement.$('.compra')
        const sellElement = await valuesElement.$('.venta')

        const buyPrice = buyElement
          ? await buyElement.evaluate(node => {
            if (!node.getElementsByClassName('val').length) return null
            return node.getElementsByClassName('val')[0].textContent?.trim() || null
          })
          : null
        const sellPrice = sellElement
          ? await sellElement.evaluate(node => {
            if (
              !node.getElementsByClassName('venta-wrapper').length || !node.getElementsByClassName('venta-wrapper')[0].getElementsByClassName('val').length
            ) return null
            return node.getElementsByClassName('venta-wrapper')[0].getElementsByClassName('val')[0].textContent?.trim() || null
          })
          : null
        const sellPercentage = sellElement
          ? await sellElement.evaluate(node => {
            if (
              !node.getElementsByClassName('var-porcentaje').length || !node.getElementsByClassName('var-porcentaje')[0].getElementsByTagName('div').length
            ) return null
            return node.getElementsByClassName('var-porcentaje')[0].getElementsByTagName('div')[0].textContent?.trim() || null
          })
          : null

        data.push({
          name,
          buyPrice,
          sellPrice,
          sellPercentage,
          buyPriceFormated: typeof buyPrice === 'string' && buyPrice.includes('$') ? (!isNaN(parseFloat(buyPrice.replace('$', ''))) ? parseFloat(buyPrice.replace('$', '').replace(/\./g, '').replace(',', '.')) : null) : null,
          sellPriceFormated: typeof sellPrice === 'string' && sellPrice.includes('$') ? (!isNaN(parseFloat(sellPrice.replace('$', ''))) ? parseFloat(sellPrice.replace('$', '').replace(/\./g, '').replace(',', '.')) : null) : null,
          sellPercentageFormated: typeof sellPercentage === 'string' && sellPercentage.includes('%') ? (!isNaN(parseFloat(sellPercentage.replace('%', ''))) ? parseFloat(sellPercentage.replace('%', '')) : null) : null,
        })
      }
    }
  }

  await browser.close()
  return { data }
}
