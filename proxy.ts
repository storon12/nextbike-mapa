import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySession } from '@/lib/auth'

// Bez přihlášení je dostupná jen přihlašovací stránka a její obrázky.
const PUBLIC = ['/login', '/api/login', '/logo.png', '/icon.png']

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  if (PUBLIC.includes(pathname)) return NextResponse.next()

  if (await verifySession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next()

  const login = new URL('/login', request.url)
  if (pathname !== '/') login.searchParams.set('next', pathname + search)
  return NextResponse.redirect(login)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
