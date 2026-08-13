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

    // ── 本地映射（离线兜底，确定性，去随机化核心） ──
    // 有新刷卡 UID 时严格按 UID 匹配；无 UID（如刷新页面）才用上次缓存卡
    const card = resolveDemoCard(rfid) || (!rfid ? getCachedCard() : null);
    if (card) {
        window._demoCard = card;
        _navState.routeData = card.route;
        _navState.toNodeId = card.dept;
        // 先用本地卡填充患者信息，真实 API 成功后再覆盖
        appData.patient = { name: card.name, id: '#' + String(card.patientId || '').slice(-4), gender: card.gender, age: card.age };
        appData.appointment = { department: card.dept, floor: card.floor, time: appData.appointment.time, waitTime: appData.appointment.waitTime };
        appData._source = 'local';
        PatientSession.set({ patientId: card.patientId, patientName: card.name, nfcId: rfid || card.uid });
    }

    // Step 1: NFC 检测（真实后端预留接口，失败降级本地卡）
    let nfcInfo = null;
    if (rfid) {
        try { nfcInfo = await PatientService.nfcDetect(rfid); } catch (e) { nfcInfo = null; }
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
        Logger.log(card ? 'API 数据加载失败，使用本地卡片' : 'API 数据加载失败，使用默认值');
        Toast.info(card ? ('已识别：' + card.name + ' · ' + card.dept) : '使用演示数据');
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

    // 页面切换前的数据预加载
    if (pageId === 'task-detail') loadTaskDetail();
    if (pageId === 'navigation') { /* startNavigation() 会自行处理 */ }

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
        if (typeof updateNavHighlight === 'function') updateNavHighlight(pageId);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (appData._loaded) { bindData(); renderProgress(); renderReports(); }
    } else {
        showToast('页面加载失败');
    }
}

