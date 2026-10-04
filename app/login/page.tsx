import type { Metadata } from 'next'
import { authConfigured } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Nextbike – přihlášení',
}

export default async function Login({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams
  const next = typeof params.next === 'string' ? params.next : '/'
  const error = params.error === '1'
  const configured = authConfigured()

  return (
    <div className="login-wrap">
      <form className="login" method="post" action="/api/login">
        <div className="login-brand">
          <span className="logo" aria-hidden="true" />
          <span>Nextbike</span>
        </div>
        <h1>Mapa jízd a eko analýza</h1>
        {configured ? (
          <>
            <div className="field">
              <label className="label" htmlFor="password">Heslo</label>
              <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus aria-invalid={error || undefined} />
            </div>
            {error && <p className="login-error" role="alert">Heslo nesedí. Zkus to znovu.</p>}
            <input type="hidden" name="next" value={next} />
            <button className="btn btn-primary" type="submit">Přihlásit</button>
          </>
        ) : (
          <p className="login-error">Přihlášení není nastavené: na serveru chybí proměnná APP_PASSWORD.</p>
        )}
      </form>
    </div>
  )
}
