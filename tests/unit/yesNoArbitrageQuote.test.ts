import type { NormalizedBookLevel } from '@/lib/order-panel-utils'
import { describe, expect, it } from 'vitest'
import {
  buildYesNoArbitragePreview,
  buildYesNoArbitrageQuote,
  findMinimumExecutableYesNoArbitrageQuote,
  scaleYesNoArbitrageQuote,
} from '@/lib/yes-no-arbitrage-quote'

function level(priceDollars: number, size: number): NormalizedBookLevel {
  return { priceCents: priceDollars * 100, priceDollars, size }
}

describe('yes/no arbitrage quotes', () => {
  it('previews both best asks and their negative edge when no arbitrage is available', () => {
    const preview = buildYesNoArbitragePreview({
      yesAsks: [level(0.83, 50)],
      noAsks: [level(0.20, 50)],
      yesFeeBps: 100,
      noFeeBps: 100,
    })

    expect(preview?.yesPrice).toBe(0.83)
    expect(preview?.noPrice).toBe(0.20)
    expect(preview?.edge).toBeCloseTo(-0.0403, 6)
  })

  it('previews an available side even while the opposite order book is empty', () => {
    const preview = buildYesNoArbitragePreview({
      yesAsks: [level(0.42, 10)],
      noAsks: [],
      yesFeeBps: null,
      noFeeBps: null,
    })

    expect(preview).toEqual({ yesPrice: 0.42, noPrice: null, edge: null })
  })

  it('pairs YES and NO liquidity while their combined cost stays below one dollar', () => {
    const quote = buildYesNoArbitrageQuote({
      yesTokenId: 'yes',
      noTokenId: 'no',
      yesAsks: [level(0.40, 10), level(0.52, 10)],
      noAsks: [level(0.50, 20)],
    })

    expect(quote?.shares).toBe(10)
    expect(quote?.totalCost).toBe(9)
    expect(quote?.profit).toBe(1)
    expect(quote?.yesOrder.price).toBe(0.40)
    expect(quote?.noOrder.price).toBe(0.50)
  })

  it('removes an opportunity that disappears after both Kuest fees', () => {
    const quote = buildYesNoArbitrageQuote({
      yesTokenId: 'yes',
      noTokenId: 'no',
      yesAsks: [level(0.495, 10)],
      noAsks: [level(0.495, 10)],
      yesFeeBps: 150,
      noFeeBps: 150,
    })

    expect(quote).toBeNull()
  })

  it('deducts the combined market and builder fees from both buy legs', () => {
    const quote = buildYesNoArbitrageQuote({
      yesTokenId: 'yes',
      noTokenId: 'no',
      yesAsks: [level(0.40, 10)],
      noAsks: [level(0.50, 10)],
      yesFeeBps: 150,
      noFeeBps: 200,
    })

    expect(quote?.yesCost).toBeCloseTo(4.06, 6)
    expect(quote?.noCost).toBeCloseTo(5.10, 6)
    expect(quote?.profit).toBeCloseTo(0.84, 6)
  })

  it('limits Max by the shared balance required by both FOK price caps', () => {
    const quote = buildYesNoArbitrageQuote({
      yesTokenId: 'yes',
      noTokenId: 'no',
      yesAsks: [level(0.30, 10), level(0.40, 10)],
      noAsks: [level(0.40, 20)],
      kuestBalance: 8,
    })

    expect(quote?.shares).toBe(10)
    expect(quote?.yesOrder.maximumCost).toBe(3)
    expect(quote?.noOrder.maximumCost).toBe(4)
  })

  it('includes both outcome fees when constraining Max to the shared balance', () => {
    const quote = buildYesNoArbitrageQuote({
      yesTokenId: 'yes',
      noTokenId: 'no',
      yesAsks: [level(0.40, 10)],
      noAsks: [level(0.50, 10)],
      yesFeeBps: 1_000,
      noFeeBps: 1_000,
      kuestBalance: 9.50,
    })

    const yesPrincipal = (quote?.yesOrder.maximumCost ?? 0)
    const noPrincipal = (quote?.noOrder.maximumCost ?? 0)
    const fees = Math.max(0, (quote?.yesCost ?? 0) - yesPrincipal)
      + Math.max(0, (quote?.noCost ?? 0) - noPrincipal)

    expect(quote?.shares).toBeCloseTo(9.595959, 6)
    expect(yesPrincipal + noPrincipal + fees).toBeLessThanOrEqual(9.50)
  })

  it('scales both legs to exactly the same number of shares', () => {
    const quote = buildYesNoArbitrageQuote({
      yesTokenId: 'yes',
      noTokenId: 'no',
      yesAsks: [level(0.40, 20)],
      noAsks: [level(0.50, 20)],
    })
    const scaled = scaleYesNoArbitrageQuote(quote!, 25)

    expect(scaled?.shares).toBe(5)
    expect(scaled?.yesOrder.maximumCost).toBe(2)
    expect(scaled?.noOrder.maximumCost).toBe(2.5)
  })

  it('finds the smallest pair accepted by both market-order minimums', () => {
    const quote = buildYesNoArbitrageQuote({
      yesTokenId: 'yes',
      noTokenId: 'no',
      yesAsks: [level(0.20, 100)],
      noAsks: [level(0.70, 100)],
    })
    const minimum = findMinimumExecutableYesNoArbitrageQuote(quote!, {
      minimumShares: 1,
      minimumOrderAmount: 1,
    })

    expect(minimum?.shares).toBeCloseTo(5, 5)
    expect(minimum?.yesOrder.maximumCost).toBeCloseTo(1, 6)
    expect(minimum?.noOrder.maximumCost).toBeCloseTo(3.5, 6)
  })
})
