/**
 * 智环引诊 - 患者客户端 NFC 读取
 *
 * 策略：真机 Web NFC 优先 + 固定测试 UID 降级
 *   - 支持 NDEFReader 的环境（Android Chrome + HTTPS + 用户手势）→ 真读卡
 *   - 不支持 / 读卡失败 → 返回 window.TEST_UID 或 DEMO_CARDS[0].uid（确定性，不再随机）
 *
 * 注意：Web NFC 读的是 NDEF 记录，不是裸硬件 UID。发卡时需用 writeCard()
 *       把 UID 作为文本记录写入卡，读卡时再解析该文本。
 */

window.TEST_UID = window.TEST_UID || null;

const NfcReader = {
    _supported: null,

    isSupported() {
        if (this._supported === null) {
            this._supported = typeof NDEFReader !== 'undefined';
        }
        return this._supported;
    },

    /** 状态回调，可被 UI 覆盖：scanning | success | fail | unsupported */
    onStatus() {},

    /** 取当前应使用的降级测试 UID */
    testUid() {
        if (window.TEST_UID) return window.TEST_UID;
        if (window.DEMO_CARDS && window.DEMO_CARDS[0]) return window.DEMO_CARDS[0].uid;
        return null;
    },

    /**
     * 读卡，返回 UID 字符串（真机读不到时降级为测试 UID）
     */
    async readCard() {
        if (!this.isSupported()) {
            this.onStatus('unsupported');
            return this.testUid();
        }

        this.onStatus('scanning');
        try {
            const ndef = new NDEFReader();
            const uid = await new Promise((resolve) => {
                let settled = false;
                const done = (v) => { if (!settled) { settled = true; clearTimeout(timer); resolve(v); } };
                const timer = setTimeout(() => done(null), 8000);

                ndef.addEventListener('reading', ({ message }) => done(this._extractUid(message)), { once: true });
                ndef.addEventListener('readingerror', () => done(null), { once: true });
                ndef.scan().catch(() => done(null));
            });

            if (uid) {
                this.onStatus('success');
                return uid;
            }
            this.onStatus('fail');
            return this.testUid();
        } catch (e) {
            this.onStatus('fail');
            return this.testUid();
        }
    },

    /** 从 NDEF message 中解析 UID 文本记录 */
    _extractUid(message) {
        if (!message || !message.records) return null;
        for (const record of message.records) {
            if ((record.recordType === 'text' || record.recordType === 'mime') && record.data) {
                const text = new TextDecoder().decode(record.data);
                const trimmed = (text || '').trim();
                if (trimmed) return trimmed;
            }
        }
        return null;
    },

    /** 写卡：把 UID 作为文本记录写入（发卡流程），返回是否成功 */
    async writeCard(uid) {
        if (!this.isSupported()) return false;
        try {
            const ndef = new NDEFReader();
            await ndef.write({ records: [{ recordType: 'text', data: String(uid) }] });
            return true;
        } catch (e) {
            return false;
        }
    },
};

window.NfcReader = NfcReader;

// ===================== 兼容旧调用 =====================
// 保留原模拟函数名，避免其它页面/内联脚本调用报错；内部不再随机。

function simulateRingDetection() {
    showTouchHint('正在感应手环...');
    setTimeout(() => {
        showTouchHint('手环识别成功');
        setTimeout(() => showPage('overview'), 1000);
    }, 2000);
}

function toggleSeniorMode() {
    const container = document.querySelector('.container');
    const toggle = document.getElementById('seniorModeToggle');
    if (toggle.checked) {
        container.classList.add('senior-friendly');
        showTouchHint('适老化模式已开启');
    } else {
        container.classList.remove('senior-friendly');
        showTouchHint('适老化模式已关闭');
    }
}

function exportReport() {
    showTouchHint('正在生成报告...');
    setTimeout(() => {
        showTouchHint('报告生成成功，正在下载...');
        setTimeout(() => showTouchHint('报告已下载到本地'), 1000);
    }, 2000);
}

window.simulateRingDetection = simulateRingDetection;
window.toggleSeniorMode = toggleSeniorMode;
window.exportReport = exportReport;
