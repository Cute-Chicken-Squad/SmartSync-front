// 手环管理页面逻辑 - 导诊台场景

// 全局变量
let currentStep = 1;
let currentPage = 1;
let pageSize = 10;
let totalPatients = 0;
let patientData = null;
let selectedPatientId = null;
let deptNodes = [];   // 地图目的地节点（从 /api/map 动态加载，type === 'destination'）

// 科室名称映射
const deptMap = {
    internal: '内科',
    surgery: '外科',
    cardiology: '心内科',
    endocrinology: '内分泌科',
    gastroenterology: '消化内科',
    ent: '耳鼻喉科',
    dermatology: '皮肤科',
    pediatrics: '儿科',
    tcm: '中医科'
};

// 科室任务队列配置
const taskQueueMap = {
    internal: [
        { name: '挂号登记', location: '导诊台' },
        { name: '候诊排队', location: '内科候诊区' },
        { name: '医生问诊', location: '内科诊室' },
        { name: '缴费结算', location: '收费处' },
        { name: '取药', location: '药房' }
    ],
    surgery: [
        { name: '挂号登记', location: '导诊台' },
        { name: '候诊排队', location: '外科候诊区' },
        { name: '医生问诊', location: '外科诊室' },
        { name: '术前检查', location: '检验科' },
        { name: '缴费结算', location: '收费处' }
    ],
    cardiology: [
        { name: '挂号登记', location: '导诊台' },
        { name: '心电图检查', location: '心电图室' },
        { name: '医生问诊', location: '心内科诊室' },
        { name: '缴费结算', location: '收费处' },
        { name: '取药', location: '药房' }
    ],
    endocrinology: [
        { name: '挂号登记', location: '导诊台' },
        { name: '血糖检测', location: '检验科' },
        { name: '医生问诊', location: '内分泌科诊室' },
        { name: '缴费结算', location: '收费处' },
        { name: '取药', location: '药房' }
    ],
    gastroenterology: [
        { name: '挂号登记', location: '导诊台' },
        { name: '候诊排队', location: '消化内科候诊区' },
        { name: '医生问诊', location: '消化内科诊室' },
        { name: '胃镜检查预约', location: '内镜中心' },
        { name: '缴费结算', location: '收费处' }
    ],
    ent: [
        { name: '挂号登记', location: '导诊台' },
        { name: '候诊排队', location: '耳鼻喉科候诊区' },
        { name: '医生问诊', location: '耳鼻喉科诊室' },
        { name: '听力检查', location: '听力室' },
        { name: '缴费取药', location: '收费处/药房' }
    ],
    dermatology: [
        { name: '挂号登记', location: '导诊台' },
        { name: '候诊排队', location: '皮肤科候诊区' },
        { name: '医生问诊', location: '皮肤科诊室' },
        { name: '皮肤检测', location: '皮肤检测室' },
        { name: '缴费取药', location: '收费处/药房' }
    ],
    pediatrics: [
        { name: '挂号登记', location: '导诊台' },
        { name: '候诊排队', location: '儿科候诊区' },
        { name: '医生问诊', location: '儿科诊室' },
        { name: '缴费结算', location: '收费处' },
        { name: '取药', location: '药房' }
    ],
    tcm: [
        { name: '挂号登记', location: '导诊台' },
        { name: '候诊排队', location: '中医科候诊区' },
        { name: '中医问诊', location: '中医科诊室' },
        { name: '缴费结算', location: '收费处' },
        { name: '取药/针灸', location: '中药房/理疗室' }
    ]
};

// 地图不可用时的降级科室列表（对应后端真实 destination 节点）
const deptFallback = [
    { code: 'DEPT_INTERNAL', name: '内科诊室' },
    { code: 'DEPT_SURGERY', name: '外科诊室' },
    { code: 'DEPT_PEDIATRICS', name: '儿科诊室' },
    { code: 'DEPT_ORTHOPEDICS', name: '骨科诊室' },
    { code: 'DEPT_LAB', name: '检验科' },
    { code: 'DEPT_ULTRASOUND', name: 'B超室' },
    { code: 'ECG_1F', name: '心电图室' }
];

