package main

import (
	"encoding/json"
	"net/http"
	"runtime"
	"time"

	"github.com/go-chi/chi/v5"
)

type Metrics struct {
	CPU    CPUInfo  `json:"cpu"`
	Memory MemInfo  `json:"memory"`
	Disk   DiskInfo `json:"disk"`
	Uptime int64    `json:"uptime"`
	Host   string   `json:"hostname"`
	OS     string   `json:"os"`
}

type CPUInfo  struct { Usage float64 `json:"usage"`; Cores int    `json:"cores"`; Model string `json:"model"` }
type MemInfo  struct { Total uint64  `json:"total"`; Used  uint64 `json:"used"`;  Free  uint64 `json:"free"` }
type DiskInfo struct { Total uint64  `json:"total"`; Used  uint64 `json:"used"`;  Free  uint64 `json:"free"` }

var startTime = time.Now()

func getMetrics(w http.ResponseWriter, r *http.Request) {
	// Stub — Commit 3 integra gopsutil para datos reales del sistema
	m := Metrics{
		CPU:    CPUInfo{Usage: 0, Cores: runtime.NumCPU(), Model: "Unknown"},
		Memory: MemInfo{},
		Disk:   DiskInfo{},
		Uptime: int64(time.Since(startTime).Seconds()),
		Host:   "localhost",
		OS:     runtime.GOOS,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(m)
}

func getServices(w http.ResponseWriter, r *http.Request) {
	services := []map[string]string{
		{"name": "nginx",  "status": "unknown"},
		{"name": "mysql",  "status": "unknown"},
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(services)
}

func restartService(w http.ResponseWriter, r *http.Request) {
	_ = chi.URLParam(r, "name")
	// TODO Commit 3: ejecutar systemctl restart {name}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"ok": true})
}
