# OS Process Monitoring Dashboard

A real-time dashboard to monitor system resources and processes using Flask, psutil, and Chart.js.

---

## 🚀 Features Implemented

### 1. System Overview
- CPU usage (real-time)
- Memory usage
- Disk usage
- Per-core CPU graph
- OS name, CPU model, uptime, RAM
- CPU temperature (N/A on Windows)

### 2. Processes Dashboard
- Live updating process table
- Sorting by PID / Name / CPU / Memory
- Search filter
- Pagination
- Kill process confirmation modal

### 3. Notifications
- Toast notifications for:
  - kill success/failure
  - shutdown / restart / logoff
  - auto-refresh toggle

### 4. Control Panel
- Shutdown system
- Restart system
- Logoff user

### 5. Auto Refresh Toggle
- Can pause live updates
- Useful during demo

---

## 🛠 Tech Stack

| Component       | Technology |
|----------------|-----------|
| Backend        | Flask (Python) |
| System Data    | psutil |
| Frontend       | HTML, CSS, JS |
| Charts         | Chart.js |
| Version Control | Git + GitHub |

---

## 📂 Project Structure


OSPROCESSMONITOR/
│
├─ app.py # Flask backend
├─ requirements.txt
│
├─ templates/
│ └─ index.html
│
└─ static/
├─ main.js
└─ styles.css