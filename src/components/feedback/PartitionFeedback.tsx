/**
 * PartitionFeedback — Sales đánh giá kết quả phân vùng
 *
 * Adjust 5: Nhận prop `snapshotId` để liên kết feedback với snapshot cụ thể.
 *
 * - Sales: nút "Đánh giá" → modal 👍/👎 + textarea bình luận
 * - Coordinator: summary view (X 👍 / Y 👎, danh sách bình luận)
 *
 * DB: `partition_feedback` table (localStorage fallback).
 *
 * SQL cần chạy:
 * ```sql
 * CREATE TABLE IF NOT EXISTS partition_feedback (
 *   id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
 *   snapshot_id TEXT NOT NULL,
 *   agent_id    TEXT NOT NULL,
 *   rating      INT NOT NULL CHECK (rating IN (1, -1)),
 *   comment     TEXT,
 *   created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
 *   UNIQUE(snapshot_id, agent_id)
 * );
 * ALTER TABLE partition_feedback ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Allow all for anon" ON partition_feedback FOR ALL USING (true) WITH CHECK (true);
 * ```
 */

import React, { useState, useEffect, useCallback } from 'react'
import { supabase, isOnline } from '../../lib/supabase.js'
import { getActiveProjectId } from '../../services/db.js'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FeedbackItem {
  id:          string
  snapshotId:  string
  agentId:     string
  agentName?:  string
  rating:      1 | -1
  comment?:    string
  createdAt:   string
}

// ── localStorage helpers ──────────────────────────────────────────────────────

const LS_BASE = 'terrimap_feedback'

function lsKeyScoped(): string {
  const pid = getActiveProjectId()
  return pid ? `${LS_BASE}_${pid}` : LS_BASE
}

function lsGet(): FeedbackItem[] {
  try { return JSON.parse(localStorage.getItem(lsKeyScoped()) ?? '[]') }
  catch { return [] }
}
function lsSet(items: FeedbackItem[]) {
  try { localStorage.setItem(lsKeyScoped(), JSON.stringify(items)) }
  catch { /* ignore */ }
}

async function saveFeedback(item: FeedbackItem): Promise<void> {
  // Always save to localStorage
  const all = lsGet()
  const idx = all.findIndex((f) => f.snapshotId === item.snapshotId && f.agentId === item.agentId)
  if (idx >= 0) all[idx] = item; else all.push(item)
  lsSet(all)

  if (!isOnline()) return
  try {
    await supabase!.from('partition_feedback').upsert({
      id:          item.id,
      snapshot_id: item.snapshotId,
      agent_id:    item.agentId,
      rating:      item.rating,
      comment:     item.comment ?? null,
      created_at:  item.createdAt,
    }, { onConflict: 'snapshot_id,agent_id' })
  } catch { /* ignore */ }
}

function loadFeedbackForSnapshot(snapshotId: string): FeedbackItem[] {
  return lsGet().filter((f) => f.snapshotId === snapshotId)
}

// ── Component ─────────────────────────────────────────────────────────────────

interface PartitionFeedbackProps {
  /** Adjust 5: liên kết feedback với snapshot cụ thể */
  snapshotId:  string
  snapshotLabel?: string
  /** ID nhân viên đang xem — để xác định đã đánh giá chưa */
  agentId:     string
  agentName?:  string
  /** 'sales' = hiện nút Đánh giá; 'coordinator' = hiện summary */
  mode:        'sales' | 'coordinator'
}

