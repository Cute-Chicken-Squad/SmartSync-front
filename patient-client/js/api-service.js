/**
 * 智环引诊 - 患者客户端 API 服务
 *
 * 使用业务端 API (8080/10138)，需要终端 Token
 * 鉴权流程: NFC手环感应 → RFID查询患者 → 获取患者信息
 * 未实现的接口自动降级为本地 mock 数据
 */

// ===================== 患者会话管理 =====================

const PatientSession = {
    _key: 'smartsync_patient_session',

    get() {
        try { return JSON.parse(localStorage.getItem(this._key)); } catch { return null; }
    },
    set(data) {
        const session = { ...this.get(), ...data, _updated: Date.now() };
        localStorage.setItem(this._key, JSON.stringify(session));
        return session;
    },
    clear() { localStorage.removeItem(this._key); },

    getPatientId() { return this.get()?.patientId; },
    getVisitId() { return this.get()?.visitId; },
    getRfid() { return this.get()?.rfid; },
    isLoggedIn() { return !!(this.get()?.patientId); },
};

// ===================== 终端认证（客户端需要终端 Token 才能调业务 API） =====================

async function ensureTerminalToken() {
    let token = TokenStore.getBizToken();
    if (token) return token;

    // 尝试用默认终端凭证登录
    try {
        const res = await businessApi.terminalLogin('CLIENT-H5', 'client-h5-pass');
        if (res.code === 200 && res.data?.token) {
            TokenStore.setBizToken(res.data.token);
            TokenStore.setBizUser({ terminalCode: res.data.terminalCode });
            console.log('[Patient] 终端自动登录成功');
            return res.data.token;
        }
    } catch (e) {
        console.warn('[Patient] 终端自动登录失败:', e.message);
    }

    // 尝试注册 + 登录
    try {
        await businessApi.terminalRegister('CLIENT-H5', 'H5患者客户端', 'client-h5-pass');
        const res = await businessApi.terminalLogin('CLIENT-H5', 'client-h5-pass');
        if (res.code === 200 && res.data?.token) {
            TokenStore.setBizToken(res.data.token);
            console.log('[Patient] 终端注册并登录成功');
            return res.data.token;
        }
    } catch (e) {
        console.warn('[Patient] 终端注册失败:', e.message);
    }

    return null;
}

// ===================== 患者 API 服务 =====================

