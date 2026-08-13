/**
 * 智环引诊 - 患者客户端 API 服务
 *
 * 鉴权: POST /api/auth/patient-login (NFC ID + 手机号)
 * 所有患者侧 API 已由后端实现 (2026-07)
 */

// ===================== 患者会话管理 =====================

const PatientSession = {
    _key: 'smartsync_patient_session',

    get() { try { return JSON.parse(localStorage.getItem(this._key)); } catch { return null; } },
    set(data) {
        const s = { ...this.get(), ...data, _updated: Date.now() };
        localStorage.setItem(this._key, JSON.stringify(s));
        return s;
    },
    clear() { localStorage.removeItem(this._key); },

    getPatientId() { return this.get()?.patientId; },
    getVisitId() { return this.get()?.visitId; },
    getNfcId() { return this.get()?.nfcId; },
    isLoggedIn() { return !!(TokenStore.getPatientToken()); },
};

// ===================== 患者认证 =====================

async function ensurePatientToken() {
    // 已有有效患者 Token
    if (TokenStore.getPatientToken()) return TokenStore.getPatientToken();

    // 尝试用存储的 NFC + 手机号登录
    const session = PatientSession.get();
    if (session?.nfcId && session?.phone) {
        try {
            const res = await businessApi.patientLogin(session.nfcId, session.phone);
            if (res.code === 200 && res.data?.token) {
                TokenStore.setPatientToken(res.data.token);
                TokenStore.setPatientUser({
                    patientId: res.data.patientId,
                    patientName: res.data.patientName,
                });
                PatientSession.set({ patientId: res.data.patientId, patientName: res.data.patientName });
                Logger.log('患者自动登录成功:', res.data.patientName);
                return res.data.token;
            }
        } catch (e) { Logger.warn('患者自动登录失败:', e.message); }
    } else {
        Logger.log('无患者会话，使用演示模式');
    }
    return null;
}

/** 患者登录 (NFC手环 + 手机号) */
async function patientLogin(nfcId, phone) {
    try {
        const res = await businessApi.patientLogin(nfcId, phone);
        if (res.code === 200 && res.data?.token) {
            TokenStore.setPatientToken(res.data.token);
            TokenStore.setPatientUser({
                patientId: res.data.patientId,
                patientName: res.data.patientName,
            });
            PatientSession.set({
                patientId: res.data.patientId,
                patientName: res.data.patientName,
                nfcId, phone,
            });
            Logger.log('患者登录成功:', res.data.patientName);
            return res.data;
        }
    } catch (e) { Logger.warn('患者登录失败:', e.message); }
    return null;
}

// ===================== 患者 API 服务 =====================

