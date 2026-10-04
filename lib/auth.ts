// Jednoduché přihlášení jedním heslem (APP_PASSWORD). Po přihlášení dostane
// prohlížeč cookie s dobou platnosti podepsanou HMAC klíčem odvozeným z
// AUTH_SECRET (nebo z hesla), takže změna hesla odhlásí všechny.

export const SESSION_COOKIE = 'nb_session'
export const SESSION_DAYS = 30

const enc = new TextEncoder()

function secret(): string | null {
  const pw = process.env.APP_PASSWORD
  if (!pw) return null
  return `${process.env.AUTH_SECRET ?? ''}:${pw}`
}

async function hmac(key: string, data: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(data)))
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('')
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function authConfigured(): boolean {
  return secret() !== null
}

export async function checkPassword(input: string): Promise<boolean> {
  const pw = process.env.APP_PASSWORD
  if (!pw) return false
  // Porovnání otisků, aby délka hesla neprozradila nic časováním.
  const [a, b] = await Promise.all([hmac('pw', input), hmac('pw', pw)])
  return safeEqual(a, b)
}

export async function createSession(): Promise<string> {
  const s = secret()
  if (!s) throw new Error('APP_PASSWORD is not set')
  const exp = Date.now() + SESSION_DAYS * 86_400_000
  return `${exp}.${await hmac(s, String(exp))}`
}

export async function verifySession(token: string | undefined): Promise<boolean> {
  const s = secret()
  if (!s || !token) return false
  const [exp, sig] = token.split('.')
  if (!exp || !sig || !(Number(exp) > Date.now())) return false
  return safeEqual(sig, await hmac(s, exp))
}
