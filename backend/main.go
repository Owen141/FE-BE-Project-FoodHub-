package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"slices"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type orderReq struct {
	Items []struct {
		MenuID  int      `json:"menu_id"`
		Qty     int      `json:"qty"`
		Options []string `json:"options"`
	} `json:"items"`
}

func (r *orderReq) validate() error {
	if len(r.Items) == 0 {
		return errors.New("ตะกร้ายังว่างอยู่")
	}
	if len(r.Items) > 50 {
		return errors.New("สั่งได้ไม่เกิน 50 รายการต่อออเดอร์")
	}
	for _, it := range r.Items {
		if it.Qty < 1 || it.Qty > 99 {
			return errors.New("จำนวนต้องอยู่ระหว่าง 1-99")
		}
	}
	return nil
}

type optionGroup struct {
	Name    string   `json:"name"`
	Choices []string `json:"choices"`
}

// pickOptions checks the chosen choices belong to this dish, at most one per group,
// and returns them in the dish's group order.
func pickOptions(groups []optionGroup, chosen []string) ([]string, error) {
	out := []string{} // never nil: pgx would send NULL into a NOT NULL column
	for _, g := range groups {
		pick := ""
		for _, c := range chosen {
			if slices.Contains(g.Choices, c) {
				if pick != "" {
					return nil, errors.New("เลือก" + g.Name + "ได้แค่อย่างเดียว")
				}
				pick = c
			}
		}
		if pick != "" {
			out = append(out, pick)
		}
	}
	if len(out) != len(chosen) {
		return nil, errors.New("ตัวเลือกไม่ถูกต้องสำหรับเมนูนี้")
	}
	return out, nil
}

var statuses = map[string]bool{"pending": true, "cooking": true, "ready": true, "done": true, "cancelled": true}

// ordersSQL builds the order list as JSON; $1 = user id to filter by, NULL = everyone.
// Unfinished orders sort first so they never fall off the limit.
const ordersSQL = `
SELECT coalesce(json_agg(o ORDER BY o.id DESC), '[]')::text FROM (
  SELECT o.id, u.username, o.total, o.status, o.created_at,
    (SELECT json_agg(json_build_object('name', m.name, 'qty', oi.qty, 'price', oi.price, 'options', oi.options) ORDER BY oi.id)
       FROM order_items oi JOIN menu_items m ON m.id = oi.menu_id
      WHERE oi.order_id = o.id) AS items
  FROM orders o JOIN users u ON u.id = o.user_id
  WHERE $1::int IS NULL OR o.user_id = $1
  ORDER BY o.status IN ('done', 'cancelled'), o.id DESC LIMIT 100
) o`

func main() {
	db, err := pgxpool.New(context.Background(), os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	r := gin.Default()
	r.Use(corsMiddleware())
	api := r.Group("/api")
	api.GET("/menu", func(c *gin.Context) {
		jsonQuery(c, db, `SELECT coalesce(json_agg(m ORDER BY m.id), '[]')::text FROM menu_items m`)
	})
	api.POST("/register", func(c *gin.Context) { register(c, db) })
	api.POST("/login", func(c *gin.Context) { login(c, db) })
	api.POST("/logout", func(c *gin.Context) { logout(c, db) })
	api.GET("/me", auth(db), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"username": c.GetString("username"), "role": c.GetString("role")})
	api.PATCH("/me/password", auth(db), func(c *gin.Context) { changePassword(c, db) })
	})

	customer := api.Group("", auth(db, "customer"))
	customer.GET("/my/orders", func(c *gin.Context) { jsonQuery(c, db, ordersSQL, c.GetInt("uid")) })
	customer.POST("/orders", func(c *gin.Context) { createOrder(c, db) })

	staff := api.Group("/staff", auth(db, "staff"))
	staff.GET("/orders", func(c *gin.Context) { jsonQuery(c, db, ordersSQL, nil) })
	staff.PATCH("/orders/:id", func(c *gin.Context) { setStatus(c, db) })

	log.Fatal(r.Run(":8080"))
}