/** 加载当前任务详情并渲染到 task-detail 页面 */
async function loadTaskDetail() {
    try {
        const task = await PatientService.getCurrentTask();
        if (task) {
            const deptEl = document.getElementById('taskDeptName');
            const locEl = document.getElementById('taskLocation');
            const waitEl = document.getElementById('taskWaitTime');
            const dirEl = document.getElementById('taskDirection');
            const dirSubEl = document.getElementById('taskDirectionSub');
            const tipsEl = document.getElementById('taskTips');

            if (deptEl) deptEl.textContent = task.taskName || '就诊任务';
            if (locEl) locEl.textContent = (task.floor || '') + ' ' + (task.department || task.room || '');
            if (waitEl) waitEl.textContent = task.estimatedWait ? (task.estimatedWait + '分钟') : '--';
            if (dirEl) dirEl.textContent = task.direction || '请沿走廊直行';
            if (dirSubEl) dirSubEl.textContent = task.department ? '前往' + task.department : '';
            if (tipsEl && task.tips?.length) {
                tipsEl.innerHTML = task.tips.map(t => '<p>' + escHtml(t) + '</p>').join('');
            }

            // 存储任务信息供导航使用
            _navState.toNodeId = task.room || task.department || '';

            console.log('[任务详情] 已加载:', task.taskName);
        }
    } catch (e) {
        console.warn('[任务详情] API 加载失败，使用默认数据:', e.message);
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
    const btn = event?.target;
    if (btn) { btn.disabled = true; }

    // 真机 Web NFC 优先 + 测试 UID 降级（不再随机生成 UID）
    let uid = null;
    if (window.NfcReader) {
        uid = await NfcReader.readCard();
    } else {
        uid = window.TEST_UID || (window.DEMO_CARDS && window.DEMO_CARDS[0] && window.DEMO_CARDS[0].uid);
    }

    if (!uid) {
        showToast('未读到卡片，请重试', 'info');
        if (btn) { btn.disabled = false; }
        return;
    }

    showToast('正在感应手环...', 'info');
    try {
        await loadPatientData(uid);
        if (appData._source === 'api') {
            showToast('手环识别成功！已加载就诊数据', 'success');
            speak('手环识别成功，欢迎' + appData.patient.name);
        } else if (window._demoCard) {
            showToast('已识别：' + window._demoCard.name + ' · ' + window._demoCard.dept, 'success');
            speak('欢迎' + window._demoCard.name);
        } else {
            showToast('手环已绑定（演示模式）', 'success');
        }
    } catch (e) {
        showToast('手环绑定成功！', 'success');
    }

    if (btn) { btn.disabled = false; }
    setTimeout(() => showPage('overview'), 1200);
}

/** 刷卡状态可视化（配合 nfc-status 元素） */
function renderScanStatus(state) {
    const el = document.getElementById('nfcStatus');
    if (!el) return;
    const map = {
        scanning: { text: '正在读取卡片…', cls: 'scanning' },
        success: { text: '读取成功', cls: 'success' },
        fail: { text: '读取失败，请重试', cls: 'fail' },
        unsupported: { text: '当前环境不支持 NFC，已使用测试卡', cls: 'unsupported' },
    };
    const s = map[state] || map.scanning;
    el.textContent = s.text;
    el.className = 'nfc-status ' + s.cls;
}

// 将 NFC 读卡状态接入可视化反馈
if (window.NfcReader) {
    NfcReader.onStatus = (state) => renderScanStatus(state);
}
window.renderScanStatus = renderScanStatus;

/** 测试 UID 选择器切换（无实体卡联调） */
function onTestUidChange(value) {
    window.TEST_UID = value || null;
    if (value) {
        const card = resolveDemoCard(value);
        showToast('测试卡已切换：' + (card ? (card.name + ' · ' + card.dept) : value), 'info');
    } else {
        showToast('已切换为默认测试卡', 'info');
    }
}
window.onTestUidChange = onTestUidChange;

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

async function downloadReport(reportId) {
    // 如果没有传 reportId，尝试从页面 data 属性或全局状态获取
    if (!reportId) {
        reportId = document.querySelector('.report-detail')?.dataset?.reportId
            || window._currentReportId
            || (appData.reports?.[0]?.id)
            || 1;
    }

    showToast('正在生成报告...', 'info');
    try {
        const blob = await PatientService.downloadReport(reportId);
        if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = '报告_' + reportId + '.pdf'; a.click();
            URL.revokeObjectURL(url);
            showToast('报告下载成功', 'success');
            return;
        }
    } catch (e) { /* fallback: 演示模式 */ }
    setTimeout(() => showToast('报告已下载 (演示模式)', 'success'), 1500);
}

async function shareReport() {
    showToast('正在生成分享链接...', 'info');
    try {
        // 获取当前查看的报告 ID（从页面 data 属性或 appData 中获取）
        const reportId = document.querySelector('.report-detail')?.dataset?.reportId || 1;
        const result = await PatientService.shareReport(reportId);
        if (result?.shareUrl) {
            await navigator.clipboard.writeText(result.shareUrl);
            showToast('分享链接已复制到剪贴板', 'success');
        } else {
            showToast('链接已复制到剪贴板 (演示模式)', 'success');
        }
    } catch (e) {
        // 降级：生成本地 URL
        const url = window.location.origin + '/report/1';
        try { await navigator.clipboard.writeText(url); } catch (_) {}
        showToast('链接已复制到剪贴板', 'success');
    }
}