const PatientService = {

    // ---- 认证 ----
    login: patientLogin,
    ensureToken: ensurePatientToken,

    // ---- 患者信息 ----
    async getInfo() {
        try { const r = await businessApi.getPatientInfo(); return r.code === 200 ? r.data : null; }
        catch (e) { return null; }
    },
    async updateInfo(data) {
        try { const r = await businessApi.updatePatientInfo(data); return r.code === 200; }
        catch (e) { return false; }
    },
    async getMessages() {
        try { const r = await businessApi.getPatientMessages(); return r.code === 200 ? r.data : []; }
        catch (e) { return []; }
    },

    // ---- 就诊 ----
    async getVisitOverview(patientId) {
        const res = await businessApi.getVisitOverview(patientId);
        if (res.code === 200 && res.data) {
            PatientSession.set({ visitId: res.data.visitId });
            return res.data;
        }
        return null;
    },
    async getVisitProgress(visitId) {
        const res = await businessApi.getVisitProgress(visitId || PatientSession.getVisitId());
        return res.code === 200 ? res.data : null;
    },
    async getCurrentTask(visitId) {
        const res = await businessApi.getCurrentTask(visitId || PatientSession.getVisitId());
        return res.code === 200 ? res.data : null;
    },
    async getVisitTrace(visitId) {
        const res = await businessApi.getVisitTrace(visitId || PatientSession.getVisitId());
        return res.code === 200 ? res.data : null;
    },
    async getReminder(patientId) {
        const res = await businessApi.getVisitReminder(patientId || PatientSession.getPatientId());
        return res.code === 200 ? res.data : null;
    },
    async getReminderCalendar(year, month) {
        const res = await businessApi.getReminderCalendar(PatientSession.getPatientId(), year, month);
        return res.code === 200 ? res.data : null;
    },

    // ---- 排队 ----
    async getQueueStatus(dept, patientId) {
        if (!dept) return null; // 后端 dept 必填，无科室时跳过请求
        const res = await businessApi.getQueueStatus(dept, patientId || PatientSession.getPatientId());
        return res.code === 200 ? res.data : null;
    },
    async getQueueProgress(dept) {
        if (!dept) return []; // 后端 dept 必填，无科室时跳过请求
        const res = await businessApi.getQueueProgress(dept);
        return res.code === 200 ? res.data : [];
    },

    // ---- 报告 ----
    async getReports(patientId) {
        const res = await businessApi.getReports(patientId || PatientSession.getPatientId());
        return res.code === 200 ? res.data : [];
    },
    async getReportDetail(reportId) {
        const res = await businessApi.getReportDetail(reportId);
        return res.code === 200 ? res.data : null;
    },
    async downloadReport(reportId) {
        return businessApi.downloadReport(reportId);
    },
    async shareReport(reportId) {
        const res = await businessApi.shareReport(reportId);
        return res.code === 200 ? res.data : null;
    },

    // ---- 操作 ----
    async submitRating(data) {
        const patientId = data.patientId || PatientSession.getPatientId();
        if (!patientId) return false; // 后端 patientId 必填，无患者时走演示兜底
        const res = await businessApi.submitRating({
            visitId: data.visitId || PatientSession.getVisitId() || 1,
            patientId,
            score: data.score,
            comment: data.comment || '',
            tags: data.tags || [],
        });
        return res.code === 200;
    },
    async sendEmergency(data) {
        const patientId = data.patientId || PatientSession.getPatientId();
        if (!patientId) return null; // 后端 patientId 必填，无患者时走演示兜底
        const res = await businessApi.sendEmergency({
            patientId,
            location: data.location || '',
            type: data.type || 'emergency',
            description: data.description || '',
        });
        return res.code === 200 ? res.data : null;
    },

    // ---- 聊天 ----
    async sendChatMessage(message) {
        const res = await businessApi.sendChatMessage({
            patientId: PatientSession.getPatientId(),
            message,
            type: 'text',
        });
        return res.code === 200 ? res.data : null;
    },
    async getQuickQuestions() {
        try { const r = await businessApi.getQuickQuestions(); return r.code === 200 ? r.data : []; }
        catch (e) { return QUICK_QUESTIONS; }
    },

    // ---- 反馈 ----
    async submitFeedback(data) {
        const res = await businessApi.submitFeedback({
            patientId: PatientSession.getPatientId(),
            type: data.type || '',
            content: data.content || '',
            contact: data.contact || '',
        });
        return res.code === 200;
    },

    // ---- NFC & 手环 ----
    async nfcDetect(nfcId) {
        const res = await businessApi.nfcDetect(nfcId);
        return res.code === 200 ? res.data : null;
    },
    async nfcBind(nfcId, patientId) {
        const res = await businessApi.nfcBind(nfcId, patientId || PatientSession.getPatientId());
        return res.code === 200 ? res.data : null;
    },
    async nfcUnbind(braceletId) {
        try { return (await businessApi.nfcUnbind(braceletId)).code === 200; }
        catch (e) { return false; }
    },
    async returnBracelet(patientId) {
        const res = await businessApi.returnBracelet(patientId || PatientSession.getPatientId());
        return res.code === 200;
    },

    // ---- 导航 ----
    async getNavigation(from, to) {
        const res = await businessApi.getNavigation(from, to);
        return res.code === 200 ? res.data : null;
    },
    async startNavigation(visitId, fromNodeId, toNodeId) {
        const vid = visitId || PatientSession.getVisitId();
        if (!vid || !fromNodeId || !toNodeId) return null; // 后端三者必填，缺一不发起请求
        const res = await businessApi.startNavigation({ visitId: vid, fromNodeId, toNodeId });
        return res.code === 200 ? res.data : null;
    },
    async arriveNavigation(visitId, nodeId) {
        const res = await businessApi.arriveNavigation({ visitId: visitId || PatientSession.getVisitId(), nodeId });
        return res.code === 200;
    },
    async getFloorPlan(floor) {
        const res = await businessApi.getFloorPlan(floor);
        return res.code === 200 ? res.data : null;
    },

    // ---- 家属 ----
    async getFamilyList(patientId) {
        const res = await businessApi.getFamilyList(patientId || PatientSession.getPatientId());
        return res.code === 200 ? res.data : [];
    },
    async bindFamily(data) {
        const res = await businessApi.bindFamily({
            patientId: PatientSession.getPatientId(),
            familyPatientId: data.familyPatientId,
            braceletId: data.braceletId,
            relationship: data.relationship || '家属',
        });
        return res.code === 200;
    },
    async unbindFamily(familyId) {
        try { return (await businessApi.unbindFamily(familyId)).code === 200; }
        catch (e) { return false; }
    },
    async getFamilyStatus(familyId) {
        const res = await businessApi.getFamilyStatus(familyId);
        return res.code === 200 ? res.data : null;
    },
};

