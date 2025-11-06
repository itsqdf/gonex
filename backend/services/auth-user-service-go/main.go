package main

import (
    "crypto/hmac"
    "crypto/sha256"
    "database/sql"
    "encoding/base64"
    "encoding/json"
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
}

type Role struct {
    ID   int    `json:"id"`
    Name string `json:"name"`
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
        dbReady = true
        log.Println("db ready")
        return
    }
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
        rows, err = db.Query("SELECT id, username, role, created_at FROM users WHERE username ILIKE '%' || $1 || '%' ORDER BY id LIMIT $2 OFFSET $3", q, limit, offset)
    } else {
        rows, err = db.Query("SELECT id, username, role, created_at FROM users ORDER BY id LIMIT $1 OFFSET $2", limit, offset)
    }
    if err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    defer rows.Close()
    var out []map[string]interface{}
    for rows.Next() {
        var u User
        if err := rows.Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt); err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
        email := u.Username
        nama := email
        if i := strings.Index(email, "@"); i > 0 { nama = email[:i] }
        out = append(out, map[string]interface{}{
            "id": u.ID,
            "nama": nama,
            "email": email,
            "status": "aktif",
            "jabatan": "",
        })
    }
    pages := (total + limit - 1) / limit
    writeJSON(w, 200, map[string]interface{}{"data": out, "meta": map[string]int{"total": total, "pages": pages, "page": page, "limit": limit}})
}

func createUser(w http.ResponseWriter, r *http.Request) {
    if !dbReady { writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error":"db_unavailable"}); return }
    var u User
    if err := json.NewDecoder(r.Body).Decode(&u); err != nil { writeJSON(w, 400, map[string]string{"error":"invalid json"}); return }
    if u.Username == "" || u.Password == "" || u.Role == "" { writeJSON(w, 400, map[string]string{"error":"username, password, role required"}); return }
    err := db.QueryRow("INSERT INTO users(username, password, role) VALUES($1,$2,$3) RETURNING id, created_at", u.Username, u.Password, u.Role).Scan(&u.ID, &u.CreatedAt)
    if err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    u.Password = ""
    writeJSON(w, 201, u)
}

func updateUser(w http.ResponseWriter, r *http.Request) {
    if !dbReady { writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error":"db_unavailable"}); return }
    idStr, err := parseIDFromPath(r.URL.Path, "/users/")
    if err != nil { writeJSON(w, 400, map[string]string{"error":"invalid id"}); return }
    var u User
    if err := json.NewDecoder(r.Body).Decode(&u); err != nil { writeJSON(w, 400, map[string]string{"error":"invalid json"}); return }
    // allow updating password or role or username
    _, err = db.Exec("UPDATE users SET username = COALESCE(NULLIF($1,''), username), password = COALESCE(NULLIF($2,''), password), role = COALESCE(NULLIF($3,''), role) WHERE id=$4", u.Username, u.Password, u.Role, idStr)
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
    err = db.QueryRow("SELECT id, username, role, created_at FROM users WHERE id=$1", id).Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt)
    if err != nil { writeJSON(w, 404, map[string]string{"error":"user_not_found"}); return }
    email := u.Username
    nama := email
    if i := strings.Index(email, "@"); i > 0 { nama = email[:i] }
    writeJSON(w, 200, map[string]interface{}{"user": map[string]interface{}{"id": u.ID, "nama": nama, "email": email, "status": "aktif", "jabatan": ""}})
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
    for rows.Next() { var r Role; if err := rows.Scan(&r.ID, &r.Name); err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }; out = append(out, r) }
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
    if err := json.NewDecoder(r.Body).Decode(&rl); err != nil { writeJSON(w, 400, map[string]string{"error":"invalid json"}); return }
    _, err = db.Exec("UPDATE roles SET name = COALESCE(NULLIF($1,''), name) WHERE id=$2", rl.Name, idStr)
    if err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    writeJSON(w, 200, map[string]string{"status":"updated"})
}

func deleteRole(w http.ResponseWriter, r *http.Request) {
    if !dbReady { writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error":"db_unavailable"}); return }
    idStr, err := parseIDFromPath(r.URL.Path, "/roles/")
    if err != nil { writeJSON(w, 400, map[string]string{"error":"invalid id"}); return }
    var roleName string
    if err := db.QueryRow("SELECT name FROM roles WHERE id=$1", idStr).Scan(&roleName); err != nil {
        writeJSON(w, 404, map[string]string{"error":"role_not_found"}); return
    }
    var cnt int
    if err := db.QueryRow("SELECT COUNT(1) FROM users WHERE role=$1", roleName).Scan(&cnt); err != nil {
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
    writeJSON(w, 200, map[string]interface{}{"id": id, "nama": nama, "email": email, "role": role, "roles": []string{role}, "status":"aktif"})
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
    rows, err := db.Query("SELECT id, username, role FROM users ORDER BY id")
    if err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
    defer rows.Close()
    var out []map[string]interface{}
    for rows.Next() {
        var id int
        var username, role string
        if err := rows.Scan(&id, &username, &role); err != nil { writeJSON(w, 500, map[string]string{"error":err.Error()}); return }
        out = append(out, map[string]interface{}{"user_id": id, "username": username, "role": role})
    }
    writeJSON(w, 200, out)
}

func hasPermissions(w http.ResponseWriter, r *http.Request) {
    if !dbReady { writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error":"db_unavailable"}); return }
    q := r.URL.Query()
    username := q.Get("username")
    if username == "" { writeJSON(w, 400, map[string]string{"error":"username required"}); return }
    var role string
    err := db.QueryRow("SELECT role FROM users WHERE username=$1", username).Scan(&role)
    if err != nil { writeJSON(w, 404, map[string]string{"error":"user_not_found"}); return }
    allowed := role == "superadmin" || role == "admin"
    writeJSON(w, 200, map[string]bool{"allowed": allowed})
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
    mux.HandleFunc("/roles-user", listRolesUser)
    mux.HandleFunc("/has-permissions", hasPermissions)

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