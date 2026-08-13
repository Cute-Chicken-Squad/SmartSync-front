/**
 * 智环引诊 - 警报列表页面
 * 对接后端: /admin/api/emergency/alarms
 * 写操作: handleAlarm, ignoreAlarm, exportEmergencyRecords
 */

// ===================== 页面初始化 =====================

document.addEventListener('DOMContentLoaded', async function () {
    console.log('[警报列表] 页面就绪, adminApi=', typeof adminApi, ', getEmergencyAlarms=', typeof (adminApi && adminApi.getEmergencyAlarms));

    // 时钟
    setInterval(function () {
        var date = new Date();
        var timeString = formatLocalDateTime(date);
        document.getElementById('dateInfo').textContent = timeString;
    }, 1000);

    // ★ 确保认证后再加载数据（写操作需要有效 token 才能持久化到后端数据库）
    await ensureAuth();
    await loadAlarms();
    console.log('[警报列表] 初始加载完成');
});

// ===================== 数据加载 =====================

/**
 * 警报排序 —— 全量警报按 状态优先级 → 等级↓ → 时间↓
 *
 * 排序规则：
 *   1. status 优先级: pending > processing > postponed > closed/completed > ignored
 *   2. level   DESC (5→1)
 *   3. createdAt DESC (同组最新在前)
 */
function sortAllAlarms(alarms) {
    var STATUS_ORDER = { pending: 0, processing: 1, postponed: 2, closed: 3, completed: 3, ignored: 4 };
    return alarms.sort(function(a, b) {
        var sa = STATUS_ORDER[a.status] ?? 9, sb = STATUS_ORDER[b.status] ?? 9;
        if (sa !== sb) return sa - sb;                          // status priority
        var la = a.level || 0, lb = b.level || 0;
        if (la !== lb) return lb - la;                          // level DESC
        return (b.createdAt || '').localeCompare(a.createdAt || ''); // time DESC
    });
}

async function loadAlarms() {
    var countEl = document.getElementById('alarmCount');
    var tbody = document.getElementById('alarmTableBody');
    try {
        var filterSelects = document.querySelectorAll('.filter-bar .filter-select');
        var statusFilter = (filterSelects[0] || {}).value || 'all';
        var levelFilter = (filterSelects[1] || {}).value || 'all';
        var timeFilter = (filterSelects[2] || {}).value || 'today';

        console.log('[警报列表] 筛选条件:', {status:statusFilter, level:levelFilter, time:timeFilter});

        var params = { current: 1, size: 200 };
        if (statusFilter !== 'all') params.status = statusFilter;
        if (levelFilter !== 'all') params.level = parseInt(levelFilter);

        console.log('[警报列表] 调用 API...');
        var res = await adminApi.getEmergencyAlarms(params);
        console.log('[警报列表] API 返回: code=' + (res ? res.code : 'N/A') + ', hasData=' + !!(res && res.data));

        if (res && res.code === 200 && res.data) {
            var records = res.data.records || [];
            console.log('[警报列表] 原始记录数:', records.length);

            // 客户端补充筛选（后端可能不支持 level/time 过滤）
            if (levelFilter !== 'all') {
                records = records.filter(function(r) { return r.level === parseInt(levelFilter); });
                console.log('[警报列表] 按等级筛选后:', records.length);
            }
            if (timeFilter === 'today') {
                var today = new Date().toISOString().split('T')[0];
                console.log('[警报列表] 今日:', today);
                records = records.filter(function(r) {
                    return (r.createdAt || '').substring(0, 10) === today;
                });
                console.log('[警报列表] 按今日筛选后:', records.length);
            } else if (timeFilter === 'week') {
                var weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
                records = records.filter(function(r) {
                    return (r.createdAt || '') >= weekAgo;
                });
                console.log('[警报列表] 按本周筛选后:', records.length);
            }

            // ★ 智能排序: 状态优先级 → 等级↓ → 时间↓
            records = sortAllAlarms(records);

            if (countEl) countEl.textContent = '共 ' + records.length + ' 条记录';
            renderAlarmTable(records);
        } else {
            console.warn('[警报列表] API 返回异常:', res);
            if (countEl) countEl.textContent = '无数据';
            if (tbody) tbody.innerHTML = '<tr><td colspan="12" style="padding:30px;text-align:center;color:#f44336;">API 返回异常: code=' + (res ? res.code : 'N/A') + '</td></tr>';
        }
    } catch (e) {
        console.error('[警报列表] 加载异常:', e.message, e.stack);
        if (countEl) countEl.textContent = '加载失败';
        if (tbody) tbody.innerHTML = '<tr><td colspan="12" style="padding:20px;text-align:center;color:#f44336;">数据加载失败: ' + e.message + '</td></tr>';
    }
}

// ===================== 渲染 =====================

