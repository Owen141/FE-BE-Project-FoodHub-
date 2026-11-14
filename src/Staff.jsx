import { useEffect, useState } from 'react'
import { api, baht, formatTime, itemText, statusLabel } from './api.js'

// status -> [next status, button label]; done/cancelled have no next step
const nextStep = {
  pending: ['cooking', 'รับออเดอร์ เริ่มทำ'],
  cooking: ['ready', 'ทำเสร็จแล้ว'],
  ready: ['done', 'ส่งถึงลูกค้าแล้ว'],
}
const statIcon = { pending: '⏳', cooking: '🔥', ready: '✅' }

export default function Staff() {
  const [orders, setOrders] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = () =>
    api('/staff/orders').then(
      (o) => { setOrders(o); setError('') },
      (e) => setError(e.message),
    )
    .finally(() => setLoading(false))

  useEffect(() => {
    load()
    const t = setInterval(load, 5000) // new orders appear without refreshing
    return () => clearInterval(t)
  }, [])

  const setStatus = (id, status) =>
    api(`/staff/orders/${id}`, { method: 'PATCH', body: { status } }).then(load, (e) => setError(e.message))

  const active = orders.filter((o) => nextStep[o.status])
  const history = orders.filter((o) => !nextStep[o.status])

  return (
    <>
      <div className="page-head">
        <h2>ภาพรวมครัว</h2>
        <p className="muted small">อัปเดตอัตโนมัติทุก 5 วินาที</p>
      </div>
      <ul className="stats">
        {Object.keys(nextStep).map((s) => (
          <li key={s} className={`panel stat ${s}`}>
            <span className="stat-icon" aria-hidden="true">{statIcon[s]}</span>
            <span>
              <strong>{orders.filter((o) => o.status === s).length}</strong>
              {statusLabel[s]}
            </span>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="error">{error}</p>}
      {loading && <p className="muted">กำลังโหลดออเดอร์...</p>}

      <section aria-labelledby="active-h">
        <div className="section-head">
          <h2 id="active-h">ออเดอร์ที่ต้องทำ</h2>
          <span className="pill">{active.length}</span>
        </div>
        {!loading && active.length === 0 && (
          <div className="panel empty">
            <span aria-hidden="true">🎉</span>
            <p>ไม่มีออเดอร์ค้าง</p>
          </div>
        )}
        <div className="tickets">
          {active.map((o) => (
            <article key={o.id} className={`panel ticket ${o.status}`}>
              <div className="ticket-head">
                <strong>#{o.id}</strong>
                <span className={`status ${o.status}`}>{statusLabel[o.status]}</span>
              </div>
              <p className="muted small">{o.username} · {formatTime(o.created_at)}</p>
              <ul>
                {o.items.map((i, n) => (
                  <li key={n}>
                    <span className="qty-tag">{i.qty}×</span>
                    <span>
                      {i.name}
                      {i.options.length > 0 && <strong className="opts">{i.options.join(' · ')}</strong>}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="ticket-total">{baht(o.total)}</p>
              <div className="actions">
                <button className="primary" onClick={() => setStatus(o.id, nextStep[o.status][0])}>
                  {nextStep[o.status][1]}
                </button>
                {o.status !== 'ready' && (
                  <button className="ghost" onClick={() => setStatus(o.id, 'cancelled')}>ยกเลิก</button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="history-h">
        <div className="section-head">
          <h2 id="history-h">ประวัติออเดอร์</h2>
        </div>
        {!loading && history.length === 0 && <p className="muted">ยังไม่มีประวัติ</p>}
        <div className="history">
          {history.map((o) => (
            <article key={o.id} className="panel order row">
              <div>
                <strong>#{o.id} {o.username}</strong>
                <span className="muted small"> · {formatTime(o.created_at)}</span>
              </div>
              <div>{o.items.map(itemText).join(', ')}</div>
              <span className={`status ${o.status}`}>{statusLabel[o.status]}</span>
              <strong>{baht(o.total)}</strong>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}
