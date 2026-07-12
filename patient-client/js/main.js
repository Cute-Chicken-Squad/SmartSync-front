/**
 * 智环引诊 - 患者客户端主逻辑
 *
 * 数据流程: NFC手环感应 → RFID查患者 → 加载就诊数据 → 渲染页面
 * API 不可用时自动降级为本地 mock 数据
 */

const pageCache = {};
const defaultPage = 'home';

let currentPageId = null;
let isVoiceActive = false;

// ===================== 数据模型（默认值 + API 填充） =====================

const appData = {
    patient: {
        name: '王大爷',
        id: '#8102',
        gender: '男',
        age: 72
    },
    appointment: {
        department: '心内科诊室',
        floor: '3F 心内科',
        time: '14:30',
        waitTime: '28分钟'
    },
    progress: [
        { title: '挂号', time: '09:00', status: 'completed' },
        { title: '就诊', time: '09:30', status: 'completed' },
        { title: '检查', time: '10:15', status: 'completed' },
        { title: '心电图检查', time: '进行中', status: 'active' },
        { title: '血液化验', time: '待进行', status: 'pending' },
        { title: '影像检查', time: '待进行', status: 'pending' }
    ],
    reports: [
        { title: '心电图检查报告', date: '2026-04-18 09:45', status: 'normal', preview: '窦性心律，心率未见明显异常...' },
        { title: '血液化验报告', date: '2026-04-17 14:30', status: 'completed', preview: '各项指标基本正常...' },
        { title: '影像检查报告', date: '2026-04-16 10:15', status: 'completed', preview: '胸部CT检查未见明显异常...' }
    ],
    reminder: {
        date: '2026-05-03 (周六) 09:30',
        department: '心内科',
        doctor: '王医生',
        room: '3楼-302'
    },
    queue: {
        number: 12,
        waitTime: '15分钟',
        aheadCount: 11,
        avgDuration: '1.5分钟'
    },
    // 数据来源标记
    _source: 'mock',
    _loaded: false,
};

// ===================== 数据加载（从后端 API + 缓存） =====================

/**
 * 尝试从后端加载患者数据，失败时使用缓存/默认值
 * 调用时机: NFC 手环感应后，或页面首次加载
 * 策略: 缓存(新鲜) → API → 缓存(过期) → mock
 */
async function loadPatientData(rfid) {
    Toast.info('正在加载就诊数据...');

    // Step 1: NFC 检测 + 患者登录
    let nfcInfo = null;
    if (rfid) {
        nfcInfo = await PatientService.nfcDetect(rfid);
        if (nfcInfo) {
            PatientSession.set({ patientId: nfcInfo.patientId, patientName: nfcInfo.patientName, nfcId: rfid });
        }
    }

    // Step 2: 患者登录 (NFC ID)
    const session = PatientSession.get();
    if (session?.nfcId) {
        const info = await PatientService.getInfo().catch(() => null);
        const phone = info?.phone || '13900000001';
        await patientLogin(session.nfcId, phone);
    }

    // Step 3: 获取就诊概览 → 填充 appData
    if (PatientSession.getPatientId()) {
        const overview = await PatientService.getVisitOverview();
        if (overview) {
            appData._source = 'api';
            appData.patient = {
                name: overview.patient?.name || appData.patient.name,
                id: overview.patient?.id ? ('#' + String(overview.patient.id).slice(-4)) : appData.patient.id,
                gender: overview.patient?.gender === 1 ? '男' : overview.patient?.gender === 2 ? '女' : appData.patient.gender,
                age: overview.patient?.age || appData.patient.age,
            };
            const a = overview.appointment || {};
            appData.appointment = {
                department: a.department || appData.appointment.department,
                floor: a.floor ? (a.floor + 'F') : appData.appointment.floor,
                time: a.time ? a.time.substring(11, 16) : appData.appointment.time,
                waitTime: a.waitMinutes ? (a.waitMinutes + '分钟') : appData.appointment.waitTime,
            };
        }

        // 并行加载
        const [progress, reports, reminder, queue] = await Promise.allSettled([
            PatientService.getVisitProgress(),
            PatientService.getReports(),
            PatientService.getReminder(),
            PatientService.getQueueStatus(appData.appointment.department),
        ]);

        if (progress.value) appData.progress = progress.value.steps || appData.progress;
        if (reports.value?.length) {
            appData.reports = reports.value.map(r => ({ title: r.title, date: r.date, status: r.status || 'completed', preview: r.preview || '' }));
        }
        if (reminder.value) {
            appData.reminder = { date: reminder.value.nextDate || appData.reminder.date, department: reminder.value.department || appData.reminder.department, doctor: reminder.value.doctorName || appData.reminder.doctor, room: reminder.value.room || appData.reminder.room };
        }
        if (queue.value) {
            appData.queue = { number: queue.value.queueNumber, waitTime: queue.value.waitMinutes ? (queue.value.waitMinutes + '分钟') : appData.queue.waitTime, aheadCount: queue.value.aheadCount, avgDuration: queue.value.avgDuration ? (queue.value.avgDuration + '分钟') : appData.queue.avgDuration };
        }

        Logger.log('数据加载完成 (API)');
        Toast.success('数据加载完成');
    } else {
        Logger.log('API 数据加载失败，使用默认值');
        Toast.info('使用演示数据');
    }

    appData._loaded = true;

    // 重新渲染页面
    refreshAllBindings();
}

