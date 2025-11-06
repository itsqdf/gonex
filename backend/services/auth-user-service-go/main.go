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
            ALTER TABLE users ADD COLUMN IF NOT EXISTS jabatan_id INTEGER;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
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
            INSERT INTO roles(name) VALUES ('admin') ON CONFLICT DO NOTHING;
            INSERT INTO roles(name) VALUES ('user') ON CONFLICT DO NOTHING;
            INSERT INTO roles(name) VALUES ('superadmin') ON CONFLICT DO NOTHING;
            INSERT INTO users(username, password, role) VALUES ('admin', 'admin123', 'admin') ON CONFLICT DO NOTHING;
            INSERT INTO users(username, password, role) VALUES ('superadmin@gmail.com', 'admin123', 'superadmin') ON CONFLICT DO NOTHING;
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
    menuCodes := []string{"menu_master_data","menu_hak_akses","menu_kas","menu_produk","menu_setting","menu_asset_perusahaan","menu_ruangan"}
    op := []string{"view","create","edit","detail","reset","print","delete"}
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
}

func listPermissions(w http.ResponseWriter, r *http.Request) {
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
        if err := db.QueryRow("SELECT COUNT(1) FROM users WHERE username ILIKE '%' || $1 || '%'", q).Scan(&total); err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    } else {
        if err := db.QueryRow("SELECT COUNT(1) FROM users").Scan(&total); err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    }

    var rows *sql.Rows
    var err error
    if q != "" {
        rows, err = db.Query("SELECT id, username, role, created_at, jabatan_id, active FROM users WHERE username ILIKE '%' || $1 || '%' ORDER BY id LIMIT $2 OFFSET $3", q, limit, offset)
    } else {
        rows, err = db.Query("SELECT id, username, role, created_at, jabatan_id, active FROM users ORDER BY id LIMIT $1 OFFSET $2", limit, offset)
    }
    if err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    defer rows.Close()
    // Fetch jabatan map from setting-service
    jabMap, _ := fetchJabatanMap()
    var out []map[string]interface{}
    for rows.Next() {
        var u User
        if err := rows.Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt, &u.JabatanID, &u.Active); err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
        email := u.Username
        nama := email
        if i := strings.Index(email, "@"); i > 0 { nama = email[:i] }
        var jabatanName string
        if u.JabatanID.Valid {
            if v, ok := jabMap[int(u.JabatanID.Int64)]; ok { jabatanName = v } else { jabatanName = "" }
        } else {
            jabatanName = ""
        }
        out = append(out, map[string]interface{}{
            "id": u.ID,
            "nama": nama,
            "email": email,
            "status": func() string { if u.Active { return "Aktif" } ; return "Tidak Aktif" }(),
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
        Email     string `json:"email"`
        Password  string `json:"password"`
        Role      string `json:"role"`
        JabatanID *int   `json:"jabatan_id"`
        Active    *bool  `json:"active"`
    }
    var in UserInput
    if err := json.NewDecoder(r.Body).Decode(&in); err != nil { writeJSON(w, 400, map[string]string{"error":"invalid json"}); return }
    // Use email as username if provided
    username := strings.TrimSpace(in.Email)
    if username == "" { username = strings.TrimSpace(in.Username) }
    password := strings.TrimSpace(in.Password)
    role := strings.TrimSpace(in.Role)
    if username == "" || password == "" || role == "" { writeJSON(w, 400, map[string]string{"error":"username/email, password, and role required"}); return }
    // Cek unik email/username
    var existingID int
    if err := db.QueryRow("SELECT id FROM users WHERE username=$1", username).Scan(&existingID); err == nil {
        writeJSON(w, 400, map[string]string{"error":"Email sudah digunakan"}); return
    }
    active := true
    if in.Active != nil { active = *in.Active }
    var u User
    err := db.QueryRow("INSERT INTO users(username, password, role, jabatan_id, active) VALUES($1,$2,$3,$4,$5) RETURNING id, created_at", username, password, role, in.JabatanID, active).Scan(&u.ID, &u.CreatedAt)
    if err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    u.Username = username
    u.Role = role
    u.Password = ""
    u.Active = active
    writeJSON(w, 201, u)
}

func updateUser(w http.ResponseWriter, r *http.Request) {
    if !dbReady { writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error":"db_unavailable"}); return }
    idStr, err := parseIDFromPath(r.URL.Path, "/users/")
    if err != nil { writeJSON(w, 400, map[string]string{"error":"invalid id"}); return }
    type UserInput struct {
        Username  string `json:"username"`
        Email     string `json:"email"`
        Password  string `json:"password"`
        Role      string `json:"role"`
        JabatanID *int   `json:"jabatan_id"`
        Active    *bool  `json:"active"`
    }
    var in UserInput
    err = json.NewDecoder(r.Body).Decode(&in); if err != nil { writeJSON(w, 400, map[string]string{"error":"invalid json"}); return }
    username := strings.TrimSpace(in.Email)
    if username == "" { username = strings.TrimSpace(in.Username) }
    // Jika mengubah email/username, pastikan unik
    if username != "" {
        var existingID int
        if err := db.QueryRow("SELECT id FROM users WHERE username=$1 AND id<>$2", username, idStr).Scan(&existingID); err == nil {
            writeJSON(w, 400, map[string]string{"error":"Email sudah digunakan"}); return
        }
    }
    // allow updating password, role, username, jabatan_id
    _, err = db.Exec("UPDATE users SET username = COALESCE(NULLIF($1,''), username), password = COALESCE(NULLIF($2,''), password), role = COALESCE(NULLIF($3,''), role), jabatan_id = COALESCE($4, jabatan_id), active = COALESCE($5, active) WHERE id=$6", username, in.Password, in.Role, in.JabatanID, in.Active, idStr)
    if err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
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
    err = db.QueryRow("SELECT id, username, role, created_at, jabatan_id, active FROM users WHERE id=$1", id).Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt, &u.JabatanID, &u.Active)
    if err != nil { writeJSON(w, 404, map[string]string{"error":"user_not_found"}); return }
    email := u.Username
    nama := email
    if i := strings.Index(email, "@"); i > 0 { nama = email[:i] }
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

func listRoles(w http.ResponseWriter, r *http.Request) {
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
    role, _ := payload["role"].(string)
    // permissions selaras dengan Sidebar
    perms := []string{}
    switch role {
    case "superadmin", "admin":
        perms = []string{"manage","menu_master_data","menu_hak_akses","menu_kas","menu_produk","menu_ruangan","menu_setting","menu_asset_perusahaan","menu_presensi","menu_payment","menu_chat","menu_ml"}
    default:
        perms = []string{"menu_master_data"}
    }
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
    rows, err := db.Query("SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id=$1", userID)
    if err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    defer rows.Close()
    allowed := false
    for rows.Next() {
        var name string
        if err := rows.Scan(&name); err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
        if name == "superadmin" || name == "admin" { allowed = true; break }
    }
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

    log.Println("auth-user-service-go listening on :3000")
    if err := http.ListenAndServe(":3000", mux); err != nil { log.Fatal(err) }
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