// 从后端地图加载「目的地」节点，填充目标科室下拉框
async function loadDeptOptions() {
    const select = document.getElementById('targetDept');
    if (!select) return;

    // 降级：API 失败时用本地科室列表兜底
    const renderOptions = (nodes) => {
        deptNodes = nodes;
        select.innerHTML = '<option value="">请选择目标科室</option>' + nodes.map(n =>
            '<option value="' + n.code + '">' + n.name + '</option>'
        ).join('');
    };

    try {
        const res = await businessApi.getMap();
        if (res && res.code === 200 && res.data && res.data.nodes) {
            const destinations = res.data.nodes
                .filter(n => n.type === 'destination')
                .map(n => ({ code: n.code, name: n.name }));
            if (destinations.length) { renderOptions(destinations); return; }
        }
        console.warn('[手环] 地图目的地节点为空，使用降级科室列表');
    } catch (e) {
        console.warn('[手环] 加载地图失败，使用降级科室列表:', e.message);
    }
    renderOptions(deptFallback);
}

// 根据科室 code 取显示名（优先查地图节点，其次本地映射，最后回退 code 本身）
function getDeptName(code) {
    const node = deptNodes.find(n => n.code === code);
    if (node) return node.name;
    return deptMap[code] || code;
}

// 模拟数据 - 已分配手环列表
let assignedBracelets = [
    { id: 1, name: '王大爷', maskedId: 'PAT-7A3B-9C2D', braceletId: 'ABC123456789', dept: '心内科', deptCode: 'cardiology', bindTime: '2026-06-17 08:15', status: 'active' },
    { id: 2, name: '李女士', maskedId: 'PAT-2E8F-4D1A', braceletId: 'DEF234567890', dept: '内分泌科', deptCode: 'endocrinology', bindTime: '2026-06-17 09:30', status: 'active' },
    { id: 3, name: '张先生', maskedId: 'PAT-5B1C-7E3F', braceletId: 'GHI345678901', dept: '消化内科', deptCode: 'gastroenterology', bindTime: '2026-06-17 10:45', status: 'active' },
    { id: 4, name: '赵阿姨', maskedId: 'PAT-9D4A-2B8E', braceletId: 'JKL456789012', dept: '内科', deptCode: 'internal', bindTime: '2026-06-17 11:20', status: 'active' },
    { id: 5, name: '孙大爷', maskedId: 'PAT-1F7C-5A3D', braceletId: 'MNO567890123', dept: '外科', deptCode: 'surgery', bindTime: '2026-06-17 12:00', status: 'active' },
    { id: 6, name: '周女士', maskedId: 'PAT-6E2B-8F4C', braceletId: 'PQR678901234', dept: '皮肤科', deptCode: 'dermatology', bindTime: '2026-06-17 13:15', status: 'active' },
    { id: 7, name: '吴先生', maskedId: 'PAT-3A9D-1E7B', braceletId: 'STU789012345', dept: '耳鼻喉科', deptCode: 'ent', bindTime: '2026-06-17 14:00', status: 'active' },
    { id: 8, name: '郑阿姨', maskedId: 'PAT-8C5F-3A2E', braceletId: 'VWX890123456', dept: '中医科', deptCode: 'tcm', bindTime: '2026-06-16 15:30', status: 'inactive' },
];

// 初始化
document.addEventListener('DOMContentLoaded', function () {
    updateDateTime();
    loadDeptOptions();
    loadPatientList();
    updateSummaryStats();
});

// 更新时间显示
function updateDateTime() {
    setInterval(() => {
        const date = new Date();
        const timeString = formatLocalDateTime(date);
        document.getElementById('dateInfo').textContent = timeString;
    }, 1000);
}