const PatientService = {

    // ---- 患者信息 ----

    /** 按 RFID 查询患者（NFC 手环感应） */
    async fetchByRfid(rfid) {
        await ensureTerminalToken();
        try {
            const res = await businessApi.fetchPatientByRfid(rfid);
            if (res.code === 200 && res.data) {
                PatientSession.set({
                    patientId: res.data.id,
                    rfid: rfid,
                    patientName: res.data.name,
                });
                return res.data;
            }
        } catch (e) { console.warn('[Patient] RFID查询失败:', e.message); }
        return null;
    },

    /** 按患者 ID 获取详情 */
    async getPatient(patientId) {
        await ensureTerminalToken();
        try {
            const res = await businessApi.getPatient(patientId || PatientSession.getPatientId());
            if (res.code === 200 && res.data) return res.data;
        } catch (e) { console.warn('[Patient] 患者信息获取失败:', e.message); }
        return null;
    },

    /** 分页查询患者 */
    async queryPatients(params) {
        await ensureTerminalToken();
        try {
            const res = await businessApi.getPatientPage(params);
            if (res.code === 200 && res.data) return res.data;
        } catch (e) { console.warn('[Patient] 患者查询失败:', e.message); }
        return null;
    },

    /** 创建患者档案 */
    async createPatient(data) {
        await ensureTerminalToken();
        try {
            const res = await businessApi.createPatient(data);
            if (res.code === 200) {
                PatientSession.set({ patientId: res.data, patientName: data.name });
                return res.data;
            }
        } catch (e) { console.warn('[Patient] 创建患者失败:', e.message); }
        return null;
    },

    // ---- 就诊数据（部分接口后端暂未实现，降级为 mock） ----

    /** 获取就诊概览 */
    async getVisitOverview(visitId) {
        try {
            const res = await apiRequest('business', `/visit/overview?visitId=${visitId || PatientSession.getVisitId() || 1}`, { method: 'GET' });
            if (res.code === 200 && res.data) return res.data;
        } catch (e) { /* 接口未实现，使用 mock */ }
        return null;
    },

    /** 获取就诊进度 */
    async getVisitProgress(visitId) {
        try {
            const res = await apiRequest('business', `/visit/progress?visitId=${visitId || PatientSession.getVisitId() || 1}`, { method: 'GET' });
            if (res.code === 200 && res.data) return res.data;
        } catch (e) { /* 接口未实现 */ }
        return null;
    },

    /** 获取排队状态 */
    async getQueueStatus(dept, patientId) {
        try {
            const res = await apiRequest('business', `/queue/status?dept=${encodeURIComponent(dept || '')}&patientId=${patientId || PatientSession.getPatientId() || ''}`, { method: 'GET' });
            if (res.code === 200 && res.data) return res.data;
        } catch (e) { /* 接口未实现 */ }
        return null;
    },

    /** 获取复诊提醒 */
    async getReminder(patientId) {
        try {
            const res = await apiRequest('business', `/visit/reminder?patientId=${patientId || PatientSession.getPatientId() || ''}`, { method: 'GET' });
            if (res.code === 200 && res.data) return res.data;
        } catch (e) { /* 接口未实现 */ }
        return null;
    },

    // ---- 报告 ----

    /** 获取报告列表 */
    async getReports(patientId) {
        try {
            const res = await apiRequest('business', `/reports?patientId=${patientId || PatientSession.getPatientId() || ''}`, { method: 'GET' });
            if (res.code === 200 && res.data) return res.data;
        } catch (e) { /* 接口未实现 */ }
        return null;
    },

    // ---- 操作 ----

    /** 提交满意度评价 */
    async submitRating(data) {
        try {
            const res = await apiRequest('business', '/rating', { method: 'POST', body: data });
            if (res.code === 200) return true;
        } catch (e) { console.warn('[Patient] 评价提交失败:', e.message); }
        return false;
    },

    /** 发起紧急求助 */
    async sendEmergency(data) {
        try {
            const res = await apiRequest('business', '/emergency', { method: 'POST', body: data });
            if (res.code === 200) return res.data;
        } catch (e) { console.warn('[Patient] 紧急求助失败:', e.message); }
        return null;
    },

    /** 归还手环 */
    async returnBracelet(patientId) {
        try {
            const res = await apiRequest('business', '/bracelet/return', { method: 'POST', body: { patientId: patientId || PatientSession.getPatientId() } });
            if (res.code === 200) return true;
        } catch (e) { /* 接口未实现 */ }
        return false;
    },

    /** 绑定手环 */
    async bindBracelet(rfidUuid, patientId) {
        await ensureTerminalToken();
        try {
            const res = await apiRequest('business', '/patient/bind-bracelet', { method: 'POST', body: { patientId: patientId || PatientSession.getPatientId(), rfidUuid } });
            if (res.code === 200) return res.data;
        } catch (e) { console.warn('[Patient] 绑定失败:', e.message); }
        return null;
    },

    /** 获取家属列表 */
    async getFamilyList(patientId) {
        try {
            const res = await apiRequest('business', `/family/list?patientId=${patientId || PatientSession.getPatientId() || ''}`, { method: 'GET' });
            if (res.code === 200 && res.data) return res.data;
        } catch (e) { /* 接口未实现 */ }
        return [];
    },

    /** 绑定家属 */
    async bindFamily(data) {
        try {
            const res = await apiRequest('business', '/family/bind', { method: 'POST', body: data });
            if (res.code === 200) return true;
        } catch (e) { /* 接口未实现 */ }
        return false;
    },
};

console.log('[智环引诊] 患者客户端 API 服务已加载');
