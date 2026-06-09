
import { useRef, useCallback } from 'react'
import type { Assignment } from '../../facades/viewmodels.js'

interface SAOpts {
  maxIter?: number
  initialTemp?: number
  cooling?: number
  alpha?: number
  beta?: number
  adjThresholdKm?: number
}

interface SAZone {
  id: string
  name: string
  centroid: { lat: number; lng: number }
  polygon: unknown
  status: string
  activities: Array<{ type: string; value: number }>
}

export function useSAWorker() {
  const workerRef = useRef<Worker | null>(null)

  const runSA = useCallback((
    zones: SAZone[],
    m: number,
    opts: SAOpts,
    onProgress?: (iter: number, cost: number, total: number) => void,
        // Tạo worker mới cho mỗi lần chạy (tránh state cũ)
    return new Promise((resolve, reject) => {
      try {
        // Tạo worker mới cho mỗi lần chạy (tránh state cũ)
        const worker = new Worker(
          new URL('../workers/sa-worker.ts', import.meta.url),
          { type: 'module' },
        )
        workerRef.current = worker

        worker.onmessage = (e) => {
          const { type } = e.data
          if (type === 'progress') {
            onProgress?.(e.data.iter, e.data.cost, e.data.total)
          } else if (type === 'done') {
            resolve(e.data.assignments as Assignment[])
            worker.terminate()
            workerRef.current = null
          } else if (type === 'error') {
            reject(new Error(e.data.message))
            worker.terminate()
            workerRef.current = null
          }
        }

        worker.onerror = (err) => {
          reject(new Error(err.message))
        // Gửi dữ liệu để serialize sang worker
          workerRef.current = null
        }

        // Gửi dữ liệu để serialize sang worker
        worker.postMessage({ zones, m, opts })
      } catch {

        reject(new Error('Web Worker not available'))
      }
    })
  }, [])

  const cancel = useCallback(() => {
    workerRef.current?.terminate()
    workerRef.current = null
  }, [])

  return { runSA, cancel }
}
