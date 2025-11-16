package main

import (
    "log"
    "net/http"
    "net/http/httputil"
    "net/url"
    "strings"

    "github.com/gorilla/mux"
)

func corsMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        origin := r.Header.Get("Origin")
        if origin != "" {
            w.Header().Set("Access-Control-Allow-Origin", origin)
            w.Header().Set("Vary", "Origin")
        } else {
            w.Header().Set("Access-Control-Allow-Origin", "*")
        }
        w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        // Allow custom headers used by frontend for role/permission gating
        w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Role, X-Permissions")
        w.Header().Set("Access-Control-Allow-Credentials", "true")
        if r.Method == http.MethodOptions {
            w.WriteHeader(http.StatusNoContent)
            return
        }
        next.ServeHTTP(w, r)
    })
}

func proxyTo(target string) http.Handler {
    u, err := url.Parse(target)
    if err != nil {
        panic(err)
    }
    p := httputil.NewSingleHostReverseProxy(u)
    // Strip upstream CORS headers so gateway emits the only CORS headers
    p.ModifyResponse = func(resp *http.Response) error {
        resp.Header.Del("Access-Control-Allow-Origin")
        resp.Header.Del("Access-Control-Allow-Methods")
        resp.Header.Del("Access-Control-Allow-Headers")
        resp.Header.Del("Access-Control-Allow-Credentials")
        resp.Header.Del("Vary")
        return nil
    }
    return p
}

// proxy with path rewrite: replace first occurrence of prefix with newPrefix
func proxyRewrite(target string, oldPrefix string, newPrefix string) http.Handler {
    u, err := url.Parse(target)
    if err != nil { panic(err) }
    p := httputil.NewSingleHostReverseProxy(u)
    // Strip upstream CORS headers so gateway emits the only CORS headers
    p.ModifyResponse = func(resp *http.Response) error {
        resp.Header.Del("Access-Control-Allow-Origin")
        resp.Header.Del("Access-Control-Allow-Methods")
        resp.Header.Del("Access-Control-Allow-Headers")
        resp.Header.Del("Access-Control-Allow-Credentials")
        resp.Header.Del("Vary")
        return nil
    }
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // only rewrite if path starts with oldPrefix
        if strings.HasPrefix(r.URL.Path, oldPrefix) {
            r.URL.Path = strings.Replace(r.URL.Path, oldPrefix, newPrefix, 1)
        }
        p.ServeHTTP(w, r)
    })
}

