/**
 * 智环引诊 - 科室负载详情页面
 * 对接后端: /admin/api/dashboard/dept-load, /admin/api/dispatch/dept-load
 * 写操作: exportDispatchReport
 */

// ===================== 页面初始化 =====================

document.addEventListener('DOMContentLoaded', async function () {
    // 时钟
    setInterval(function () {
        var date = new Date();
        var timeString = formatLocalDateTime(date);
        document.getElementById('dateInfo').textContent = timeString;
    }, 1000);

    // ★ 加载数据
    await loadDeptData();
});

// ===================== 数据加载 =====================

async function loadDeptData() {
    try {
        const res = await adminApi.getDispatchDeptLoad();
        if (res.code === 200 && res.data) {
            const deptList = Array.isArray(res.data) ? res.data : (res.data.records || []);
            renderDeptTable(deptList);
            updateSummaryStats(deptList);
            console.log('[负载详情] 已加载科室数据:', deptList.length);
        }
    } catch (e) {
        console.warn('[负载详情] 加载失败:', e.message);
    }
}

// ===================== 渲染 =====================

function renderDeptTable(deptList) {
    const tbody = document.getElementById('deptTableBody') || document.querySelector('.card:nth-child(3) .table-container tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    deptList.forEach(function (dept) {
        const utilization = dept.utilization || 0;
        const maxCapacity = dept.maxCapacity || Math.round((dept.queueCount || 0) / (utilization / 100));
        const avgWait = dept.avgWaitMinutes || dept.waitMinutes || 0;

        let statusClass, statusText, fillClass;
        if (utilization >= 85) { statusClass = 'danger'; statusText = '高负载'; fillClass = 'danger'; }
        else if (utilization >= 65) { statusClass = 'warning'; statusText = '中等'; fillClass = 'warning'; }
        else { statusClass = 'normal'; statusText = '正常'; fillClass = 'normal'; }

        var row = document.createElement('tr');
        row.innerHTML =
            '<td>' + (dept.deptName || dept.name || '--') + '</td>' +
            '<td>' + (dept.queueCount || dept.visitCount || 0) + '</td>' +
            '<td>' + maxCapacity + '</td>' +
            '<td>' +
                '<div class="progress-bar">' +
                    '<div class="progress-fill ' + fillClass + '" style="width: ' + utilization + '%"></div>' +
                '</div>' +
                '<span style="margin-left: 8px;">' + utilization + '%</span>' +
            '</td>' +
            '<td>' + avgWait + '分钟</td>' +
            '<td><span class="status-badge ' + statusClass + '">' + statusText + '</span></td>' +
            '<td><button class="btn-sm" onclick="viewDetail(\'' + (dept.deptName || dept.name) + '\')">查看</button></td>';
        tbody.appendChild(row);
    });
}

function updateSummaryStats(deptList) {
    // 更新统计概览卡片
    const totalDepts = deptList.length;
    const highLoad = deptList.filter(function (d) { return (d.utilization || 0) >= 85; }).length;
    const mediumLoad = deptList.filter(function (d) { var u = d.utilization || 0; return u >= 65 && u < 85; }).length;
    const normalLoad = totalDepts - highLoad - mediumLoad;

    const statCards = document.querySelectorAll('.card-body > div > div > div:first-child');
    if (statCards.length >= 4) {
        statCards[0].textContent = totalDepts;
        statCards[1].textContent = highLoad;
        statCards[2].textContent = mediumLoad;
        statCards[3].textContent = normalLoad;
    }
}

// ===================== 写操作 =====================

async function exportData(evt) {
    var btn = (evt && evt.target) || document.querySelector('#exportDataBtn');
    if (!btn) { console.error('[负载] 导出按钮未找到'); return; }
    btn.innerHTML = '导出中...';
    btn.disabled = true;
    try {
        var result = await adminApi.exportDispatchReport();
        var blob = result instanceof Blob ? result : (result instanceof Response ? await result.blob() : new Blob([JSON.stringify(result)], { type: 'text/csv' }));
        var url = window.URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'dept_load_report.csv';
        a.click();
        window.URL.revokeObjectURL(url);
        alert('科室负载数据导出成功');
    } catch (e) {
        console.error('[负载详情] 导出失败:', e.message);
        alert('导出失败: ' + e.message);
    } finally {
        btn.innerHTML = '导出数据';
        btn.disabled = false;
    }
}

function viewDetail(deptName) {
    window.location.href = 'queue-detail.html?dept=' + encodeURIComponent(deptName);
}

function filterData() { loadDeptData(); }
function sortData() { loadDeptData(); }

function refreshData() {
    var btn = event.target;
    btn.innerHTML = '刷新中...';
    btn.disabled = true;
    loadDeptData().finally(function () {
        btn.innerHTML = '刷新';
        btn.disabled = false;
    });
}

function goBack() {
    window.location.href = 'index.html';
}
