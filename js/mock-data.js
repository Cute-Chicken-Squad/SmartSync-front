/**
 * 智环引诊 - 总站模拟数据中心
 *
 * 当后端 API 不可达时自动降级使用模拟数据，确保控制中心各页面
 * 在无后端环境下也能展示完整的功能演示。
 *
 * 开关: 修改 MOCK_MODE 变量即可切换
 *   - 'auto'  : 先尝试真实 API，失败后降级到模拟 (默认)
 *   - 'always' : 始终使用模拟数据（离线 demo 模式）
 *   - 'never'  : 始终使用真实 API
 */

const MOCK_MODE = 'auto';

// ===================== 模拟数据定义 =====================

const MOCK = {
    // ── Dashboard KPI ──
    kpi: {
        todayVisits: 12456,
        currentOnsite: 1247,
        pendingAlarms: 3,
        deptUtilization: 78.6,
    },

    // ── 科室负载 ──
    deptLoad: [
        { deptName: '检验科', queueCount: 156, utilization: 92, loadStatus: 'danger' },
        { deptName: '影像科', queueCount: 142, utilization: 85, loadStatus: 'warning' },
        { deptName: '心内科', queueCount: 98, utilization: 63, loadStatus: 'warning' },
        { deptName: '内分泌科', queueCount: 76, utilization: 48, loadStatus: 'normal' },
        { deptName: '消化内科', queueCount: 54, utilization: 35, loadStatus: 'normal' },
        { deptName: '骨科', queueCount: 67, utilization: 42, loadStatus: 'normal' },
        { deptName: '急诊科', queueCount: 23, utilization: 28, loadStatus: 'normal' },
    ],

    // ── 实时警报 ──
    alarms: [
        { id: 1, level: 3, createdAt: new Date().toISOString().replace('T', ' ').substring(11, 16), location: '2F-洗手间附近',
            description: '患者触发紧急求助按钮，需要立即响应', type: 'emergency' },
        { id: 2, level: 2, createdAt: new Date(Date.now() - 120000).toISOString().replace('T', ' ').substring(11, 16),
            location: '1F-电梯厅', description: '需要轮椅协助通行', type: 'wheelchair' },
        { id: 3, level: 1, createdAt: new Date(Date.now() - 360000).toISOString().replace('T', ' ').substring(11, 16),
            location: '3F-检验科门口', description: '患者等待时间过长，建议分流', type: 'maintenance' },
    ],

    // ── 患者来源分布 ──
    sourceDistribution: [
        { label: '主城区', count: 4982, percentage: 40 },
        { label: '郊区', count: 3737, percentage: 30 },
        { label: '周边县市', count: 2491, percentage: 20 },
        { label: '外地', count: 1246, percentage: 10 },
    ],

    // ── 24小时流量趋势 ──
    trafficTrend: [
        { hour: 0, visitCount: 45 }, { hour: 4, visitCount: 28 }, { hour: 8, visitCount: 210 },
        { hour: 10, visitCount: 285 }, { hour: 12, visitCount: 250 }, { hour: 14, visitCount: 268 },
        { hour: 16, visitCount: 220 }, { hour: 18, visitCount: 145 }, { hour: 20, visitCount: 80 },
        { hour: 24, visitCount: 30 },
    ],

    // ── 系统运行状态 ──
    systemStatus: { status: 'UP' },

    // ── 调度：科室负载表 ──
    dispatchDeptLoad: [
        { deptName: '内科', queueCount: 12, avgWaitMinutes: 18, loadStatus: 'warning' },
        { deptName: '外科', queueCount: 8, avgWaitMinutes: 12, loadStatus: 'normal' },
        { deptName: '检验科', queueCount: 24, avgWaitMinutes: 35, loadStatus: 'danger' },
        { deptName: '影像科', queueCount: 18, avgWaitMinutes: 28, loadStatus: 'warning' },
        { deptName: '心内科', queueCount: 15, avgWaitMinutes: 22, loadStatus: 'warning' },
        { deptName: '急诊科', queueCount: 5, avgWaitMinutes: 5, loadStatus: 'normal' },
    ],

    // ── 调度建议 ──
    suggestions: [
        { fromDeptId: 3, toDeptId: 4, fromDeptName: '检验科', toDeptName: '影像科',
            fromUtilization: 92, toUtilization: 85, suggestedCount: 3, reason: '检验科排队过长，影像科尚有余力' },
        { fromDeptId: 5, toDeptId: 6, fromDeptName: '心内科', toDeptName: '内分泌科',
            fromUtilization: 63, toUtilization: 48, suggestedCount: 2, reason: '心内科等待时间偏长，可分流至内分泌科' },
    ],

    // ── 应急警报列表 ──
    emergencyAlarms: {
        records: [
            { id: 1, alarmCode: 'ALM-20260429-001', type: 'emergency', level: 3, location: '2F-洗手间附近',
                patientName: '王大爷', status: 'pending', createdAt: new Date().toISOString().replace('T',' ').substring(0,19) },
            { id: 2, alarmCode: 'ALM-20260429-002', type: 'wheelchair', level: 2, location: '1F-电梯厅',
                patientName: '李女士', status: 'pending', createdAt: new Date(Date.now()-120000).toISOString().replace('T',' ').substring(0,19) },
            { id: 3, alarmCode: 'ALM-20260429-003', type: 'maintenance', level: 1, location: '3F-检验科门口',
                patientName: '张先生', status: 'pending', createdAt: new Date(Date.now()-360000).toISOString().replace('T',' ').substring(0,19) },
            { id: 4, alarmCode: 'ALM-20260429-004', type: 'maintenance', level: 1, location: '医技楼B区',
                patientName: '--', status: 'pending', createdAt: new Date(Date.now()-480000).toISOString().replace('T',' ').substring(0,19) },
            { id: 5, alarmCode: 'ALM-20260429-005', type: 'emergency', level: 1, location: '1F-门诊大厅',
                patientName: '赵先生', status: 'completed', createdAt: new Date(Date.now()-600000).toISOString().replace('T',' ').substring(0,19) },
        ],
        total: 5, current: 1, size: 10,
    },

    // ── 数据分析：综合详情 ──
    analyticsDetail: {
        totalVisits: 12456, queuedVisits: 1247, inProgressVisits: 856, finishedVisits: 10353,
        averageSatisfaction: 4.7, busiestDept: '检验科', pendingAlarms: 3,
    },

    // ── 月度趋势 ──
    monthlyTrend: [
        { month: '2026-01', visitCount: 280000 }, { month: '2026-02', visitCount: 310000 },
        { month: '2026-03', visitCount: 350000 }, { month: '2026-04', visitCount: 380000 },
        { month: '2026-05', visitCount: 420000 }, { month: '2026-06', visitCount: 400000 },
    ],

    // ── 科室排行 ──
    deptRanking: [
        { deptName: '检验科', visitCount: 2850 }, { deptName: '影像科', visitCount: 2420 },
        { deptName: '心内科', visitCount: 1980 }, { deptName: '内科', visitCount: 1750 },
        { deptName: '内分泌科', visitCount: 1420 }, { deptName: '消化内科', visitCount: 1180 },
        { deptName: '骨科', visitCount: 950 }, { deptName: '外科', visitCount: 820 },
        { deptName: '急诊科', visitCount: 680 }, { deptName: '儿科', visitCount: 520 },
    ],

    // ── 满意度分布 ──
    satisfaction: [
        { score: 5, count: 6800, percentage: 55 }, { score: 4, count: 3700, percentage: 30 },
        { score: 3, count: 1200, percentage: 10 }, { score: 2, count: 400, percentage: 3 },
        { score: 1, count: 250, percentage: 2 },
    ],

    // ── 系统设置 ──
    settings: {
        groups: [
            { settingGroup: '系统参数', items: [
                { settingKey: 'max_queue_size', settingValue: '50', description: '科室最大排队人数' },
                { settingKey: 'alert_threshold', settingValue: '15', description: '等待时间告警阈值(分钟)' },
            ]},
            { settingGroup: '通知配置', items: [
                { settingKey: 'sms_enabled', settingValue: 'true', description: '是否启用短信通知' },
                { settingKey: 'broadcast_enabled', settingValue: 'true', description: '是否启用语音广播' },
            ]},
        ],
        backups: [
            { id: 1, backupType: 'manual', fileSize: 204800, status: 'success',
                createdAt: new Date(Date.now() - 86400000).toISOString().replace('T', ' ').substring(0, 19) },
            { id: 2, backupType: 'auto', fileSize: 198400, status: 'success',
                createdAt: new Date(Date.now() - 2 * 86400000).toISOString().replace('T', ' ').substring(0, 19) },
        ],
    },

    // ── 子站列表 ──
    substations: {
        records: [
            { terminalCode: 'SUB-1F-01', terminalName: '1F-门诊大厅', status: 1, createdAt: '2026-04-01' },
            { terminalCode: 'SUB-1F-02', terminalName: '1F-电梯厅', status: 1, createdAt: '2026-04-01' },
            { terminalCode: 'SUB-2F-01', terminalName: '2F-走廊北', status: 1, createdAt: '2026-04-02' },
            { terminalCode: 'SUB-2F-02', terminalName: '2F-检验科', status: 1, createdAt: '2026-04-02' },
            { terminalCode: 'SUB-3F-01', terminalName: '3F-心内科', status: 0, createdAt: '2026-04-03' },
            { terminalCode: 'SUB-3F-02', terminalName: '3F-影像科', status: 1, createdAt: '2026-04-03' },
        ],
        total: 6, current: 1, size: 50,
    },
};