export default function PartitionFeedback({
  snapshotId, snapshotLabel, agentId, agentName, mode,
}: PartitionFeedbackProps) {
  const [feedbacks, setFeedbacks]   = useState<FeedbackItem[]>([])
  const [showModal, setShowModal]   = useState(false)
  const [rating, setRating]         = useState<1 | -1 | null>(null)
  const [comment, setComment]       = useState('')
  const [submitting, setSubmitting] = useState(false)

  const reload = useCallback(() => {
    setFeedbacks(loadFeedbackForSnapshot(snapshotId))
  }, [snapshotId])

  useEffect(() => { reload() }, [reload])

  const myFeedback = feedbacks.find((f) => f.agentId === agentId)

  const handleSubmit = useCallback(async () => {
    if (!rating) return
    setSubmitting(true)
    const item: FeedbackItem = {
      id:         `fb-${agentId}-${Date.now()}`,
      snapshotId,
      agentId,
      agentName,
      rating,
      comment:    comment.trim() || undefined,
      createdAt:  new Date().toISOString(),
    }
    await saveFeedback(item)
    reload()
    setShowModal(false)
    setRating(null)
    setComment('')
    setSubmitting(false)
  }, [rating, comment, snapshotId, agentId, agentName, reload])

  // ── Coordinator summary view ──────────────────────────────────────────────
  if (mode === 'coordinator') {
    const likes    = feedbacks.filter((f) => f.rating === 1).length
    const dislikes = feedbacks.filter((f) => f.rating === -1).length
    if (feedbacks.length === 0) return null
    return (
      <div style={styles.summaryWrapper}>
        <div style={styles.summaryHeader}>
          💬 Đánh giá snapshot{snapshotLabel ? ` "${snapshotLabel}"` : ''}
        </div>
        <div style={styles.summaryStats}>
          <span style={styles.likeCount}>👍 {likes}</span>
          <span style={styles.dislikeCount}>👎 {dislikes}</span>
        </div>
        {feedbacks.filter((f) => f.comment).map((f) => (
          <div key={f.id} style={styles.commentItem}>
            <span style={styles.commentAgent}>{f.agentName ?? f.agentId}</span>
            <span style={{ marginLeft: 4, fontSize: 11 }}>{f.rating === 1 ? '👍' : '👎'}</span>
            <div style={styles.commentText}>{f.comment}</div>
          </div>
        ))}
      </div>
    )
  }

  // ── Sales view ────────────────────────────────────────────────────────────
  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        style={{
          ...styles.rateBtn,
          ...(myFeedback ? styles.rateBtnDone : {}),
        }}
        title={myFeedback ? 'Đã đánh giá — click để chỉnh sửa' : 'Đánh giá phân vùng này'}
      >
        {myFeedback
          ? (myFeedback.rating === 1 ? '👍 Đã đánh giá' : '👎 Đã đánh giá')
          : '💬 Đánh giá'}
      </button>

      {/* Modal */}
      {showModal && (
        <div style={styles.backdrop} onClick={() => setShowModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>
              Đánh giá phân vùng{snapshotLabel ? ` "${snapshotLabel}"` : ''}
            </div>

            <div style={styles.ratingRow}>
              <button
                onClick={() => setRating(1)}
                style={{
                  ...styles.ratingBtn,
                  ...(rating === 1 ? styles.ratingBtnLike : {}),
                }}
              >
                👍 Tốt
              </button>
              <button
                onClick={() => setRating(-1)}
                style={{
                  ...styles.ratingBtn,
                  ...(rating === -1 ? styles.ratingBtnDislike : {}),
                }}
              >
                👎 Chưa tốt
              </button>
            </div>

            <textarea
              placeholder="Bình luận (tùy chọn)..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              style={styles.textarea}
              rows={3}
            />

            <div style={styles.modalFooter}>
              <button
                onClick={() => setShowModal(false)}
                style={styles.cancelBtn}
              >
                Hủy
              </button>
              <button
                onClick={handleSubmit}
                disabled={!rating || submitting}
                style={{
                  ...styles.submitBtn,
                  opacity: (!rating || submitting) ? 0.5 : 1,
                }}
              >
                {submitting ? '⏳' : '✅ Gửi đánh giá'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  rateBtn: {
    padding:      '5px 12px',
    borderRadius: 7,
    border:       '1.5px solid var(--color-border)',
    background:   'transparent',
    color:        'var(--color-text)',
    fontSize:     12,
    fontWeight:   600,
    cursor:       'pointer',
    transition:   'all 150ms',
  },
  rateBtnDone: {
    borderColor: 'var(--color-accent)',
    color:       'var(--color-accent)',
  },
  backdrop: {
    position:  'fixed',
    inset:     0,
    zIndex:    9000,
    background: 'rgba(0,0,0,0.45)',
    display:   'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modal: {
    background:   'var(--color-surface)',
    border:       '1.5px solid var(--color-border)',
    borderRadius: 14,
    padding:      '20px 22px',
    width:        320,
    boxShadow:    '0 16px 48px rgba(0,0,0,0.28)',
    display:      'flex',
    flexDirection: 'column',
    gap:           12,
  },
  modalTitle: {
    fontSize:   15,
    fontWeight: 700,
    color:      'var(--color-text)',
  },
  ratingRow: {
    display: 'flex',
    gap:     10,
  },
  ratingBtn: {
    flex:         1,
    padding:      '10px 0',
    borderRadius: 9,
    border:       '2px solid var(--color-border)',
    background:   'var(--color-surface-2)',
    fontSize:     14,
    fontWeight:   700,
    cursor:       'pointer',
    transition:   'all 150ms',
  },
  ratingBtnLike: {
    borderColor: '#22c55e',
    background:  'rgba(34,197,94,0.12)',
    color:       '#22c55e',
  },
  ratingBtnDislike: {
    borderColor: '#ef4444',
    background:  'rgba(239,68,68,0.12)',
    color:       '#ef4444',
  },
  textarea: {
    width:        '100%',
    padding:      '8px 10px',
    borderRadius: 8,
    border:       '1px solid var(--color-border)',
    background:   'var(--color-surface)',
    color:        'var(--color-text)',
    fontSize:     13,
    resize:       'vertical',
    boxSizing:    'border-box',
  },
  modalFooter: {
    display:        'flex',
    justifyContent: 'flex-end',
    gap:            8,
  },
  cancelBtn: {
    padding:      '6px 14px',
    borderRadius: 7,
    border:       '1.5px solid var(--color-border)',
    background:   'transparent',
    color:        'var(--color-text-muted)',
    fontSize:     13,
    cursor:       'pointer',
  },
  submitBtn: {
    padding:      '6px 16px',
    borderRadius: 7,
    border:       'none',
    background:   'var(--color-accent)',
    color:        '#fff',
    fontSize:     13,
    fontWeight:   700,
    cursor:       'pointer',
  },
  // Coordinator summary
  summaryWrapper: {
    padding:      '10px 14px',
    borderRadius: 10,
    border:       '1px solid var(--color-border)',
    background:   'var(--color-surface-2)',
    marginTop:    8,
  },
  summaryHeader: {
    fontSize:   13,
    fontWeight: 700,
    color:      'var(--color-text)',
    marginBottom: 6,
  },
  summaryStats: {
    display: 'flex',
    gap:     12,
    marginBottom: 8,
  },
  likeCount:    { fontSize: 14, fontWeight: 700, color: '#22c55e' },
  dislikeCount: { fontSize: 14, fontWeight: 700, color: '#ef4444' },
  commentItem: {
    padding:      '6px 0',
    borderTop:    '1px solid var(--color-border)',
    display:      'flex',
    flexDirection: 'column',
    gap:           2,
  },
  commentAgent: {
    fontSize:   11,
    fontWeight: 700,
    color:      'var(--color-accent)',
  },
  commentText: {
    fontSize: 12,
    color:    'var(--color-text-muted)',
  },
}
