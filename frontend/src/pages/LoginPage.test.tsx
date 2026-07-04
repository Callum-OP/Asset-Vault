import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { LoginPage } from './LoginPage'
import { AuthProvider } from '../auth/AuthContext'

describe('LoginPage', () => {
  it('renders the sign-in form', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    )
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    // Google button is hidden when no client ID is configured.
    expect(screen.queryByText(/sign in with google/i)).not.toBeInTheDocument()
  })
})