func main() {
	r := mux.NewRouter()

	r.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok","service":"gateway"}`))
	})

    // Auth/User service
    r.PathPrefix("/users").Handler(proxyTo("http://auth-user-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions)
    r.PathPrefix("/roles").Handler(proxyTo("http://auth-user-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions)
    r.PathPrefix("/roles-user").Handler(proxyTo("http://auth-user-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions)
    r.PathPrefix("/has-permissions").Handler(proxyTo("http://auth-user-service:3000")).Methods(http.MethodGet, http.MethodOptions)
    r.PathPrefix("/permissions").Handler(proxyTo("http://auth-user-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions)
    // Allow GET for /auth endpoints like /auth/me and /auth/permissions
    r.PathPrefix("/auth").Handler(proxyTo("http://auth-user-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodOptions)

    // User biometrics endpoints (proxy to auth-user-service)
    r.PathPrefix("/user-biometrics").Handler(proxyTo("http://auth-user-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodPatch, http.MethodOptions)

    // Setting service
    // Tambahkan DELETE dan OPTIONS agar penghapusan lokasi presensi bekerja melalui gateway
    r.PathPrefix("/setting").Handler(proxyTo("http://setting-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions)
    r.PathPrefix("/settings").Handler(proxyTo("http://setting-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodOptions)
	// Chat service (proxied to setting-service for simplicity)
	r.PathPrefix("/chat").Handler(proxyTo("http://setting-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete)
	r.PathPrefix("/companies").Handler(proxyTo("http://setting-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete)
	r.PathPrefix("/jabatan").Handler(proxyTo("http://setting-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete)
	r.PathPrefix("/jabatan-presensi").Handler(proxyTo("http://setting-service:3000")).Methods(http.MethodGet, http.MethodPut)
	r.PathPrefix("/clients").Handler(proxyTo("http://setting-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete)
	r.PathPrefix("/vendors").Handler(proxyTo("http://setting-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete)

	// Produk service
	r.PathPrefix("/produk").Handler(proxyTo("http://produk-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete)
	r.PathPrefix("/gudang").Handler(proxyTo("http://produk-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete)
	r.PathPrefix("/mutasi").Handler(proxyTo("http://produk-service:3000")).Methods(http.MethodGet)
	r.PathPrefix("/posisi").Handler(proxyTo("http://produk-service:3000")).Methods(http.MethodGet)
	r.PathPrefix("/rak").Handler(proxyTo("http://produk-service:3000")).Methods(http.MethodGet)
	r.PathPrefix("/recommendations").Handler(proxyTo("http://produk-service:3000")).Methods(http.MethodGet)
    r.PathPrefix("/maintenance").Handler(proxyTo("http://produk-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete)
    r.PathPrefix("/assets").Handler(proxyTo("http://produk-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete)
    r.PathPrefix("/category-asset").Handler(proxyTo("http://produk-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete)
	r.PathPrefix("/category-produk").Handler(proxyTo("http://produk-service:3000")).Methods(http.MethodGet)
	r.PathPrefix("/pembelian").Handler(proxyTo("http://produk-service:3000")).Methods(http.MethodGet)

    // Frontend alt paths -> Produk service with rewrites
    r.PathPrefix("/products").Handler(proxyRewrite("http://produk-service:3000", "/products", "/produk")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete)
    r.PathPrefix("/warehouses").Handler(proxyRewrite("http://produk-service:3000", "/warehouses", "/gudang")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete)
    r.PathPrefix("/mutasi-barang").Handler(proxyRewrite("http://produk-service:3000", "/mutasi-barang", "/mutasi")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete)
    r.PathPrefix("/category-products").Handler(proxyRewrite("http://produk-service:3000", "/category-products", "/category-produk")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete)
    r.PathPrefix("/category-assets").Handler(proxyRewrite("http://produk-service:3000", "/category-assets", "/category-asset")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete)

    // Keuangan service
	r.PathPrefix("/payment").Handler(proxyTo("http://keuangan-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete)
	r.PathPrefix("/kas").Handler(proxyTo("http://keuangan-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete)
    r.PathPrefix("/arus").Handler(proxyTo("http://keuangan-service:3000")).Methods(http.MethodGet)
    r.PathPrefix("/keluar").Handler(proxyTo("http://keuangan-service:3000")).Methods(http.MethodGet)
    r.PathPrefix("/masuk").Handler(proxyTo("http://keuangan-service:3000")).Methods(http.MethodGet)
    r.PathPrefix("/rekening").Handler(proxyTo("http://keuangan-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete)

    // Frontend alt path for payments -> keuangan-service
    r.PathPrefix("/payments").Handler(proxyRewrite("http://keuangan-service:3000", "/payments", "/payment")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete)

	// Client service
	r.PathPrefix("/presensi").Handler(proxyTo("http://client-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete)
	r.PathPrefix("/absences").Handler(proxyTo("http://client-service:3000")).Methods(http.MethodGet)
	r.PathPrefix("/activities").Handler(proxyTo("http://client-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete)
	r.PathPrefix("/check-in").Handler(proxyTo("http://client-service:3000")).Methods(http.MethodGet)
	r.PathPrefix("/setting-presensi").Handler(proxyTo("http://client-service:3000")).Methods(http.MethodGet)

	// Akademik teacher-service
	r.PathPrefix("/akademik").Handler(proxyTo("http://teacher-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete)

	// Delete service
	r.PathPrefix("/deletion-logs").Handler(proxyTo("http://delete-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodDelete)

    log.Println("gateway listening on :8080")
    if err := http.ListenAndServe(":8080", corsMiddleware(r)); err != nil {
        log.Fatal(err)
    }
}