// jsonQuery returns a query whose single text column Postgres already built as JSON.
func jsonQuery(c *gin.Context, db *pgxpool.Pool, sql string, args ...any) {
	var out string
	if err := db.QueryRow(c, sql, args...).Scan(&out); err != nil {
		serverError(c, err)
		return
	}
	c.Data(http.StatusOK, "application/json; charset=utf-8", []byte(out))
}

func createOrder(c *gin.Context, db *pgxpool.Pool) {
	var req orderReq
	if err := c.ShouldBindJSON(&req); err != nil {
		fail(c, http.StatusBadRequest, "ข้อมูลไม่ถูกต้อง")
		return
	}
	if err := req.validate(); err != nil {
		fail(c, http.StatusBadRequest, err.Error())
		return
	}

	tx, err := db.Begin(c)
	if err != nil {
		serverError(c, err)
		return
	}
	defer tx.Rollback(context.Background()) // no-op after commit

	var id, total int
	if err := tx.QueryRow(c, `INSERT INTO orders (user_id) VALUES ($1) RETURNING id`, c.GetInt("uid")).Scan(&id); err != nil {
		serverError(c, err)
		return
	}
	for _, it := range req.Items {
		// price and allowed options come from the DB, never from the client
		var price int
		var groups []optionGroup
		err := tx.QueryRow(c, `SELECT price, options FROM menu_items WHERE id = $1`, it.MenuID).Scan(&price, &groups)
		if errors.Is(err, pgx.ErrNoRows) {
			fail(c, http.StatusBadRequest, "ไม่พบเมนูที่เลือก")
			return
		}
		if err != nil {
			serverError(c, err)
			return
		}
		opts, err := pickOptions(groups, it.Options)
		if err != nil {
			fail(c, http.StatusBadRequest, err.Error())
			return
		}
		if _, err := tx.Exec(c, `INSERT INTO order_items (order_id, menu_id, qty, price, options)
			VALUES ($1, $2, $3, $4, $5)`, id, it.MenuID, it.Qty, price, opts); err != nil {
			serverError(c, err)
			return
		}
	}
	if err := tx.QueryRow(c, `UPDATE orders SET total = (SELECT sum(qty * price) FROM order_items WHERE order_id = $1)
		WHERE id = $1 RETURNING total`, id).Scan(&total); err != nil {
		serverError(c, err)
		return
	}
	if err := tx.Commit(c); err != nil {
		serverError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id, "total": total})
}

func setStatus(c *gin.Context, db *pgxpool.Pool) {
	var body struct {
		Status string `json:"status"`
	}
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || c.ShouldBindJSON(&body) != nil || !statuses[body.Status] {
		fail(c, http.StatusBadRequest, "สถานะไม่ถูกต้อง")
		return
	}
	tag, err := db.Exec(c, `UPDATE orders SET status = $1 WHERE id = $2`, body.Status, id)
	if err != nil {
		serverError(c, err)
		return
	}
	if tag.RowsAffected() == 0 {
		fail(c, http.StatusNotFound, "ไม่พบออเดอร์")
		return
	}
	c.Status(http.StatusNoContent)
}

func fail(c *gin.Context, code int, msg string) {
	c.AbortWithStatusJSON(code, gin.H{"error": msg})
}

func serverError(c *gin.Context, err error) {
	log.Println(err)
	fail(c, http.StatusInternalServerError, "เกิดข้อผิดพลาดในระบบ")
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		allowed := origin == "http://localhost:5173" ||
			origin == "http://127.0.0.1:5173" ||
			origin == "https://fe-be-project-food-hub.vercel.app" ||
			(strings.HasPrefix(origin, "https://fe-be-project-food-hub-") &&
				strings.HasSuffix(origin, "-owen141s-projects.vercel.app"))

		if allowed {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
			c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			c.Header("Vary", "Origin")
		}
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}