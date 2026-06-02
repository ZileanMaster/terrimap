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
    background: 'color-mix(in srgb, var(--color-bg) 55%, #000)',
    backdropFilter: 'blur(10px)',
    display: 'grid',
    placeItems: 'center',
    padding: 16,
  },
  modal: {
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    borderRadius: 20,
    border: '1px solid var(--color-border)',
    boxShadow: '0 24px 48px rgba(0,0,0,.24)',
    overflow: 'hidden',
    maxWidth: '100%',
    transform: 'translateY(0)',
  },
  header: {
    padding: '18px 20px 0',
  },
  title: {
    fontSize: 17,
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
    padding: '18px 20px',
  },
  footer: {
    padding: '14px 20px 18px',
    borderTop: '1px solid var(--color-border)',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
  },
}

