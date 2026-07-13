/**
 * 智环引诊 - 警报列表页面
 * 对接后端: /admin/api/emergency/alarms
 * 写操作: handleAlarm, ignoreAlarm, exportEmergencyRecords
 */

// ===================== 页面初始化 =====================

document.addEventListener('DOMContentLoaded', async function () {
    // 时钟
    setInterval(function () {
        var date = new Date();
        var timeString = date.toISOString().replace('T', ' ').substring(0, 19);
        document.getElementById('dateInfo').textContent = timeString;
    }, 1000);

    // ★ 加载警报列表
    await loadAlarms();
});

// ===================== 数据加载 =====================

async function loadAlarms() {
    try {
        const statusFilter = document.querySelector('.filter-bar select:nth-child(2)')?.value || 'all';
        const levelFilter = document.querySelector('.filter-bar select:nth-child(4)')?.value || 'all';
        const timeRange = document.querySelector('.filter-bar select:nth-child(6)')?.value || 'today';

        const params = { current: 1, size: 200 };
        if (statusFilter !== 'all') params.status = statusFilter;
        if (levelFilter !== 'all') params.level = levelFilter;

        const res = await adminApi.getEmergencyAlarms(params);
        if (res.code === 200 && res.data) {
            const records = res.data.records || [];
            renderAlarmTable(records);
            document.getElementById('alarmCount').textContent = '共 ' + records.length + ' 条记录';
        }
    } catch (e) {
        console.warn('[警报列表] 加载失败:', e.message);
        document.getElementById('alarmCount').textContent = '加载失败';
    }
}

// ===================== 渲染 =====================

function renderAlarmTable(records) {
    const tbody = document.getElementById('alarmTableBody');
    tbody.innerHTML = '';

    records.forEach(function (alarm) {
        const levelMap = { 3: { text: '紧急', cls: 'danger' }, 2: { text: '中等', cls: 'warning' }, 1: { text: '一般', cls: 'normal' } };
        const level = levelMap[alarm.level] || levelMap[1];
        const statusMap = { pending: { text: '待处理', cls: 'warning' }, processing: { text: '处理中', cls: 'danger' }, completed: { text: '已处理', cls: 'normal' } };
        const st = statusMap[alarm.status] || statusMap.pending;
        const timeStr = (alarm.createdAt || alarm.alarmTime || '').substring(11, 19) || '--:--:--';

        var row = document.createElement('tr');
        row.innerHTML =
            '<td>' + timeStr + '</td>' +
            '<td>' + (alarm.location || '--') + '</td>' +
            '<td>' + (alarm.description || alarm.alarmDesc || '--') + '</td>' +
            '<td><span class="status-badge ' + level.cls + '">' + level.text + '</span></td>' +
            '<td><span class="status-badge ' + st.cls + '">' + st.text + '</span></td>' +
            '<td>' +
                '<button class="btn-sm" onclick="viewAlarmDetail(' + alarm.id + ')">查看</button>' +
                (alarm.status === 'pending' ? '<button class="btn-sm" style="background: #4caf50;" onclick="handleAlarm(' + alarm.id + ')">处理</button>' : '') +
            '</td>';
        tbody.appendChild(row);
    });
}

// ===================== 写操作 =====================

async function handleAlarm(id) {
    var btn = event.target;
    btn.innerHTML = '处理中...';
    btn.disabled = true;
    try {
        const res = await adminApi.handleAlarm(id, '警报列表快速处理');
        if (res.code === 200) {
            btn.innerHTML = '已处理';
            btn.style.background = '#4caf50';
            console.log('[警报列表] 已处理:', id);
            // 刷新列表
            setTimeout(loadAlarms, 500);
        }
    } catch (e) {
        console.error('[警报列表] 处理失败:', e.message);
        alert('处理失败: ' + e.message);
        btn.innerHTML = '处理';
        btn.disabled = false;
    }
}

async function exportAlarms() {
    var btn = event.target;
    btn.innerHTML = '导出中...';
    btn.disabled = true;
    try {
        const blob = await adminApi.exportEmergencyRecords();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'alarm_records.csv';
        a.click();
        window.URL.revokeObjectURL(url);
        alert('警报记录导出成功 ✅');
    } catch (e) {
        console.error('[警报列表] 导出失败:', e.message);
        alert('导出失败: ' + e.message);
    } finally {
        btn.innerHTML = '导出记录';
        btn.disabled = false;
    }
}

function viewAlarmDetail(id) {
    // 跳转到应急管理页（或弹窗展示详情）
    window.location.href = 'emergency.html?alarmId=' + id;
}

function filterAlarms() {
    loadAlarms();
}

function refreshAlarms() {
    var btn = event.target;
    btn.innerHTML = '刷新中...';
    btn.disabled = true;
    loadAlarms().finally(function () {
        btn.innerHTML = '刷新';
        btn.disabled = false;
    });
}

function goBack() {
    window.location.href = 'emergency.html';
}
