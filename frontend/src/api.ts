import type { AdminSettings } from './types'

const API_ROOT = '/api/v2'
const TOKEN_KEY = 'bitpanel-admin-auth'

type ApiEnvelope<T> = { status?: string; message?: string; data?: T }

export class ApiError extends Error {
  status: number

  constructor(message: string, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function tokenStore() {
  return window.sessionStorage
}

export function getToken(): string | null {
  return tokenStore().getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  tokenStore().setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  tokenStore().removeItem(TOKEN_KEY)
}

function adminRoot(settings: AdminSettings): string {
  const securePath = settings.secure_path?.replace(/^\/+|\/+$/g, '')
  if (!securePath) throw new ApiError('后台安全路径未注入页面配置')
  return `${API_ROOT}/${encodeURIComponent(securePath)}`
}

async function request<T>(url: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', token)

  let response: Response
  try {
    response = await fetch(url, { ...init, headers })
  } catch {
    throw new ApiError('无法连接到服务器，请检查服务状态或网络连接')
  }

  const payload = await response.json().catch(() => null) as ApiEnvelope<T> | null
  if (!response.ok || payload?.status === 'fail') {
    if (token && [401, 403].includes(response.status)) {
      clearToken()
      window.dispatchEvent(new Event('bitpanel:unauthorized'))
    }
    throw new ApiError(payload?.message || `请求失败 (${response.status})`, response.status)
  }
  return (payload?.status ? payload.data : payload) as T
}

export async function login(email: string, password: string): Promise<{ auth_data: string; is_admin: boolean }> {
  const result = await request<{ auth_data: string; is_admin: boolean }>(`${API_ROOT}/passport/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (!result?.auth_data) throw new ApiError('登录响应缺少认证令牌')
  if (!result.is_admin) throw new ApiError('该账户没有管理员权限', 403)
  return result
}

export function adminGet<T>(settings: AdminSettings, path: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(`${adminRoot(settings)}/${path.replace(/^\//, '')}`, window.location.origin)
  for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, String(value))
  return request<T>(url.toString(), {}, getToken())
}

export function adminPost<T>(settings: AdminSettings, path: string, body: unknown): Promise<T> {
  return request<T>(`${adminRoot(settings)}/${path.replace(/^\//, '')}`, {
    method: 'POST',
    body: JSON.stringify(body),
  }, getToken())
}

export async function adminDownload(settings: AdminSettings, path: string, body: unknown, filename: string): Promise<void> {
  const headers = new Headers({ Accept: 'text/csv', 'Content-Type': 'application/json' })
  const token = getToken()
  if (token) headers.set('Authorization', token)
  let response: Response
  try {
    response = await fetch(`${adminRoot(settings)}/${path.replace(/^\//, '')}`, {
      method: 'POST', headers, body: JSON.stringify(body),
    })
  } catch {
    throw new ApiError('无法连接到服务器，请检查服务状态或网络连接')
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as ApiEnvelope<unknown> | null
    if (token && [401, 403].includes(response.status)) {
      clearToken()
      window.dispatchEvent(new Event('bitpanel:unauthorized'))
    }
    throw new ApiError(payload?.message || `下载失败 (${response.status})`, response.status)
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const payload = await response.json() as ApiEnvelope<unknown>
    throw new ApiError(payload.message || '服务器返回了非文件响应')
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function validateAdminSession(settings: AdminSettings): Promise<void> {
  await adminGet(settings, 'stat/getOverride')
}
