import React from 'react'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export default function Input({ style, ...props }: InputProps) {
  return <input {...props} style={{ ...styles.input, ...style }} />
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function Textarea({ style, ...props }: TextareaProps) {
  return <textarea {...props} style={{ ...styles.textarea, ...style }} />
}

const styles: Record<string, React.CSSProperties> = {
  input: {
    width: '100%',
    height: 40,
    padding: '0 12px',
    borderRadius: 10,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    outline: 'none',
    fontSize: 14,
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    outline: 'none',
    fontSize: 14,
    resize: 'vertical',
  },
}

