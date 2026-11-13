
import { useEffect, useState } from 'react'
import { api, baht, formatTime, itemText, menuCategories, menuCategoryForItem, statusLabel } from './api.js'
const emptyForm = {
  name: '',
  price: '',
  category: 'savory',
  emoji: '🍽️',
  image: '',
  options: [],
  is_available: true,
}

export default function Admin({ activePage, setActivePage }) {
      
      const [summary, setSummary] = useState({
    order_count: 0,
    total_sales: 0,
    member_count: 0,
  })
  const [summaryError, setSummaryError] = useState('')
    const loadSummary = () =>
    api('/admin/summary').then(
      (data) => {
        setSummary(data)
        setSummaryError('')
      },
      (error) => setSummaryError(error.message),
    )
      const [orders, setOrders] = useState([])
  const [orderError, setOrderError] = useState('')
  const [orderLoading, setOrderLoading] = useState(true)

  const nextStep = {
    pending: ['cooking', 'รับออเดอร์ เริ่มทำ'],
    cooking: ['ready', 'ทำเสร็จแล้ว'],
    ready: ['done', 'ส่งถึงลูกค้าแล้ว'],
  }

  const statIcon = {
    pending: '⏳',
    cooking: '🔥',
    ready: '✅',
  }

  const loadOrders = () =>
    api('/admin/orders').then(
      (data) => {
        setOrders(data)
        setOrderError('')
      },
      (error) => setOrderError(error.message),
    ).finally(() => setOrderLoading(false))

    useEffect(() => {
    loadOrders()
    loadSummary()

    const timer = setInterval(() => {
      loadOrders()
      loadSummary()
    }, 5000)

    return () => clearInterval(timer)
  }, [])

  const changeOrderStatus = async (id, status) => {
    try {
      await api(`/admin/orders/${id}`, {
        method: 'PATCH',
        body: { status },
      })
      await loadOrders()
    } catch (error) {
      setOrderError(error.message)
    }
  }

  const activeOrders = orders.filter((order) => nextStep[order.status])
  const orderHistory = orders.filter((order) => !nextStep[order.status])
  const [menu, setMenu] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)

  async function loadMenu() {
    setLoading(true)
    setError('')
    try {
      const data = await api('/admin/menu')
      setMenu(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMenu()
  }, [])

  function changeField(field, value) {
    setForm(current => ({ ...current, [field]: value }))
  }

  function resetForm() {
    setForm(emptyForm)
    setEditingId(null)
  }

  function startEdit(item) {
    setEditingId(item.id)
    setForm({
      name: item.name,
      price: String(item.price),
      category: menuCategoryForItem(item),
      emoji: item.emoji || '🍽️',
      image: item.image || '',
      options: (item.options || []).map(group => ({
        name: group.name,
        choices: [...(group.choices || [])],
      })),
      is_available: item.is_available,
    })
    setMessage('')
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function addOptionGroup() {
    setForm(current => ({
      ...current,
      options: [...current.options, { name: '', choices: [] }],
    }))
  }

  function updateOptionGroup(index, value) {
    setForm(current => ({
      ...current,
      options: current.options.map((group, i) =>
        i === index ? { ...group, name: value } : group
      ),
    }))
  }

  function addChoice(index) {
    setForm(current => ({
      ...current,
      options: current.options.map((group, i) =>
        i === index
          ? { ...group, choices: [...group.choices, ''] }
          : group
      ),
    }))
  }

  function updateChoice(groupIndex, choiceIndex, value) {
    setForm(current => ({
      ...current,
      options: current.options.map((group, i) =>
        i === groupIndex
          ? {
              ...group,
              choices: group.choices.map((choice, j) =>
                j === choiceIndex ? value : choice
              ),
            }
          : group
      ),
    }))
  }

  function removeChoice(groupIndex, choiceIndex) {
    setForm(current => ({
      ...current,
      options: current.options.map((group, i) =>
        i === groupIndex
          ? {
              ...group,
              choices: group.choices.filter((_, j) => j !== choiceIndex),
            }
          : group
      ),
    }))
  }

  function removeOptionGroup(index) {
    setForm(current => ({
      ...current,
      options: current.options.filter((_, i) => i !== index),
    }))
  }

  async function saveMenu(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    const name = form.name.trim()
    const emoji = form.emoji.trim()
    const price = Number(form.price)

    if (!name || !emoji) {
      setError('กรุณากรอกชื่อเมนูและอีโมจิ')
      return
    }

    if (form.price === '' || !Number.isInteger(price) || price < 0) {
      setError('กรุณากรอกราคาเป็นจำนวนเต็มตั้งแต่ 0 บาทขึ้นไป')
      return
    }

    const options = form.options
      .map(group => ({
        name: group.name.trim(),
        choices: group.choices.map(choice => choice.trim()).filter(Boolean),
      }))
      .filter(group => group.name && group.choices.length > 0)

    const body = {
      name,
      price,
      category: form.category,
      emoji,
      image: form.image.trim(),
      options,
    }

    setSaving(true)
    try {
      if (editingId) {
               await api(`/admin/menu/${editingId}`, {
          method: 'PATCH',
          body: {
            ...body,
            is_available: form.is_available,
          },
        })
        setMessage('บันทึกการแก้ไขเมนูเรียบร้อยแล้ว')
      } else {
        await api('/admin/menu', {
          method: 'POST',
          body,
        })
        setMessage('เพิ่มเมนูเรียบร้อยแล้ว')
      }

      resetForm()
      await loadMenu()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleAvailability(item) {
    setError('')
    setMessage('')

    try {
      await api(`/admin/menu/${item.id}`, {
        method: 'PATCH',
        body: {
          name: item.name,
          price: item.price,
          category: menuCategoryForItem(item),
          emoji: item.emoji,
          image: item.image || '',
          options: item.options || [],
          is_available: !item.is_available,
        },
      })

      setMessage(
        item.is_available
          ? `ปิดการขาย "${item.name}" แล้ว`
          : `เปิดการขาย "${item.name}" แล้ว`
      )
      await loadMenu()
    } catch (err) {
      setError(err.message)
    }
  }

  async function deleteMenu(item) {
    const confirmed = window.confirm(
      `ต้องการลบเมนู "${item.name}" ใช่หรือไม่?`
    )
    if (!confirmed) return

    setError('')
    setMessage('')

    try {
      await api(`/admin/menu/${item.id}`, { method: 'DELETE' })
      setMessage(`ลบเมนู "${item.name}" เรียบร้อยแล้ว`)
      await loadMenu()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="admin">
      <div className="page-head">
        <div>
          <h1>ระบบผู้ดูแลร้าน</h1>
          <p>จัดการเมนูอาหารและตรวจสอบข้อมูลร้าน</p>
        </div>
      </div>

            

            {/* Store Overview */}
             {activePage === 'overview' && (
      <section className="admin-overview">
        <div className="section-head">
          <h2>ภาพรวมร้าน</h2>
        </div>

        {summaryError && (
          <div className="admin-alert error" role="alert">
            {summaryError}
          </div>
        )}

        <ul className="stats">
          <li className="panel stat">
            <span className="stat-icon" aria-hidden="true">🧾</span>
            <span>
              <strong>{summary.order_count.toLocaleString('th-TH')}</strong>
              จำนวนออเดอร์ทั้งหมด
            </span>
          </li>

          <li className="panel stat">
            <span className="stat-icon" aria-hidden="true">💰</span>
            <span>
              <strong>{baht(summary.total_sales)}</strong>
              ยอดขายรวม
            </span>
          </li>

          <li className="panel stat">
            <span className="stat-icon" aria-hidden="true">👥</span>
            <span>
              <strong>{summary.member_count.toLocaleString('th-TH')}</strong>
              จำนวนสมาชิก
            </span>
          </li>
        </ul>
      </section> )}

      {error && <div className="admin-alert error">{error}</div>}
      {message && <div className="admin-alert success">{message}</div>}
      {activePage === 'menu' && (
        <>  
      <section className="panel admin-form-panel">
        <div className="section-head">
          <h2>{editingId ? 'แก้ไขเมนูอาหาร' : 'เพิ่มเมนูอาหาร'}</h2>
          {editingId && (
            <button type="button" className="admin-secondary" onClick={resetForm}>
              ยกเลิกการแก้ไข
            </button>
          )}
        </div>

        <form onSubmit={saveMenu}>
          <div className="admin-form-grid">
            <label>
              ชื่อเมนู
              <input
                value={form.name}
                onChange={e => changeField('name', e.target.value)}
                placeholder="เช่น ข้าวผัดกุ้ง"
                required
              />
            </label>

            <label>
              ราคา (บาท)
              <input
                type="number"
                min="0"
                step="1"
                value={form.price}
                onChange={e => changeField('price', e.target.value)}
                placeholder="60"
                required
              />
            </label>

            <label>
              หมวดหมู่
              <select
                value={form.category}
                onChange={e => changeField('category', e.target.value)}
              >
                {menuCategories.map(category => (
                  <option key={category.value} value={category.value}>
                    {category.emoji} {category.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              ที่อยู่รูปภาพ
              <input
                value={form.image}
                onChange={e => changeField('image', e.target.value)}
                placeholder="/menu/food.jpg"
              />
            </label>
          </div>

          <div className="admin-options">
            <div className="section-head">
              <h3>ตัวเลือกเพิ่มเติมของเมนู</h3>
              <button type="button" className="admin-secondary" onClick={addOptionGroup}>
                + เพิ่มกลุ่มตัวเลือก
              </button>
            </div>

            {form.options.map((group, index) => (
              <div className="admin-option-group" key={index}>
                <div className="admin-option-title">
                  <input
                    value={group.name}
                    onChange={e => updateOptionGroup(index, e.target.value)}
                    placeholder="ชื่อกลุ่ม เช่น ความเผ็ด"
                  />
                  <button
                    type="button"
                    className="admin-danger"
                    onClick={() => removeOptionGroup(index)}
                  >
                    ลบกลุ่ม
                  </button>
                </div>

                {group.choices.map((choice, choiceIndex) => (
                  <div className="admin-choice" key={choiceIndex}>
                    <input
                      value={choice}
                      onChange={e =>
                        updateChoice(index, choiceIndex, e.target.value)
                      }
                      placeholder="เช่น เผ็ดน้อย"
                    />
                    <button
                      type="button"
                      className="admin-danger"
                      onClick={() => removeChoice(index, choiceIndex)}
                    >
                      ลบ
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  className="admin-secondary"
                  onClick={() => addChoice(index)}
                >
                  + เพิ่มตัวเลือก
                </button>
              </div>
            ))}
          </div>

          {editingId && (
  <div className="admin-availability-card">
    <div className="admin-availability-info">
      <strong>สถานะการจำหน่าย</strong>
      <span>
        {form.is_available
          ? 'เมนูนี้เปิดให้ลูกค้าสั่งซื้อได้'
          : 'เมนูนี้ถูกปิดการขาย ลูกค้าจะไม่เห็นเมนู'}
      </span>
    </div>

    <label className="admin-switch">
      <input
        type="checkbox"
        checked={form.is_available}
        onChange={e => changeField('is_available', e.target.checked)}
      />
      <span className="admin-switch-track">
        <span className="admin-switch-thumb" />
      </span>
    </label>
  </div>
)}

          <button type="submit" className="admin-primary" disabled={saving}>
            {saving ? 'กำลังบันทึก...' : editingId ? 'บันทึกการแก้ไข' : 'เพิ่มเมนู'}
          </button>
        </form>
      </section>

      <section className="panel admin-menu-panel">
        <div className="section-head">
          <h2>รายการเมนูทั้งหมด</h2>
          <button type="button" className="admin-secondary" onClick={loadMenu}>
            รีเฟรช
          </button>
        </div>

        {loading ? (
          <p>กำลังโหลดเมนู...</p>
        ) : menu.length === 0 ? (
          <p>ยังไม่มีเมนูอาหาร</p>
        ) : (
          <div className="admin-menu-list">
           {[...menu]
  .sort((a, b) => Number(b.is_available) - Number(a.is_available))
  .map(item => (
              <div className="admin-menu-item" key={item.id}>
                <div className="admin-menu-info">
                  <span className="admin-menu-emoji">{item.emoji || '🍽️'}</span>
                  <div>
                    <strong>{item.name}</strong>
                    <p>{baht(item.price)}</p>
                    <span className="admin-category">
                      {menuCategories.find(category => category.value === menuCategoryForItem(item))?.label || 'ของคาว'}
                    </span>
                    <span className={item.is_available ? 'admin-status available' : 'admin-status unavailable'}>
                      {item.is_available ? 'กำลังขาย' : 'ปิดการขาย'}
                    </span>
                  </div>
                </div>

                <div className="admin-menu-actions">
                  <button
                    type="button"
                    className="admin-secondary"
                    onClick={() => startEdit(item)}
                  >
                    แก้ไข
                  </button>
                  
                  <button
                    type="button"
                    className="admin-danger"
                    onClick={() => deleteMenu(item)}
                  >
                    ลบ
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section> 
       </>
      )}

      {/* Order management */}
      {activePage === 'overview' && (
      <section className="admin-orders">
        <div className="page-head">
          <div>
            <h2>จัดการออเดอร์</h2>
            <p className="muted small">อัปเดตอัตโนมัติทุก 5 วินาที</p>
          </div>
          <button
            type="button"
            className="admin-secondary"
            onClick={loadOrders}
          >
            รีเฟรชออเดอร์
          </button>
        </div>

        {orderError && (
          <div className="admin-alert error" role="alert">
            {orderError}
          </div>
        )}

        <ul className="stats">
          {Object.keys(nextStep).map((status) => (
            <li key={status} className={`panel stat ${status}`}>
              <span className="stat-icon" aria-hidden="true">
                {statIcon[status]}
              </span>
              <span>
                <strong>
                  {orders.filter((order) => order.status === status).length}
                </strong>
                {statusLabel[status]}
              </span>
            </li>
          ))}
        </ul>

        <section aria-labelledby="admin-active-orders">
          <div className="section-head">
            <h2 id="admin-active-orders">ออเดอร์ที่กำลังดำเนินการ</h2>
            <span className="pill">{activeOrders.length}</span>
          </div>

          {orderLoading ? (
            <p className="muted">กำลังโหลดออเดอร์...</p>
          ) : activeOrders.length === 0 ? (
            <div className="panel empty">
              <span aria-hidden="true">🎉</span>
              <p>ไม่มีออเดอร์ที่ต้องดำเนินการ</p>
            </div>
          ) : (
            <div className="tickets">
              {activeOrders.map((order) => (
                <article
                  key={order.id}
                  className={`panel ticket ${order.status}`}
                >
                  <div className="ticket-head">
                    <strong>#{order.id}</strong>
                    <span className={`status ${order.status}`}>
                      {statusLabel[order.status]}
                    </span>
                  </div>

                  <p className="muted small">
                    {order.username} · {formatTime(order.created_at)}
                  </p>

                  <ul>
                    {order.items.map((item, index) => (
                      <li key={index}>
                        <span className="qty-tag">{item.qty}×</span>
                        <span>{itemText(item)}</span>
                      </li>
                    ))}
                  </ul>

                  <p className="ticket-total">{baht(order.total)}</p>

                  <div className="actions">
                    <button
                      type="button"
                      className="primary"
                      onClick={() =>
                        changeOrderStatus(
                          order.id,
                          nextStep[order.status][0],
                        )
                      }
                    >
                      {nextStep[order.status][1]}
                    </button>

                    {order.status !== 'ready' && (
                      <button
                        type="button"
                        className="ghost"
                        onClick={() =>
                          changeOrderStatus(order.id, 'cancelled')
                        }
                      >
                        ยกเลิก
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="admin-order-history">
          <div className="section-head">
            <h2 id="admin-order-history">ประวัติออเดอร์</h2>
          </div>

          {orderLoading ? (
            <p className="muted">กำลังโหลดประวัติ...</p>
          ) : orderHistory.length === 0 ? (
            <p className="muted">ยังไม่มีประวัติออเดอร์</p>
          ) : (
            <div className="history">
              {orderHistory.map((order) => (
                <article key={order.id} className="panel order row">
                  <div>
                    <strong>#{order.id} {order.username}</strong>
                    <span className="muted small">
                      {' '}· {formatTime(order.created_at)}
                    </span>
                  </div>

                  <div>
                    {order.items.map(itemText).join(', ')}
                  </div>

                  <span className={`status ${order.status}`}>
                    {statusLabel[order.status]}
                  </span>

                  <strong>{baht(order.total)}</strong>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
      )}

    </div>
  )
  
}