// ===================== 工具函数 =====================

/** 包装响应为 API 标准格式 */
function mockResponse(data) {
    return { code: 200, message: 'OK (mock)', data: data };
}

/** 判断是否应使用模拟数据 */
function shouldUseMock() {
    if (MOCK_MODE === 'always') return true;
    if (MOCK_MODE === 'never') return false;
    return false; // 'auto' 模式由各方法自行处理
}

/** 包装 API 方法，失败时降级到模拟数据 */
function withMockFallback(apiFn, mockData, mockFn) {
    return async function (...args) {
        if (MOCK_MODE === 'always') {
            return mockResponse(typeof mockFn === 'function' ? mockFn(...args) : mockData);
        }
        try {
            const result = await apiFn.apply(this, args);
            return result;
        } catch (e) {
            if (MOCK_MODE === 'auto') {
                console.warn('[Mock] API 降级使用模拟数据:', e.message);
                return mockResponse(typeof mockFn === 'function' ? mockFn(...args) : mockData);
            }
            throw e;
        }
    };
}

// ===================== 为 adminApi 打补丁 =====================

(function patchAdminApi() {
    if (typeof adminApi === 'undefined') {
        console.warn('[Mock] adminApi 未加载，跳过模拟补丁');
        return;
    }

    // -- Dashboard --
    adminApi.getKpi = withMockFallback(adminApi.getKpi, MOCK.kpi);
    adminApi.getDeptLoad = withMockFallback(adminApi.getDeptLoad, MOCK.deptLoad);
    adminApi.getAlarms = withMockFallback(adminApi.getAlarms, MOCK.alarms, (limit) =>
        Array.isArray(MOCK.alarms) ? MOCK.alarms.slice(0, limit || MOCK.alarms.length) : MOCK.alarms);
    adminApi.getSourceDistribution = withMockFallback(adminApi.getSourceDistribution, MOCK.sourceDistribution);
    adminApi.getTrafficTrend = withMockFallback(adminApi.getTrafficTrend, MOCK.trafficTrend);
    adminApi.getSystemStatus = withMockFallback(adminApi.getSystemStatus, MOCK.systemStatus);

    // -- Dispatch --
    adminApi.getDispatchDeptLoad = withMockFallback(adminApi.getDispatchDeptLoad, MOCK.dispatchDeptLoad);
    adminApi.getSuggestions = withMockFallback(adminApi.getSuggestions, MOCK.suggestions);

    // -- Emergency --
    adminApi.getEmergencyAlarms = withMockFallback(adminApi.getEmergencyAlarms, MOCK.emergencyAlarms);

    // -- Analytics --
    adminApi.getAnalyticsDetail = withMockFallback(adminApi.getAnalyticsDetail, MOCK.analyticsDetail);
    adminApi.getMonthlyTrend = withMockFallback(adminApi.getMonthlyTrend, MOCK.monthlyTrend);
    adminApi.getDeptRanking = withMockFallback(adminApi.getDeptRanking, MOCK.deptRanking);
    adminApi.getSatisfaction = withMockFallback(adminApi.getSatisfaction, MOCK.satisfaction);

    // -- Settings --
    adminApi.getSettings = withMockFallback(adminApi.getSettings, MOCK.settings);
    adminApi.getSubstations = withMockFallback(adminApi.getSubstations, MOCK.substations);

    console.log('[Mock] 模拟数据补丁已应用 (模式: ' + MOCK_MODE + ')');
})();
