/**
 * Web Worker entry point for Simulated Annealing.
 * Receives: { zones, m, opts }
 * Posts: { type: 'progress', iter, cost } | { type: 'done', assignments } | { type: 'error', message }
 *
 * Worker CAN import from L0/L1 directly — it is sandboxed execution, not an L4 component.
 */

import { partitionSimulatedAnnealing } from '../../lib/partition.js'
import type { Zone } from '../../types/domain.js'

self.onmessage = (e: MessageEvent) => {
  const { zones, m, opts } = e.data as {
    zones: Zone[]
    m: number
    opts?: {
      maxIter?: number
      initialTemp?: number
      cooling?: number
      alpha?: number
      beta?: number
      adjThresholdKm?: number
    }
  }

  const maxIter = opts?.maxIter ?? 5000

  try {
    const assignments = partitionSimulatedAnnealing(zones, m, {
      ...opts,
      onProgress: (iter, cost) => {
        // Throttle: only post progress every 100 iterations to avoid message flooding
        if (iter % 100 === 0 || iter === maxIter - 1) {
          self.postMessage({ type: 'progress', iter, cost, total: maxIter })
        }
      },
    })

    self.postMessage({ type: 'done', assignments })
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : 'SA Worker error',
    })
  }
}
