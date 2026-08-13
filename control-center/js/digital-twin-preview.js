// ═══════════════════════════════════════════════════════════
// 智环引诊 - 数字孪生缩略图（首页「院区数字孪生」卡片）
// 渲染与 /digital-twin/index.html 相同的孪生场景（缩小版）：
//   墙体(590) + 科室(52)，数据源 /api/get-layout
// 相机、地面、网格、墙体/科室几何与 twin_scene.js 保持一致
// ═══════════════════════════════════════════════════════════
(function () {
    'use strict';

    var WALL_HEIGHT = 3.2;
    var WALL_THICKNESS = 0.2;

    function TwinPreview() {
        this.container = document.getElementById('twinPreviewCanvas');
        if (!this.container) return;
        this.init();
    }

    TwinPreview.prototype.init = function () {
        var W = this.container.clientWidth || 900;
        var H = this.container.clientHeight || 300;

        this.scene = new THREE.Scene();
        this.scene.background = null; // 透明背景，去掉灰色底色

        this.camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 2000);
        this.camera.position.set(360, 37, -50);
        this.camera.lookAt(360, 0, 20);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(W, H);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.container.appendChild(this.renderer.domElement);

        // 灯光（提亮，避免暗沉）
        this.scene.add(new THREE.HemisphereLight(0xffffff, 0xe6ebf0, 0.6));
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
        var dir = new THREE.DirectionalLight(0xffffff, 1.3);
        dir.position.set(360, 120, -60);
        this.scene.add(dir);
        var fill = new THREE.DirectionalLight(0xffffff, 0.6);
        fill.position.set(300, 60, 60);
        this.scene.add(fill);

        this.load();

        var self = this;
        window.addEventListener('resize', function () { self.onResize(); });
    };

    TwinPreview.prototype.load = function () {
        var self = this;
        fetch('/api/get-layout')
            .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
            .then(function (data) { self.build(data); })
            .catch(function () {
                // 降级：直接读本地 JSON（与 /api/get-layout 同源）
                Promise.all([
                    fetch('/digital-twin/data/hospital_f1/walls.json').then(function (r) { return r.json(); }),
                    fetch('/digital-twin/data/hospital_f1/departments.json').then(function (r) { return r.json(); })
                ]).then(function (rs) {
                    self.build({ walls: (rs[0] && rs[0].walls) || [], departments: (rs[1] && rs[1].departments) || [] });
                }).catch(function () {});
            });
    };

    TwinPreview.prototype.build = function (data) {
        var self = this;
        var walls = data.walls || [];
        var depts = data.departments || [];

        this.wallsGroup = new THREE.Group();
        this.deptsGroup = new THREE.Group();
        this.scene.add(this.wallsGroup);
        this.scene.add(this.deptsGroup);

        // 墙体：与 twin_scene.createWalls 一致（start_x/end_x 格式）
        walls.forEach(function (w) {
            if (w.start_x === undefined || w.end_x === undefined) return;
            var dx = w.end_x - w.start_x;
            var dy = w.end_y - w.start_y;
            var len = Math.sqrt(dx * dx + dy * dy);
            if (len < 0.3) return;

            var mesh = new THREE.Mesh(
                new THREE.BoxGeometry(len, WALL_HEIGHT, WALL_THICKNESS),
                new THREE.MeshStandardMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: 0.95,
                    roughness: 0.5,
                    metalness: 0.0,
                    side: THREE.DoubleSide
                })
            );
            mesh.position.set((w.start_x + w.end_x) / 2, WALL_HEIGHT / 2, (w.start_y + w.end_y) / 2);
            mesh.rotation.y = Math.atan2(dy, dx);
            self.wallsGroup.add(mesh);
        });

        // 科室：与 twin_scene.createDepartments 一致
        depts.forEach(function (d) {
            var w = d.width || 5;
            var h = d.height || 5;
            if (w < 0.5 || h < 0.5) return;

            var cx = d.center_x !== undefined ? d.center_x : (d.position ? d.position.x : 0);
            var cy = d.center_y !== undefined ? d.center_y : (d.position ? d.position.z : 0);
            var color = d.color ? parseInt(d.color.replace('#', ''), 16) : 0x607d8b;

            var mesh = new THREE.Mesh(
                new THREE.BoxGeometry(w, 3.0, h),
                new THREE.MeshStandardMaterial({
                    color: color,
                    transparent: true,
                    opacity: 0.85,
                    roughness: 0.4,
                    metalness: 0.0,
                    side: THREE.DoubleSide
                })
            );
            mesh.position.set(cx, 1.5, cy);
            self.deptsGroup.add(mesh);
        });

        // 统计
        this.setStat('previewDeptCount', depts.length);
        this.setStat('previewPatientCount', 30);
        this.setStat('previewSubOnline', '24/28');

        this.renderer.render(this.scene, this.camera);
    };

    TwinPreview.prototype.setStat = function (id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    TwinPreview.prototype.onResize = function () {
        var W = this.container.clientWidth || 900;
        var H = this.container.clientHeight || 300;
        this.camera.aspect = W / H;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(W, H);
        this.renderer.render(this.scene, this.camera);
    };

    new TwinPreview();
})();