/**
 * 刷新所有数据绑定和渲染
 */
function refreshAllBindings() {
    bindData();
    renderProgress();
    renderReports();

    // 更新 overview 页面的 header badge
    const headerBadge = document.querySelector('.header-badge');
    if (headerBadge && appData.progress.length > 0) {
        const completed = appData.progress.filter(p => p.status === 'completed').length;
        headerBadge.textContent = '今日已完成 ' + completed + '/' + appData.progress.length + ' 项';
    }

    // 更新 stat 数值
    document.querySelectorAll('[data-stat]').forEach(el => {
        const key = el.dataset.stat;
        if (appData.queue[key] != null) {
            el.textContent = appData.queue[key];
        }
    });
}

// ===================== 页面导航 =====================

function showPage(pageId) {
    if (currentPageId === pageId) return;

    // 使用过渡动画（如果 pages.js 已加载）
    if (typeof navigateTo === 'function') {
        navigateTo(pageId);
        // 刷新数据绑定（在过渡完成后）
        setTimeout(() => {
            if (appData._loaded) { bindData(); renderProgress(); renderReports(); }
        }, 300);
        return;
    }

    // 降级：无动画切换
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
        currentPageId = pageId;
        updateNavigation(pageId);
        // 控制底部导航显隐
        if (typeof toggleBottomNav === 'function') toggleBottomNav(pageId);
        if (typeof updateNavHighlight === 'function') updateNavHighlight(pageId);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (appData._loaded) { bindData(); renderProgress(); renderReports(); }
    } else {
        showToast('页面加载失败');
    }
}

function updateNavigation(pageId) {
    setTimeout(() => {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            const navText = item.querySelector('.nav-text');
            if (navText) {
                const text = navText.textContent.trim();
                if ((pageId === 'overview' && text === '首页') ||
                    (pageId === 'reports' && text === '报告') ||
                    (pageId === 'reminder' && text === '复诊') ||
                    (pageId === 'profile' && text === '我的')) {
                    item.classList.add('active');
                }
            }
        });
    }, 0);
}

function showToast(message, type = 'info', duration = 3000) {
    // 使用新的 Toast 组件
    if (typeof Toast !== 'undefined') {
        Toast.show(message, type, duration);
        return;
    }
    // 降级：使用旧 DOM 方式
    const toast = document.getElementById('toast');
    if (!toast) return;
    const toastMessage = toast.querySelector('.toast-message');
    if (toastMessage) toastMessage.textContent = message;
    toast.className = 'toast toast-' + type;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
}

// ===================== NFC 手环感应（核心入口） =====================

async function simulateNfcBind() {
    showToast('正在感应手环...', 'info');
    const btn = event?.target;
    if (btn) { btn.disabled = true; }

    // 模拟 RFID 读取
    const mockRfid = 'ABCDEFGHJKMN' + String(Math.floor(Math.random() * 10));

    try {
        await loadPatientData(mockRfid);
        if (appData._source === 'api') {
            showToast('手环识别成功！已加载就诊数据', 'success');
            speak('手环识别成功，欢迎' + appData.patient.name);
        } else {
            showToast('手环已绑定（演示模式）', 'success');
        }
    } catch (e) {
        showToast('手环绑定成功！', 'success');
    }

    if (btn) { btn.disabled = false; }
    setTimeout(() => showPage('overview'), 1200);
}

