/**
 * 智环引诊 - 系统设置
 * 对接后端: /admin/api/settings/*
 */

// ===================== 设置保存 =====================

async function saveSettings() {
    const btn = event?.target;
    if (!btn) return;
    btn.innerHTML = '保存中...';
    btn.disabled = true;

    // 收集表单中的设置项
    const items = [];
    const inputs = document.querySelectorAll('[data-setting-group]');
    inputs.forEach(input => {
        items.push({
            settingGroup: input.dataset.settingGroup,
            settingKey: input.dataset.settingKey || input.name,
            settingValue: input.type === 'checkbox' ? (input.checked ? '1' : '0') : input.value,
            description: input.dataset.description || '',
        });
    });

    // 如果没有 data-setting-group 属性，使用通用表单收集
    if (!items.length) {
        const formInputs = document.querySelectorAll('.settings-form input, .settings-form select, .settings-form textarea');
        formInputs.forEach((input, i) => {
            if (input.name) {
                items.push({
                    settingGroup: input.dataset.group || 'general',
                    settingKey: input.name,
                    settingValue: input.type === 'checkbox' ? (input.checked ? '1' : '0') : input.value,
                    description: input.placeholder || '',
                });
            }
        });
    }

    try {
        const res = await adminApi.saveSettings({ items });
        if (res.code === 200) {
            alert('设置已保存！');
        }
    } catch (e) {
        alert('保存失败: ' + e.message);
    } finally {
        btn.innerHTML = '保存设置';
        btn.disabled = false;
    }
}

// ===================== 恢复默认 =====================

async function restoreDefaults() {
    if (!confirm('确定要恢复默认设置吗？此操作将重置所有系统设置！')) return;
    const btn = event?.target;
    if (btn) { btn.innerHTML = '恢复中...'; btn.disabled = true; }
    try {
        await adminApi.resetSettings();
        alert('已恢复默认设置！');
        loadSettings();
    } catch (e) {
        alert('恢复失败: ' + e.message);
    } finally {
        if (btn) { btn.innerHTML = '恢复默认'; btn.disabled = false; }
    }
}

// ===================== 加载设置 =====================

async function loadSettings() {
    try {
        const res = await adminApi.getSettings();
        if (res.code === 200 && res.data) {
            renderSettings(res.data);
        }
    } catch (e) { console.error('[Settings]:', e); }
}

function renderSettings(data) {
    const groups = data.groups || [];
    const container = document.querySelector('.settings-content, .settings-form');
    if (!container || !groups.length) return;

    container.innerHTML = groups.map(g => `
        <div class="settings-group" style="margin-bottom:24px;">
            <h4 style="margin-bottom:12px;color:#2c3e50;">${escHtml(g.settingGroup)}</h4>
            ${(g.items || []).map(item => `
                <div class="setting-item" style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0f0;">
                    <div>
                        <label style="font-size:13px;font-weight:500;">${escHtml(item.settingKey)}</label>
                        <p style="font-size:11px;color:#868e96;margin:2px 0 0;">${escHtml(item.description || '')}</p>
                    </div>
                    <input type="text" value="${escHtml(item.settingValue || '')}"
                        data-setting-group="${escHtml(g.settingGroup)}"
                        data-setting-key="${escHtml(item.settingKey)}"
                        data-description="${escHtml(item.description || '')}"
                        style="width:300px;padding:8px;border:1px solid #ddd;border-radius:6px;font-size:13px;">
                </div>
            `).join('')}
        </div>
    `).join('');

    // 渲染备份列表
    if (data.backups && data.backups.length) {
        const backupSection = document.querySelector('.backup-list, .backup-section');
        if (backupSection) {
            backupSection.innerHTML = `
                <h4>备份历史</h4>
                <table class="data-table" style="width:100%;margin-top:12px;">
                    <thead><tr><th>ID</th><th>类型</th><th>大小</th><th>状态</th><th>时间</th><th>操作</th></tr></thead>
                    <tbody>
                        ${data.backups.map(b => `
                            <tr>
                                <td>${b.id}</td>
                                <td>${b.backupType || 'manual'}</td>
                                <td>${b.fileSize ? (b.fileSize/1024).toFixed(1)+'KB' : '--'}</td>
                                <td><span class="badge ${b.status === 'success' ? 'badge-success' : b.status === 'failed' ? 'badge-danger' : 'badge-warning'}">${b.status}</span></td>
                                <td>${b.createdAt || '--'}</td>
                                <td><button class="btn-sm" onclick="restoreBackupById(${b.id})">恢复</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }
    }
}

// ===================== 子站管理 =====================

