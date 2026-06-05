import React from 'react'
import { Link } from 'react-router-dom'
import { RiArrowLeftLine } from 'react-icons/ri'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4"
      style={{ background: 'var(--color-bg)' }}>
      <p className="font-display font-black text-8xl mb-4 gradient-text">404</p>
      <h1 className="font-display font-bold text-2xl mb-2" style={{ color: 'var(--color-text)' }}>
        Page not found
      </h1>
      <p className="text-sm mb-8" style={{ color: 'var(--color-text-muted)' }}>
        The page you're looking for doesn't exist.
      </p>
      <Link to="/home" className="btn-primary flex items-center gap-2">
        <RiArrowLeftLine /> Go Home
      </Link>
    </div>
  )
}