// 更新汇总统计（API 优先，失败时本地计算降级）
async function updateSummaryStats() {
    try {
        await loadBraceletSummary();
    } catch (e) {
        // 降级：本地计算
        const total = 156;
        const bound = assignedBracelets.filter(p => p.status === 'active').length;
        const available = total - bound;
        const todayAssigned = assignedBracelets.filter(p => p.bindTime && p.bindTime.startsWith(new Date().toISOString().substring(0, 10))).length;
        document.getElementById('totalBracelets').textContent = total;
        document.getElementById('boundBracelets').textContent = bound;
        document.getElementById('availableBracelets').textContent = available;
        document.getElementById('todayAssigned').textContent = todayAssigned;
    }
}

// 播放滴声（Web Audio API）
function playBeepSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(1200, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.15);

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
    } catch (e) {
        console.log('音频播放失败:', e);
    }
}

// 模拟身份证读卡
function simulateIdRead(e) {
    const btn = (e && e.target) || document.querySelector('#step1Content .btn.primary');
    if (!btn) return;
    btn.innerHTML = '读取中...';
    btn.disabled = true;

    setTimeout(() => {
        const names = ['张伟', '李娜', '王芳', '刘洋', '陈明', '杨静', '赵磊', '黄丽'];
        const name = names[Math.floor(Math.random() * names.length)];
        const gender = Math.random() > 0.5 ? '1' : '2';
        const age = Math.floor(Math.random() * 60) + 20;
        const idCardNo = generateIdCard(gender, age);
        const phone = '1' + (Math.floor(Math.random() * 9) + 3) + String(Math.floor(Math.random() * 1000000000)).padStart(9, '0');

        document.getElementById('patientName').value = name;
        document.getElementById('idCardNo').value = idCardNo;
        document.getElementById('gender').value = gender;
        document.getElementById('age').value = age;
        document.getElementById('phone').value = phone;

        btn.innerHTML = '模拟读卡';
        btn.disabled = false;
    }, 800);
}

// 生成随机身份证号
function generateIdCard(gender, age) {
    const prefix = '110101';
    const year = new Date().getFullYear() - age;
    const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
    const seq = String(Math.floor(Math.random() * 999)).padStart(3, '0');
    const code = prefix + String(year) + month + day + seq;
    const last = gender === '1' ? (Math.floor(Math.random() * 5) * 2 + 1) : (Math.floor(Math.random() * 5) * 2);
    return code + last;
}

