# ครัวอร่อย (FoodHub) — ระบบสั่งอาหารออนไลน์

Term Project วิชา Frontend/Backend — React + Fetch API + Go

## ลิงก์ระบบ
- เว็บไซต์: https://fe-be-project-food-hub.vercel.app
- API: https://fe-be-project-foodhub.onrender.com
- หมายเหตุ: Backend อยู่บน Render แบบฟรี เปิดครั้งแรกอาจรอ 30-60 วินาที

## บัญชีทดสอบ
| บทบาท | Username | Password |
|---|---|---|
| ลูกค้า | สมัครเองได้ที่หน้าเว็บ | - |
| พนักงาน | staff1 | staff1234 |
| ผู้ดูแลระบบ | admin1 | admin1234 |

## ฟีเจอร์
- **Guest**: ดูเมนู กรองหมวดหมู่ ใส่ตะกร้าได้โดยไม่ต้องล็อกอิน (ตอนสั่งซื้อจะให้ล็อกอินก่อน)
- **Member (ลูกค้า)**: สมัคร/เข้าสู่ระบบ/ออกจากระบบ, โปรไฟล์, เปลี่ยนรหัสผ่าน, สั่งอาหาร (ปรับความเผ็ด-หวานได้), ติดตามสถานะออเดอร์อัตโนมัติ
- **Staff (พนักงาน)**: ดูออเดอร์ที่ต้องทำ เปลี่ยนสถานะ (รับออเดอร์ → ทำเสร็จ → ส่งถึงลูกค้า) และยกเลิกออเดอร์
- **Admin (ผู้ดูแลระบบ)**: ภาพรวมร้าน (จำนวนออเดอร์ ยอดขาย สมาชิก) จัดการเมนู (เพิ่ม แก้ไข เปิด/ปิดการขาย ลบ)
- Backend ตรวจสิทธิ์ทุก endpoint ด้วย session cookie และ role
- มีสถานะ Loading / Empty / Error ในหน้าที่ดึงข้อมูล

## เทคโนโลยี
- Frontend: React (Vite) + Fetch API — deploy บน Vercel
- Backend: Go (Gin) — deploy บน Render
- Database: PostgreSQL บน Supabase

## โครงสร้างโปรเจค
- `src/` — โค้ด React (Login, Customer, Staff, Admin, Profile, api.js)
- `backend/` — Go API (main.go, auth.go)
- `db/` — สคริปต์ SQL สร้างตาราง

## เส้นทางข้อมูล
React (`fetch` ใน `src/api.js`) → Go/Gin API (`/api/...`) → SQL → PostgreSQL (Supabase) → ตอบกลับเป็น JSON → React แสดงผล

## API หลัก
| Method | Path | สิทธิ์ |
|---|---|---|
| GET | `/api/menu` | ทุกคน |
| POST | `/api/register`, `/api/login`, `/api/logout` | ทุกคน |
| GET | `/api/me` | ล็อกอินแล้ว |
| PATCH | `/api/me/password` | ล็อกอินแล้ว |
| GET/POST | `/api/my/orders`, `/api/orders` | ลูกค้า |
| GET/PATCH | `/api/staff/orders` | พนักงาน |
| GET/POST/PATCH/DELETE | `/api/admin/...` | ผู้ดูแลระบบ |

## การแบ่งงาน
- (ชื่อ) — นายเจษฎาพร อมรจิตรเวชกุล 650710861 
ทำหน้าที่ Backend และ Deploy: Go/Gin API, ระบบสมาชิกและ session/role (`auth.go`), API ออเดอร์/แอดมิน (`main.go`), ฐานข้อมูล PostgreSQL บน Supabase, deploy Render/Vercel, ตั้งค่า CORS และ cookie
- (ชื่อ) —  นายนทนันทน์ แสงเทียน 650710697 
ทำหน้าที่ Frontend: หน้า React (Login, Customer, Staff, Admin), UI/CSS, การเรียก API ด้วย Fetch (`api.js`), ระบบหมวดหมู่และตะกร้า


## วิธีรันในเครื่อง
```bash
# Backend
cd backend
export DATABASE_URL="postgresql://..."
go run .

# Frontend (เปิดอีก terminal ที่โฟลเดอร์หลัก)
npm install
npm run dev
```
