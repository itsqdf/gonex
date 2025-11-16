package main

import (
    "crypto/hmac"
    "crypto/sha256"
    "database/sql"
    "encoding/base64"
    "encoding/json"
    "io"
    "errors"
    "log"
    "net/http"
    "net/url"
    "os"
    "strconv"
    "strings"
    "time"
    _ "github.com/lib/pq"
)

type User struct {
    ID        int       `json:"id"`
    Username  string    `json:"username"`
    Password  string    `json:"password,omitempty"`
    Role      string    `json:"role"`
    CreatedAt time.Time `json:"created_at"`
    JabatanID sql.NullInt64 `json:"jabatan_id"`
    Active    bool      `json:"active"`
}

type Role struct {
    ID   int    `json:"id"`
    Name string `json:"name"`
}

type Permission struct {
    ID          int    `json:"id"`
    Code        string `json:"code"`
    Name        string `json:"name"`
    Description string `json:"description"`
}

type RoleAssignment struct {
    ID     int    `json:"id"`
    UserID int    `json:"user_id"`
    RoleID int    `json:"role_id"`
    Role   string `json:"role"`
}

// util: convert nullable string to interface{}
func nullableToString(ns sql.NullString) interface{} { if ns.Valid { return ns.String } ; return nil }
func nullableString(s string) interface{} { if strings.TrimSpace(s) == "" { return nil } ; return s }

var db *sql.DB
var dbReady bool

func envOr(key, def string) string {
    v := os.Getenv(key)
    if v == "" { return def }
    return v
}

func initDB() error {
    dsn := normalizeDSN(envOr("DATABASE_URL", "postgres://root:armagedon25@auth-user-db:5432/auth_db"))
    var err error
    db, err = sql.Open("postgres", dsn)
    if err != nil {
        log.Println("db open error:", err)
        return nil
    }
    return nil
}

func waitForDB() {
    for {
        if db == nil { time.Sleep(500 * time.Millisecond); continue }
        if err := db.Ping(); err != nil {
            log.Println("db ping error:", err)
            time.Sleep(1 * time.Second)
            continue
        }
        _, err := db.Exec(`
            CREATE TABLE IF NOT EXISTS roles (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL
            );
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
            -- Tambah kolom wajib sesuai frontend
            ALTER TABLE users ADD COLUMN IF NOT EXISTS nama TEXT NOT NULL DEFAULT '';
            ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS jabatan_id INTEGER;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
            -- Backfill data lama agar konsisten
            UPDATE users SET email = username WHERE email IS NULL OR email='';
            UPDATE users SET nama = CASE WHEN position('@' in email)>0 THEN split_part(email,'@',1) ELSE email END WHERE nama = '';
            CREATE TABLE IF NOT EXISTS user_roles (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
                UNIQUE(user_id, role_id)
            );
            CREATE TABLE IF NOT EXISTS permissions (
                id SERIAL PRIMARY KEY,
                code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                description TEXT
            );
            CREATE TABLE IF NOT EXISTS role_permissions (
                role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
                permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
                PRIMARY KEY (role_id, permission_id)
            );
            -- Biometrik pengguna
            CREATE TABLE IF NOT EXISTS user_biometrics (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                face_vector JSONB NULL,
                fingerprint_hash TEXT NULL,
                qr_code TEXT NULL,
                face_image_url TEXT NULL,
                active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
            -- Pastikan ada constraint unik pada user_id agar ON CONFLICT (user_id) bekerja
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_indexes WHERE indexname = 'uniq_user_biometrics_user_id'
              ) THEN
                CREATE UNIQUE INDEX uniq_user_biometrics_user_id ON user_biometrics(user_id);
              END IF;
            END
            $$;
            INSERT INTO roles(name) VALUES ('admin') ON CONFLICT DO NOTHING;
            INSERT INTO roles(name) VALUES ('user') ON CONFLICT DO NOTHING;
            INSERT INTO roles(name) VALUES ('Pengguna') ON CONFLICT DO NOTHING;
            INSERT INTO roles(name) VALUES ('superadmin') ON CONFLICT DO NOTHING;
            INSERT INTO users(username, password, role) VALUES ('admin', 'admin123', 'admin') ON CONFLICT DO NOTHING;
            INSERT INTO users(username, password, role) VALUES ('superadmin@gmail.com', 'admin123', 'superadmin') ON CONFLICT DO NOTHING;

            -- Master data: schools untuk lokasi sekolah
            CREATE TABLE IF NOT EXISTS schools (
                id INTEGER PRIMARY KEY,
                name TEXT,
                latitude DOUBLE PRECISION,
                longitude DOUBLE PRECISION,
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
        `)
        if err != nil {
            log.Println("db schema error:", err)
            time.Sleep(1 * time.Second)
            continue
        }
        seedPermissions()
        dbReady = true
        log.Println("db ready")
        return
    }
}