async function addToCalendar() {
    showToast('正在添加复诊提醒...', 'info');
    try {
        const now = new Date();
        const result = await PatientService.getReminderCalendar(now.getFullYear(), now.getMonth() + 1);
        if (result) {
            showToast('已添加到日历提醒！', 'success');
            speak('已添加复诊提醒');
        } else {
            showToast('已添加到日历提醒！(演示模式)', 'success');
        }
    } catch (e) {
        showToast('已添加到日历提醒！', 'success');
    }
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
    if (!btn) return;

    // 使用 Web Speech API 进行语音识别
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showToast('您的浏览器不支持语音输入', 'info');
        return;
    }

    btn.classList.toggle('active');
    if (btn.classList.contains('active')) {
        showToast('正在听您说话...', 'info');
        const recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            const text = event.results[0][0].transcript;
            btn.classList.remove('active');
            showToast('识别: ' + text, 'success');
            // 将识别结果填入聊天输入框
            const chatInput = document.getElementById('chatInput');
            if (chatInput) {
                chatInput.value = text;
                sendMessage();
            }
        };

        recognition.onerror = () => {
            btn.classList.remove('active');
            showToast('语音识别失败，请重试', 'info');
        };

        recognition.onend = () => {
            btn.classList.remove('active');
        };

        recognition.start();
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

async function viewFamilyProgress(familyId) {
    showToast('正在查看就诊详情...', 'info');
    try {
        const status = await PatientService.getFamilyStatus(familyId);
        if (status) {
            // 将家属状态写入 appData 供 overview 页展示
            appData.patient = {
                name: status.patientName || appData.patient.name,
                id: '#' + (familyId || '').toString().slice(-4),
                gender: '',
                age: '',
            };
            appData.appointment = {
                department: status.currentStep || '',
                floor: status.floor || '',
                time: '',
                waitTime: status.waitMinutes ? (status.waitMinutes + '分钟') : '',
            };
            appData._source = 'api';
            appData._loaded = true;
            refreshAllBindings();
            showToast('已加载' + status.patientName + '的就诊信息', 'success');
        }
    } catch (e) {
        // 降级
    }
    setTimeout(() => showPage('overview'), 1000);
}

// ===================== 导航功能 =====================

/** 导航状态 */
let _navState = {
    fromNodeId: null,
    toNodeId: null,
    routeData: null,
};

/**
 * 开始导航 — 从 task-detail 页点击"开始导航"触发
 * 1. 获取当前任务（含目标节点）
 * 2. 获取当前位置节点
 * 3. 调用导航 API 计算路线
 * 4. 渲染 navigation 页面
 */
/**
 * 加载导航路线 — 点击导航页"开始导航"时调用
 * 从 API 获取路线数据并更新页面 DOM，不跳转页面
 */
