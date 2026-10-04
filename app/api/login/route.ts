import { NextResponse, type NextRequest } from 'next/server'
import { checkPassword, createSession, SESSION_COOKIE, SESSION_DAYS } from '@/lib/auth'

// Jen cesty v rámci aplikace, aby se přihlášení nedalo zneužít k přesměrování jinam.
function safeNext(v: FormDataEntryValue | null): string {
  const s = typeof v === 'string' ? v : ''
  return s.startsWith('/') && !s.startsWith('//') ? s : '/'
}

export async function POST(request: NextRequest) {
  const form = await request.formData()
  const next = safeNext(form.get('next'))
  const password = String(form.get('password') ?? '')

  if (!(await checkPassword(password))) {
    // Malé zdržení zpomalí zkoušení hesel naslepo.
    await new Promise((r) => setTimeout(r, 800))
    const back = new URL('/login', request.url)
    back.searchParams.set('error', '1')
    if (next !== '/') back.searchParams.set('next', next)
    return NextResponse.redirect(back, 303)
  }

  const res = NextResponse.redirect(new URL(next, request.url), 303)
  res.cookies.set(SESSION_COOKIE, await createSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  })
  return res
}
