import { GoogleLogin } from '@react-oauth/google'

import { useAuth } from '../auth/AuthContext'

// Rendered only inside a GoogleOAuthProvider (i.e. when GOOGLE_CLIENT_ID is set).
export function GoogleButton({ onError }: { onError: (message: string) => void }) {
  const { loginWithGoogle } = useAuth()

  return (
    <GoogleLogin
      onSuccess={(credentialResponse) => {
        const idToken = credentialResponse.credential
        if (!idToken) {
          onError('Google did not return a credential')
          return
        }
        loginWithGoogle(idToken).catch(() => onError('Google sign-in failed'))
      }}
      onError={() => onError('Google sign-in failed')}
    />
  )
}