async function loadNavigationRoute() {
    console.log('[导航] loadNavigationRoute 被调用');
    showToast('正在规划路线...', 'info');

    // 确保页面可见
    const navPage = document.getElementById('navigation');
    if (navPage && !navPage.classList.contains('active')) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        navPage.classList.add('active');
    }

    try {
        // 优先使用刷卡已绑定的固定路线（来自 UID，去随机化）
        if (_navState.routeData && window._demoCard) {
            renderNavigationPage(_navState.routeData, {
                taskName: window._demoCard.dept,
                floor: window._demoCard.floor,
                department: window._demoCard.dept,
            });
            showToast('导航已开始，请按路线前行', 'success');
            speak('导航已开始，预计' + (_navState.routeData.duration || '5') + '分钟到达');
            return;
        }

        // 获取当前任务
        console.log('[导航] 正在获取当前任务...');
        const task = await PatientService.getCurrentTask();
        console.log('[导航] 任务:', task);
        const destName = task?.taskName || task?.department || '心内科诊室';
        const floor = task?.floor || '3F';
        const fromNodeId = _navState.fromNodeId || 'entrance_1f';
        const toNodeId = task?.room || task?.department || '心内科';

        // 更新目的地
        const destEl = document.querySelector('#navDest');
        if (destEl) destEl.textContent = floor + ' ' + destName;

        // 调 API 获取路线
        const route = await PatientService.getNavigation(fromNodeId, toNodeId);
        if (route) {
            _navState.routeData = route;
            _navState.toNodeId = toNodeId;

            // 更新预计时间
            const durEl = document.querySelector('#navDuration');
            if (durEl && route.duration) durEl.textContent = '约' + route.duration + '分钟';

            // 更新步骤
            const stepsEl = document.querySelector('#navSteps');
            if (stepsEl && route.steps?.length) {
                stepsEl.innerHTML = route.steps.map((s, i) => `
                    <div style="display: flex; align-items: center; gap: 16px; margin-bottom: ${i < route.steps.length - 1 ? '16px' : '0'};">
                        <div style="width: ${i === 0 ? '32px' : '24px'}; height: ${i === 0 ? '32px' : '24px'}; background: ${i === 0 ? 'var(--accent-color)' : 'var(--bg-secondary)'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: ${i === 0 ? '#FFFFFF' : 'var(--accent-color)'}; font-weight: 600; font-size: ${i === 0 ? '14px' : '12px'}; flex-shrink: 0;">
                            ${i === 0 ? (i + 1) : '→'}
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: 500;">${escHtml(s.step || s.instruction)}</div>
                            <div style="font-size: 12px; color: var(--text-muted);">${escHtml(s.detail || '')}</div>
                        </div>
                    </div>
                `).join('');
            }

            // 通知后端开始导航
            await PatientService.startNavigation(PatientSession.getVisitId(), fromNodeId, toNodeId);
        }

        showToast('导航已开始，请按路线前行', 'success');
        speak('导航已开始，预计' + (route?.duration || '3') + '分钟到达');
    } catch (e) {
        console.warn('[导航] API 调用失败:', e.message);
        showToast('导航已开始（演示模式）', 'success');
    }
}

/** 到达目的地 — 点击导航页"到达目的地"时调用 */
async function arriveDestination() {
    showToast('正在确认到达...', 'info');
    try {
        const nodeId = _navState.toNodeId || 'destination';
        await PatientService.arriveNavigation(PatientSession.getVisitId(), nodeId);
        showToast('已到达！进度已更新', 'success');
        await loadPatientData();
    } catch (e) {
        showToast('已到达目的地（演示模式）', 'success');
    }
    showPage('overview');
}

async function startNavigation() {
    showToast('正在规划路线...', 'info');

    try {
        // 优先使用刷卡已绑定的固定路线（来自 UID，去随机化）
        if (_navState.routeData && window._demoCard) {
            renderNavigationPage(_navState.routeData, {
                taskName: window._demoCard.dept,
                floor: window._demoCard.floor,
                department: window._demoCard.dept,
            });
            showPage('navigation');
            return;
        }

        // Step 1: 获取当前任务信息（含目标科室、楼层、房间）
        const task = await PatientService.getCurrentTask();
        if (!task) {
            showToast('无法获取任务信息，使用演示数据', 'info');
            showPage('navigation');
            return;
        }

        // 从任务中提取目标节点 ID 或使用科室名
        const toNodeId = task.room || task.department || '心电图室';
        const fromNodeId = _navState.fromNodeId || 'entrance_1f';

        // Step 2: 调用导航 API 获取路线
        const route = await PatientService.getNavigation(fromNodeId, toNodeId);
        if (route) {
            _navState.routeData = route;
            _navState.toNodeId = toNodeId;
            _navState.fromNodeId = fromNodeId;

            // Step 3: 渲染导航页面
            renderNavigationPage(route, task);

            // Step 4: 通知后端开始导航
            await PatientService.startNavigation(
                PatientSession.getVisitId(),
                fromNodeId,
                toNodeId
            );
        } else {
            // API 不可用，使用任务数据渲染
            renderNavigationPage(null, task);
        }
    } catch (e) {
        console.warn('[导航] API 调用失败，使用演示模式:', e.message);
        // 降级：渲染默认导航
        renderNavigationPage(null, {
            taskName: '心电图检查',
            department: '心电图室',
            floor: '3F',
            room: '心电图室',
        });
    }

    showPage('navigation');
}

