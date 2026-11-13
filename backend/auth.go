package main

import (
	"errors"
	"net/http"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	sessionCookie = "session"
	sessionDays   = 7
)

type credentials struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

func (cr *credentials) validate() error {
	cr.Username = strings.TrimSpace(cr.Username)
	if n := utf8.RuneCountInString(cr.Username); n < 3 || n > 30 {
		return errors.New("ชื่อผู้ใช้ต้องยาว 3-30 ตัวอักษร")
	}
	if len(cr.Password) < 6 || len(cr.Password) > 72 { // bcrypt ignores bytes past 72
		return errors.New("รหัสผ่านต้องยาว 6-72 ตัวอักษร")
	}
	return nil
}

// register always creates a customer; staff accounts are only created in the DB.
func register(c *gin.Context, db *pgxpool.Pool) {
	var cr credentials
	if err := c.ShouldBindJSON(&cr); err != nil {
		fail(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}
	if err := cr.validate(); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}
	var id int
	err := db.QueryRow(c, `INSERT INTO users (username, password_hash, role)
		VALUES ($1, crypt($2, gen_salt('bf', 10)), 'customer')
		ON CONFLICT (username) DO NOTHING RETURNING id`, cr.Username, cr.Password).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		fail(c, http.StatusConflict, "ชื่อผู้ใช้นี้ถูกใช้แล้ว")
		return
	}
	if err != nil {
		serverError(c, err)
		return
	}
	startSession(c, db, id, cr.Username, "customer")
}

func login(c *gin.Context, db *pgxpool.Pool) {
	var cr credentials
	if err := c.ShouldBindJSON(&cr); err != nil {
		fail(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}
	cr.Username = strings.TrimSpace(cr.Username)
	var id int
	var role string
	err := db.QueryRow(c, `SELECT id, role FROM users WHERE username = $1 AND password_hash = crypt($2, password_hash)`,
		cr.Username, cr.Password).Scan(&id, &role)
	if errors.Is(err, pgx.ErrNoRows) {
		fail(c, http.StatusUnauthorized, "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง")
		return
	}
	if err != nil {
		serverError(c, err)
		return
	}
	startSession(c, db, id, cr.Username, role)
}

func startSession(c *gin.Context, db *pgxpool.Pool, id int, username, role string) {
	var token string
	if err := db.QueryRow(c, `INSERT INTO sessions (token, user_id)
		VALUES (encode(gen_random_bytes(32), 'hex'), $1) RETURNING token`, id).Scan(&token); err != nil {
		serverError(c, err)
		return
	}
	setCookie(c, token, sessionDays*24*60*60)
	c.JSON(http.StatusOK, gin.H{"username": username, "role": role})
}

func logout(c *gin.Context, db *pgxpool.Pool) {
	if token, err := c.Cookie(sessionCookie); err == nil {
		if _, err := db.Exec(c, `DELETE FROM sessions WHERE token = $1`, token); err != nil {
			serverError(c, err)
			return
		}
	}
	setCookie(c, "", -1)
	c.Status(http.StatusNoContent)
}

// shortcut: Secure=false so the cookie works on plain http://localhost, set true once served over HTTPS.
func setCookie(c *gin.Context, token string, maxAge int) {
	c.SetSameSite(http.SameSiteLaxMode) // cross-site POSTs don't carry the cookie (CSRF)
	c.SetCookie(sessionCookie, token, maxAge, "/", "", false, true)
}

// auth requires a valid session; when roles are given the user must have one of them.
func auth(db *pgxpool.Pool, roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, _ := c.Cookie(sessionCookie)
		var id int
		var username, role string
		err := db.QueryRow(c, `SELECT u.id, u.username, u.role FROM sessions s JOIN users u ON u.id = s.user_id
			WHERE s.token = $1 AND s.created_at > now() - make_interval(days => $2)`, token, sessionDays).
			Scan(&id, &username, &role)
		if errors.Is(err, pgx.ErrNoRows) {
			fail(c, http.StatusUnauthorized, "กรุณาเข้าสู่ระบบ")
			return
		}
		if err != nil {
			serverError(c, err)
			return
		}
		if len(roles) > 0 && !slices.Contains(roles, role) {
			fail(c, http.StatusForbidden, "ไม่มีสิทธิ์เข้าถึง")
			return
		}
		c.Set("uid", id)
		c.Set("username", username)
		c.Set("role", role)
	}
}
func setCookie(c *gin.Context, token string, maxAge int) {
	c.SetSameSite(http.SameSiteNoneMode) // ให้ส่ง cookie ข้ามโดเมน Vercel -> Render ได้
	c.SetCookie(sessionCookie, token, maxAge, "/", "", true, true) // Secure=true ต้องใช้คู่กับ SameSite=None
}