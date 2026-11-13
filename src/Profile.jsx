import { useState } from 'react'
import { api } from './api.js'

const roleName = { customer: 'ลูกค้า', staff: 'พนักงาน', admin: 'ผู้ดูแลระบบ' }

export default function Profile({ user }) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setMsg(null)
    setBusy(true)
    try {
      await api('/me/password', {
        method: 'PATCH',
        body: { old_password: oldPassword, new_password: newPassword },
      })
      setMsg({ text: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว' })
      setOldPassword('')
      setNewPassword('')
    } catch (err) {
      setMsg({ error: true, text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel" style={{ maxWidth: 480, margin: '24px auto' }}>
      <h2>โปรไฟล์ของฉัน</h2>
      <p><strong>ชื่อผู้ใช้:</strong> {user.username}</p>
      <p><strong>สิทธิ์:</strong> {roleName[user.role] || user.role}</p>

      <form onSubmit={submit}>
        <h3>เปลี่ยนรหัสผ่าน</h3>
        <label>
          รหัสผ่านเดิม
          <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)}
            autoComplete="current-password" required />
        </label>
        <label>
          รหัสผ่านใหม่ (6-72 ตัวอักษร)
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password" minLength={6} required />
        </label>
        <button className="primary" disabled={busy}>{busy ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}</button>
        {msg && <p role="status" className={msg.error ? 'error' : 'ok'}>{msg.text}</p>}
      </form>
    </section>
  )
}