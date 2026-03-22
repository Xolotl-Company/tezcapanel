package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

var agentToken string

func main() {
	agentToken = os.Getenv("AGENT_TOKEN")
	if agentToken == "" {
		log.Fatal("AGENT_TOKEN no definido")
	}

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(authMiddleware)

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	r.Get("/metrics", getMetrics)
	r.Get("/services", getServices)
	r.Post("/services/{name}/restart", restartService)

	addr := "127.0.0.1:7070"
	fmt.Printf("tezcaagent corriendo en %s\n", addr)
	log.Fatal(http.ListenAndServe(addr, r))
}