async function loadSubstations() {
    try {
        const res = await adminApi.getSubstations({ current: 1, size: 50 });
        if (res.code === 200 && res.data) {
            const records = res.data.records || (Array.isArray(res.data) ? res.data : []);
            renderSubstations(records);
        }
    } catch (e) { console.error('[Settings] 子站:', e); }
}

function renderSubstations(substations) {
    const tbody = document.querySelector('.table-container .data-table tbody');
    if (!tbody || !substations.length) return;
    tbody.innerHTML = substations.map(s => `
        <tr>
            <td>${escHtml(s.terminalCode || '--')}</td>
            <td>${escHtml(s.terminalName || '--')}</td>
            <td><span class="badge ${s.status === 1 ? 'badge-success' : s.status === 0 ? 'badge-warning' : 'badge-danger'}">${s.status === 1 ? '启用' : s.status === 0 ? '待审核' : '禁用'}</span></td>
            <td>${s.createdAt ? s.createdAt.substring(0, 10) : '--'}</td>
            <td>
                <button class="btn-sm" onclick="restartSubstation('${escHtml(s.terminalCode)}')">重启</button>
                <button class="btn-sm" onclick="editSubstation('${escHtml(s.terminalCode)}')">编辑</button>
                <button class="btn-sm btn-danger" onclick="deleteSubstation('${escHtml(s.terminalCode)}')">删除</button>
            </td>
        </tr>
    `).join('');
}

async function addSubstation() {
    const code = prompt('终端编码:');
    if (!code) return;
    const name = prompt('终端名称:');
    const key = prompt('初始密钥 (8-128位):');
    if (!key) return;
    try {
        const res = await adminApi.addSubstation({ terminalCode: code, terminalName: name, secretKey: key, status: 1 });
        if (res.code === 200) {
            alert('子站添加成功！');
            loadSubstations();
        }
    } catch (e) { alert('添加失败: ' + e.message); }
}

async function restartSubstation(name) {
    if (!confirm(`确定要重启 ${name} 吗？`)) return;
    try {
        await adminApi.restartSubstation(name);
        alert(`${name} 重启指令已发送！`);
    } catch (e) { alert('重启失败: ' + e.message); }
}

function editSubstation(name) {
    alert(`编辑 ${name} - 功能开发中`);
}

async function deleteSubstation(name) {
    if (!confirm(`确定要删除 ${name} 吗？此操作不可恢复！`)) return;
    try {
        await adminApi.deleteSubstation(name);
        alert(`${name} 已删除！`);
        loadSubstations();
    } catch (e) { alert('删除失败: ' + e.message); }
}

// ===================== 备份 =====================

async function backupNow() {
    const btn = event?.target;
    if (btn) { btn.innerHTML = '备份中...'; btn.disabled = true; }
    try {
        await adminApi.backupNow();
        alert('备份成功！');
        loadSettings();
    } catch (e) {
        alert('备份失败: ' + e.message);
    } finally {
        if (btn) { btn.innerHTML = '立即备份'; btn.disabled = false; }
    }
}

async function restoreBackup() {
    const backupId = prompt('请输入要恢复的备份 ID:');
    if (!backupId) return;
    if (!confirm('确定要恢复备份吗？这将覆盖当前数据！恢复后请重新登录。')) return;
    try {
        await adminApi.restoreBackup(Number(backupId));
        alert('备份恢复成功！请重新登录。');
        TokenStore.clearAdmin();
        location.reload();
    } catch (e) { alert('恢复失败: ' + e.message); }
}

async function restoreBackupById(backupId) {
    if (!confirm(`确定要恢复到备份 #${backupId} 吗？这将覆盖当前数据！`)) return;
    try {
        await adminApi.restoreBackup(backupId);
        alert('备份恢复成功！请重新登录。');
        TokenStore.clearAdmin();
        location.reload();
    } catch (e) { alert('恢复失败: ' + e.message); }
}

// ===================== 辅助 =====================

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
            if (!document.getElementById('loginOverlay')) { observer.disconnect(); loadSettings(); loadSubstations(); }
        });
        observer.observe(document.body, { childList: true });
        return;
    }

    loadSettings();
    loadSubstations();

    // 绑定保存/恢复按钮
    const saveBtn = document.querySelector('.btn.success');
    if (saveBtn) saveBtn.addEventListener('click', saveSettings);
    const restoreBtn = document.querySelector('.btn.danger');
    if (restoreBtn) restoreBtn.addEventListener('click', restoreDefaults);

    // 绑定添加子站按钮
    const addBtn = document.querySelector('.table-container + .btn');
    if (addBtn) addBtn.addEventListener('click', addSubstation);
});