var levelMap = {
    5: { text: '特急', cls: 'danger' },
    4: { text: '紧急', cls: 'danger' },
    3: { text: '中等', cls: 'warning' },
    2: { text: '一般', cls: 'warning' },
    1: { text: '低', cls: 'normal' },
};

var statusMap = {
    pending: { text: '待处理', cls: 'warning' },
    processing: { text: '处理中', cls: 'danger' },
    completed: { text: '已完成', cls: 'normal' },
    closed: { text: '已关闭', cls: 'normal' },
    ignored: { text: '已忽略', cls: 'normal' },
    postponed: { text: '已延后', cls: 'normal' },
};

var typeLabels = {
    '紧急急救': '紧急急救', '生命体征异常': '体征异常', '排队超时': '排队超时',
    '轮椅需求': '轮椅协助', '设备维护': '设备维护', '患者摔倒': '患者摔倒',
    '导引迷路': '导引服务', '情绪激动': '情绪安抚',
    '手环故障': '手环故障', '广播通知': '广播通知',
    'emergency': '紧急急救', 'wheelchair': '轮椅协助', 'vital': '体征异常',
    'maintenance': '设备维护', 'fall': '患者摔倒', 'queue': '排队超时',
    'broadcast': '广播通知',
};

function renderAlarmTable(records) {
    var tbody = document.getElementById('alarmTableBody');
    if (!tbody) { console.error('[警报列表] 找不到 alarmTableBody 元素'); return; }

    if (!records || records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" style="padding:30px;text-align:center;color:#999;">暂无匹配的警报记录</td></tr>';
        return;
    }

    console.log('[警报列表] 正在渲染 ' + records.length + ' 条记录...');

    var rowsHtml = records.map(function (a) {
        var lv = levelMap[a.level] || levelMap[3];
        var st = statusMap[a.status] || statusMap.pending;
        var timeStr = escHtml((a.createdAt || a.alarmTime || '').substring(11, 19) || '--:--:--');
        var fullTime = escHtml((a.createdAt || a.alarmTime || '').substring(0, 19) || '--');
        var handleTimeStr = escHtml((a.handledAt || '').substring(11, 19) || '--:--:--');
        var alarmCode = escHtml(a.alarmCode || ('ALM-' + a.id));
        var typeLabel = escHtml(typeLabels[a.type] || a.type || '--');
        var patientName = escHtml(a.patientName || '--');
        var terminal = escHtml(a.terminalName || '--');
        var handler = escHtml(a.handlerName || '--');
        var location = escHtml(a.location || '--');
        var desc = escHtml(a.description || a.alarmDesc || '--');
        var descShort = desc.length > 24 ? desc.substring(0, 24) + '…' : desc;
        var locShort = location.length > 10 ? location.substring(0, 10) + '…' : location;

        var actions = '<button class="btn-sm" onclick="viewAlarmDetail(\'' + a.id + '\')">查看</button>';
        if (a.status === 'pending') {
            actions += ' <button class="btn-sm" style="background:#4caf50;color:#fff;" onclick="handleAlarm(\'' + a.id + '\')">处理</button>';
            actions += ' <button class="btn-sm" style="background:#999;color:#fff;" onclick="ignoreAlarm(\'' + a.id + '\')">忽略</button>';
        } else if (a.status === 'processing') {
            actions += ' <button class="btn-sm" style="background:#ff9800;color:#fff;" onclick="handleAlarm(\'' + a.id + '\')">完成</button>';
        }

        return '<tr style="border-bottom:1px solid #f0f0f0;">' +
            '<td style="padding:8px 6px;font-size:11px;font-family:monospace;color:#666;" title="' + alarmCode + '">' + alarmCode + '</td>' +
            '<td style="padding:8px 6px;font-size:12px;" title="' + fullTime + '">' + timeStr + '</td>' +
            '<td style="padding:8px 6px;font-size:12px;" title="' + location + '">' + locShort + '</td>' +
            '<td style="padding:8px 6px;font-size:12px;">' + patientName + '</td>' +
            '<td style="padding:8px 6px;font-size:12px;" title="' + desc + '">' + descShort + '</td>' +
            '<td style="padding:8px 6px;font-size:12px;">' + typeLabel + '</td>' +
            '<td style="padding:8px 6px;"><span class="status-badge ' + lv.cls + '">' + lv.text + '</span></td>' +
            '<td style="padding:8px 6px;font-size:11px;color:#666;">' + terminal + '</td>' +
            '<td style="padding:8px 6px;"><span class="status-badge ' + st.cls + '">' + st.text + '</span></td>' +
            '<td style="padding:8px 6px;font-size:12px;">' + handler + '</td>' +
            '<td style="padding:8px 6px;font-size:11px;color:#666;">' + handleTimeStr + '</td>' +
            '<td style="padding:8px 4px;white-space:nowrap;">' + actions + '</td>' +
            '</tr>';
    }).join('');

    tbody.innerHTML = rowsHtml;
    console.log('[警报列表] 渲染完成, ' + records.length + ' 行');
}