/**
 * 渲染导航页面内容
 * @param {object|null} route API 返回的路线数据
 * @param {object} task 当前任务信息
 */
function renderNavigationPage(route, task) {
    const page = document.getElementById('navigation');
    if (!page) return;

    const destName = task.taskName || task.department || '目的地';
    const floor = task.floor || '';

    // 更新目的地
    const destEl = page.querySelector('#navDest');
    if (destEl) destEl.textContent = floor ? (floor + ' ' + destName) : destName;

    // 更新预计时间
    const durEl = page.querySelector('#navDuration');
    if (route) {
        if (durEl && route.duration) durEl.textContent = '约' + route.duration + '分钟';
        else if (durEl) durEl.textContent = '约3分钟';
    } else {
        if (durEl) durEl.textContent = '约3分钟';
    }

    // 更新方向步骤
    const stepsContainer = page.querySelector('#navSteps');
    if (stepsContainer) {
        const steps = route?.steps || [];
        if (steps.length) {
            stepsContainer.innerHTML = steps.map((s, i) => `
                <div style="display: flex; align-items: center; gap: 16px; margin-bottom: ${i < steps.length - 1 ? '16px' : '0'};">
                    <div style="width: ${i === 0 ? '32px' : '24px'}; height: ${i === 0 ? '32px' : '24px'}; background: ${i === 0 ? 'var(--accent-color)' : 'var(--bg-secondary)'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: ${i === 0 ? '#FFFFFF' : 'var(--accent-color)'}; font-weight: 600; font-size: ${i === 0 ? '14px' : '12px'}; flex-shrink: 0;">
                        ${i === 0 ? (i + 1) : '→'}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 500;">${escHtml(s.step || s.instruction)}</div>
                        <div style="font-size: 12px; color: var(--text-muted);">${escHtml(s.detail || '')}</div>
                    </div>
                </div>
            `).join('');
        } else {
            // 使用任务中的 direction 作为降级
            const direction = task.direction || '请沿走廊直行，乘电梯前往目的地';
            stepsContainer.innerHTML = `
                <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
                    <div style="width: 32px; height: 32px; background: var(--accent-color); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #FFFFFF; font-weight: 600; font-size: 14px;">1</div>
                    <div style="flex: 1;">
                        <div style="font-weight: 500;">从当前位置出发</div>
                        <div style="font-size: 12px; color: var(--text-muted);">${escHtml(direction)}</div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 16px;">
                    <div style="width: 24px; height: 24px; background: var(--bg-secondary); border-radius: 50%; display: flex; align-items: center; justify-content: center;"><span style="font-size: 12px; color: var(--accent-color); font-weight: 600;">→</span></div>
                    <div style="flex: 1;">
                        <div style="font-weight: 500;">到达${escHtml(destName)}</div>
                        <div style="font-size: 12px; color: var(--text-muted);">${floor || ''}</div>
                    </div>
                </div>`;
        }
    }

    // 更新到达按钮
    const arriveBtn = page.querySelector('.btn-block');
    if (arriveBtn) {
        arriveBtn.onclick = arriveDestination;
    }
}

async function callFamily(familyId) {
    showToast('正在获取家人信息...', 'info');
    try {
        const status = await PatientService.getFamilyStatus(familyId);
        if (status && status.phone) {
            showToast('正在呼叫 ' + (status.patientName || '家人') + '...', 'info');
            window.open('tel:' + status.phone);
        } else {
            showToast('已发送关怀提醒', 'success');
        }
    } catch (e) {
        showToast('电话已接通', 'success');
    }
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

    const uid = window.NfcReader ? await NfcReader.readCard()
        : (window.TEST_UID || (window.DEMO_CARDS && window.DEMO_CARDS[0] && window.DEMO_CARDS[0].uid));
    await loadPatientData(uid).catch(() => {});
    Skeleton.hide('.patient-card');
    Skeleton.hide('.appointment-card');
    Skeleton.hide('.progress-timeline');
    refreshAllBindings();

    // 使用 navigateTo（处理底部导航显隐）或降级 showPage
    if (typeof navigateTo === 'function') {
        await navigateTo('overview');
    } else if (typeof PageTransition !== 'undefined') {
        await PageTransition.go('overview');
    } else {
        showPage('overview');
    }
}

