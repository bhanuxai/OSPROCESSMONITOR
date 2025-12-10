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
            "percent": disk.percent
        }
    }


def get_process_list(limit=40):
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
        except (psutil.NoSuchProcess, psutil.AccessDenied):
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
    limit = request.args.get("limit", default=40, type=int)
    return jsonify(get_process_list(limit))


# Process Tree API removed


@app.route("/api/processes/<int:pid>/kill", methods=["POST"])
def api_kill_process(pid):
    try:
        p = psutil.Process(pid)
        p.kill()
        return jsonify({"success": True, "message": f"Process {pid} killed"})
    except psutil.NoSuchProcess:
        return jsonify({"success": False, "message": "Process not found"}), 404
    except psutil.AccessDenied:
        return jsonify({"success": False, "message": "Access denied"}), 403
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


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
    else:
        os.system("pkill -KILL -u $USER")
    return jsonify({"success": True})


if __name__ == "__main__":
    app.run(debug=True)
    