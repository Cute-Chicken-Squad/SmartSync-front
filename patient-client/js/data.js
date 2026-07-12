/**
 * 智环引诊 - 数据常量与配置
 * 将硬编码中文文本集中管理，便于后续国际化
 */

const APP_CONFIG = {
    name: '智环引诊',
    version: '2.0.0',

    // 导航标签
    nav: {
        home: '首页',
        reports: '报告',
        reminder: '复诊',
        profile: '我的',
    },

    // 身份
    identity: { patient: '患者', family: '家属' },

    // 评分文本
    ratings: ['非常不满意', '不满意', '一般', '满意', '非常满意'],

    // 性别映射
    gender: { 1: '男', 2: '女', '1': '男', '2': '女' },

    // 就诊状态
    visitStatus: {
        queuing: '排队中',
        in_progress: '就诊中',
        completed: '已完成',
        pending: '待进行',
        active: '进行中',
    },

    // 报告状态
    reportStatus: {
        normal: '正常',
        completed: '已出结果',
        pending: '检验中',
    },

    // 警报类型
    alarmType: {
        emergency: '紧急求助',
        wheelchair: '轮椅协助',
        maintenance: '设备维护',
        fall: '跌倒',
        vital: '生命体征',
    },

    // 队列状态
    queueStatus: {
        waiting: '等待中',
        calling: '就诊中',
        preparing: '准备中',
        completed: '已完成',
    },

    // Toast 消息
    messages: {
        nfcSuccess: '手环识别成功！已加载就诊数据',
        nfcDemo: '手环绑定成功！（演示模式）',
        emergencySent: '已通知医护人员，他们将尽快赶到！',
        emergencyDemo: '已通知医护人员！',
        ratingThanks: '感谢您的评价！',
        reportDownloaded: '报告已下载',
        braceletReturned: '手环已归还，感谢您的使用！',
        offlineWarning: '当前处于离线状态，显示缓存数据',
        networkRestored: '网络已恢复',
        dataLoading: '正在加载就诊数据...',
        dataLoaded: '数据加载完成',
    },

    // 科室映射
    departments: {
        internal: '内科',
        surgery: '外科',
        cardiology: '心内科',
        endocrinology: '内分泌科',
        gastroenterology: '消化内科',
        ent: '耳鼻喉科',
        dermatology: '皮肤科',
        pediatrics: '儿科',
        tcm: '中医科',
        radiology: '影像科',
        laboratory: '检验科',
    },

    // 模块开关
    features: {
        voiceInput: true,
        elderMode: true,
        familyMode: true,
        offlineCache: true,
        hapticFeedback: true,
    },
};

// 快捷问题列表
const QUICK_QUESTIONS = [
    '检查报告什么时候出来？',
    '洗手间在哪里？',
    '药房怎么走？',
    '还需要等多久？',
    '我的主治医生是谁？',
    '下次复诊是什么时候？',
];

// 导航步骤模板 (按科室)
const TASK_QUEUE_TEMPLATES = {
    default: [
        { name: '挂号登记', location: '导诊台' },
        { name: '候诊排队', location: '候诊区' },
        { name: '医生问诊', location: '诊室' },
        { name: '缴费结算', location: '收费处' },
        { name: '取药', location: '药房' },
    ],
    cardiology: [
        { name: '挂号登记', location: '导诊台' },
        { name: '心电图检查', location: '心电图室' },
        { name: '医生问诊', location: '心内科诊室' },
        { name: '缴费结算', location: '收费处' },
        { name: '取药', location: '药房' },
    ],
    surgery: [
        { name: '挂号登记', location: '导诊台' },
        { name: '候诊排队', location: '外科候诊区' },
        { name: '医生问诊', location: '外科诊室' },
        { name: '术前检查', location: '检验科' },
        { name: '缴费结算', location: '收费处' },
    ],
};

// 调试开关
const DEBUG = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const Logger = {
    log(...args) { if (DEBUG) console.log('[Patient]', ...args); },
    warn(...args) { if (DEBUG) console.warn('[Patient]', ...args); },
    error(...args) { console.error('[Patient]', ...args); },
};

// 全局导出
window.APP_CONFIG = APP_CONFIG;
window.QUICK_QUESTIONS = QUICK_QUESTIONS;
window.TASK_QUEUE_TEMPLATES = TASK_QUEUE_TEMPLATES;
window.DEBUG = DEBUG;
window.Logger = Logger;
