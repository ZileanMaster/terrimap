/**
 * Điểm vào Web Worker cho Simulated Annealing.
 * Nhận: { zones, m, opts }
 * Gửi: { type: 'progress', iter, cost } | { type: 'done', assignments } | { type: 'error', message }
 *
 * Worker CÓ THỂ import trực tiếp từ L0/L1 — đây là môi trường thực thi sandbox, không phải component L4.
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
        // Gi?i h?n t?n su?t: ch? g?i progress m?i 100 v?ng ?? tr?nh spam message
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