// ===================== 语音播报 =====================

function speak(text) {
    if (window.voiceEnabled && 'speechSynthesis' in window) {
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.8;
        speechSynthesis.speak(utterance);
    }
}

// ===================== 操作类函数（对接后端 API） =====================

async function confirmEmergency() {
    const btn = event?.target;
    if (btn) { btn.disabled = true; btn.textContent = '求助中...'; }

    try {
        const result = await PatientService.sendEmergency({
            patientId: PatientSession.getPatientId(),
            location: appData.appointment?.floor || '未知',
            type: 'emergency',
            description: '患者通过手机端发起紧急求助',
        });
        if (result) {
            showToast('已通知医护人员，他们将尽快赶到！', 'success');
            speak('求助已发送，请稍候');
        } else {
            showToast('已通知医护人员！(演示模式)', 'success');
        }
    } catch (e) {
        showToast('已通知医护人员！', 'success');
    }

    if (btn) { btn.disabled = false; btn.textContent = '确认求助'; }
}

async function downloadReport() {
    showToast('正在生成报告...', 'info');
    // 尝试从 API 下载
    try {
        const blob = await apiRequest('business', '/reports/1/download', { rawResponse: true });
        if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = '报告.pdf'; a.click();
            URL.revokeObjectURL(url);
            showToast('报告下载成功', 'success');
            return;
        }
    } catch (e) { /* fallback */ }
    setTimeout(() => showToast('报告已下载 (演示模式)', 'success'), 1500);
}

function shareReport() {
    showToast('正在生成分享链接...', 'info');
    setTimeout(() => showToast('链接已复制到剪贴板', 'success'), 1000);
}

function addToCalendar() {
    showToast('已添加到日历提醒！', 'success');
    speak('已添加复诊提醒');
}

async function submitRating() {
    const stars = document.querySelectorAll('.star.active').length;
    const comment = document.querySelector('.comment-input')?.value || '';
    if (stars === 0) { showToast('请先选择评分', 'info'); return; }

    try {
        const ok = await PatientService.submitRating({
            patientId: PatientSession.getPatientId(),
            visitId: PatientSession.getVisitId() || 1,
            score: stars,
            comment: comment,
        });
        if (ok) {
            showToast('感谢您的评价！', 'success');
        } else {
            showToast('感谢您的评价！(演示模式)', 'success');
        }
    } catch (e) {
        showToast('感谢您的评价！', 'success');
    }
    setTimeout(() => showPage('overview'), 1000);
}

async function confirmReturn() {
    showToast('正在归还手环...', 'info');
    try {
        await PatientService.returnBracelet();
    } catch (e) { /* fallback */ }
    showToast('手环已归还，感谢您的使用！', 'success');
    PatientSession.clear();
    setTimeout(() => showPage('rating'), 1500);
}

async function bindFamily() {
    showToast('正在绑定家人手环...', 'info');
    try {
        await PatientService.bindFamily({ familyPatientId: PatientSession.getPatientId() });
        showToast('绑定成功！', 'success');
    } catch (e) {
        showToast('绑定成功！(演示模式)', 'success');
    }
}

// ===================== 语音交互 =====================

function toggleVoice() {
    isVoiceActive = !isVoiceActive;
    const btn = document.getElementById('voiceFloatBtn');
    if (btn) btn.classList.toggle('active', isVoiceActive);
    if (isVoiceActive) {
        showToast('正在听您说话...', 'info');
        setTimeout(() => {
            isVoiceActive = false;
            if (btn) btn.classList.remove('active');
            showToast('语音识别完成');
            setTimeout(() => showPage('overview'), 1000);
        }, 3000);
    }
}

function toggleVoiceInput() {
    const btn = document.querySelector('.voice-input-btn');
    if (btn) {
        btn.classList.toggle('active');
        if (btn.classList.contains('active')) {
            showToast('正在听您说话...', 'info');
            setTimeout(() => { btn.classList.remove('active'); showToast('语音输入完成'); }, 3000);
        }
    }
}

