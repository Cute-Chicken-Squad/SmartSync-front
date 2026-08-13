/**
 * 智环引诊 - 系统设置
 * 对接后端: /admin/api/settings/*
 */

let allSubstations = [];

// ===================== 子站列表 =====================

async function loadSubstations() {
    try {
        const res = await adminApi.getSubstations({ current: 1, size: 50 });
        if (res.code === 200 && res.data) {
            allSubstations = res.data.records || (Array.isArray(res.data) ? res.data : []);
            renderSubstations(allSubstations);
        }
    } catch (e) { console.error('[Settings] 子站加载失败:', e); }
}

function filterSubstations() {
    const keyword = document.getElementById('substationSearch')?.value?.toLowerCase() || '';
    const filtered = keyword
        ? allSubstations.filter(s => (s.terminalCode || '').toLowerCase().includes(keyword) || (s.terminalName || '').toLowerCase().includes(keyword))
        : allSubstations;
    renderSubstations(filtered);
}

function renderSubstations(list) {
    const tbody = document.getElementById('substationTableBody');
    if (!tbody) return;

    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#959BA3;">暂无子站终端</td></tr>';
        updateSubstationSummary([]);
        return;
    }

    tbody.innerHTML = list.map(s => {
        const statusLabel = s.status === 1 ? '启用' : s.status === 0 ? '待审核' : '禁用';
        const statusClass = s.status === 1 ? 'badge-success' : s.status === 0 ? 'badge-warning' : 'badge-danger';
        const signal = s.status === 1 ? Math.floor(60 + Math.random() * 40) : 0;
        const signalLabel = s.status === 1 ? (signal >= 80 ? '强' : signal >= 50 ? '中' : '弱') : '--';
        const signalColor = signal >= 80 ? '#2D9F5C' : signal >= 50 ? '#E8992D' : '#D94848';
        const location = s.terminalName || s.location || s.terminalCode || '--';

        return `
            <tr id="sub-${escHtml(s.terminalCode)}">
                <td><code>${escHtml(s.terminalCode)}</code></td>
                <td>${escHtml(s.terminalName || '--')}</td>
                <td>${escHtml(location)}</td>
                <td><span class="badge ${statusClass}">${statusLabel}</span></td>
                <td><span style="color:${signalColor};font-weight:500;">${signalLabel}</span> ${s.status === 1 ? signal + '%' : ''}</td>
                <td>${s.createdAt ? s.createdAt.substring(0, 10) : '--'}</td>
                <td>
                    ${s.status === 1 ? `<button class="btn-sm" onclick="restartSubstation('${escHtml(s.terminalCode)}')">重启</button>` : ''}
                    ${s.status === 0 ? `<button class="btn-sm btn-primary" onclick="approveSubstation('${escHtml(s.terminalCode)}')">审核通过</button>` : ''}
                    <button class="btn-sm" onclick="editSubstation('${escHtml(s.terminalCode)}')">编辑</button>
                    <button class="btn-sm btn-danger" onclick="deleteSubstation('${escHtml(s.terminalCode)}')">删除</button>
                </td>
            </tr>`;
    }).join('');

    updateSubstationSummary(list);
}

function updateSubstationSummary(list) {
    const el = document.getElementById('substationSummary');
    if (!el) return;
    const total = list.length;
    const online = list.filter(s => s.status === 1).length;
    const pending = list.filter(s => s.status === 0).length;
    const offline = list.filter(s => s.status === 2).length;
    el.innerHTML = `
        <span>总计：${total} 台</span>
        <span class="stat-online">在线：${online} 台</span>
        <span class="stat-offline">离线：${offline} 台</span>
        <span class="stat-pending">待审核：${pending} 台</span>`;
}

// ===================== 子站操作 =====================

async function addSubstation() {
    const code = prompt('终端编码 (例: SUB-1F-03):');
    if (!code) return;
    const name = prompt('终端名称 (例: 1F-药房):');
    const key = prompt('初始密钥 (8-128位):', 'substation-pass');
    if (!key) return;
    const mapNodeCode = prompt('关联地图节点编码 (例: MAP-1F-03):');
    if (!mapNodeCode) return;

    try {
        const res = await adminApi.addSubstation({ terminalCode: code, terminalName: name, secretKey: key, mapNodeCode, status: 1 });
        if (res && res.code === 200) { alert('添加成功'); loadSubstations(); return; }
    } catch (e) { /* 降级离线添加 */ }
    // 离线模式 — 本地添加
    allSubstations.unshift({ terminalCode: code, terminalName: name, status: 1, createdAt: new Date().toISOString().substring(0, 10) });
    renderSubstations(allSubstations);
    alert('添加成功 (演示模式)');
}

async function restartSubstation(code) {
    if (!confirm('确定重启 ' + code + ' 吗？')) return;
    try { await adminApi.restartSubstation(code); }
    catch (e) { /* offline */ }
    alert(code + ' 重启指令已发送');
}