// ===================== SSE 实时推送 =====================

const SSEClient = {
    _connections: {},

    /**
     * 订阅 SSE 频道
     * @param {string} channel - 频道名 (visit-progress, queue, etc.)
     * @param {string} url - SSE URL 路径
     * @param {function} onData - 数据回调
     * @param {'patient'|'admin'|'biz'} tokenType
     */
    subscribe(channel, url, onData, tokenType = 'patient') {
        this.unsubscribe(channel);

        const token = tokenType === 'patient' ? TokenStore.getPatientToken()
            : tokenType === 'admin' ? TokenStore.getAdminToken()
            : TokenStore.getBizToken();

        if (!token) { Logger.warn('SSE: 无 Token，跳过订阅', channel); return; }

        const base = tokenType === 'admin' ? API_CONFIG.admin.baseURL.replace('/admin/api', '')
            : API_CONFIG.business.baseURL.replace('/api', '');
        const fullUrl = base + url;

        const controller = new AbortController();
        this._connections[channel] = controller;

        Logger.log('SSE 订阅:', channel);

        fetch(fullUrl, {
            headers: { Accept: 'text/event-stream', Authorization: `Bearer ${token}` },
            signal: controller.signal,
        }).then(async (response) => {
            if (!response.ok) { Logger.warn('SSE 连接失败:', response.status); return; }
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (line.startsWith('data:')) {
                        try { onData(JSON.parse(line.slice(5).trim())); }
                        catch (e) { /* skip malformed */ }
                    }
                }
            }
        }).catch(e => { if (e.name !== 'AbortError') Logger.warn('SSE 错误:', channel, e.message); });
    },

    unsubscribe(channel) {
        if (this._connections[channel]) {
            this._connections[channel].abort();
            delete this._connections[channel];
        }
    },

    /** 订阅就诊进度 */
    watchProgress(visitId, onData) {
        this.subscribe('visit-progress', `/ws/visit/progress/${visitId}`, onData, 'patient');
    },
    /** 订阅排队状态 */
    watchQueue(dept, onData) {
        this.subscribe('queue-' + dept, `/ws/queue/${encodeURIComponent(dept)}`, onData, 'patient');
    },
};

// 全局导出
window.PatientSession = PatientSession;
window.ensurePatientToken = ensurePatientToken;
window.patientLogin = patientLogin;
window.PatientService = PatientService;
window.SSEClient = SSEClient;

Logger.log('患者 API 服务已加载 (患者 Token 模式)');