// 生成脱敏ID
function generateMaskedId() {
    const chars = '0123456789ABCDEF';
    let part1 = '', part2 = '';
    for (let i = 0; i < 4; i++) {
        part1 += chars.charAt(Math.floor(Math.random() * chars.length));
        part2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return 'PAT-' + part1 + '-' + part2;
}

// 生成 NFC 芯片 UID（模拟手环 NFC 靠近读到的 ID，格式如 NF8997190469）
function generateNfcId() {
    let result = 'NF';
    for (let i = 0; i < 10; i++) {
        result += Math.floor(Math.random() * 10);
    }
    return result;
}

// 步骤切换
function goToStep1() {
    currentStep = 1;
    updateStepIndicator();
    document.getElementById('step1Content').classList.remove('hidden');
    document.getElementById('step2Content').classList.add('hidden');
    document.getElementById('step3Content').classList.add('hidden');
    document.getElementById('cardTitle').textContent = '患者信息登记';
    document.getElementById('assignStatus').textContent = '待录入';
    document.getElementById('assignStatus').classList.remove('active');
}

function goToStep2() {
    const name = document.getElementById('patientName').value.trim();
    const idCardNo = document.getElementById('idCardNo').value.trim();
    const targetDept = document.getElementById('targetDept').value;

    if (!name) {
        alert('请输入患者姓名');
        return;
    }
    if (!idCardNo || !validateIdCard(idCardNo)) {
        alert('请输入正确的18位身份证号');
        return;
    }
    if (!targetDept) {
        alert('请选择目标科室');
        return;
    }

    patientData = {
        name: name,
        idCardNo: idCardNo,
        gender: document.getElementById('gender').value,
        age: document.getElementById('age').value,
        phone: document.getElementById('phone').value,
        insuranceNo: document.getElementById('insuranceNo').value,
        medicalHistory: document.getElementById('medicalHistory').value,
        emergencyContactName: document.getElementById('emergencyContactName').value,
        emergencyContactPhone: document.getElementById('emergencyContactPhone').value,
        targetDept: targetDept,
        deptName: getDeptName(targetDept)
    };

    updatePatientPreview();
    resetDeviceScreen();

    currentStep = 2;
    updateStepIndicator();
    document.getElementById('step1Content').classList.add('hidden');
    document.getElementById('step2Content').classList.remove('hidden');
    document.getElementById('step3Content').classList.add('hidden');
    document.getElementById('cardTitle').textContent = '手环绑定';
    document.getElementById('assignStatus').textContent = '待绑定';
    document.getElementById('assignStatus').classList.add('active');
}

async function goToStep3(nfcId) {
    // 1. 先建患者档案（不传手环字段），拿到患者 ID（后端 19 位雪花 ID 已被转成字符串）
    const patientId = await createPatientApi({
        name: patientData.name,
        idCardNo: patientData.idCardNo,
        gender: patientData.gender ? parseInt(patientData.gender, 10) : null,
        age: patientData.age ? parseInt(patientData.age, 10) : null,
        phone: patientData.phone || null,
        insuranceNo: patientData.insuranceNo || null,
        medicalHistory: patientData.medicalHistory || null,
        emergencyContactName: patientData.emergencyContactName || null,
        emergencyContactPhone: patientData.emergencyContactPhone || null,
    });

    // 2. 绑定 NFC 手环（POST /api/nfc/bind），后端返回 braceletId / maskedId / bindTime
    let maskedId = generateMaskedId();
    let bindTime = new Date().toISOString().replace('T', ' ').substring(0, 19);
    if (patientId) {
        const bind = await bindNfcApi(nfcId, patientId);
        if (bind) {
            maskedId = bind.maskedId || maskedId;
            bindTime = (bind.bindTime || '').replace('T', ' ').substring(0, 19) || bindTime;
        } else {
            console.warn('[手环] NFC 绑定失败，使用本地脱敏 ID');
        }
    } else {
        console.warn('[手环] 患者建档失败，仅本地记录');
    }

    patientData.patientId = patientId;
    patientData.nfcId = nfcId;
    patientData.braceletId = nfcId;   // 展示用 NFC 芯片 ID
    patientData.maskedId = maskedId;
    patientData.bindTime = bindTime;

    // 3. 写入目的地（科室）→ 后端刷卡导航会自动排序要去科室的顺序
    if (patientId && patientData.targetDept) {
        const destOk = await addDestinationApi(patientId, patientData.targetDept, patientData.deptName);
        if (destOk) {
            console.log('[手环] 已写入目的地:', patientData.deptName, '(' + patientData.targetDept + ')');
        } else {
            console.warn('[手环] 写入目的地失败，仅本地记录');
        }
    }

    // 显示结果
    document.getElementById('resultMaskedId').textContent = maskedId;
    document.getElementById('resultName').textContent = patientData.name;
    document.getElementById('resultDept').textContent = patientData.deptName;
    document.getElementById('resultBraceletId').textContent = nfcId;
    document.getElementById('resultTime').textContent = bindTime;

    // 生成任务队列
    renderTaskQueue(patientData.targetDept);

    // 生成条形码
    generateBarcode(maskedId);

    currentStep = 3;
    updateStepIndicator();
    document.getElementById('step1Content').classList.add('hidden');
    document.getElementById('step2Content').classList.add('hidden');
    document.getElementById('step3Content').classList.remove('hidden');
    document.getElementById('cardTitle').textContent = '绑定完成';
    document.getElementById('assignStatus').textContent = '已完成';
    document.getElementById('assignStatus').classList.add('active');

    // 加入本地列表并刷新汇总
    addPatientToList(patientData);
    updateSummaryStats();
}

// 渲染任务队列
function renderTaskQueue(deptCode) {
    const queue = taskQueueMap[deptCode] || taskQueueMap.internal;
    const container = document.getElementById('resultTaskQueue');
    container.innerHTML = '';

    queue.forEach((task, index) => {
        const item = document.createElement('div');
        item.className = 'task-item' + (index === 0 ? ' active' : '');
        item.innerHTML = `
            <div class="task-number">${index + 1}</div>
            <div class="task-name">${task.name}</div>
            <div class="task-location">${task.location}</div>
        `;
        container.appendChild(item);
    });
}

// 生成条形码
function generateBarcode(text) {
    const container = document.getElementById('barcodeLines');
    container.innerHTML = '';

    const seed = text.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    for (let i = 0; i < 40; i++) {
        const line = document.createElement('div');
        line.className = 'barcode-line';
        const height = Math.floor((Math.sin(seed + i * 0.7) + 1) * 12 + 4);
        const width = Math.random() > 0.5 ? 2 : 3;
        line.style.height = height + 'px';
        line.style.width = width + 'px';
        container.appendChild(line);
    }

    document.getElementById('barcodeText').textContent = text;
}

// 更新步骤指示器
function updateStepIndicator() {
    const steps = document.querySelectorAll('.steps-indicator .step');
    const lines = document.querySelectorAll('.steps-indicator .step-line');

    steps.forEach((step) => {
        const stepNum = parseInt(step.dataset.step);
        step.classList.remove('active', 'completed');
        if (stepNum < currentStep) {
            step.classList.add('completed');
        } else if (stepNum === currentStep) {
            step.classList.add('active');
        }
    });

    lines.forEach((line, index) => {
        line.classList.remove('active');
        if (index < currentStep - 1) {
            line.classList.add('active');
        }
    });
}

// 更新患者预览
function updatePatientPreview() {
    document.getElementById('previewName').textContent = patientData.name;
    document.getElementById('previewIdCard').textContent = maskIdCard(patientData.idCardNo);
    document.getElementById('previewGender').textContent = patientData.gender === '1' ? '男' : (patientData.gender === '2' ? '女' : '-');
    document.getElementById('previewAge').textContent = patientData.age || '-';
    document.getElementById('previewPhone').textContent = patientData.phone || '-';
    document.getElementById('previewDept').textContent = patientData.deptName;
}

// 重置设备屏幕
function resetDeviceScreen() {
    document.getElementById('deviceStatus').textContent = '等待中...';
    document.getElementById('deviceStatus').className = 'device-status';
    document.querySelector('.light-dot').className = 'light-dot';
    document.querySelector('.light-label').textContent = '就绪';
    document.getElementById('soundWave').classList.add('hidden');

    document.getElementById('screenContent').innerHTML = `
        <div class="screen-waiting">
            <div class="nfc-icon">
                <div class="nfc-ring"></div>
                <div class="nfc-ring delay"></div>
                <div class="nfc-center"></div>
            </div>
            <p>请将手环靠近感应区</p>
        </div>
    `;

    const bindBtn = document.getElementById('bindBtn');
    bindBtn.disabled = false;
    bindBtn.innerHTML = '<span class="btn-icon"></span>模拟手环靠近';
}

// 开始绑定（模拟手环靠近）
function startBind() {
    const bindBtn = document.getElementById('bindBtn');
    bindBtn.disabled = true;
    bindBtn.innerHTML = '绑定中...';

    // 更新设备状态
    document.getElementById('deviceStatus').textContent = '正在读取...';
    document.getElementById('deviceStatus').className = 'device-status scanning';
    document.querySelector('.light-dot').className = 'light-dot scanning';
    document.querySelector('.light-label').textContent = '读取中';

    // 1.5秒后完成
    setTimeout(() => {
        const nfcId = generateNfcId();

        // 播放滴声
        playBeepSound();

        // 显示声波动画
        document.getElementById('soundWave').classList.remove('hidden');

        // 更新屏幕内容
        document.getElementById('screenContent').innerHTML = `
            <div class="screen-success">
                <div class="success-text">✓ 读取成功</div>
                <div class="bracelet-id-text">${nfcId}</div>
            </div>
        `;

        // 更新设备状态
        document.getElementById('deviceStatus').textContent = '读取完成';
        document.getElementById('deviceStatus').className = 'device-status success';
        document.querySelector('.light-dot').className = 'light-dot success';
        document.querySelector('.light-label').textContent = '完成';

        // 0.8秒后跳转到步骤3
        setTimeout(() => {
            goToStep3(nfcId);
        }, 800);
    }, 1500);
}

// 手动输入手环ID
function manualInputBraceletId() {
    document.getElementById('manualModal').classList.add('show');
}

function closeManualModal() {
    document.getElementById('manualModal').classList.remove('show');
    document.getElementById('manualBraceletId').value = '';
}

function confirmManualBind() {
    const nfcId = document.getElementById('manualBraceletId').value.trim().toUpperCase();

    if (!nfcId) {
        alert('请输入手环 NFC 芯片 ID');
        return;
    }

    if (assignedBracelets.some(p => p.braceletId === nfcId && p.status === 'active')) {
        alert('该手环 NFC 已被绑定，请使用其他手环');
        return;
    }

    closeManualModal();
    goToStep3(nfcId);
}

// 重置表单
function resetForm() {
    document.getElementById('patientForm').reset();
    patientData = null;
    goToStep1();
}

// 打印小票
function printTicket() {
    alert('小票打印中...\n\n患者：' + patientData.name + '\n脱敏ID：' + patientData.maskedId + '\n科室：' + patientData.deptName + '\n手环：' + patientData.braceletId);
}

// 加载患者列表（API 优先）
async function loadPatientList() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    // 尝试从 API 加载
    try {
        const data = await fetchPatientsApi(currentPage, pageSize, searchTerm);
        if (data && data.records) {
            // 将 API 数据映射到本地格式
            assignedBracelets = data.records.map(r => ({
                id: r.id,
                name: r.name,
                maskedId: r.maskedId || r.idCardNo,
                braceletId: r.nfcUid || '',
                dept: '',
                deptCode: '',
                bindTime: r.bindTime || r.createdAt || '',
                status: r.nfcUid ? 'active' : 'inactive',
            }));
            totalPatients = data.total || assignedBracelets.length;
            renderPatientTable(searchTerm);
            updatePageInfo();
            return;
        }
    } catch (e) {
        console.warn('[手环] API 加载列表失败，使用本地数据:', e.message);
    }

    // 降级：本地过滤
    renderPatientTable(searchTerm);
    updatePageInfo();
}

