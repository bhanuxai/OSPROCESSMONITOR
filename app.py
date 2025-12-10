from flask import Flask, jsonify, render_template, request
import psutil
import os
import platform
import datetime

app = Flask(__name__)

def get_system_summary():
    cpu_percent = psutil.cpu_percent(interval=0.3)
    per_cpu = psutil.cpu_percent(interval=None, percpu=True)
    virtual_mem = psutil.virtual_memory()
    swap = psutil.swap_memory()
    disk = psutil.disk_usage("/")

    uptime_delta = datetime.datetime.now() - datetime.datetime.fromtimestamp(psutil.boot_time())

    return {
        "time": datetime.datetime.now().strftime("%H:%M:%S"),
        "cpu_percent": cpu_percent,
        "per_cpu": per_cpu,
        "memory": {
            "total": virtual_mem.total,
            "used": virtual_mem.used,
            "percent": virtual_mem.percent
        },
        "swap": {
            "total": swap.total,
            "used": swap.used,
            "percent": swap.percent
        },
        "disk": {
            "total": disk.total,
            "used": disk.used,
            "percent": disk.percent,
            "temperature": get_cpu_temp(),

        },
        "system": {
            "os": platform.system(),
            "cpu": platform.processor(),
            "total_ram": round(virtual_mem.total / (1024**3), 2),
            "uptime": str(uptime_delta).split('.')[0]
        }
    }

def get_cpu_temp():
    try:
        temps = psutil.sensors_temperatures()
        if not temps:
            return None
        
        for name, entries in temps.items():
            for entry in entries:
                if entry.current:
                    return entry.current
    except:
        return None


def get_process_list(limit=200):
    processes = []
    for p in psutil.process_iter(["pid", "name", "cpu_percent", "memory_percent", "status"]):
        try:
            info = p.info
            processes.append({
                "pid": info["pid"],
                "name": info["name"],
                "cpu_percent": info["cpu_percent"],
                "memory_percent": round(info["memory_percent"], 2),
                "status": info["status"]
            })
        except:
            continue

    processes.sort(key=lambda x: x["cpu_percent"], reverse=True)
    return processes[:limit]

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/summary")
def api_summary():
    return jsonify(get_system_summary())

@app.route("/api/processes")
def api_processes():
    limit = request.args.get("limit", default=200, type=int)
    return jsonify(get_process_list(limit))

@app.route("/api/processes/<int:pid>/kill", methods=["POST"])
def api_kill_process(pid):
    try:
        psutil.Process(pid).kill()
        return jsonify({"success": True})
    except:
        return jsonify({"success": False})

@app.route("/api/shutdown", methods=["POST"])
def shutdown():
    os.system("shutdown /s /t 1")
    return jsonify({"success": True})

@app.route("/api/restart", methods=["POST"])
def restart():
    os.system("shutdown /r /t 1")
    return jsonify({"success": True})

@app.route("/api/logoff", methods=["POST"])
def logoff():
    if platform.system() == "Windows":
        os.system("shutdown /l")
    return jsonify({"success": True})

if __name__ == "__main__":
    app.run(debug=True)