func seedPermissions() {
    // Tambahkan menu sesuai kebutuhan Sidebar dan operation generic
    menuCodes := []string{"menu_master_data","menu_hak_akses","menu_kas","menu_produk","menu_setting","menu_asset_perusahaan","menu_ruangan","menu_payment","menu_chat","menu_ml","menu_presensi","menu_user_biometrics","menu_client","menu_akademik"}
    op := []string{"view","create","edit","detail","reset","print","delete","manage"}
    prefixes := []string{"produk_","kas_masuk_","kas_keluar_","kas_flow_","rekening_","category_asset_","category_product_","assets_","maintenance_","warehouses_","racks_","rack_positions_","mutasi_"}
    for _, c := range menuCodes {
        _, _ = db.Exec("INSERT INTO permissions(code,name,description) VALUES($1,$2,$3) ON CONFLICT(code) DO NOTHING", c, c, "Menu permission")
    }
    for _, o := range op {
        _, _ = db.Exec("INSERT INTO permissions(code,name,description) VALUES($1,$2,$3) ON CONFLICT(code) DO NOTHING", o, strings.Title(o), "Generic operation")
    }
    for _, p := range prefixes {
        for _, o := range op {
            code := p + o
            name := strings.Title(strings.ReplaceAll(p, "_", " ")) + " " + strings.Title(o)
            _, _ = db.Exec("INSERT INTO permissions(code,name,description) VALUES($1,$2,$3) ON CONFLICT(code) DO NOTHING", code, name, "Scoped operation")
        }
    }
    // Akademik dot-based permissions for teacher-service
    akademikEntities := []string{"jenjang","kelas","time","tahun","mapel","guru","jadwal"}
    for _, ent := range akademikEntities {
        for _, o := range []string{"read","create","update","delete","build"} {
            code := "akademik." + ent + "." + o
            name := "Akademik " + strings.Title(ent) + " " + strings.Title(o)
            _, _ = db.Exec("INSERT INTO permissions(code,name,description) VALUES($1,$2,$3) ON CONFLICT(code) DO NOTHING", code, name, "Teacher-service scoped operation")
        }
    }
    // Beri semua permission ke superadmin
    var superID int
    _ = db.QueryRow("SELECT id FROM roles WHERE name='superadmin'").Scan(&superID)
    if superID != 0 {
        rows, err := db.Query("SELECT id FROM permissions")
        if err == nil {
            defer rows.Close()
            for rows.Next() {
                var pid int
                if err := rows.Scan(&pid); err == nil {
                    _, _ = db.Exec("INSERT INTO role_permissions(role_id, permission_id) VALUES($1,$2) ON CONFLICT DO NOTHING", superID, pid)
                }
            }
        }
    }
    // Seed baseline permission untuk admin agar UI konsisten
    var adminID int
    _ = db.QueryRow("SELECT id FROM roles WHERE name='admin'").Scan(&adminID)
    if adminID != 0 {
        baseCodes := []string{"manage","menu_master_data","menu_hak_akses","menu_kas","menu_produk","menu_setting","menu_asset_perusahaan","menu_ruangan","menu_payment","menu_chat","menu_ml","menu_presensi","menu_user_biometrics","menu_client","menu_akademik"}
        for _, code := range baseCodes {
            var pid int
            if err := db.QueryRow("SELECT id FROM permissions WHERE code=$1", code).Scan(&pid); err == nil && pid != 0 {
                _, _ = db.Exec("INSERT INTO role_permissions(role_id, permission_id) VALUES($1,$2) ON CONFLICT DO NOTHING", adminID, pid)
            }
        }
    }

    // Sinkronisasi legacy kolom users.role ke tabel user_roles agar perhitungan permissions dinamis berjalan.
    // Setiap user yang memiliki nilai pada kolom legacy 'role' akan diberikan entri pada user_roles sesuai role tersebut.
    // Ini memastikan superadmin@gmail.com memiliki akses penuh tanpa perlu assign manual.
    roleIDs := map[string]int{}
    if rows, err := db.Query("SELECT id, name FROM roles"); err == nil {
        defer rows.Close()
        for rows.Next() {
            var id int; var name string
            if err := rows.Scan(&id, &name); err == nil {
                roleIDs[name] = id
            }
        }
    }
    for name, rid := range roleIDs {
        if rid == 0 { continue }
        if urows, err := db.Query("SELECT id FROM users WHERE role=$1", name); err == nil {
            func(){
                defer urows.Close()
                for urows.Next() {
                    var uid int
                    if err := urows.Scan(&uid); err == nil {
                        _, _ = db.Exec("INSERT INTO user_roles(user_id, role_id) VALUES($1,$2) ON CONFLICT DO NOTHING", uid, rid)
                    }
                }
            }()
        }
    }
}