/** 渲染患者表格 */
function renderPatientTable(searchTerm) {
    const tbody = document.getElementById('patientList');
    let filteredList = assignedBracelets;
    if (searchTerm) {
        filteredList = assignedBracelets.filter(p =>
            p.name.toLowerCase().includes(searchTerm) ||
            (p.braceletId || '').toLowerCase().includes(searchTerm) ||
            (p.maskedId || '').toLowerCase().includes(searchTerm)
        );
    }

    totalPatients = filteredList.length;
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageData = filteredList.slice(startIndex, endIndex);

    tbody.innerHTML = '';

    pageData.forEach(patient => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${patient.name}</td>
            <td><span class="masked-id-text">${patient.maskedId}</span></td>
            <td><span class="dept-tag-sm">${patient.dept}</span></td>
            <td><span class="bracelet-id-text">${patient.braceletId}</span></td>
            <td><span class="status-badge ${patient.status}">${patient.status === 'active' ? '已绑定' : '已解绑'}</span></td>
            <td>
                <button class="btn-sm" onclick="showDetailModalById('${patient.id}')">详情</button>
                <button class="btn-sm danger" onclick="showUnbindModal('${patient.id}')" ${patient.status === 'inactive' ? 'disabled' : ''}>解绑</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// 搜索患者
function searchPatients() {
    currentPage = 1;
    loadPatientList();
}

// 分页
function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        loadPatientList();
    }
}

