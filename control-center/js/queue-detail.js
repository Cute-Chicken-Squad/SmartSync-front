/**
 * 智环引诊 - 科室排队详情页面
 * 对接后端: /admin/api/dispatch/queue-detail
 * 写操作: callPatient, exportQueueDetail
 */

// 从 URL 获取科室名
const deptName = new URLSearchParams(window.location.search).get('dept') || '内科';

// 本地降级数据（API 不可用时使用）
const fallbackQueueData = {
    '内科': [
        { id: 1, name: '张大爷', gender: '男', age: 72, arrivalTime: '13:45:22', waitingTime: '50分钟', priority: '普通', status: 'waiting' },
        { id: 2, name: '李女士', gender: '女', age: 45, arrivalTime: '14:05:10', waitingTime: '30分钟', priority: '普通', status: 'waiting' },
    ],
    '外科': [
        { id: 1, name: '王先生', gender: '男', age: 35, arrivalTime: '14:00:00', waitingTime: '35分钟', priority: '普通', status: 'waiting' },
    ],
    '检验科': [
        { id: 1, name: '王大爷', gender: '男', age: 70, arrivalTime: '13:30:00', waitingTime: '65分钟', priority: '普通', status: 'waiting' },
    ],
    '影像科': [
        { id: 1, name: '张大爷', gender: '男', age: 68, arrivalTime: '13:50:00', waitingTime: '45分钟', priority: '普通', status: 'waiting' },
    ],
    '心内科': [
        { id: 1, name: '王大爷', gender: '男', age: 75, arrivalTime: '14:00:00', waitingTime: '35分钟', priority: '优先', status: 'waiting' },
    ],
    '急诊科': [
        { id: 1, name: '张女士', gender: '女', age: 28, arrivalTime: '14:30:00', waitingTime: '5分钟', priority: '紧急', status: 'completed' },
    ],
};

let currentQueueData = [];

// ===================== 页面初始化 =====================

document.addEventListener('DOMContentLoaded', async function () {
    // 时钟
    setInterval(function () {
        var date = new Date();
        var timeString = date.toISOString().replace('T', ' ').substring(0, 19);
        document.getElementById('dateInfo').textContent = timeString;
    }, 1000);

    // 更新标题
    document.getElementById('deptTitle').textContent = deptName + ' - 排队详情';

    // ★ 加载排队数据
    await loadQueueData();
});

// ===================== 数据加载 =====================

async function loadQueueData() {
    try {
        const sortSelect = document.querySelector('.filter-bar select:first-of-type');
        const statusSelect = document.querySelector('.filter-bar select:nth-of-type(2)');
        const sort = sortSelect?.value || 'time';
        const status = statusSelect?.value || 'all';

        const params = { deptName: deptName, sort: sort };
        if (status !== 'all') params.status = status;

        const res = await adminApi.getQueueDetail(params);
        if (res.code === 200 && res.data) {
            currentQueueData = (res.data.records || res.data || []).map(function (r) {
                return {
                    id: r.id || r.patientId,
                    name: r.patientName || r.name,
                    gender: r.gender || '',
                    age: r.age || '',
                    arrivalTime: (r.arrivalTime || r.createdAt || '').substring(11, 19) || '--:--:--',
                    waitingTime: r.waitingTime || r.waitMinutes ? (r.waitMinutes + '分钟') : '--',
                    priority: r.priority || '普通',
                    status: r.status || 'waiting',
                };
            });
            renderQueue();
            return;
        }
    } catch (e) {
        console.warn('[排队详情] API 加载失败，使用降级数据:', e.message);
    }

    // 降级：使用本地数据
    currentQueueData = fallbackQueueData[deptName] || [];
    renderQueue();
}

// ===================== 渲染 =====================

function renderQueue() {
    var tbody = document.getElementById('queueTable');
    tbody.innerHTML = '';

    // 排序
    var priorityOrder = { '紧急': 0, '优先': 1, '普通': 2 };
    var statusOrder = { 'calling': 0, 'waiting': 1, 'completed': 2 };
    currentQueueData.sort(function (a, b) {
        if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
        return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    });

    currentQueueData.forEach(function (item, index) {
        var statusClass = item.status === 'waiting' ? 'warning' : (item.status === 'calling' ? 'danger' : 'normal');
        var statusText = item.status === 'waiting' ? '等待中' : (item.status === 'calling' ? '叫号中' : '已就诊');
        var priorityClass = item.priority === '优先' || item.priority === '紧急' ? 'danger' : 'normal';

        var row = document.createElement('tr');
        row.innerHTML =
            '<td>' + (index + 1) + '</td>' +
            '<td>' + item.name + '</td>' +
            '<td>' + (item.gender || '--') + '</td>' +
            '<td>' + (item.age ? item.age + '岁' : '--') + '</td>' +
            '<td>' + item.arrivalTime + '</td>' +
            '<td>' + item.waitingTime + '</td>' +
            '<td><span class="status-badge ' + priorityClass + '">' + item.priority + '</span></td>' +
            '<td><span class="status-badge ' + statusClass + '">' + statusText + '</span></td>' +
            '<td>' + (item.status !== 'completed' ? '<button class="btn-sm" onclick="callPatient(' + item.id + ')">叫号</button>' : '') + '</td>';
        tbody.appendChild(row);
    });

    document.getElementById('queueCount').textContent = '排队总人数：' + currentQueueData.length;
}

// ===================== 写操作 =====================

async function callPatient(id) {
    try {
        const res = await adminApi.callPatient(id);
        if (res.code === 200) {
            console.log('[排队详情] 已叫号:', id);
            // 更新本地状态
            var patient = currentQueueData.find(function (p) { return p.id === id; });
            if (patient) patient.status = 'calling';
            renderQueue();
        }
    } catch (e) {
        console.error('[排队详情] 叫号失败:', e.message);
        alert('叫号失败: ' + e.message);
    }
}

async function exportQueue() {
    var btn = event.target;
    btn.innerHTML = '导出中...';
    btn.disabled = true;
    try {
        const blob = await adminApi.exportQueueDetail(deptName);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = deptName + '_queue.csv';
        a.click();
        window.URL.revokeObjectURL(url);
        alert(deptName + '排队列表导出成功 ✅');
    } catch (e) {
        console.error('[排队详情] 导出失败:', e.message);
        alert('导出失败: ' + e.message);
    } finally {
        btn.innerHTML = '导出列表';
        btn.disabled = false;
    }
}

// ===================== 筛选/排序 =====================

function sortQueue() { loadQueueData(); }
function filterQueue() { loadQueueData(); }

function refreshQueue() {
    var btn = event.target;
    btn.innerHTML = '刷新中...';
    btn.disabled = true;
    loadQueueData().finally(function () {
        btn.innerHTML = '刷新';
        btn.disabled = false;
    });
}

function goBack() {
    window.location.href = 'dispatch.html';
}
