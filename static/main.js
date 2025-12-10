// ====================================
// Tabs
// ====================================
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-page").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
  });
});

// ====================================
// Toast notifications
// ====================================
function showToast(message, isError = false) {
  const container = document.getElementById("toast-container");
  const div = document.createElement("div");
  div.className = "toast" + (isError ? " error" : "");
  div.textContent = message;
  container.appendChild(div);
  setTimeout(() => div.remove(), 4000);
}

// ====================================
// Auto refresh toggle
// ====================================
let autoRefresh = true;

document.getElementById("autoRefreshToggle").addEventListener("change", (e) => {
  autoRefresh = e.target.checked;
  showToast(autoRefresh ? "🔄 Auto refresh enabled" : "⏸ Auto refresh paused");
});

// ====================================
// Charts
// ====================================
let cpuMemChart, perCoreChart;
let historyLabels = [], cpuHistory = [], memHistory = [];
let latestProcesses = [];

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

function fmtPercent(v) { return v.toFixed(1) + "%"; }

// ====================================
// Summary API
// ====================================

let tempEl = document.getElementById("sys-temp");
let t = data.temperature;

if (t > 80) tempEl.className = "value hot";
else if (t > 60) tempEl.className = "value warn";
else tempEl.className = "value";

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

  document.getElementById("sys-os").textContent = data.system.os;
  document.getElementById("sys-cpu").textContent = data.system.cpu;
  document.getElementById("sys-ram").textContent = data.system.total_ram + " GB";
  document.getElementById("sys-uptime").textContent = data.system.uptime;

  document.getElementById("cpu-value").textContent = fmtPercent(data.cpu_percent);
  document.getElementById("cpu-meter-fill").style.width = data.cpu_percent + "%";
  document.getElementById("mem-value").textContent = fmtPercent(data.memory.percent);
  document.getElementById("mem-meter-fill").style.width = data.memory.percent + "%";
  document.getElementById("disk-value").textContent = fmtPercent(data.disk.percent);
  document.getElementById("disk-meter-fill").style.width = data.disk.percent + "%";

  document.getElementById("sys-temp").textContent =
  data.temperature ? data.temperature + " °C" : "N/A";

  cpuMemChart.update();
  perCoreChart.data.labels = data.per_cpu.map((_, i) => "Core " + i);
  perCoreChart.data.datasets[0].data = data.per_cpu;
  perCoreChart.update();
}

// ====================================
// Processes API
// ====================================
async function fetchProcesses() {
  const res = await fetch("/api/processes?limit=200");
  latestProcesses = await res.json();
  renderProcessTable();
}

// ====================================
// Table Rendering
// ====================================
let currentSort = "cpu";
let sortCpu = true, sortMem = true, sortPid = true, sortName = true;

let currentPage = 1;
let rowsPerPage = 20;

function renderProcessTable() {
  const tbody = document.getElementById("process-tbody");
  const searchTerm = document.getElementById("process-search").value.toLowerCase();

  let result = latestProcesses.filter((p) =>
    p.pid.toString().includes(searchTerm) ||
    (p.name || "").toLowerCase().includes(searchTerm)
  );

  if (currentSort === "cpu") result.sort((a, b) => sortCpu ? b.cpu_percent - a.cpu_percent : a.cpu_percent - b.cpu_percent);
  if (currentSort === "memory") result.sort((a, b) => sortMem ? b.memory_percent - a.memory_percent : a.memory_percent - b.memory_percent);
  if (currentSort === "pid") result.sort((a, b) => sortPid ? a.pid - b.pid : b.pid - a.pid);
  if (currentSort === "name") result.sort((a, b) => sortName ?
    (a.name || "").localeCompare(b.name || "") :
    (b.name || "").localeCompare(a.name || ""));

  let start = (currentPage - 1) * rowsPerPage;
  let end = start + rowsPerPage;
  let pageItems = result.slice(start, end);

  tbody.innerHTML = "";
  pageItems.forEach((p) => {
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

  document.getElementById("pageInfo").textContent =
    `Page ${currentPage} of ${Math.ceil(result.length / rowsPerPage)}`;
}

// ====================================
// Sorting
// ====================================
document.querySelectorAll("th[data-sort]").forEach(th => {
  th.addEventListener("click", () => {
    const field = th.getAttribute("data-sort");
    if (field === "cpu") sortCpu = !sortCpu;
    if (field === "memory") sortMem = !sortMem;
    if (field === "pid") sortPid = !sortPid;
    if (field === "name") sortName = !sortName;
    currentSort = field;
    renderProcessTable();
  });
});

// ====================================
// Pagination
// ====================================
document.getElementById("prevBtn").addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    renderProcessTable();
  }
});
document.getElementById("nextBtn").addEventListener("click", () => {
  currentPage++;
  renderProcessTable();
});

// ====================================
// Modal Kill
// ====================================
let modalPid = null;
let modalName = null;

function killProcess(pid) {
  const proc = latestProcesses.find(p => p.pid === pid);
  modalPid = pid;
  modalName = proc?.name || "-";

  document.getElementById("modal-text").textContent =
    `Are you sure you want to kill PID ${pid} (${modalName})?`;

  document.getElementById("modal-overlay").style.display = "flex";
}

document.getElementById("confirmKill").addEventListener("click", async () => {
  const res = await fetch("/api/processes/" + modalPid + "/kill", { method: "POST" });
  const data = await res.json();

  if (data.success) showToast("✔ Process " + modalPid + " killed");
  else showToast("❌ Failed to kill " + modalPid, true);

  document.getElementById("modal-overlay").style.display = "none";
  fetchProcesses();
});

document.getElementById("cancelKill").addEventListener("click", () => {
  document.getElementById("modal-overlay").style.display = "none";
});

// ====================================
// System Buttons
// ====================================
async function shutdownPC() {
  if (confirm("Shutdown computer?")) {
    await fetch("/api/shutdown", { method: "POST" });
    showToast("⚠ Shutdown command sent");
  }
}

async function restartPC() {
  if (confirm("Restart computer?")) {
    await fetch("/api/restart", { method: "POST" });
    showToast("⚠ Restart command sent");
  }
}

async function logoffPC() {
  if (confirm("Logoff user?")) {
    await fetch("/api/logoff", { method: "POST" });
    showToast("⚠ Logoff command sent");
  }
}

// ====================================
// Start App
// ====================================
window.addEventListener("DOMContentLoaded", () => {
  initCharts();
  fetchSummary();
  fetchProcesses();

  setInterval(() => { if (autoRefresh) fetchSummary(); }, 1000);
  setInterval(() => { if (autoRefresh) fetchProcesses(); }, 2000);
});