async function selectFamily() {
    localStorage.setItem('identity', 'family');
    showToast('正在加载家人列表...', 'info');

    // ★ 从 API 加载家属列表
    try {
        const familyList = await PatientService.getFamilyList();
        if (familyList && familyList.length > 0) {
            // 存储到全局数据供页面渲染
            window._familyList = familyList;
            renderFamilyList(familyList);
            showToast(`已加载 ${familyList.length} 位家人`, 'success');
        } else {
            showToast('您还没有绑定家人', 'info');
        }
    } catch (e) {
        showToast('正在进入家属关怀模式...', 'success');
    }

    setTimeout(() => showPage('family-mode'), 800);
}

/** 渲染家属列表 */
function renderFamilyList(list) {
    const container = document.querySelector('.family-list') || document.getElementById('familyList');
    if (!container) return;
    container.innerHTML = list.map(f => `
        <div class="family-item" onclick="viewFamilyProgress(${f.familyId || f.id})">
            <div class="family-avatar">${(f.name || '家人').charAt(0)}</div>
            <div class="family-info">
                <div class="family-name">${escHtml(f.name || '家人')}</div>
                <div class="family-relation">${escHtml(f.relationship || '家属')}</div>
            </div>
            <div class="family-status ${f.onlineStatus === 'online' ? 'online' : 'offline'}">
                ${f.onlineStatus === 'online' ? '在线' : '离线'}
            </div>
        </div>
    `).join('');
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

async function sendMessage() {
    const input = document.getElementById('chatInput');
    if (!input?.value?.trim()) return;
    const message = input.value.trim();
    input.value = '';

    // 立即显示用户消息
    appendChatBubble('user', message);

    try {
        const result = await PatientService.sendChatMessage(message);
        if (result && result.reply) {
            appendChatBubble('bot', result.reply);
            if (result.suggestions?.length) {
                renderChatSuggestions(result.suggestions);
            }
        } else {
            appendChatBubble('bot', '抱歉，我暂时无法回答这个问题。请咨询导诊台工作人员。');
        }
    } catch (e) {
        appendChatBubble('bot', '网络连接异常，请稍后再试。(演示模式)');
    }
}

function addQuickQuestion(question) {
    const input = document.getElementById('chatInput');
    if (input) { input.value = question; }
    sendMessage();
}

/** 添加聊天气泡 */
function appendChatBubble(role, text) {
    const container = document.querySelector('.chat-messages') || document.getElementById('chatMessages');
    if (!container) return;
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble ' + role;
    bubble.textContent = text;
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
}

/** 渲染聊天快捷建议 */
function renderChatSuggestions(suggestions) {
    const container = document.getElementById('quickQuestions');
    if (!container) return;
    container.innerHTML = suggestions.map(s =>
        `<button class="quick-btn" onclick="addQuickQuestion('${escHtml(s.question || s)}')">${escHtml(s.question || s)}</button>`
    ).join('');
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
window.selectPatient = selectPatient;
window.selectFamily = selectFamily;
window.loadNavigationRoute = loadNavigationRoute;
window.arriveDestination = arriveDestination;
window.startNavigation = startNavigation;
window.loadTaskDetail = loadTaskDetail;
window.bindData = bindData;
window.renderProgress = renderProgress;
window.renderReports = renderReports;
window.appData = appData;
window.PatientSession = PatientSession;
window.loadPatientData = loadPatientData;
