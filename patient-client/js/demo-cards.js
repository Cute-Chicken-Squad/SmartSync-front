/**
 * 智环引诊 - 演示卡配置（UID → 患者 → 专属路线 唯一真源）
 *
 * 用途：
 *   1. 现场演示时按卡片 UID 确定性返回绑定路线（去随机化）
 *   2. 离线兜底：路线静态打进本文件，断网也能返回正确结果
 *   3. 预留真实后端接口（nfcDetect）可用时，以真实返回覆盖本表
 *
 * 数据来源：
 *   - UID 与患者信息来自 seed_data.py（nfcUid = BC1111111111 ~ BC8888888888）
 *   - 路线（任务序列）来自 需新增的模拟数据.md
 */
(function () {
    'use strict';

    // 科室 → 楼层 + 目标诊室
    var DEPT_INFO = {
        '心内科': { floor: '3F', node: '心内科诊室' },
        '内分泌科': { floor: '2F', node: '内分泌科诊室' },
        '消化内科': { floor: '2F', node: '消化内科诊室' },
        '内科': { floor: '2F', node: '内科诊室' },
        '外科': { floor: '3F', node: '外科诊室' },
        '皮肤科': { floor: '2F', node: '皮肤科诊室' },
        '骨科': { floor: '3F', node: '骨科诊室' },
        '儿科': { floor: '1F', node: '儿科诊室' },
    };

    // 每患者专属检查环节（路线中段，用于体现“专属”差异）
    var DEPT_STEP = {
        '心内科': '前往心电图室完成心电图检查',
        '内分泌科': '前往检验科完成血糖检测',
        '消化内科': '前往内镜中心预约胃镜检查',
        '内科': '前往内科候诊区等待叫号',
        '外科': '前往检验科完成术前检查',
        '皮肤科': '前往皮肤检测室完成检测',
        '骨科': '前往影像科完成影像检查',
        '儿科': '前往儿科候诊区等待叫号',
    };

    function buildRoute(dept) {
        var info = DEPT_INFO[dept];
        return {
            duration: 5,
            steps: [
                { step: 1, instruction: '从当前位置出发', detail: '门诊楼1层大厅' },
                { step: 2, instruction: DEPT_STEP[dept], detail: '按导引牌前行' },
                { step: 3, instruction: '乘坐电梯前往 ' + info.floor, detail: '电梯在走廊尽头左转' },
                { step: 4, instruction: '到达 ' + info.node, detail: info.floor + ' 候诊区' },
            ],
        };
    }

    var CARDS = [
        { uid: 'BC1111111111', patientId: 'PAT-7A3B-9C2D', name: '王大爷', gender: '男', age: 72, dept: '心内科' },
        { uid: 'BC2222222222', patientId: 'PAT-2E8F-4D1A', name: '李女士', gender: '女', age: 45, dept: '内分泌科' },
        { uid: 'BC3333333333', patientId: 'PAT-5B1C-7E3F', name: '张先生', gender: '男', age: 38, dept: '消化内科' },
        { uid: 'BC4444444444', patientId: 'PAT-9D4A-2B8E', name: '赵阿姨', gender: '女', age: 65, dept: '内科' },
        { uid: 'BC5555555555', patientId: 'PAT-1F7C-5A3D', name: '孙大爷', gender: '男', age: 78, dept: '外科' },
        { uid: 'BC6666666666', patientId: 'PAT-6E2B-8F4C', name: '周女士', gender: '女', age: 28, dept: '皮肤科' },
        { uid: 'BC7777777777', patientId: 'PAT-3A9D-1E7B', name: '吴先生', gender: '男', age: 55, dept: '骨科' },
        { uid: 'BC8888888888', patientId: 'PAT-8C5F-3A2E', name: '郑阿姨', gender: '女', age: 62, dept: '儿科' },
    ];

    var DEMO_CARDS = CARDS.map(function (c) {
        return {
            uid: c.uid,
            patientId: c.patientId,
            name: c.name,
            gender: c.gender,
            age: c.age,
            dept: c.dept,
            floor: DEPT_INFO[c.dept].floor,
            route: buildRoute(c.dept),
        };
    });

    var DEMO_CARDS_BY_UID = {};
    DEMO_CARDS.forEach(function (c) { DEMO_CARDS_BY_UID[c.uid] = c; });

    /** 按 UID 解析绑定卡（无匹配返回 null） */
    function resolveDemoCard(uid) {
        if (!uid) return null;
        return DEMO_CARDS_BY_UID[String(uid).trim().toUpperCase()] || null;
    }

    /** 读取上次成功读到的卡（用于刷新后还原同一路线） */
    function getCachedCard() {
        try {
            var session = JSON.parse(localStorage.getItem('smartsync_patient_session') || 'null');
            return session && session.nfcId ? resolveDemoCard(session.nfcId) : null;
        } catch (e) { return null; }
    }

    window.DEMO_CARDS = DEMO_CARDS;
    window.DEMO_CARDS_BY_UID = DEMO_CARDS_BY_UID;
    window.resolveDemoCard = resolveDemoCard;
    window.getCachedCard = getCachedCard;
})();
