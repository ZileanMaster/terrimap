import React from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export default function Button({
  variant = 'secondary',
  size = 'md',
  style,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        ...styles.base,
        ...(size === 'sm' ? styles.sm : styles.md),
        ...(variant === 'primary'
          ? styles.primary
          : variant === 'danger'
            ? styles.danger
            : variant === 'ghost'
              ? styles.ghost
              : styles.secondary),
        ...(disabled ? styles.disabled : {}),
        ...style,
      }}
    />
  )
}

export function IconButton({
  style,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        ...styles.icon,
        ...(disabled ? styles.disabled : {}),
        ...style,
      }}
    />
  )
}

const styles: Record<string, React.CSSProperties> = {
  base: {
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    borderRadius: 10,
    cursor: 'pointer',
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    userSelect: 'none',
    lineHeight: 1,
    transition: 'transform 120ms ease, background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease',
  },
  md: { height: 40, padding: '0 14px', fontSize: 14 },
  sm: { height: 32, padding: '0 10px', fontSize: 13, borderRadius: 8 },

  primary: {
    background: 'var(--color-accent)',
    borderColor: 'var(--color-accent)',
    color: '#fff',
    boxShadow: 'var(--shadow-sm)',
  },
  secondary: {
    background: 'var(--color-surface)',
  },
  ghost: {
    background: 'transparent',
  },
  danger: {
    background: 'rgba(220,38,38,.10)',
    borderColor: 'rgba(220,38,38,.25)',
    color: 'var(--color-danger)',
  },
  disabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--color-text)',
    transition: 'transform 120ms ease, background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease',
  },
}

