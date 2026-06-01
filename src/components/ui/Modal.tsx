import React from 'react'
import { createPortal } from 'react-dom'

export interface ModalProps {
  open: boolean
  title?: string
  description?: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  width?: number
}

export default function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  width = 480,
}: ModalProps) {
  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div style={styles.backdrop} role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div
        style={{ ...styles.modal, width }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {(title || description) && (
          <div style={styles.header}>
            {title && <div style={styles.title}>{title}</div>}
            {description && <div style={styles.desc}>{description}</div>}
          </div>
        )}

        <div style={styles.body}>{children}</div>

        {footer && <div style={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 9000,
    background: 'rgba(0,0,0,.45)',
    display: 'grid',
    placeItems: 'center',
    padding: 16,
  },
  modal: {
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--color-border)',
    boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden',
    maxWidth: '100%',
  },
  header: {
    padding: '16px 18px 0',
  },
  title: {
    fontSize: 16,
    fontWeight: 800,
    letterSpacing: '-0.02em',
  },
  desc: {
    marginTop: 6,
    color: 'var(--color-text-muted)',
    fontSize: 13,
    lineHeight: 1.4,
  },
  body: {
    padding: '16px 18px',
  },
  footer: {
    padding: '12px 18px 16px',
    borderTop: '1px solid var(--color-border)',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
  },
}

