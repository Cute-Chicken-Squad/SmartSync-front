/**
 * 智环引诊 - API 配置与鉴权模块
 *
 * 架构说明：
 *   管理端 Admin API → 代理 /admin/api/* → http://20.196.218.72:10139
 *   业务端 Biz API    → 代理 /api/*       → http://20.196.218.72:10138
 *
 * 鉴权方式: Bearer Token (JWT)
 *   管理员 Token: POST /admin/api/auth/login
 *   终端 Token:   POST /api/auth/login
 *
 * 管理后台账号: admin / aaHeUasC+A6onVfID4/FeqDb
 */

// 后端连接开关 — 设为 true 断开后端，前端自动使用演示数据
const API_OFFLINE = false;

const API_CONFIG = {
    // 通过同源代理访问，避免 CORS
    admin: { baseURL: '/admin/api', timeout: 15000 },
    business: { baseURL: '/api', timeout: 15000 },
};

// ===================== Token 管理 =====================

const TokenStore = {
    _adminTokenKey: 'smartsync_admin_token',
    _adminUserKey: 'smartsync_admin_user',
    _bizTokenKey: 'smartsync_biz_token',
    _bizUserKey: 'smartsync_biz_user',

    // --- 管理员 Token ---
    getAdminToken() { return localStorage.getItem(this._adminTokenKey); },
    setAdminToken(token) { localStorage.setItem(this._adminTokenKey, token); },
    getAdminUser() {
        try { return JSON.parse(localStorage.getItem(this._adminUserKey)); } catch { return null; }
    },
    setAdminUser(user) { localStorage.setItem(this._adminUserKey, JSON.stringify(user)); },
    clearAdmin() {
        localStorage.removeItem(this._adminTokenKey);
        localStorage.removeItem(this._adminUserKey);
    },

    // --- 终端 Token ---
    getBizToken() { return localStorage.getItem(this._bizTokenKey); },
    setBizToken(token) { localStorage.setItem(this._bizTokenKey, token); },
    getBizUser() {
        try { return JSON.parse(localStorage.getItem(this._bizUserKey)); } catch { return null; }
    },
    setBizUser(user) { localStorage.setItem(this._bizUserKey, JSON.stringify(user)); },
    clearBiz() {
        localStorage.removeItem(this._bizTokenKey);
        localStorage.removeItem(this._bizUserKey);
    },

    // --- 患者 Token ---
    _patientTokenKey: 'smartsync_patient_token',
    _patientUserKey: 'smartsync_patient_user',
    getPatientToken() { return localStorage.getItem(this._patientTokenKey); },
    setPatientToken(token) { localStorage.setItem(this._patientTokenKey, token); },
    getPatientUser() {
        try { return JSON.parse(localStorage.getItem(this._patientUserKey)); } catch { return null; }
    },
    setPatientUser(user) { localStorage.setItem(this._patientUserKey, JSON.stringify(user)); },
    clearPatient() {
        localStorage.removeItem(this._patientTokenKey);
        localStorage.removeItem(this._patientUserKey);
    },

    // --- 全部清除 ---
    clearAll() { this.clearAdmin(); this.clearBiz(); this.clearPatient(); },
};

// ===================== 通用请求 =====================

/**
 * @param {'admin'|'business'} config
 * @param {string} endpoint  如 '/dashboard/kpi'
 * @param {object} [options] fetch 额外选项 (method, body, params, rawResponse)
 * @returns {Promise<{code:number, message:string, data:any}>}
 */
