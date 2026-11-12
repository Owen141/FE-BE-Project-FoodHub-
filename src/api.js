const API_URL = import.meta.env.VITE_API_URL || ''

export const menuCategories = [
  { value: 'savory', label: 'ของคาว', emoji: '🍛' },
  { value: 'dessert', label: 'ของหวาน', emoji: '🍰' },
  { value: 'drink', label: 'เครื่องดื่ม', emoji: '🥤' },
]

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(API_URL + '/api' + path, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body && JSON.stringify(body),
  })

  if (res.status === 401) window.dispatchEvent(new Event('unauthorized'))
  if (res.status === 204) return null

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้')
  return data
}

export const statusLabel = {
  pending: 'รอรับออเดอร์',
  cooking: 'กำลังทำ',
  ready: 'พร้อมเสิร์ฟ',
  done: 'เสร็จสิ้น',
  cancelled: 'ยกเลิก',
}

export const baht = (n) => '฿' + n.toLocaleString('th-TH')

export const itemText = (i) => `${i.name}${i.options.length ? ` (${i.options.join(', ')})` : ''} ×${i.qty}`

export const formatTime = (iso) => new Date(iso).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
