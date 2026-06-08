import type { HTMLAttributes, ReactNode } from 'react'
import styles from './Card.module.css'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  interactive?: boolean
  selected?: boolean
}

export function Card({ children, interactive, selected, className = '', ...rest }: CardProps) {
  return (
    <div
      {...rest}
      className={[
        styles.card,
        interactive ? styles.interactive : '',
        selected ? styles.selected : '',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  )
}