// HTML 转义，防止 XSS
function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===================== 写操作 =====================

async function handleAlarm(id) {
    var btn = event.target;
    btn.innerHTML = '...';
    btn.disabled = true;
    try {
        // 一步完成: 接单 + 关闭 = 直接已处理
        var res = await adminApi.handleAlarm(id, '警报列表快速处理');
        if (res.code === 200) {
            await adminApi.closeAlarm(id);
        }
        // 更新该行：状态=已完成，移除处理/忽略按钮
        var row = btn.closest('tr');
        if (row) {
            var statusCell = row.children[8];
            if (statusCell) statusCell.innerHTML = '<span class="status-badge normal">已完成</span>';
            var handlerCell = row.children[9];
            if (handlerCell) handlerCell.textContent = '值班管理员';
            var timeCell = row.children[10];
            if (timeCell) timeCell.textContent = new Date().toISOString().replace('T',' ').substring(11,19);
            var actionCell = row.children[11];
            if (actionCell) actionCell.innerHTML = '<button class="btn-sm" onclick="viewAlarmDetail(\'' + id + '\')">查看</button>';
        }
        console.log('[警报列表] 已处理:', id);
        updateAlarmCount();
    } catch (e) {
        console.error('[警报列表] 处理失败:', e.message);
        alert('处理失败: ' + e.message);
        btn.innerHTML = '处理';
        btn.disabled = false;
    }
}

async function completeAlarm(id) {
    var btn = event.target;
    btn.innerHTML = '...';
    btn.disabled = true;
    try {
        var res = await adminApi.closeAlarm(id);
        if (res.code === 200) {
            var row = btn.closest('tr');
            if (row) {
                var statusCell = row.children[8];
                if (statusCell) statusCell.innerHTML = '<span class="status-badge normal">已完成</span>';
                var timeCell = row.children[10];
                if (timeCell) timeCell.textContent = new Date().toISOString().replace('T',' ').substring(11,19);
                var actionCell = row.children[11];
                if (actionCell) actionCell.innerHTML = '<button class="btn-sm" onclick="viewAlarmDetail(\'' + id + '\')">查看</button>';
            }
            console.log('[警报列表] 已完成:', id);
            updateAlarmCount();
        }
    } catch (e) {
        console.error('[警报列表] 完成失败:', e.message);
        alert('完成失败: ' + e.message);
        btn.innerHTML = '完成';
        btn.disabled = false;
    }
}

async function ignoreAlarm(id) {
    var btn = event.target;
    btn.innerHTML = '...';
    btn.disabled = true;
    try {
        var res = await adminApi.ignoreAlarm(id);
        if (res.code === 200) {
            // 立即更新该行的状态
            var row = btn.closest('tr');
            if (row) {
                var statusCell = row.children[8];
                if (statusCell) statusCell.innerHTML = '<span class="status-badge normal">已忽略</span>';
                var timeCell = row.children[10];
                if (timeCell) timeCell.textContent = new Date().toISOString().replace('T',' ').substring(11,19);
                var actionCell = row.children[11];
                if (actionCell) actionCell.innerHTML = '<button class="btn-sm" onclick="viewAlarmDetail(\'' + id + '\')">查看</button>';
            }
            console.log('[警报列表] 已忽略:', id);
            updateAlarmCount();
        }
    } catch (e) {
        console.error('[警报列表] 忽略失败:', e.message);
        alert('忽略失败: ' + e.message);
        btn.innerHTML = '忽略';
        btn.disabled = false;
    }
}

async function exportAlarms(evt) {
    var btn = (evt && evt.target) || document.querySelector('#exportAlarmsBtn');
    if (!btn) { console.error('[告警] 导出按钮未找到'); return; }
    btn.innerHTML = '导出中...';
    btn.disabled = true;
    try {
        var result = await adminApi.exportEmergencyRecords();
        var blob = result instanceof Blob ? result : (result instanceof Response ? await result.blob() : new Blob([JSON.stringify(result)], { type: 'text/csv' }));
        var url = window.URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'alarm_records.csv';
        a.click();
        window.URL.revokeObjectURL(url);
        alert('警报记录导出成功');
    } catch (e) {
        console.error('[警报列表] 导出失败:', e.message);
        alert('导出失败: ' + e.message);
    } finally {
        btn.innerHTML = '导出记录';
        btn.disabled = false;
    }
}

function viewAlarmDetail(id) {
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

function updateAlarmCount() {
    var el = document.getElementById('alarmCount');
    if (!el) return;
    var tbody = document.getElementById('alarmTableBody');
    var rows = tbody ? tbody.querySelectorAll('tr') : [];
    el.textContent = '共 ' + rows.length + ' 条记录';
}