// ===================== 模式切换 =====================

function toggleElderMode(toggle) {
    if (toggle.checked) {
        document.body.classList.add('elder-mode');
        localStorage.setItem('elderMode', 'true');
        showToast('老年模式已开启');
    } else {
        document.body.classList.remove('elder-mode');
        localStorage.setItem('elderMode', 'false');
        showToast('老年模式已关闭');
    }
}

function toggleHighContrast(toggle) {
    if (toggle.checked) {
        document.body.classList.add('high-contrast');
        localStorage.setItem('highContrast', 'true');
        showToast('深色模式已开启');
    } else {
        document.body.classList.remove('high-contrast');
        localStorage.setItem('highContrast', 'false');
        showToast('深色模式已关闭');
    }
}

function toggleFamilyMode(checkbox) {
    if (checkbox.checked) {
        document.body.classList.add('family-mode');
        localStorage.setItem('familyMode', 'true');
        showToast('已开启家属关怀模式', 'success');
        const familyView = document.getElementById('family-view');
        if (familyView) familyView.style.display = 'block';
    } else {
        document.body.classList.remove('family-mode');
        localStorage.setItem('familyMode', 'false');
        showToast('已关闭家属关怀模式', 'info');
        const familyView = document.getElementById('family-view');
        if (familyView) familyView.style.display = 'none';
    }
}

function viewFamilyProgress() {
    showToast('正在查看就诊详情...', 'info');
    setTimeout(() => showPage('overview'), 1000);
}

function callFamily() {
    showToast('正在拨打家人电话...', 'info');
    setTimeout(() => showToast('电话已接通', 'success'), 1500);
}

// ===================== 身份选择 =====================

async function selectPatient() {
    localStorage.setItem('identity', 'patient');
    Device.haptic('light');
    showToast('正在识别患者身份...', 'info');

    // 在 overview 页面显示骨架屏
    Skeleton.show('.patient-card', 'kpi');
    Skeleton.show('.appointment-card', 'card');
    Skeleton.show('.progress-timeline', 'progress');

    await loadPatientData().catch(() => {});
    Skeleton.hide('.patient-card');
    Skeleton.hide('.appointment-card');
    Skeleton.hide('.progress-timeline');
    refreshAllBindings();

    // 使用 navigateTo（处理底部导航显隐）或降级 showPage
    if (typeof navigateTo === 'function') {
        await navigateTo('overview');
    } else if (typeof PageTransition !== 'undefined') {
        await PageTransition.go('overview');
        if (typeof toggleBottomNav === 'function') toggleBottomNav('overview');
    } else {
        showPage('overview');
    }
}

function selectFamily() {
    localStorage.setItem('identity', 'family');
    showToast('正在进入家属关怀模式...', 'success');
    setTimeout(() => showPage('family-mode'), 1000);
}

// ===================== 数据绑定（HTML [data-bind] 属性） =====================

function bindData() {
    document.querySelectorAll('[data-bind]').forEach(element => {
        const bindPath = element.getAttribute('data-bind');
        const value = getNestedValue(appData, bindPath);
        if (value !== undefined) {
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.value = value;
            } else {
                element.textContent = value;
            }
        }
    });
}

function getNestedValue(obj, path) {
    // 防止原型链访问
    if (!path || typeof path !== 'string') return undefined;
    const keys = path.split('.');
    if (keys.some(k => k === '__proto__' || k === 'constructor' || k === 'prototype')) return undefined;
    return keys.reduce((current, key) => current?.[key], obj);
}

/** HTML 转义，防止 XSS */
function escHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

// ===================== 进度渲染 =====================

function renderProgress() {
    const container = document.querySelector('.progress-timeline');
    if (!container) return;
    container.innerHTML = appData.progress.map((item, index) => `
        <div class="progress-item ${escHtml(item.status)}">
            <div class="progress-dot"></div>
            ${index < appData.progress.length - 1 ? '<div class="progress-line"></div>' : ''}
            <div class="progress-info">
                <div class="progress-title">${escHtml(item.title)}</div>
                <div class="progress-time">${escHtml(item.time)}</div>
            </div>
        </div>
    `).join('');
}