function nextPage() {
    const maxPage = Math.ceil(totalPatients / pageSize);
    if (currentPage < maxPage) {
        currentPage++;
        loadPatientList();
    }
}

function updatePageInfo() {
    const maxPage = Math.ceil(totalPatients / pageSize) || 1;
    document.getElementById('pageInfo').textContent = `第 ${currentPage} 页 / 共 ${maxPage} 页`;
}

// 添加患者到列表
function addPatientToList(data) {
    const newPatient = {
        id: data.patientId || (assignedBracelets.length + 1),
        name: data.name,
        maskedId: data.maskedId,
        braceletId: data.braceletId,   // NFC 芯片 ID
        dept: data.deptName,
        deptCode: data.targetDept,
        bindTime: data.bindTime,
        status: 'active'
    };
    assignedBracelets.unshift(newPatient);
    // 同步到 localStorage，供任务监控页读取
    try {
        const stored = JSON.parse(localStorage.getItem('smartsync_patients') || '[]');
        stored.unshift(newPatient);
        localStorage.setItem('smartsync_patients', JSON.stringify(stored.slice(0, 100)));
    } catch(e) {}
    loadPatientList();
}

// 显示解绑弹窗
function showUnbindModal(patientId) {
    selectedPatientId = patientId;
    const patient = assignedBracelets.find(p => String(p.id) === String(patientId));
    document.getElementById('unbindBraceletId').textContent = patient.braceletId;
    document.getElementById('unbindModal').classList.add('show');
}

