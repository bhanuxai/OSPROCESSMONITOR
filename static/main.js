// Tab switching
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-page").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
  });
});

let cpuMemChart;
let perCoreChart;

let historyLabels = [];
let cpuHistory = [];
let memHistory = [];

let latestProcesses = [];

function fmtPercent(v) {
  return v.toFixed(1) + "%";
}

function updateMeters(cpu, mem, disk) {
  document.getElementById("cpu-value").textContent = fmtPercent(cpu);
  document.getElementById("mem-value").textContent = fmtPercent(mem);
  document.getElementById("disk-value").textContent = fmtPercent(disk);

  document.getElementById("cpu-meter-fill").style.width = cpu + "%";
  document.getElementById("mem-meter-fill").style.width = mem + "%";
  document.getElementById("disk-meter-fill").style.width = disk + "%";
}

function initCharts() {
  cpuMemChart = new Chart(document.getElementById("cpuMemChart"), {
    type: "line",
    data: {
      labels: historyLabels,
      datasets: [
        { label: "CPU %", data: cpuHistory, borderWidth: 1 },
        { label: "Memory %", data: memHistory, borderWidth: 1 }
      ]
    },
    options: { responsive: true, scales: { y: { max: 100 } } }
  });

  perCoreChart = new Chart(document.getElementById("perCoreChart"), {
    type: "bar",
    data: {
      labels: [],
      datasets: [{ label: "CPU per core %", data: [], borderWidth: 1 }]
    },
    options: { responsive: true, scales: { y: { max: 100 } } }
  });
}

async function fetchSummary() {
  const res = await fetch("/api/summary");
  const data = await res.json();

  historyLabels.push(data.time);
  cpuHistory.push(data.cpu_percent);
  memHistory.push(data.memory.percent);

  if (historyLabels.length > 60) {
    historyLabels.shift();
    cpuHistory.shift();
    memHistory.shift();
  }

  updateMeters(data.cpu_percent, data.memory.percent, data.disk.percent);

  cpuMemChart.update();
  perCoreChart.data.labels = data.per_cpu.map((_, i) => "Core " + i);
  perCoreChart.data.datasets[0].data = data.per_cpu;
  perCoreChart.update();

  document.getElementById("current-time").textContent = "Last update: " + data.time;
}

async function fetchProcesses() {
  const res = await fetch("/api/processes?limit=60");
  latestProcesses = await res.json();
  renderProcessTable();
}

function renderProcessTable() {
  const tbody = document.getElementById("process-tbody");
  const searchTerm = document.getElementById("process-search").value.toLowerCase();
  const sortBy = document.getElementById("sort-select").value;

  let result = latestProcesses.filter((p) =>
    p.pid.toString().includes(searchTerm) ||
    (p.name || "").toLowerCase().includes(searchTerm)
  );

  if (sortBy === "cpu") result.sort((a, b) => b.cpu_percent - a.cpu_percent);
  if (sortBy === "memory") result.sort((a, b) => b.memory_percent - a.memory_percent);
  if (sortBy === "pid") result.sort((a, b) => a.pid - b.pid);

  tbody.innerHTML = "";
  result.forEach((p) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.pid}</td>
      <td>${p.name || "-"}</td>
      <td>${p.cpu_percent.toFixed(1)}</td>
      <td>${p.memory_percent.toFixed(1)}</td>
      <td>${p.status}</td>
      <td><button class="kill-btn" onclick="killProcess(${p.pid})">Kill</button></td>
    `;
    tbody.appendChild(tr);
  });
}

async function killProcess(pid) {
  if (!confirm("Kill process " + pid + "?")) return;
  await fetch("/api/processes/" + pid + "/kill", { method: "POST" });
  fetchProcesses();
}

// Control Panel
async function shutdownPC() {
  if (confirm("Shutdown computer?")) {
    await fetch("/api/shutdown", { method: "POST" });
  }
}

async function restartPC() {
  if (confirm("Restart computer?")) {
    await fetch("/api/restart", { method: "POST" });
  }
}

async function logoffPC() {
  if (confirm("Logoff user?")) {
    await fetch("/api/logoff", { method: "POST" });
  }
}

window.addEventListener("DOMContentLoaded", () => {
  initCharts();
  fetchSummary();
  fetchProcesses();

  setInterval(fetchSummary, 1000);
  setInterval(fetchProcesses, 2000);
});