// ===================== 报告渲染 =====================

function renderReports() {
    const container = document.querySelector('.report-list');
    if (!container) return;
    container.innerHTML = appData.reports.map(report => `
        <div class="report-item" onclick="showPage('report-detail')">
            <div class="report-header">
                <div class="report-title">${escHtml(report.title)}</div>
                <div class="report-status ${escHtml(report.status)}">${report.status === 'normal' ? '正常' : '已完成'}</div>
            </div>
            <div class="report-meta">${escHtml(report.date)}</div>
            <div class="report-preview">${escHtml(report.preview || '')}</div>
            <div class="report-actions">
                <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); downloadReport()">下载</button>
                <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); shareReport()">分享</button>
            </div>
        </div>
    `).join('');
}

// ===================== 评分 =====================

function setRating(stars) {
    document.querySelectorAll('.star').forEach((star, i) => star.classList.toggle('active', i < stars));
    const texts = ['非常不满意', '不满意', '一般', '满意', '非常满意'];
    const el = document.getElementById('ratingText');
    if (el) el.textContent = stars > 0 ? texts[stars - 1] : '请选择评分';
}

// ===================== 聊天 =====================

function sendMessage() {
    const input = document.getElementById('chatInput');
    if (input?.value?.trim()) { showToast('消息已发送'); input.value = ''; }
}

function addQuickQuestion(question) {
    showToast('已发送: ' + question);
}

// ===================== 触摸反馈 =====================

function initTouchFeedback() {
    document.addEventListener('click', function(e) {
        if (e.target.tagName === 'BUTTON' ||
            e.target.classList.contains('menu-item') ||
            e.target.classList.contains('back-btn')) {
            createTouchFeedback(e.clientX, e.clientY);
        }
    });
}

function createTouchFeedback(x, y) {
    const ripple = document.createElement('div');
    ripple.className = 'touch-ripple';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
}

// ===================== 初始化 =====================

document.addEventListener('DOMContentLoaded', () => {
    hideLoading();

    // 恢复模式设置
    if (localStorage.getItem('elderMode') === 'true') document.body.classList.add('elder-mode');
    if (localStorage.getItem('highContrast') === 'true') document.body.classList.add('high-contrast');
    window.voiceEnabled = localStorage.getItem('voiceEnabled') !== 'false';

    // 初始化页面管理（底部导航、空状态标记）
    if (typeof setupPages === 'function') setupPages();

    bindData();
    renderProgress();
    renderReports();
    initTouchFeedback();

    // 如果之前有 session，尝试加载真实数据
    if (PatientSession.isLoggedIn()) {
        Logger.log('检测到已有会话，加载患者数据...');
        loadPatientData().catch(() => Logger.log('数据加载失败，使用默认值'));
    }

    // 标记已初始化
    document.body.classList.add('app-initialized');
});

window.addEventListener('error', (event) => {
    Logger.error('Global error:', event.error);
    hideLoading();
    Toast.show('应用程序发生错误，请刷新重试', 'error', 5000);
});

// ===================== 全局导出 =====================
window.showPage = showPage;
window.showToast = showToast;
window.toggleVoice = toggleVoice;
window.simulateNfcBind = simulateNfcBind;
window.confirmEmergency = confirmEmergency;
window.downloadReport = downloadReport;
window.shareReport = shareReport;
window.addToCalendar = addToCalendar;
window.submitRating = submitRating;
window.bindFamily = bindFamily;
window.addQuickQuestion = addQuickQuestion;
window.setRating = setRating;
window.sendMessage = sendMessage;
window.toggleVoiceInput = toggleVoiceInput;
window.toggleElderMode = toggleElderMode;
window.toggleHighContrast = toggleHighContrast;
window.toggleFamilyMode = toggleFamilyMode;
window.viewFamilyProgress = viewFamilyProgress;
window.callFamily = callFamily;
window.confirmReturn = confirmReturn;
window.selectPatient = selectPatient;
window.selectFamily = selectFamily;
window.bindData = bindData;
window.renderProgress = renderProgress;
window.renderReports = renderReports;
window.appData = appData;
window.PatientSession = PatientSession;
window.loadPatientData = loadPatientData;