function closeUnbindModal() {
    document.getElementById('unbindModal').classList.remove('show');
    selectedPatientId = null;
}

async function confirmUnbind() {
    if (selectedPatientId) {
        const patient = assignedBracelets.find(p => String(p.id) === String(selectedPatientId));
        if (patient) {
            // ★ 解绑 = 归还手环（POST /api/bracelet/return，清空 nfcUid，保留患者档案）
            const ok = await returnBraceletApi(selectedPatientId);
            if (ok) {
                console.log('[手环] 已通过 API 归还手环:', patient.name);
            } else {
                console.warn('[手环] API 归还失败，仅本地标记');
            }
            loadPatientList();
            updateSummaryStats();
        }
    }
    closeUnbindModal();
    alert('手环已解绑');
}

// 显示详情弹窗
function showDetailModalById(patientId) {
    const patient = assignedBracelets.find(p => String(p.id) === String(patientId));
    if (patient) {
        showDetailModal(patient);
    }
}

function showDetailModal(patient) {
    const tasks = taskQueueMap[patient.deptCode] || taskQueueMap.internal;
    const taskListHtml = tasks.map((task, i) => `
        <div class="task-item ${i === 0 ? 'active' : ''}">
            <div class="task-number">${i + 1}</div>
            <div class="task-name">${task.name}</div>
            <div class="task-location">${task.location}</div>
        </div>
    `).join('');

    const content = document.getElementById('detailContent');
    content.innerHTML = `
        <div class="detail-grid">
            <div class="detail-section">
                <h5>基本信息</h5>
                <div class="detail-item">
                    <span class="detail-label">姓名</span>
                    <span class="detail-value">${patient.name}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">脱敏ID</span>
                    <span class="detail-value" style="color: #5c7cfa; font-family: monospace;">${patient.maskedId}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">目标科室</span>
                    <span class="detail-value">${patient.dept}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">手环ID</span>
                    <span class="detail-value" style="font-family: monospace;">${patient.braceletId}</span>
                </div>
            </div>
            <div class="detail-section">
                <h5>绑定信息</h5>
                <div class="detail-item">
                    <span class="detail-label">绑定时间</span>
                    <span class="detail-value">${patient.bindTime}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">状态</span>
                    <span class="detail-value">${patient.status === 'active' ? '已绑定' : '已解绑'}</span>
                </div>
            </div>
            <div class="detail-section full" style="grid-column: 1 / -1;">
                <h5>任务队列</h5>
                <div class="task-queue" style="margin-top: 8px;">
                    ${taskListHtml}
                </div>
                ${patient.status === 'active' ? `
                <button class="btn primary" style="margin-top:16px;width:100%;" onclick="location.href='/control-center/html/task-monitor.html?patientId=${patient.id}&patientName=${encodeURIComponent(patient.name)}'">任务管理 →</button>
                ` : ''}
            </div>
        </div>
    `;
    document.getElementById('detailModal').classList.add('show');
}