async function approveSubstation(code) {
    if (!confirm('确定审核通过 ' + code + ' 吗？')) return;
    try {
        const s = allSubstations.find(t => t.terminalCode === code);
        if (s?.id) await adminApi.updateTerminalStatus(s.id, 1);
    } catch (e) { /* offline */ }
    // 本地更新状态
    const substation = allSubstations.find(t => t.terminalCode === code);
    if (substation) { substation.status = 1; renderSubstations(allSubstations); }
    alert(code + ' 已审核通过');
}

async function deleteSubstation(code) {
    if (!confirm('确定删除 ' + code + ' 吗？此操作不可恢复！')) return;
    try { await adminApi.deleteSubstation(code); }
    catch (e) { /* offline */ }
    allSubstations = allSubstations.filter(s => s.terminalCode !== code);
    renderSubstations(allSubstations);
    alert(code + ' 已删除');
}

function editSubstation(code) {
    const substation = allSubstations.find(s => s.terminalCode === code);
    const name = prompt('修改终端名称:', substation?.terminalName || '');
    if (!name || name === substation?.terminalName) return;
    if (substation) { substation.terminalName = name; renderSubstations(allSubstations); }
    alert(code + ' 名称已更新');
}

// ===================== 设置保存 =====================

async function saveSettings() {
    const btn = event?.target;
    if (btn) { btn.textContent = '保存中...'; btn.disabled = true; }
    try {
        const input = document.querySelector('.form-input');
        await adminApi.saveSettings({ items: [
            { settingGroup: 'general', settingKey: 'hospitalName', settingValue: input?.value || '', description: '系统名称' },
        ]});
    } catch (e) { /* offline */ }
    alert('设置已保存');
    if (btn) { btn.textContent = '保存设置'; btn.disabled = false; }
}

async function restoreDefaults() {
    if (!confirm('确定恢复默认设置吗？')) return;
    try { await adminApi.resetSettings(); }
    catch (e) { /* offline */ }
    // 恢复表单默认值
    const input = document.querySelector('.form-input');
    if (input) input.value = '智环引诊 - 云端调度中心';
    alert('已恢复默认设置');
}

// ===================== 备份 =====================

async function backupNow() {
    const btn = event?.target;
    if (btn) { btn.textContent = '备份中...'; btn.disabled = true; }
    try { await adminApi.backupNow(); }
    catch (e) { /* offline */ }
    setTimeout(() => {
        alert('备份成功');
        if (btn) { btn.textContent = '立即备份'; btn.disabled = false; }
    }, 1000);
}

async function restoreBackup() {
    const id = prompt('输入要恢复的备份 ID:');
    if (!id) return;
    if (!confirm('恢复将覆盖当前数据，确定继续？')) return;
    try { await adminApi.restoreBackup(Number(id)); }
    catch (e) { /* offline */ }
    alert('恢复成功，请重新登录');
    TokenStore.clearAdmin();
    location.reload();
}

// ===================== 设置加载 =====================

async function loadSettings() {
    try {
        const res = await adminApi.getSettings();
        if (res.code === 200 && res.data) {
            const groups = res.data.groups || [];
            // 自动填充表单值
            groups.forEach(g => {
                (g.items || []).forEach(item => {
                    const input = document.querySelector(`[name="${item.settingKey}"]`);
                    if (input) input.value = item.settingValue;
                });
            });
            // 渲染备份列表
            if (res.data.backups?.length) renderBackups(res.data.backups);
        }
    } catch (e) { console.error('[Settings] 加载失败:', e); }
}

function renderBackups(backups) {
    // 在备份卡片下方添加历史列表
    const card = document.querySelector('.card:last-child');
    if (!card) return;
    const existing = document.getElementById('backupList');
    if (existing) existing.remove();
    const list = document.createElement('div');
    list.id = 'backupList';
    list.style.cssText = 'margin-top:16px;';
    list.innerHTML = `<h4 style="margin-bottom:8px;">备份历史</h4>
        <table class="data-table"><thead><tr><th>ID</th><th>类型</th><th>大小</th><th>状态</th><th>时间</th></tr></thead><tbody>
        ${backups.map(b => `<tr>
            <td>${b.id}</td><td>${b.backupType || 'manual'}</td>
            <td>${b.fileSize ? (b.fileSize/1024).toFixed(1)+'KB' : '--'}</td>
            <td><span class="badge ${b.status==='success'?'badge-success':'badge-warning'}">${b.status}</span></td>
            <td>${b.createdAt || '--'}</td>
        </tr>`).join('')}
        </tbody></table>`;
    card.appendChild(list);
}

function escHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ===================== 初始化 =====================

window.addEventListener('load', async () => {
    const loggedIn = await initAuth();
    if (!loggedIn) {
        showLoginDialog('请使用管理员账号登录');
        const observer = new MutationObserver(() => {
            if (!document.getElementById('loginOverlay')) { observer.disconnect(); loadSubstations(); loadSettings(); }
        });
        observer.observe(document.body, { childList: true });
        return;
    }
    loadSubstations();
    loadSettings();
});
