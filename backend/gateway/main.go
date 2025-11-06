package main

import (
    "log"
    "net/http"
    "net/http/httputil"
    "net/url"

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
        w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
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
	return p
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
    // Allow GET for /auth endpoints like /auth/me and /auth/permissions
    r.PathPrefix("/auth").Handler(proxyTo("http://auth-user-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodOptions)

	// Setting service
	r.PathPrefix("/setting").Handler(proxyTo("http://setting-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodPut)
	r.PathPrefix("/companies").Handler(proxyTo("http://setting-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete)
	r.PathPrefix("/jabatan").Handler(proxyTo("http://setting-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete)

	// Produk service
	r.PathPrefix("/produk").Handler(proxyTo("http://produk-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete)
	r.PathPrefix("/gudang").Handler(proxyTo("http://produk-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete)
	r.PathPrefix("/mutasi").Handler(proxyTo("http://produk-service:3000")).Methods(http.MethodGet)
	r.PathPrefix("/posisi").Handler(proxyTo("http://produk-service:3000")).Methods(http.MethodGet)
	r.PathPrefix("/rak").Handler(proxyTo("http://produk-service:3000")).Methods(http.MethodGet)
	r.PathPrefix("/recommendations").Handler(proxyTo("http://produk-service:3000")).Methods(http.MethodGet)
	r.PathPrefix("/maintenance").Handler(proxyTo("http://produk-service:3000")).Methods(http.MethodGet)
	r.PathPrefix("/assets").Handler(proxyTo("http://produk-service:3000")).Methods(http.MethodGet)
	r.PathPrefix("/category-asset").Handler(proxyTo("http://produk-service:3000")).Methods(http.MethodGet)
	r.PathPrefix("/category-produk").Handler(proxyTo("http://produk-service:3000")).Methods(http.MethodGet)
	r.PathPrefix("/pembelian").Handler(proxyTo("http://produk-service:3000")).Methods(http.MethodGet)

	// Keuangan service
	r.PathPrefix("/payment").Handler(proxyTo("http://keuangan-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete)
	r.PathPrefix("/kas").Handler(proxyTo("http://keuangan-service:3000")).Methods(http.MethodGet)
	r.PathPrefix("/arus").Handler(proxyTo("http://keuangan-service:3000")).Methods(http.MethodGet)
	r.PathPrefix("/keluar").Handler(proxyTo("http://keuangan-service:3000")).Methods(http.MethodGet)
	r.PathPrefix("/masuk").Handler(proxyTo("http://keuangan-service:3000")).Methods(http.MethodGet)
	r.PathPrefix("/rekening").Handler(proxyTo("http://keuangan-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete)

	// Client service
	r.PathPrefix("/presensi").Handler(proxyTo("http://client-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete)
	r.PathPrefix("/absences").Handler(proxyTo("http://client-service:3000")).Methods(http.MethodGet)
	r.PathPrefix("/activities").Handler(proxyTo("http://client-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete)
	r.PathPrefix("/check-in").Handler(proxyTo("http://client-service:3000")).Methods(http.MethodGet)
	r.PathPrefix("/setting-presensi").Handler(proxyTo("http://client-service:3000")).Methods(http.MethodGet)

	// Delete service
	r.PathPrefix("/deletion-logs").Handler(proxyTo("http://delete-service:3000")).Methods(http.MethodGet, http.MethodPost, http.MethodDelete)

    log.Println("gateway listening on :8080")
    if err := http.ListenAndServe(":8080", corsMiddleware(r)); err != nil {
        log.Fatal(err)
    }
}