function closeDetailModal() {
    document.getElementById('detailModal').classList.remove('show');
}

// 验证身份证号
function validateIdCard(idCard) {
    return /^\d{17}[\dXx]$/.test(idCard);
}

// 隐藏身份证中间部分
function maskIdCard(idCard) {
    if (!idCard || idCard.length < 18) return idCard;
    return idCard.substring(0, 6) + '********' + idCard.substring(14);
}

// ===================== API 对接层 =====================

/** 创建患者 → POST /api/patient */
async function createPatientApi(data) {
    try {
        const res = await businessApi.createPatient(data);
        if (res.code === 200) return res.data;
        console.warn('创建患者返回非 200:', res);
        return null;
    } catch (error) {
        console.error('创建患者失败:', error);
        return null;
    }
}

/** 更新患者 → PUT /api/patient/:id */
/** 写入目的地（科室）→ POST /api/substation/navigation/destinations，刷卡导航自动排序 */
async function addDestinationApi(patientId, nodeCode, label) {
    try {
        const res = await businessApi.addDestination(patientId, nodeCode, label);
        return res.code === 200;
    } catch (error) {
        console.error('写入目的地失败:', error);
        return false;
    }
}

async function updatePatientApi(id, data) {
    try {
        const res = await businessApi.updatePatient(id, data);
        return res.code === 200;
    } catch (error) {
        console.error('更新患者失败:', error);
        return false;
    }
}

/** 分页查询患者 → GET /api/patient/page */
async function fetchPatientsApi(current, size, keyword) {
    try {
        const res = await businessApi.getPatientPage({ current, size, keyword: keyword || '' });
        if (res.code === 200) return res.data;
        console.warn('获取患者列表返回非 200:', res);
        return null;
    } catch (error) {
        console.error('获取患者列表失败:', error);
        return null;
    }
}

/** 加载手环库存概览 → GET /api/bracelet/summary */
async function loadBraceletSummary() {
    try {
        const res = await businessApi.getBraceletSummary();
        if (res.code === 200 && res.data) {
            document.getElementById('totalBracelets').textContent = res.data.totalBracelets || 0;
            document.getElementById('boundBracelets').textContent = res.data.boundCount || 0;
            document.getElementById('availableBracelets').textContent = res.data.availableCount || 0;
            document.getElementById('todayAssigned').textContent = res.data.todayIssued || 0;
        }
    } catch (e) {
        console.warn('获取手环概览失败，使用本地计算:', e.message);
        updateSummaryStats();
    }
}

/** 删除患者 → DELETE /api/patient/:id */
async function deletePatientApi(id) {
    try {
        const res = await businessApi.deletePatient(id);
        return res.code === 200;
    } catch (error) {
        console.error('删除患者失败:', error);
        return false;
    }
}

/** 绑定 NFC 手环 → POST /api/nfc/bind，返回 { braceletId, maskedId, bindTime } */
async function bindNfcApi(nfcId, patientId) {
    try {
        const res = await businessApi.nfcBind(nfcId, patientId);
        if (res.code === 200) return res.data;
        console.warn('绑定 NFC 返回非 200:', res);
        return null;
    } catch (error) {
        console.error('绑定 NFC 失败:', error);
        return null;
    }
}

/** 归还/解绑手环 → POST /api/bracelet/return（清空 nfcUid，保留患者档案） */
async function returnBraceletApi(patientId) {
    try {
        const res = await businessApi.returnBracelet(patientId);
        return res.code === 200;
    } catch (error) {
        console.error('归还手环失败:', error);
        return false;
    }
}