async function apiRequest(config, endpoint, options = {}) {
    // 断开后端连接 — 直接返回离线响应，触发前端降级逻辑
    if (API_OFFLINE) {
        console.log('[API] 离线模式 — 跳过请求: ' + endpoint);
        return { code: 599, message: '离线模式', data: null };
    }

    const { baseURL, timeout } = API_CONFIG[config];
    const url = `${baseURL}${endpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || timeout);

    // 获取对应 Token (patient 类型优先用患者 Token)
    const token = config === 'admin'
        ? TokenStore.getAdminToken()
        : (options._usePatientToken === false ? TokenStore.getBizToken()
            : (TokenStore.getPatientToken() || TokenStore.getBizToken()));

    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const fetchOptions = {
        ...options,
        signal: controller.signal,
        headers,
        // body 如果已经被外部设置就用外部的，否则根据 method 自动处理
    };

    // 处理 body
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
        fetchOptions.body = JSON.stringify(options.body);
    }

    try {
        const response = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);

        // 401 → 清除 token，触发重新登录
        if (response.status === 401) {
            if (config === 'admin') {
                TokenStore.clearAdmin();
                // 非登录接口才跳转
                if (!endpoint.includes('/auth/login')) {
                    if (typeof showLoginDialog === 'function') showLoginDialog();
                }
            } else {
                TokenStore.clearBiz();
            }
        }

        // 导出类接口直接返回 blob
        const ct = response.headers.get('Content-Type') || '';
        if (options.rawResponse) return response;
        if (ct.includes('text/csv') || ct.includes('application/octet-stream')) {
            return response.blob();
        }

        const data = await response.json();

        if (!response.ok) {
            const msg = data.message || `HTTP ${response.status}`;
            throw new Error(msg);
        }

        return data;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') throw new Error('请求超时，请检查网络');
        throw error;
    }
}

// ===================== 管理端 API (控制中心) =====================

const adminApi = {
    // Auth
    login(username, password) {
        return apiRequest('admin', '/auth/login', {
            method: 'POST',
            body: { username, password },
            headers: {}, // 不带 token
        });
    },
    getMe() {
        return apiRequest('admin', '/auth/me', { method: 'GET' });
    },

    // Dashboard
    getKpi() { return apiRequest('admin', '/dashboard/kpi'); },
    getDeptLoad() { return apiRequest('admin', '/dashboard/dept-load'); },
    getAlarms(limit) { return apiRequest('admin', '/dashboard/alarms' + (limit ? `?limit=${limit}` : '')); },
    getSourceDistribution() { return apiRequest('admin', '/dashboard/source-distribution'); },
    getTrafficTrend() { return apiRequest('admin', '/dashboard/traffic-trend'); },
    getSystemStatus() { return apiRequest('admin', '/dashboard/system-status'); },

    // Dispatch
    getDispatchDeptLoad() { return apiRequest('admin', '/dispatch/dept-load'); },
    getTaskPreemption() { return apiRequest('admin', '/dispatch/task-preemption'); },
    getSuggestions() { return apiRequest('admin', '/dispatch/suggestions'); },
    executeDispatch(data) { return apiRequest('admin', '/dispatch/execute', { method: 'POST', body: data }); },
    triageDept(deptName, patientCount) {
        const q = patientCount ? `?patientCount=${patientCount}` : '';
        return apiRequest('admin', `/dispatch/triage/${encodeURIComponent(deptName)}${q}`, { method: 'POST' });
    },
    exportDispatchReport() { return apiRequest('admin', '/dispatch/report', { rawResponse: true }); },

    // Emergency
    getEmergencyAlarms(params) {
        const q = params ? '?' + new URLSearchParams(params).toString() : '';
        return apiRequest('admin', '/emergency/alarms' + q);
    },
    getEmergencyRecords() { return apiRequest('admin', '/emergency/records'); },
    getAlarmDetail(alarmId) { return apiRequest('admin', `/emergency/alarm/${alarmId}`); },
    handleAlarm(alarmId, note) { return apiRequest('admin', `/emergency/alarm/${alarmId}`, { method: 'PUT', body: { handleNote: note } }); },
    ignoreAlarm(alarmId) { return apiRequest('admin', `/emergency/alarm/${alarmId}/ignore`, { method: 'PUT' }); },
    postponeAlarm(alarmId, until) { return apiRequest('admin', `/emergency/alarm/${alarmId}/postpone`, { method: 'PUT', body: { postponeUntil: until } }); },
    closeAlarm(alarmId) { return apiRequest('admin', `/emergency/alarm/${alarmId}/close`, { method: 'PUT' }); },
    broadcastEmergency(content) { return apiRequest('admin', '/emergency/broadcast', { method: 'POST', body: { content } }); },
    createMaintenance(alarmId, note) { return apiRequest('admin', `/emergency/alarm/${alarmId}/maintenance`, { method: 'POST', body: { note } }); },
    exportEmergencyRecords() { return apiRequest('admin', '/emergency/export', { rawResponse: true }); },

    // Analytics
    getMonthlyTrend() { return apiRequest('admin', '/analytics/monthly-trend'); },
    getDeptRanking(startDate, endDate) {
        let q = '';
        if (startDate) q += `startDate=${startDate}&`;
        if (endDate) q += `endDate=${endDate}`;
        return apiRequest('admin', '/analytics/dept-ranking' + (q ? '?' + q.replace(/&$/, '') : ''));
    },
    getSatisfaction() { return apiRequest('admin', '/analytics/satisfaction'); },
    getAnalyticsDetail(startDate, endDate) {
        let q = '';
        if (startDate) q += `startDate=${startDate}&`;
        if (endDate) q += `endDate=${endDate}`;
        return apiRequest('admin', '/analytics/detail' + (q ? '?' + q.replace(/&$/, '') : ''));
    },
    queryAnalytics(params) {
        const q = params ? '?' + new URLSearchParams(params).toString() : '';
        return apiRequest('admin', '/analytics/query' + q);
    },
    exportAnalytics(params) {
        const q = params ? '?' + new URLSearchParams(params).toString() : '';
        return apiRequest('admin', '/analytics/export' + q, { rawResponse: true });
    },

    // Admin User Management
    getAdminPage(params) {
        const q = params ? '?' + new URLSearchParams(params).toString() : '';
        return apiRequest('admin', '/admin/page' + q);
    },
    createAdmin(data) { return apiRequest('admin', '/admin', { method: 'POST', body: data }); },
    updateAdmin(id, data) { return apiRequest('admin', `/admin/${id}`, { method: 'PUT', body: data }); },
    updateAdminStatus(id, status) { return apiRequest('admin', `/admin/${id}/status?status=${status}`, { method: 'PUT' }); },
    deleteAdmin(id) { return apiRequest('admin', `/admin/${id}`, { method: 'DELETE' }); },

    // Terminal Management
    getTerminalPage(params) {
        const q = params ? '?' + new URLSearchParams(params).toString() : '';
        return apiRequest('admin', '/terminal/page' + q);
    },
    getTerminalDetail(id) { return apiRequest('admin', `/terminal/${id}`); },
    updateTerminalStatus(id, status) { return apiRequest('admin', `/terminal/${id}/status?status=${status}`, { method: 'PUT' }); },
    deleteTerminal(id) { return apiRequest('admin', `/terminal/${id}`, { method: 'DELETE' }); },

    // Settings
    getSettings() { return apiRequest('admin', '/settings'); },
    saveSettings(data) { return apiRequest('admin', '/settings', { method: 'PUT', body: data }); },
    resetSettings() { return apiRequest('admin', '/settings/defaults', { method: 'POST' }); },
    getSubstations(params) {
        const q = params ? '?' + new URLSearchParams(params).toString() : '';
        return apiRequest('admin', '/settings/substations' + q);
    },
    addSubstation(data) { return apiRequest('admin', '/settings/substations', { method: 'POST', body: data }); },
    restartSubstation(name) { return apiRequest('admin', `/settings/substations/${name}/restart`, { method: 'POST' }); },
    deleteSubstation(name) { return apiRequest('admin', `/settings/substations/${name}`, { method: 'DELETE' }); },
    backupNow() { return apiRequest('admin', '/settings/backup', { method: 'POST' }); },
    restoreBackup(backupId) { return apiRequest('admin', '/settings/backup/restore', { method: 'POST', body: { backupId } }); },

    // Dashboard 扩展 (2026-07)
    getHeatmap() { return apiRequest('admin', '/dashboard/heatmap'); },
    getDashboardNodes() { return apiRequest('admin', '/dashboard/nodes'); },
    getDeptDetail(deptId) { return apiRequest('admin', `/dashboard/dept-detail?deptId=${deptId}`); },

    // Digital Twin
    getDigitalTwinFloorPlan(floor) { return apiRequest('admin', `/digital-twin/floor-plan?floor=${floor}`); },
    getDigitalTwinPatientPositions() { return apiRequest('admin', '/digital-twin/patient-positions'); },

    // Tasks (2026-07)
    getTasksKpi() { return apiRequest('admin', '/tasks/kpi'); },
    getTasksList(params) {
        const q = params ? '?' + new URLSearchParams(params).toString() : '';
        return apiRequest('admin', '/tasks/list' + q);
    },
    getTaskDetail(taskId) { return apiRequest('admin', `/tasks/${taskId}`); },
    adjustTask(taskId, data) { return apiRequest('admin', `/tasks/${taskId}/adjust`, { method: 'PUT', body: data }); },
    updateTaskStatus(taskId, data) { return apiRequest('admin', `/tasks/${taskId}/status`, { method: 'PUT', body: data }); },
    getTaskEventLog() { return apiRequest('admin', '/tasks/event-log'); },

    // Queue (2026-07)
    getQueueDetail(params) {
        const q = params ? '?' + new URLSearchParams(params).toString() : '';
        return apiRequest('admin', '/dispatch/queue-detail' + q);
    },
    callPatient(patientId) { return apiRequest('admin', `/queue/call/${patientId}`, { method: 'POST' }); },
    exportQueueDetail(deptName) { return apiRequest('admin', `/dispatch/queue-detail/export?deptName=${encodeURIComponent(deptName)}`, { rawResponse: true }); },
};

// ===================== 业务端 API (患者客户端 / 子站终端) =====================

const businessApi = {
    // Auth
    terminalLogin(terminalCode, secretKey) {
        return apiRequest('business', '/auth/login', {
            method: 'POST', body: { terminalCode, secretKey }, headers: {},
        });
    },
    terminalRegister(terminalCode, terminalName, secretKey) {
        return apiRequest('business', '/auth/register', {
            method: 'POST', body: { terminalCode, terminalName, secretKey }, headers: {},
        });
    },
    /** 患者自助登录 (NFC ID + 手机号) */
    patientLogin(nfcId, phone) {
        return apiRequest('business', '/auth/patient-login', {
            method: 'POST', body: { nfcId, phone }, headers: {},
        });
    },

    // Health
    healthCheck() { return apiRequest('business', '/health'); },

    // Patient CRUD (终端 Token)
    createPatient(data) { return apiRequest('business', '/patient', { method: 'POST', body: data }); },
    updatePatient(id, data) { return apiRequest('business', `/patient/${id}`, { method: 'PUT', body: data }); },
    deletePatient(id) { return apiRequest('business', `/patient/${id}`, { method: 'DELETE' }); },
    getPatient(id) { return apiRequest('business', `/patient/${id}`); },
    getPatientPage(params) {
        const q = params ? '?' + new URLSearchParams(params).toString() : '';
        return apiRequest('business', '/patient/page' + q);
    },
    fetchPatientByRfid(rfid) { return apiRequest('business', '/patient/fetch-by-rfid', { method: 'POST', body: { rfid } }); },
    /** 患者自查询个人信息 */
    getPatientInfo() { return apiRequest('business', '/patient/info'); },
    /** 患者更新个人信息 */
    updatePatientInfo(data) { return apiRequest('business', '/patient/info', { method: 'PUT', body: data }); },
    /** 按身份证号查询患者 */
    queryPatientByIdCard(idCardNo) { return apiRequest('business', '/patient/query?idCardNo=' + encodeURIComponent(idCardNo)); },
    /** 患者消息 */
    getPatientMessages() { return apiRequest('business', '/patient/messages'); },

    // Visit (患者 Token)
    getVisitOverview(patientId) {
        const q = patientId ? '?patientId=' + patientId : '';
        return apiRequest('business', '/visit/overview' + q);
    },
    getVisitProgress(visitId) { return apiRequest('business', `/visit/progress?visitId=${visitId}`); },
    getCurrentTask(visitId) { return apiRequest('business', `/visit/current-task?visitId=${visitId}`); },
    getVisitTrace(visitId) { return apiRequest('business', `/visit/trace?visitId=${visitId}`); },
    getVisitReminder(patientId) {
        const q = patientId ? '?patientId=' + patientId : '';
        return apiRequest('business', '/visit/reminder' + q);
    },

    // Queue (患者 Token)
    getQueueStatus(dept, patientId) {
        const params = new URLSearchParams();
        if (dept) params.set('dept', dept);
        if (patientId) params.set('patientId', patientId);
        return apiRequest('business', '/queue/status?' + params.toString());
    },
    getQueueProgress(dept) { return apiRequest('business', `/queue/progress?dept=${encodeURIComponent(dept || '')}`); },

    // Reports (患者 Token)
    getReports(patientId) {
        const q = patientId ? '?patientId=' + patientId : '';
        return apiRequest('business', '/reports' + q);
    },
    getReportDetail(reportId) { return apiRequest('business', `/reports/${reportId}`); },
    downloadReport(reportId) { return apiRequest('business', `/reports/${reportId}/download`, { rawResponse: true }); },
    shareReport(reportId) { return apiRequest('business', `/reports/${reportId}/share`, { method: 'POST' }); },

    // Rating (患者 Token)
    submitRating(data) { return apiRequest('business', '/rating', { method: 'POST', body: data }); },

    // Emergency (患者 Token)
    sendEmergency(data) { return apiRequest('business', '/emergency', { method: 'POST', body: data }); },

    // Chat (患者 Token)
    sendChatMessage(data) { return apiRequest('business', '/chat/message', { method: 'POST', body: data }); },
    getQuickQuestions() { return apiRequest('business', '/chat/quick-questions'); },

    // Feedback
    submitFeedback(data) { return apiRequest('business', '/feedback', { method: 'POST', body: data }); },

    // Reminder Calendar
    getReminderCalendar(patientId, year, month) {
        const params = new URLSearchParams();
        if (patientId) params.set('patientId', patientId);
        if (year) params.set('year', year);
        if (month) params.set('month', month);
        return apiRequest('business', '/reminder/calendar?' + params.toString());
    },

    // NFC & Bracelet
    nfcDetect(nfcId) { return apiRequest('business', '/nfc/detect', { method: 'POST', body: { nfcId } }); },
    nfcBind(nfcId, patientId) { return apiRequest('business', '/nfc/bind', { method: 'POST', body: { nfcId, patientId } }); },
    nfcUnbind(braceletId) { return apiRequest('business', `/nfc/unbind/${braceletId}`, { method: 'POST' }); },
    returnBracelet(patientId) { return apiRequest('business', '/bracelet/return', { method: 'POST', body: { patientId } }); },
    getBraceletSummary() { return apiRequest('business', '/bracelet/summary'); },
    getBraceletRecords(params) {
        const q = params ? '?' + new URLSearchParams(params).toString() : '';
        return apiRequest('business', '/bracelet/records' + q);
    },

    // Navigation (患者 Token)
    getNavigation(from, to) { return apiRequest('business', `/navigation?from=${from}&to=${to}`); },
    startNavigation(data) { return apiRequest('business', '/navigation/start', { method: 'POST', body: data }); },
    arriveNavigation(data) { return apiRequest('business', '/navigation/arrive', { method: 'POST', body: data }); },
    getFloorPlan(floor) { return apiRequest('business', `/map/floor-plan?floor=${floor}`); },

    // Family (患者 Token)
    getFamilyList(patientId) {
        const q = patientId ? '?patientId=' + patientId : '';
        return apiRequest('business', '/family/list' + q);
    },
    bindFamily(data) { return apiRequest('business', '/family/bind', { method: 'POST', body: data }); },
    unbindFamily(familyId) { return apiRequest('business', `/family/unbind/${familyId}`, { method: 'DELETE' }); },
    getFamilyStatus(familyId) { return apiRequest('business', `/family/status?familyId=${familyId}`); },

    // Substation (终端 Token)
    substationDetect(stationId, nfcId) { return apiRequest('business', '/substation/detect', { method: 'POST', body: { stationId, nfcId } }); },
    substationTask(patientId) { return apiRequest('business', `/substation/task/${patientId}`); },
    substationVoice(stationId, voiceText) { return apiRequest('business', '/substation/voice', { method: 'POST', body: { stationId, voiceText } }); },
    substationStatus(stationId) { return apiRequest('business', `/substation/status/${stationId}`); },
    substationTaskConfirm(patientId, confirmed) { return apiRequest('business', '/substation/task/confirm', { method: 'PUT', body: { patientId, confirmed } }); },
};

// ===================== 登录对话框 =====================

function showLoginDialog(preMessage) {
    // 离线模式不弹登录窗
    if (API_OFFLINE) return;
    // 避免重复弹窗
    if (document.getElementById('loginOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'loginOverlay';
    overlay.style.cssText = `
        position:fixed;top:0;left:0;width:100%;height:100%;
        background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:99999;
    `;
    overlay.innerHTML = `
        <div style="background:#fff;border-radius:12px;padding:32px;width:380px;box-shadow:0 8px 40px rgba(0,0,0,0.2);">
            <h3 style="margin:0 0 8px;color:#2c3e50;">🔐 智环引诊 - 管理员登录</h3>
            ${preMessage ? `<p style="color:#e74c3c;font-size:13px;margin:0 0 16px;">${preMessage}</p>` : ''}
            <div id="loginError" style="display:none;color:#e74c3c;font-size:13px;margin-bottom:12px;padding:8px;background:#fdeaea;border-radius:6px;"></div>
            <label style="display:block;margin-bottom:4px;font-size:13px;color:#666;">账号</label>
            <input id="loginUsername" value="admin" style="width:100%;padding:10px;margin-bottom:12px;border:1px solid #ddd;border-radius:6px;font-size:14px;box-sizing:border-box;">
            <label style="display:block;margin-bottom:4px;font-size:13px;color:#666;">密码</label>
            <input id="loginPassword" type="password" value="aaHeUasC+A6onVfID4/FeqDb" style="width:100%;padding:10px;margin-bottom:20px;border:1px solid #ddd;border-radius:6px;font-size:14px;box-sizing:border-box;">
            <button id="loginSubmitBtn" style="width:100%;padding:12px;background:#4285f4;color:#fff;border:none;border-radius:6px;font-size:15px;cursor:pointer;">登 录</button>
            <p style="font-size:11px;color:#aaa;margin:12px 0 0;text-align:center;">管理端: ${API_CONFIG.admin.baseURL}</p>
        </div>
    `;
    document.body.appendChild(overlay);

    const errDiv = overlay.querySelector('#loginError');
    const btn = overlay.querySelector('#loginSubmitBtn');
    const usernameInput = overlay.querySelector('#loginUsername');
    const passwordInput = overlay.querySelector('#loginPassword');

    const doLogin = async () => {
        btn.disabled = true;
        btn.textContent = '登录中...';
        errDiv.style.display = 'none';
        try {
            const res = await adminApi.login(usernameInput.value, passwordInput.value);
            if (res.code === 200 && res.data && res.data.token) {
                TokenStore.setAdminToken(res.data.token);
                TokenStore.setAdminUser({
                    username: res.data.username,
                    displayName: res.data.displayName,
                });
                overlay.remove();
                console.log('[智环引诊] 管理员登录成功:', res.data.displayName);
                // 刷新当前页面数据
                if (typeof refreshAllData === 'function') refreshAllData();
                else location.reload();
            } else {
                throw new Error(res.message || '登录失败');
            }
        } catch (e) {
            errDiv.textContent = '❌ ' + (e.message || '登录失败，请检查网络');
            errDiv.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.textContent = '登 录';
        }
    };

    btn.addEventListener('click', doLogin);
    passwordInput.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
}

// ===================== 初始化 =====================

// 尝试用已存储的 token 验证身份
async function initAuth() {
    // 离线模式跳过登录
    if (API_OFFLINE) { console.log('[API] 离线模式 — 跳过登录验证'); return true; }

    const token = TokenStore.getAdminToken();
    if (!token) {
        console.log('[智环引诊] 未找到管理端 token，需要登录');
        return false;
    }
    try {
        const res = await adminApi.getMe();
        if (res.code === 200) {
            console.log('[智环引诊] Token 有效，已登录:', res.data?.displayName || res.data?.username);
            TokenStore.setAdminUser(res.data);
            return true;
        }
    } catch (e) {
        console.warn('[智环引诊] Token 验证失败:', e.message);
        TokenStore.clearAdmin();
    }
    return false;
}

console.log('[智环引诊] API 配置已加载');
console.log('  管理端:', API_CONFIG.admin.baseURL, '→ 10139');
console.log('  业务端:', API_CONFIG.business.baseURL, '→ 10138');