func listPermissions(w http.ResponseWriter, _ *http.Request) {
    if !dbReady { writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error":"db_unavailable"}); return }
    rows, err := db.Query("SELECT id, code, name, COALESCE(description,'') FROM permissions ORDER BY code")
    if err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    defer rows.Close()
    var out []Permission
    for rows.Next() {
        var p Permission
        if err := rows.Scan(&p.ID, &p.Code, &p.Name, &p.Description); err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
        out = append(out, p)
    }
    writeJSON(w, 200, map[string]interface{}{"data": out})
}

func permissionsByRole(w http.ResponseWriter, r *http.Request) {
    if !dbReady { writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error":"db_unavailable"}); return }
    roleID, err := parseIDFromPath(r.URL.Path, "/permissions/by-role/")
    if err != nil { writeJSON(w, 400, map[string]string{"error":"invalid role id"}); return }
    rows, err := db.Query(`
        SELECT p.id, p.code, p.name, COALESCE(p.description,'')
        FROM role_permissions rp JOIN permissions p ON rp.permission_id = p.id
        WHERE rp.role_id = $1 ORDER BY p.code
    `, roleID)
    if err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    defer rows.Close()
    var out []Permission
    for rows.Next() {
        var p Permission
        if err := rows.Scan(&p.ID, &p.Code, &p.Name, &p.Description); err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
        out = append(out, p)
    }
    writeJSON(w, 200, map[string]interface{}{"data": out})
}

func assignPermissions(w http.ResponseWriter, r *http.Request) {
    if !dbReady { writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error":"db_unavailable"}); return }
    roleID, err := parseIDFromPath(r.URL.Path, "/permissions/assign/")
    if err != nil { writeJSON(w, 400, map[string]string{"error":"invalid role id"}); return }
    var in struct { PermIDs []int `json:"perm_ids"` }
    if err := json.NewDecoder(r.Body).Decode(&in); err != nil { writeJSON(w, 400, map[string]string{"error":"invalid json"}); return }
    tx, err := db.Begin()
    if err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    _, err = tx.Exec("DELETE FROM role_permissions WHERE role_id=$1", roleID)
    if err != nil { _ = tx.Rollback(); writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    for _, pid := range in.PermIDs {
        _, err = tx.Exec("INSERT INTO role_permissions(role_id, permission_id) VALUES($1,$2) ON CONFLICT DO NOTHING", roleID, pid)
        if err != nil { _ = tx.Rollback(); writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    }
    if err := tx.Commit(); err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    writeJSON(w, 200, map[string]string{"status":"assigned"})
}

func writeJSON(w http.ResponseWriter, code int, v interface{}) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(code)
    _ = json.NewEncoder(w).Encode(v)
}

func healthHandler(w http.ResponseWriter, _ *http.Request) {
    if err := db.Ping(); err != nil {
        writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status":"db_error","error":err.Error()})
        return
    }
    writeJSON(w, http.StatusOK, map[string]string{"status":"ok","service":"auth-user-service-go"})
}

func listUsers(w http.ResponseWriter, r *http.Request) {
    if !dbReady { writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error":"db_unavailable"}); return }
    q := r.URL.Query().Get("q")
    pageStr := r.URL.Query().Get("page")
    limitStr := r.URL.Query().Get("limit")
    page, _ := strconv.Atoi(pageStr)
    limit, _ := strconv.Atoi(limitStr)
    if page <= 0 { page = 1 }
    if limit <= 0 { limit = 10 }
    offset := (page - 1) * limit

    // count total
    var total int
    if q != "" {
        if err := db.QueryRow("SELECT COUNT(1) FROM users WHERE (nama ILIKE '%' || $1 || '%') OR (email ILIKE '%' || $1 || '%')", q).Scan(&total); err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    } else {
        if err := db.QueryRow("SELECT COUNT(1) FROM users").Scan(&total); err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    }

    var rows *sql.Rows
    var err error
    if q != "" {
        rows, err = db.Query("SELECT id, nama, email, created_at, jabatan_id, active FROM users WHERE (nama ILIKE '%' || $1 || '%') OR (email ILIKE '%' || $1 || '%') ORDER BY id LIMIT $2 OFFSET $3", q, limit, offset)
    } else {
        rows, err = db.Query("SELECT id, nama, email, created_at, jabatan_id, active FROM users ORDER BY id LIMIT $1 OFFSET $2", limit, offset)
    }
    if err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    defer rows.Close()
    // Fetch jabatan map from setting-service
    jabMap, _ := fetchJabatanMap()
    var out []map[string]interface{}
    for rows.Next() {
        var id int
        var nama, email string
        var created time.Time
        var jabID sql.NullInt64
        var active bool
        if err := rows.Scan(&id, &nama, &email, &created, &jabID, &active); err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
        if strings.TrimSpace(nama) == "" {
            nama = email
            if i := strings.Index(email, "@"); i > 0 { nama = email[:i] }
        }
        var jabatanName string
        if jabID.Valid {
            if v, ok := jabMap[int(jabID.Int64)]; ok { jabatanName = v } else { jabatanName = "" }
        } else {
            jabatanName = ""
        }
        out = append(out, map[string]interface{}{
            "id": id,
            "nama": nama,
            "email": email,
            "status": func() string { if active { return "Aktif" } ; return "Tidak Aktif" }(),
            "jabatan": jabatanName,
        })
    }
    pages := (total + limit - 1) / limit
    writeJSON(w, 200, map[string]interface{}{"data": out, "meta": map[string]int{"total": total, "pages": pages, "page": page, "limit": limit}})
}

func createUser(w http.ResponseWriter, r *http.Request) {
    if !dbReady { writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error":"db_unavailable"}); return }
    type UserInput struct {
        Username  string `json:"username"`
        Nama      string `json:"nama"`
        Email     string `json:"email"`
        Password  string `json:"password"`
        Role      string `json:"role"`
        JabatanID *int   `json:"jabatan_id"`
        Active    *bool  `json:"active"`
    }
    var in UserInput
    if err := json.NewDecoder(r.Body).Decode(&in); err != nil { writeJSON(w, 400, map[string]string{"error":"invalid json"}); return }
    // Gunakan email sebagai username
    nama := strings.TrimSpace(in.Nama)
    email := strings.ToLower(strings.TrimSpace(in.Email))
    username := email
    if username == "" { username = strings.TrimSpace(in.Username) }
    password := strings.TrimSpace(in.Password)
    role := strings.TrimSpace(in.Role)
    if nama == "" || email == "" || password == "" { writeJSON(w, 400, map[string]string{"error":"nama, email, dan password wajib"}); return }
    // Cek unik email
    var existingID int
    if err := db.QueryRow("SELECT id FROM users WHERE email=$1", email).Scan(&existingID); err == nil {
        writeJSON(w, 400, map[string]string{"error":"Email sudah digunakan"}); return
    }
    active := true
    if in.Active != nil { active = *in.Active }
    // Simpan users dengan nama dan email; username diselaraskan ke email
    var u User
    err := db.QueryRow("INSERT INTO users(nama, email, username, password, role, jabatan_id, active) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id, created_at", nama, email, username, password, role, in.JabatanID, active).Scan(&u.ID, &u.CreatedAt)
    if err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    u.Username = username
    u.Role = role
    u.Password = ""
    u.Active = active
    // Jika aktif, auto-assign role standar "Pengguna"
    if active {
        var rid int
        if err := db.QueryRow("SELECT id FROM roles WHERE name=$1", "Pengguna").Scan(&rid); err == nil && rid != 0 {
            _, _ = db.Exec("INSERT INTO user_roles(user_id, role_id) VALUES($1,$2) ON CONFLICT DO NOTHING", u.ID, rid)
        }
    }
    writeJSON(w, 201, u)
}

func updateUser(w http.ResponseWriter, r *http.Request) {
    if !dbReady { writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error":"db_unavailable"}); return }
    idStr, err := parseIDFromPath(r.URL.Path, "/users/")
    if err != nil { writeJSON(w, 400, map[string]string{"error":"invalid id"}); return }
    type UserInput struct {
        Username  string `json:"username"`
        Nama      string `json:"nama"`
        Email     string `json:"email"`
        Password  string `json:"password"`
        Role      string `json:"role"`
        JabatanID *int   `json:"jabatan_id"`
        Active    *bool  `json:"active"`
    }
    var in UserInput
    err = json.NewDecoder(r.Body).Decode(&in); if err != nil { writeJSON(w, 400, map[string]string{"error":"invalid json"}); return }
    nama := strings.TrimSpace(in.Nama)
    email := strings.ToLower(strings.TrimSpace(in.Email))
    username := email
    if username == "" { username = strings.TrimSpace(in.Username) }
    // Jika mengubah email/username, pastikan unik
    if email != "" {
        var existingID int
        if err := db.QueryRow("SELECT id FROM users WHERE email=$1 AND id<>$2", email, idStr).Scan(&existingID); err == nil {
            writeJSON(w, 400, map[string]string{"error":"Email sudah digunakan"}); return
        }
    }
    // allow updating nama, email, password, role, username (diselaraskan ke email), jabatan_id, active
    _, err = db.Exec("UPDATE users SET nama = COALESCE(NULLIF($1,''), nama), email = COALESCE(NULLIF($2,''), email), username = COALESCE(NULLIF($3,''), username), password = COALESCE(NULLIF($4,''), password), role = COALESCE(NULLIF($5,''), role), jabatan_id = COALESCE($6, jabatan_id), active = COALESCE($7, active) WHERE id=$8", nama, email, username, in.Password, in.Role, in.JabatanID, in.Active, idStr)
    if err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    // Jika diaktifkan, pastikan role Pengguna ditambahkan
    if in.Active != nil && *in.Active {
        var rid int
        if err := db.QueryRow("SELECT id FROM roles WHERE name=$1", "Pengguna").Scan(&rid); err == nil && rid != 0 {
            _, _ = db.Exec("INSERT INTO user_roles(user_id, role_id) VALUES($1,$2) ON CONFLICT DO NOTHING", idStr, rid)
        }
    }
    writeJSON(w, 200, map[string]string{"status":"updated"})
}

func deleteUser(w http.ResponseWriter, r *http.Request) {
    if !dbReady { writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error":"db_unavailable"}); return }
    idStr, err := parseIDFromPath(r.URL.Path, "/users/")
    if err != nil { writeJSON(w, 400, map[string]string{"error":"invalid id"}); return }
    _, err = db.Exec("DELETE FROM users WHERE id=$1", idStr)
    if err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    writeJSON(w, 200, map[string]string{"status":"deleted"})
}

func getUser(w http.ResponseWriter, r *http.Request) {
    if !dbReady { writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error":"db_unavailable"}); return }
    id, err := parseIDFromPath(r.URL.Path, "/users/")
    if err != nil { writeJSON(w, 400, map[string]string{"error":"invalid id"}); return }
    var u User
    var nama, email string
    err = db.QueryRow("SELECT id, nama, email, role, created_at, jabatan_id, active FROM users WHERE id=$1", id).Scan(&u.ID, &nama, &email, &u.Role, &u.CreatedAt, &u.JabatanID, &u.Active)
    if err != nil { writeJSON(w, 404, map[string]string{"error":"user_not_found"}); return }
    if strings.TrimSpace(nama) == "" {
        nama = email
        if i := strings.Index(email, "@"); i > 0 { nama = email[:i] }
    }
    // map jabatan name
    jabatanName := ""
    if u.JabatanID.Valid {
        if jabMap, err := fetchJabatanMap(); err == nil {
            if v, ok := jabMap[int(u.JabatanID.Int64)]; ok { jabatanName = v }
        }
    }
    writeJSON(w, 200, map[string]interface{}{"user": map[string]interface{}{"id": u.ID, "nama": nama, "email": email, "status": func() string { if u.Active { return "Aktif" } ; return "Tidak Aktif" }(), "jabatan": jabatanName, "role": u.Role}})
}

func resetPassword(w http.ResponseWriter, r *http.Request) {
    if !dbReady { writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error":"db_unavailable"}); return }
    id, err := parseIDFromPath(r.URL.Path, "/users/")
    if err != nil { writeJSON(w, 400, map[string]string{"error":"invalid id"}); return }
    const def = "12345678"
    _, err = db.Exec("UPDATE users SET password=$1 WHERE id=$2", def, id)
    if err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    writeJSON(w, 200, map[string]string{"status":"ok", "default": def})
}

func listRoles(w http.ResponseWriter, _ *http.Request) {
    if !dbReady { writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error":"db_unavailable"}); return }
    rows, err := db.Query("SELECT id, name FROM roles ORDER BY id")
    if err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    defer rows.Close()
    var out []Role
    for rows.Next() { var r Role; if scanErr := rows.Scan(&r.ID, &r.Name); scanErr != nil { writeJSON(w, 500, map[string]string{"error":scanErr.Error()}); return }; out = append(out, r) }
    writeJSON(w, 200, map[string]interface{}{"data": out})
}

func createRole(w http.ResponseWriter, r *http.Request) {
    if !dbReady { writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error":"db_unavailable"}); return }
    var rl Role
    if err := json.NewDecoder(r.Body).Decode(&rl); err != nil { writeJSON(w, 400, map[string]string{"error":"invalid json"}); return }
    if rl.Name == "" { writeJSON(w, 400, map[string]string{"error":"name required"}); return }
    err := db.QueryRow("INSERT INTO roles(name) VALUES($1) RETURNING id", rl.Name).Scan(&rl.ID)
    if err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    writeJSON(w, 201, rl)
}

func updateRole(w http.ResponseWriter, r *http.Request) {
    if !dbReady { writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error":"db_unavailable"}); return }
    idStr, err := parseIDFromPath(r.URL.Path, "/roles/")
    if err != nil { writeJSON(w, 400, map[string]string{"error":"invalid id"}); return }
    var rl Role
    err = json.NewDecoder(r.Body).Decode(&rl); if err != nil { writeJSON(w, 400, map[string]string{"error":"invalid json"}); return }
    _, err = db.Exec("UPDATE roles SET name = COALESCE(NULLIF($1,''), name) WHERE id=$2", rl.Name, idStr)
    if err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    writeJSON(w, 200, map[string]string{"status":"updated"})
}

func deleteRole(w http.ResponseWriter, r *http.Request) {
    if !dbReady { writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error":"db_unavailable"}); return }
    idStr, err := parseIDFromPath(r.URL.Path, "/roles/")
    if err != nil { writeJSON(w, 400, map[string]string{"error":"invalid id"}); return }
    var roleName string
    err = db.QueryRow("SELECT name FROM roles WHERE id=$1", idStr).Scan(&roleName); if err != nil {
        writeJSON(w, 404, map[string]string{"error":"role_not_found"}); return
    }
    var cnt int
    err = db.QueryRow("SELECT COUNT(1) FROM users WHERE role=$1", roleName).Scan(&cnt); if err != nil {
        writeJSON(w, 500, map[string]string{"error":err.Error()}); return
    }
    if cnt > 0 { writeJSON(w, 409, map[string]string{"error":"role_in_use"}); return }
    _, err = db.Exec("DELETE FROM roles WHERE id=$1", idStr)
    if err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    writeJSON(w, 200, map[string]string{"status":"deleted"})
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
    if !dbReady { writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error":"db_unavailable"}); return }
    var in struct {
        Username string `json:"username"`
        Email    string `json:"email"`
        Password string `json:"password"`
    }
    if err := json.NewDecoder(r.Body).Decode(&in); err != nil { writeJSON(w, 400, map[string]string{"error":"invalid json"}); return }
    loginKey := strings.TrimSpace(in.Username)
    if loginKey == "" { loginKey = strings.TrimSpace(in.Email) }
    loginKey = strings.ToLower(loginKey)
    var u User
    err := db.QueryRow("SELECT id, username, password, role, created_at FROM users WHERE username=$1", loginKey).Scan(&u.ID, &u.Username, &u.Password, &u.Role, &u.CreatedAt)
    if err != nil { writeJSON(w, 401, map[string]string{"error":"invalid_credentials"}); return }
    if in.Password != u.Password { writeJSON(w, 401, map[string]string{"error":"invalid_credentials"}); return }
    secret := envOr("JWT_SECRET", "dev-secret")
    payload := map[string]interface{}{
        "sub": u.ID,
        "username": u.Username,
        "role": u.Role,
        "exp": time.Now().Add(24 * time.Hour).Unix(),
        "iat": time.Now().Unix(),
    }
    ss, err := generateJWT(secret, payload)
    if err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    email := u.Username
    nama := email
    if i := strings.Index(email, "@"); i > 0 { nama = email[:i] }
    writeJSON(w, 200, map[string]interface{}{"token": ss, "user": map[string]interface{}{"id": u.ID, "username": u.Username, "role": u.Role, "email": email, "nama": nama}})
}

func getBearerToken(r *http.Request) string {
    ah := r.Header.Get("Authorization")
    if strings.HasPrefix(strings.ToLower(ah), "bearer ") { return strings.TrimSpace(ah[7:]) }
    return ""
}

func verifyJWT(secret, token string) (map[string]interface{}, error) {
    parts := strings.Split(token, ".")
    if len(parts) != 3 { return nil, errors.New("bad token") }
    signingInput := parts[0] + "." + parts[1]
    mac := hmac.New(sha256.New, []byte(secret))
    if _, err := mac.Write([]byte(signingInput)); err != nil { return nil, err }
    expected := b64url(mac.Sum(nil))
    if parts[2] != expected { return nil, errors.New("invalid signature") }
    // decode payload
    pBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
    if err != nil { return nil, err }
    var payload map[string]interface{}
    if err := json.Unmarshal(pBytes, &payload); err != nil { return nil, err }
    // exp check (optional)
    if expVal, ok := payload["exp"].(float64); ok {
        if time.Now().Unix() > int64(expVal) { return nil, errors.New("token expired") }
    }
    return payload, nil
}

func authMeHandler(w http.ResponseWriter, r *http.Request) {
    if !dbReady { writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error":"db_unavailable"}); return }
    tok := getBearerToken(r)
    if tok == "" { writeJSON(w, 401, map[string]string{"error":"unauthorized"}); return }
    payload, err := verifyJWT(envOr("JWT_SECRET", "dev-secret"), tok)
    if err != nil { writeJSON(w, 401, map[string]string{"error":"unauthorized"}); return }
    username, _ := payload["username"].(string)
    role, _ := payload["role"].(string)
    var id int
    if err := db.QueryRow("SELECT id FROM users WHERE username=$1", username).Scan(&id); err != nil { writeJSON(w, 404, map[string]string{"error":"user_not_found"}); return }
    email := username
    nama := email
    if i := strings.Index(email, "@"); i > 0 { nama = email[:i] }
    // Collect assigned roles
    roles := []string{role}
    rows, err := db.Query("SELECT r.name FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1", id)
    if err == nil {
        defer rows.Close()
        for rows.Next() {
            var rn string
            if scanErr := rows.Scan(&rn); scanErr == nil {
                // avoid duplicates
                dup := false
                for _, ex := range roles { if ex == rn { dup = true; break } }
                if !dup { roles = append(roles, rn) }
            }
        }
    }
    writeJSON(w, 200, map[string]interface{}{"id": id, "nama": nama, "email": email, "role": role, "roles": roles, "status":"aktif"})
}

func authPermissionsHandler(w http.ResponseWriter, r *http.Request) {
    tok := getBearerToken(r)
    if tok == "" { writeJSON(w, 401, map[string]string{"error":"unauthorized"}); return }
    payload, err := verifyJWT(envOr("JWT_SECRET", "dev-secret"), tok)
    if err != nil { writeJSON(w, 401, map[string]string{"error":"unauthorized"}); return }
    sub, _ := payload["sub"].(float64)
    userID := int(sub)
    if userID == 0 { writeJSON(w, 401, map[string]string{"error":"unauthorized"}); return }
    // Ambil permissions dari role_permissions untuk seluruh role user
    rows, err := db.Query(`
        SELECT DISTINCT p.code
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = $1
    `, userID)
    if err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    defer rows.Close()
    var perms []string
    for rows.Next() {
        var code string
        if err := rows.Scan(&code); err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
        perms = append(perms, code)
    }
    // Fallback minimal jika belum ada permission
    if len(perms) == 0 { perms = []string{"menu_master_data"} }
    writeJSON(w, 200, map[string]interface{}{"permissions": perms})
}

func listRolesUser(w http.ResponseWriter, r *http.Request) {
    if !dbReady { writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error":"db_unavailable"}); return }
    q := r.URL.Query()
    userIDStr := strings.TrimSpace(q.Get("user_id"))
    query := strings.TrimSpace(q.Get("q"))
    page, _ := strconv.Atoi(q.Get("page")); if page < 1 { page = 1 }
    limit, _ := strconv.Atoi(q.Get("limit")); if limit < 1 { limit = 10 }
    offset := (page - 1) * limit

    // Build filters
    filters := []string{"1=1"}
    args := []interface{}{}
    if userIDStr != "" {
        filters = append(filters, "ur.user_id = $1")
        uid, _ := strconv.Atoi(userIDStr)
        args = append(args, uid)
    }
    // For text query, match username or role name
    if query != "" {
        ph := "$" + strconv.Itoa(len(args)+1)
        // Use proper parameter concatenation for LIKE: '%' || $n || '%'
        filters = append(filters, "(u.username ILIKE '%' || "+ph+" || '%' OR r.name ILIKE '%' || "+ph+" || '%')")
        args = append(args, query)
    }

    where := "WHERE " + strings.Join(filters, " AND ")
    // Total count
    countSQL := "SELECT COUNT(*) FROM user_roles ur JOIN users u ON u.id=ur.user_id JOIN roles r ON r.id=ur.role_id " + where
    var total int
    if err := db.QueryRow(countSQL, args...).Scan(&total); err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }

    // List with pagination
    listSQL := "SELECT ur.id, ur.user_id, ur.role_id, r.name FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN users u ON u.id=ur.user_id " + where + " ORDER BY ur.id LIMIT $"+strconv.Itoa(len(args)+1)+" OFFSET $"+strconv.Itoa(len(args)+2)
    rows, err := db.Query(listSQL, append(args, limit, offset)...)
    if err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    defer rows.Close()
    var out []RoleAssignment
    for rows.Next() {
        var it RoleAssignment
        if err := rows.Scan(&it.ID, &it.UserID, &it.RoleID, &it.Role); err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
        out = append(out, it)
    }
    writeJSON(w, 200, map[string]interface{}{"data": out, "meta": map[string]int{"page": page, "limit": limit, "total": total, "pages": func() int { if limit <= 0 { return 1 } ; if total == 0 { return 1 } ; p := total / limit ; if total%limit != 0 { p++ } ; if p < 1 { p = 1 } ; return p }() }})
}

// list biometrics
func listUserBiometrics(w http.ResponseWriter, r *http.Request) {
    if !dbReady { writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error":"db_unavailable"}); return }
    q := r.URL.Query()
    userIDStr := strings.TrimSpace(q.Get("user_id"))
    var rows *sql.Rows
    var err error
    if userIDStr != "" {
        uid, _ := strconv.Atoi(userIDStr)
        rows, err = db.Query(`SELECT id, user_id, face_vector, fingerprint_hash, qr_code, face_image_url, active, created_at FROM user_biometrics WHERE user_id=$1 ORDER BY id DESC`, uid)
    } else {
        rows, err = db.Query(`SELECT id, user_id, face_vector, fingerprint_hash, qr_code, face_image_url, active, created_at FROM user_biometrics ORDER BY id DESC`)
    }
    if err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    defer rows.Close()
    var list []map[string]interface{}
    for rows.Next() {
        var id, userID int
        var faceVec sql.NullString
        var fpHash, qrCode, faceImage sql.NullString
        var active bool
        var createdAt time.Time
        if err := rows.Scan(&id, &userID, &faceVec, &fpHash, &qrCode, &faceImage, &active, &createdAt); err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
        item := map[string]interface{}{
            "id": id,
            "user_id": userID,
            "fingerprint_hash": nullableToString(fpHash),
            "qr_code": nullableToString(qrCode),
            "face_image_url": nullableToString(faceImage),
            "active": active,
            "created_at": createdAt.Format(time.RFC3339),
        }
        if faceVec.Valid { item["face_vector"] = json.RawMessage(faceVec.String) }
        list = append(list, item)
    }
    writeJSON(w, 200, list)
}

// create or update biometrics
func createOrUpdateUserBiometrics(w http.ResponseWriter, r *http.Request) {
    if !dbReady { writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error":"db_unavailable"}); return }
    var in struct {
        UserID int             `json:"user_id"`
        FaceVector json.RawMessage `json:"face_vector"`
        FingerprintHash string  `json:"fingerprint_hash"`
        QRCode string           `json:"qr_code"`
        FaceImageURL string     `json:"face_image_url"`
        Active *bool            `json:"active"`
    }
    if err := json.NewDecoder(r.Body).Decode(&in); err != nil { writeJSON(w, 400, map[string]string{"error":"invalid json"}); return }
    if in.UserID == 0 { writeJSON(w, 400, map[string]string{"error":"user_id required"}); return }
    active := true
    if in.Active != nil { active = *in.Active }
    var faceVecStr *string
    if len(in.FaceVector) > 0 { s := string(in.FaceVector); faceVecStr = &s }
    var id int
    err := db.QueryRow(`
        INSERT INTO user_biometrics(user_id, face_vector, fingerprint_hash, qr_code, face_image_url, active)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (user_id) DO UPDATE SET
            face_vector = EXCLUDED.face_vector,
            fingerprint_hash = EXCLUDED.fingerprint_hash,
            -- Jangan timpa QR jika sudah ada: pakai nilai lama bila tidak NULL
            qr_code = COALESCE(user_biometrics.qr_code, EXCLUDED.qr_code),
            face_image_url = EXCLUDED.face_image_url,
            active = EXCLUDED.active
        RETURNING id
    `, in.UserID, faceVecStr, nullableString(in.FingerprintHash), nullableString(in.QRCode), nullableString(in.FaceImageURL), active).Scan(&id)
    if err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    writeJSON(w, 201, map[string]interface{}{"id": id, "status":"ok"})
}

func patchUserBiometrics(w http.ResponseWriter, r *http.Request) {
    if !dbReady { writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error":"db_unavailable"}); return }
    id, err := parseIDFromPath(r.URL.Path, "/user-biometrics/")
    if err != nil { writeJSON(w, 400, map[string]string{"error":"invalid id"}); return }
    var in struct { Active *bool `json:"active"` }
    if err := json.NewDecoder(r.Body).Decode(&in); err != nil { writeJSON(w, 400, map[string]string{"error":"invalid json"}); return }
    if in.Active == nil { writeJSON(w, 400, map[string]string{"error":"active required"}); return }
    var uid int
    if err := db.QueryRow(`UPDATE user_biometrics SET active=$1 WHERE id=$2 RETURNING user_id`, *in.Active, id).Scan(&uid); err != nil { writeJSON(w, 404, map[string]string{"error":"not found"}); return }
    writeJSON(w, 200, map[string]interface{}{"status":"updated","user_id":uid,"active":*in.Active})
}

func createRoleAssignment(w http.ResponseWriter, r *http.Request) {
    if !dbReady { writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error":"db_unavailable"}); return }
    var in struct { UserID int `json:"user_id"`; RoleID int `json:"role_id"` }
    if err := json.NewDecoder(r.Body).Decode(&in); err != nil { writeJSON(w, 400, map[string]string{"error":"invalid json"}); return }
    if in.UserID <= 0 || in.RoleID <= 0 { writeJSON(w, 400, map[string]string{"error":"user_id and role_id required"}); return }
    // Validate existence
    var exists int
    if err := db.QueryRow("SELECT COUNT(*) FROM users WHERE id=$1", in.UserID).Scan(&exists); err != nil || exists == 0 { writeJSON(w, 404, map[string]string{"error":"user_not_found"}); return }
    if err := db.QueryRow("SELECT COUNT(*) FROM roles WHERE id=$1", in.RoleID).Scan(&exists); err != nil || exists == 0 { writeJSON(w, 404, map[string]string{"error":"role_not_found"}); return }
    // Insert
    var id int
    err := db.QueryRow("INSERT INTO user_roles(user_id, role_id) VALUES($1,$2) ON CONFLICT(user_id, role_id) DO NOTHING RETURNING id", in.UserID, in.RoleID).Scan(&id)
    if err != nil {
        // If conflict (already exists), fetch the existing id
        row := db.QueryRow("SELECT id FROM user_roles WHERE user_id=$1 AND role_id=$2", in.UserID, in.RoleID)
        _ = row.Scan(&id)
    }
    // Fetch role name
    var roleName string
    _ = db.QueryRow("SELECT name FROM roles WHERE id=$1", in.RoleID).Scan(&roleName)
    writeJSON(w, 200, map[string]interface{}{"id": id, "user_id": in.UserID, "role_id": in.RoleID, "role": roleName})
}

func deleteRoleAssignment(w http.ResponseWriter, r *http.Request) {
    if !dbReady { writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error":"db_unavailable"}); return }
    id, err := parseIDFromPath(r.URL.Path, "/roles-user/")
    if err != nil { writeJSON(w, 400, map[string]string{"error":"invalid id"}); return }
    res, err := db.Exec("DELETE FROM user_roles WHERE id=$1", id)
    if err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    n, _ := res.RowsAffected()
    if n == 0 { writeJSON(w, 404, map[string]string{"error":"assignment_not_found"}); return }
    writeJSON(w, 200, map[string]string{"status":"deleted"})
}

func hasPermissions(w http.ResponseWriter, r *http.Request) {
    if !dbReady { writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error":"db_unavailable"}); return }
    q := r.URL.Query()
    username := q.Get("username")
    if username == "" { writeJSON(w, 400, map[string]string{"error":"username required"}); return }
    var userID int
    err := db.QueryRow("SELECT id FROM users WHERE username=$1", username).Scan(&userID)
    if err != nil { writeJSON(w, 404, map[string]string{"error":"user_not_found"}); return }
    // Periksa apakah user memiliki permission yang mengizinkan akses halaman hak akses
    // Kriteria: memiliki salah satu dari manage atau menu_hak_akses
    rows, err := db.Query(`
        SELECT p.code FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id=$1 AND p.code IN ('manage','menu_hak_akses')
    `, userID)
    if err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    defer rows.Close()
    allowed := rows.Next()
    writeJSON(w, 200, map[string]bool{"allowed": allowed})
}

// fetchJabatanMap retrieves {id:name} mapping from setting-service
func fetchJabatanMap() (map[int]string, error) {
    m := map[int]string{}
    client := &http.Client{ Timeout: 3 * time.Second }
    req, err := http.NewRequest(http.MethodGet, envOr("SETTING_SERVICE_URL", "http://setting-service:3000")+"/jabatan", nil)
    if err != nil { return m, err }
    resp, err := client.Do(req)
    if err != nil { return m, err }
    defer resp.Body.Close()
    var data interface{}
    if err := json.NewDecoder(resp.Body).Decode(&data); err != nil { return m, err }
    // data could be an array of {id,name}
    if arr, ok := data.([]interface{}); ok {
        for _, item := range arr {
            if obj, ok := item.(map[string]interface{}); ok {
                idf, idok := obj["id"].(float64)
                name, nok := obj["name"].(string)
                if idok && nok { m[int(idf)] = name }
            }
        }
    } else if obj, ok := data.(map[string]interface{}); ok {
        // or {data: [...]} shape
        if arr, ok := obj["data"].([]interface{}); ok {
            for _, item := range arr {
                if mobj, ok := item.(map[string]interface{}); ok {
                    idf, idok := mobj["id"].(float64)
                    name, nok := mobj["name"].(string)
                    if idok && nok { m[int(idf)] = name }
                }
            }
        }
    }
    return m, nil
}

func b64url(data []byte) string {
    return base64.RawURLEncoding.EncodeToString(data)
}

func generateJWT(secret string, payload map[string]interface{}) (string, error) {
    header := map[string]string{"alg":"HS256","typ":"JWT"}
    hJSON, err := json.Marshal(header)
    if err != nil { return "", err }
    pJSON, err := json.Marshal(payload)
    if err != nil { return "", err }
    head := b64url(hJSON)
    pay := b64url(pJSON)
    signingInput := head + "." + pay
    mac := hmac.New(sha256.New, []byte(secret))
    if _, err := mac.Write([]byte(signingInput)); err != nil { return "", err }
    sig := b64url(mac.Sum(nil))
    return signingInput + "." + sig, nil
}

func parseIDFromPath(path, prefix string) (int, error) {
    if !strings.HasPrefix(path, prefix) { return 0, errors.New("bad path") }
    s := strings.TrimPrefix(path, prefix)
    s = strings.Trim(s, "/")
    id, err := strconv.Atoi(s)
    if err != nil { return 0, err }
    return id, nil
}

func main() {
    _ = initDB()
    go waitForDB()
    mux := http.NewServeMux()

    mux.HandleFunc("/health", healthHandler)

    mux.HandleFunc("/users", func(w http.ResponseWriter, r *http.Request) {
        switch r.Method {
        case http.MethodGet:
            listUsers(w, r)
        case http.MethodPost:
            createUser(w, r)
        default:
            w.WriteHeader(http.StatusMethodNotAllowed)
        }
    })

    // handled below with extra route for reset-password

    mux.HandleFunc("/roles", func(w http.ResponseWriter, r *http.Request) {
        switch r.Method {
        case http.MethodGet:
            listRoles(w, r)
        case http.MethodPost:
            createRole(w, r)
        default:
            w.WriteHeader(http.StatusMethodNotAllowed)
        }
    })

    mux.HandleFunc("/roles/", func(w http.ResponseWriter, r *http.Request) {
        switch r.Method {
        case http.MethodPut:
            updateRole(w, r)
        case http.MethodDelete:
            deleteRole(w, r)
        default:
            w.WriteHeader(http.StatusMethodNotAllowed)
        }
    })

    mux.HandleFunc("/auth/login", loginHandler)
    mux.HandleFunc("/auth/me", authMeHandler)
    mux.HandleFunc("/auth/permissions", authPermissionsHandler)
    // Route detail users dan aksi khusus (reset-password)
    // Contoh: POST /users/123/reset-password
    //         GET  /users/123
    //         PUT  /users/123
    //         DELETE /users/123
    mux.HandleFunc("/users/", func(w http.ResponseWriter, r *http.Request) {
        // Tangani endpoint khusus reset-password
        if r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/reset-password") {
            // Ekstrak ID sebelum suffix
            // /users/{id}/reset-password -> ambil {id}
            s := strings.TrimPrefix(r.URL.Path, "/users/")
            parts := strings.Split(strings.Trim(s, "/"), "/")
            if len(parts) >= 2 {
                // bentuk valid: {id}, "reset-password"
                _, err := strconv.Atoi(parts[0])
                if err != nil { writeJSON(w, 400, map[string]string{"error":"invalid id"}); return }
                // delegasikan ke handler yang membaca ID dari path
                resetPassword(w, r)
                return
            }
            writeJSON(w, 404, map[string]string{"error":"not_found"})
            return
        }
        // Toggle/update active status: PUT /users/{id}/active
        if r.Method == http.MethodPut && strings.HasSuffix(r.URL.Path, "/active") {
            s := strings.TrimPrefix(r.URL.Path, "/users/")
            parts := strings.Split(strings.Trim(s, "/"), "/")
            if len(parts) >= 2 {
                id, err := strconv.Atoi(parts[0])
                if err != nil { writeJSON(w, 400, map[string]string{"error":"invalid id"}); return }
                // Try to accept various input forms: query param, JSON body, or toggle when no body
                qActive := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("active")))
                var targetActive *bool
                if qActive == "true" { b := true; targetActive = &b }
                if qActive == "false" { b := false; targetActive = &b }
                if targetActive == nil {
                    // Read raw body to handle empty, JSON, plain text, or form-like input
                    bodyBytes, _ := io.ReadAll(r.Body)
                    raw := strings.TrimSpace(string(bodyBytes))
                    if len(raw) == 0 {
                        // No body: toggle current value
                        var cur bool
                        if err := db.QueryRow("SELECT active FROM users WHERE id=$1", id).Scan(&cur); err != nil { writeJSON(w, 404, map[string]string{"error":"user_not_found"}); return }
                        b := !cur
                        targetActive = &b
                    } else {
                        // Try JSON first
                        type In struct { Active *bool `json:"active"` }
                        var in In
                        if err := json.Unmarshal(bodyBytes, &in); err == nil {
                            targetActive = in.Active
                        } else {
                            // Try plain boolean text
                            low := strings.ToLower(raw)
                            if low == "true" { b := true; targetActive = &b }
                            if low == "false" { b := false; targetActive = &b }
                            if targetActive == nil {
                                // Try form-like: active=true/false
                                vals, _ := url.ParseQuery(raw)
                                av := strings.ToLower(strings.TrimSpace(vals.Get("active")))
                                if av == "true" { b := true; targetActive = &b }
                                if av == "false" { b := false; targetActive = &b }
                            }
                        }
                    }
                }
                if targetActive == nil { writeJSON(w, 400, map[string]string{"error":"active required"}); return }
                if _, err := db.Exec("UPDATE users SET active=$1 WHERE id=$2", *targetActive, id); err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
                // Jika mengaktifkan user, pastikan role Pengguna ditambahkan
                if *targetActive {
                    var rid int
                    if err := db.QueryRow("SELECT id FROM roles WHERE name=$1", "Pengguna").Scan(&rid); err == nil && rid != 0 {
                        _, _ = db.Exec("INSERT INTO user_roles(user_id, role_id) VALUES($1,$2) ON CONFLICT DO NOTHING", id, rid)
                    }
                }
                writeJSON(w, 200, map[string]interface{}{"status":"updated","active":*targetActive})
                return
            }
            writeJSON(w, 404, map[string]string{"error":"not_found"})
            return
        }
        // CRUD pada /users/{id}
        switch r.Method {
        case http.MethodPut:
            updateUser(w, r)
        case http.MethodDelete:
            deleteUser(w, r)
        case http.MethodGet:
            getUser(w, r)
        default:
            w.WriteHeader(http.StatusMethodNotAllowed)
        }
    })
    // Roles-User CRUD: list and create
    mux.HandleFunc("/roles-user", func(w http.ResponseWriter, r *http.Request) {
        switch r.Method {
        case http.MethodGet:
            listRolesUser(w, r)
        case http.MethodPost:
            createRoleAssignment(w, r)
        default:
            w.WriteHeader(http.StatusMethodNotAllowed)
        }
    })
    // Roles-User delete by id
    mux.HandleFunc("/roles-user/", func(w http.ResponseWriter, r *http.Request) {
        switch r.Method {
        case http.MethodDelete:
            deleteRoleAssignment(w, r)
        default:
            w.WriteHeader(http.StatusMethodNotAllowed)
        }
    })
    mux.HandleFunc("/has-permissions", hasPermissions)

    // permissions endpoints untuk halaman Has Permissions
    mux.HandleFunc("/permissions", func(w http.ResponseWriter, r *http.Request) {
        if r.Method == http.MethodGet { listPermissions(w, r); return }
        w.WriteHeader(http.StatusMethodNotAllowed)
    })
    mux.HandleFunc("/permissions/by-role/", func(w http.ResponseWriter, r *http.Request) {
        if r.Method == http.MethodGet { permissionsByRole(w, r); return }
        w.WriteHeader(http.StatusMethodNotAllowed)
    })
    mux.HandleFunc("/permissions/assign/", func(w http.ResponseWriter, r *http.Request) {
        if r.Method == http.MethodPut { assignPermissions(w, r); return }
        w.WriteHeader(http.StatusMethodNotAllowed)
    })

    // User biometrics endpoints
    mux.HandleFunc("/user-biometrics", func(w http.ResponseWriter, r *http.Request) {
        switch r.Method {
        case http.MethodGet:
            listUserBiometrics(w, r)
        case http.MethodPost:
            createOrUpdateUserBiometrics(w, r)
        default:
            w.WriteHeader(http.StatusMethodNotAllowed)
        }
    })
    mux.HandleFunc("/user-biometrics/", func(w http.ResponseWriter, r *http.Request) {
        switch r.Method {
        case http.MethodPatch:
            patchUserBiometrics(w, r)
        default:
            w.WriteHeader(http.StatusMethodNotAllowed)
        }
    })

    // Master Data: update lokasi sekolah
    mux.HandleFunc("/api/v1/master/school/", func(w http.ResponseWriter, r *http.Request) {
        // Hanya izinkan POST/PUT dan suffix /update-location
        if !(r.Method == http.MethodPost || r.Method == http.MethodPut) { w.WriteHeader(http.StatusMethodNotAllowed); return }
        if !strings.HasSuffix(r.URL.Path, "/update-location") { w.WriteHeader(http.StatusNotFound); return }
        updateSchoolLocation(w, r)
    })

    log.Println("auth-user-service-go listening on :3000")
    if err := http.ListenAndServe(":3000", mux); err != nil { log.Fatal(err) }
}

// Update lokasi sekolah: /api/v1/master/school/{id}/update-location
// Payload: { "school_id": number (opsional), "latitude": number, "longitude": number }
func updateSchoolLocation(w http.ResponseWriter, r *http.Request) {
    if !dbReady { writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error":"db_unavailable"}); return }
    // Ekstrak id dari path
    s := strings.TrimPrefix(r.URL.Path, "/api/v1/master/school/")
    parts := strings.Split(strings.Trim(s, "/"), "/")
    if len(parts) < 2 || parts[1] != "update-location" { writeJSON(w, 404, map[string]string{"error":"not_found"}); return }
    id, err := strconv.Atoi(parts[0])
    if err != nil || id <= 0 { writeJSON(w, 400, map[string]string{"error":"invalid school id"}); return }

    var payload struct {
        SchoolID  *int     `json:"school_id"`
        Latitude  *float64 `json:"latitude"`
        Longitude *float64 `json:"longitude"`
    }
    if err := json.NewDecoder(r.Body).Decode(&payload); err != nil { writeJSON(w, 400, map[string]string{"error":"invalid json"}); return }
    // Gunakan path id jika payload.school_id kosong
    if payload.SchoolID == nil { payload.SchoolID = &id }
    if payload.Latitude == nil || payload.Longitude == nil { writeJSON(w, 400, map[string]string{"error":"latitude/longitude required"}); return }

    // Upsert lokasi
    _, err = db.Exec(
        "INSERT INTO schools(id, latitude, longitude) VALUES($1,$2,$3) "+
            "ON CONFLICT (id) DO UPDATE SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, updated_at = NOW()",
        *payload.SchoolID, *payload.Latitude, *payload.Longitude,
    )
    if err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    writeJSON(w, 200, map[string]interface{}{"status":"updated","school_id":*payload.SchoolID,"latitude":*payload.Latitude,"longitude":*payload.Longitude})
}

func normalizeDSN(dsn string) string {
    if strings.Contains(dsn, "sslmode=") { return dsn }
    // append sslmode=disable preserving existing query
    u, err := url.Parse(dsn)
    if err != nil { return dsn + "?sslmode=disable" }
    q := u.Query()
    q.Set("sslmode", "disable")
    u.RawQuery = q.Encode()
    return u.String()
}