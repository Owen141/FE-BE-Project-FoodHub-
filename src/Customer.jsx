import { useEffect, useState } from 'react'
import { api, baht, formatTime, itemText, menuCategories, statusLabel } from './api.js'

const steps = ['pending', 'cooking', 'ready', 'done']

function Tracker({ status }) {
  const at = steps.indexOf(status)
  return (
    <ol className="tracker">
      {steps.map((s, i) => (
        <li key={s} className={i < at ? 'past' : i === at ? 'now' : undefined} aria-current={i === at ? 'step' : undefined}>
          {statusLabel[s]}
        </li>
      ))}
    </ol>
  )
}

export default function Customer() {
  const [menu, setMenu] = useState([])
  const [cart, setCart] = useState({}) // "menuId|options" -> { menu, options, qty }
  const [picks, setPicks] = useState({}) // menu id -> { group name -> choice }
  const [orders, setOrders] = useState([])
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [activeTab, setActiveTab] = useState('menu')
  const [activeCategory, setActiveCategory] = useState('all')

  const loadOrders = () => api('/my/orders').then(setOrders)
  useEffect(() => {
    const fail = (e) => setMsg({ error: true, text: e.message })
    api('/menu').then(setMenu, fail)
    loadOrders().catch(fail)
    const t = setInterval(() => loadOrders().catch(() => {}), 5000) // picks up status changes from staff
    return () => clearInterval(t)
  }, [])

  // same dish with different options = separate cart lines
  const add = (m) => {
    const options = m.options.map((g) => picks[m.id]?.[g.name]).filter(Boolean)
    const key = m.id + '|' + options.join(',')
    setCart((c) => ({ ...c, [key]: { menu: m, options, qty: Math.min((c[key]?.qty || 0) + 1, 99) } }))
  }

  const change = (key, d) =>
    setCart((c) => {
      const qty = Math.min(c[key].qty + d, 99)
      const next = { ...c, [key]: { ...c[key], qty } }
      if (qty <= 0) delete next[key]
      return next
    })

  const pick = (id, group, choice) => setPicks((p) => ({ ...p, [id]: { ...p[id], [group]: choice } }))

  const lines = Object.entries(cart)
  const total = lines.reduce((s, [, l]) => s + l.menu.price * l.qty, 0)
  const count = lines.reduce((n, [, l]) => n + l.qty, 0)
  const inCart = (id) => lines.reduce((n, [, l]) => n + (l.menu.id === id ? l.qty : 0), 0)
  const visibleMenu = menu.filter((item) =>
    activeCategory === 'all' || (item.category || 'savory') === activeCategory
  )

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const o = await api('/orders', {
        method: 'POST',
        body: { items: lines.map(([, l]) => ({ menu_id: l.menu.id, qty: l.qty, options: l.options })) },
      })
      setMsg({ text: `สั่งสำเร็จ! ออเดอร์ #${o.id} ยอดรวม ${baht(o.total)}` })
      setCart({})
      await loadOrders()
    } catch (err) {
      setMsg({ error: true, text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>

      <nav className="customer-navigation" aria-label="เมนูลูกค้า">
        <button
          type="button"
          className={activeTab === 'menu' ? 'customer-tab active' : 'customer-tab'}
          onClick={() => setActiveTab('menu')}
        >
          🍽️ สั่งอาหาร
        </button>

        <button
          type="button"
          className={activeTab === 'orders' ? 'customer-tab active' : 'customer-tab'}
          onClick={() => setActiveTab('orders')}
        >
          📋 ออเดอร์ของฉัน
        </button>
      </nav>
      {activeTab === 'menu' && (
      <>
      <div className="page-head">
        <h2 id="menu-h">เมนูวันนี้</h2>
        <p className="muted">ปรับความเผ็ด-หวานได้ตามใจ ก่อนกดเพิ่มลงตะกร้า</p>
      </div>

      <nav className="category-navigation" aria-label="หมวดหมู่เมนู">
        <button
          type="button"
          className={activeCategory === 'all' ? 'category-tab active' : 'category-tab'}
          onClick={() => setActiveCategory('all')}
        >
          🍽️ ทั้งหมด
        </button>
        {menuCategories.map(category => (
          <button
            key={category.value}
            type="button"
            className={activeCategory === category.value ? 'category-tab active' : 'category-tab'}
            onClick={() => setActiveCategory(category.value)}
          >
            {category.emoji} {category.label}
          </button>
        ))}
      </nav>

      <div className="shop">
        <section aria-labelledby="menu-h">
          <ul className="menu">
            {visibleMenu.map((m) => {
              const n = inCart(m.id)
              return (
                <li key={m.id} className="card">
                  <div className="media">
                    {m.image ? (
                      <img className="photo" src={m.image} alt="" loading="lazy" />
                    ) : (
                      <span className="photo emoji" aria-hidden="true">{m.emoji}</span>
                    )}
                    {n > 0 && <span className="in-cart">ในตะกร้า {n}</span>}
                  </div>
                  <div className="card-body">
                    <div className="card-head">
                      <strong className="dish">{m.name}</strong>
                      <span className="price">{baht(m.price)}</span>
                    </div>
                    {m.options.map((g) => (
                      <label key={g.name} className="option">
                        {g.name}
                        <select value={picks[m.id]?.[g.name] || ''} onChange={(e) => pick(m.id, g.name, e.target.value)}>
                          <option value="">ปกติ</option>
                          {g.choices.map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                    <button className="add" onClick={() => add(m)}>
                      <span aria-hidden="true">+ </span>เพิ่มลงตะกร้า
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
          {visibleMenu.length === 0 && (
            <div className="panel empty">
              <span aria-hidden="true">🍽️</span>
              <p>ยังไม่มีเมนูในหมวดหมู่นี้</p>
            </div>
          )}
        </section>

        <aside id="cart" aria-labelledby="cart-h">
          <form className="panel cart" onSubmit={submit}>
            <div className="cart-head">
              <h2 id="cart-h">ตะกร้าของฉัน</h2>
              {count > 0 && <span className="pill">{count} รายการ</span>}
            </div>
            {lines.length === 0 ? (
              <div className="empty">
                <span aria-hidden="true">🛒</span>
                <p>ยังไม่มีอาหารในตะกร้า</p>
                <p className="small">เลือกเมนูที่ชอบแล้วกด "เพิ่มลงตะกร้า"</p>
              </div>
            ) : (
              <div className="lines">
                {lines.map(([key, l]) => (
                  <div key={key} className="line">
                    <div>
                      <span className="line-name">{l.menu.name}</span>
                      {l.options.length > 0 && <small className="opts">{l.options.join(' · ')}</small>}
                    </div>
                    <span className="stepper">
                      <button type="button" aria-label={`ลด ${l.menu.name}`} onClick={() => change(key, -1)}>−</button>
                      <span>{l.qty}</span>
                      <button type="button" aria-label={`เพิ่ม ${l.menu.name}`} onClick={() => change(key, 1)}>+</button>
                    </span>
                    <span className="line-price">{baht(l.menu.price * l.qty)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="summary">
              <span>ยอดรวม</span>
              <strong>{baht(total)}</strong>
            </div>
            <button className="primary" disabled={busy || lines.length === 0}>
              {busy ? 'กำลังสั่ง...' : 'ยืนยันสั่งอาหาร'}
            </button>
            {msg && <p role="status" className={msg.error ? 'error' : 'ok'}>{msg.text}</p>}
          </form>
        </aside>
      </div>
        </>
)}

      {activeTab === 'orders' && (
      <section aria-labelledby="orders-h">
        <div className="page-head">
          <h2 id="orders-h">ออเดอร์ของฉัน</h2>
          <p className="muted small">สถานะอัปเดตอัตโนมัติ</p>
        </div>
        {orders.length === 0 && <p className="muted">ยังไม่มีออเดอร์</p>}
        <div className="orders-list">
          {orders.map((o) => (
            <article key={o.id} className="panel order">
              <div className="order-head">
                <strong className="order-id">ออเดอร์ #{o.id}</strong>
                <span className="muted small">{formatTime(o.created_at)}</span>
                <strong className="order-total">{baht(o.total)}</strong>
              </div>
              <p className="order-items">{o.items.map(itemText).join(', ')}</p>
              {o.status === 'cancelled' ? (
                <span className="status cancelled">ออเดอร์นี้ถูกยกเลิก</span>
              ) : (
                <Tracker status={o.status} />
              )}
            </article>
          ))}
        </div>
      </section>
      )}

      {activeTab === 'menu' && count > 0 && (
        <a href="#cart" className="cart-bar">
          <span>🛒 ดูตะกร้า · {count} รายการ</span>
          <strong>{baht(total)}</strong>
        </a>
      )}
    </>
  )
}
