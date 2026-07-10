// ═══════════════════════════════════════════════════════════
// 智环引诊 - 数字孪生预览（首页嵌入，全局 THREE）
// ═══════════════════════════════════════════════════════════
(function () {
    'use strict';

    function TwinPreview() {
        this.container = document.getElementById('twinPreviewCanvas');
        if (!this.container) return;
        this.cadBounds = { minX: 290, maxX: 437, minY: -33, maxY: 60 };
        this.patientMeshes = [];
        this.deptMeshes = [];
        this.topAccents = [];
        this.init();
    }

    TwinPreview.prototype.init = function () {
        var W = this.container.clientWidth || 800;
        var H = this.container.clientHeight || 300;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf8fafc);

        var cw = this.cadBounds.maxX - this.cadBounds.minX;
        var cx = (this.cadBounds.minX + this.cadBounds.maxX) / 2;
        var cy = (this.cadBounds.minY + this.cadBounds.maxY) / 2;

        this.camera = new THREE.PerspectiveCamera(35, W / H, 1, 800);
        this.camera.position.set(cx, cy - cw * 0.22, cw * 0.55);
        this.camera.lookAt(cx, cy, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(W, H);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.container.appendChild(this.renderer.domElement);

        this.scene.add(new THREE.AmbientLight(0xaabbcc, 0.9));
        this.scene.add(new THREE.HemisphereLight(0xeef4ff, 0xaabbcc, 0.7));
        var sun = new THREE.DirectionalLight(0xffffff, 1.5);
        sun.position.set(cx + 50, cy - 40, 100);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = 400;
        sun.shadow.camera.left = -100;
        sun.shadow.camera.right = 100;
        sun.shadow.camera.top = 80;
        sun.shadow.camera.bottom = -80;
        sun.shadow.bias = -0.0005;
        this.scene.add(sun);

        var fillLight = new THREE.DirectionalLight(0x60a5fa, 0.4);
        fillLight.position.set(cx - 30, cy + 20, 50);
        this.scene.add(fillLight);

        this.load();
        var self = this;
        window.addEventListener('resize', function () { self.onResize(); });
        this.loop();
    };

    TwinPreview.prototype.load = function () {
        var self = this;
        fetch('/digital-twin/data/hospital_f1/cad_twin_data.json')
            .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
            .then(function (data) {
                var bounds = data.metadata.bounds;
                self.cadBounds = {
                    minX: bounds.min_x,
                    maxX: bounds.max_x,
                    minY: bounds.min_y,
                    maxY: bounds.max_y
                };
                self.build(data);
            })
            .catch(function () {
                self.cadBounds = { min_x: 0, max_x: 140, min_y: 0, max_y: 90 };
                self.build(self.fallbackData());
            });
    };

    TwinPreview.prototype.fallbackData = function () {
        return {
            departments: [
                { name: '门诊大厅', x: 45, y: 25, color: '#3b82f6' },
                { name: '内科', x: 15, y: 60, color: '#0ea5e9' },
                { name: '外科', x: 80, y: 60, color: '#06b6d4' },
                { name: '放射科', x: 15, y: 75, color: '#6366f1' },
                { name: '检验科', x: 80, y: 75, color: '#34d399' },
                { name: '妇科', x: 115, y: 60, color: '#8b5cf6' },
                { name: '药房', x: 115, y: 25, color: '#60a5fa' },
            ],
            patients: Array.from({ length: 20 }, function (_, i) {
                return {
                    x: 10 + Math.random() * 120, y: 12 + Math.random() * 65,
                    typeColor: ['#60a5fa', '#34d399', '#f87171'][i % 3]
                };
            })
        };
    };

    TwinPreview.prototype.build = function (data) {
        var cw = this.cadBounds.maxX - this.cadBounds.minX;
        var ch = this.cadBounds.maxY - this.cadBounds.minY;
        var cx = (this.cadBounds.minX + this.cadBounds.maxX) / 2;
        var cy = (this.cadBounds.minY + this.cadBounds.maxY) / 2;

        // Floor - gradient style
        var floorGeo = new THREE.PlaneGeometry(cw, ch);
        var floorMat = new THREE.MeshStandardMaterial({
            color: 0xf1f5f9,
            roughness: 0.8,
            metalness: 0.02,
            transparent: true,
            opacity: 0.95
        });
        var floor = new THREE.Mesh(floorGeo, floorMat);
        floor.position.set(cx, cy, -0.15);
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Floor edge border
        var borderMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, linewidth: 2 });
        var borderGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(this.cadBounds.minX, this.cadBounds.minY, 0),
            new THREE.Vector3(this.cadBounds.maxX, this.cadBounds.minY, 0),
            new THREE.Vector3(this.cadBounds.maxX, this.cadBounds.maxY, 0),
            new THREE.Vector3(this.cadBounds.minX, this.cadBounds.maxY, 0),
            new THREE.Vector3(this.cadBounds.minX, this.cadBounds.minY, 0)
        ]);
        var border = new THREE.Line(borderGeo, borderMat);
        this.scene.add(border);

        // Camera reposition - zoom in for better visual
        this.camera.position.set(cx, cy - cw * 0.22, cw * 0.55);
        this.camera.lookAt(cx, cy, 0);
        this.camera.aspect = this.container.clientWidth / (this.container.clientHeight || 1);
        this.camera.updateProjectionMatrix();

        var self = this;

        // Depts - improved visual style
        var colorPalette = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1', '#0ea5e9'];
        (data.departments || []).forEach(function (d, index) {
            var w = Math.max(3.2, 2.5 + d.name.length * 0.18);
            var dp = Math.max(2.2, 2.0 + d.name.length * 0.12);
            var height = 4.8;
            var color = d.color || colorPalette[index % colorPalette.length];

            // Base layer
            var baseMesh = new THREE.Mesh(
                new THREE.BoxGeometry(w + 0.2, dp + 0.2, height * 0.8),
                new THREE.MeshStandardMaterial({
                    color: color,
                    roughness: 0.6,
                    metalness: 0.05,
                    transparent: true,
                    opacity: 0.35
                })
            );
            baseMesh.position.set(d.x, d.y, height * 0.4);
            baseMesh.receiveShadow = true;
            self.scene.add(baseMesh);

            // Main body
            var mesh = new THREE.Mesh(
                new THREE.BoxGeometry(w, dp, height),
                new THREE.MeshStandardMaterial({
                    color: color,
                    roughness: 0.3,
                    metalness: 0.2,
                    transparent: true,
                    opacity: 0.55,
                    emissive: color,
                    emissiveIntensity: 0.15
                })
            );
            mesh.position.set(d.x, d.y, height / 2);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            self.scene.add(mesh);
            self.deptMeshes.push(mesh);

            // Top glossy layer with highlight
            var top = new THREE.Mesh(
                new THREE.BoxGeometry(w + 0.12, dp + 0.12, 0.18),
                new THREE.MeshStandardMaterial({
                    color: 0xffffff,
                    roughness: 0.05,
                    metalness: 0.7,
                    transparent: true,
                    opacity: 0.9,
                    emissive: color,
                    emissiveIntensity: 0.4
                })
            );
            top.position.set(d.x, d.y, height + 0.09);
            top.castShadow = true;
            self.scene.add(top);
            self.topAccents.push(top);

            // Ambient glow
            var glowGeo = new THREE.SphereGeometry(Math.max(w, dp) * 0.6, 20, 20);
            var glowMat = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.06,
                side: THREE.BackSide
            });
            var glow = new THREE.Mesh(glowGeo, glowMat);
            glow.position.set(d.x, d.y, height / 2);
            self.scene.add(glow);
        });

        // Patients - improved visual style
        (data.patients || []).slice(0, 25).forEach(function (pt) {
            var c = pt.typeColor || '#60a5fa';

            // Outer ring with glow
            var ring = new THREE.Mesh(
                new THREE.TorusGeometry(0.5, 0.04, 8, 24),
                new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.25 })
            );
            ring.position.set(pt.x, pt.y, 0.1);
            ring.rotation.x = -Math.PI / 2;
            self.scene.add(ring);

            // Core sphere with emissive glow
            var core = new THREE.Mesh(
                new THREE.SphereGeometry(0.35, 16, 16),
                new THREE.MeshStandardMaterial({
                    color: c,
                    roughness: 0.15,
                    metalness: 0.25,
                    emissive: c,
                    emissiveIntensity: 0.6,
                    transparent: true,
                    opacity: 0.95
                })
            );
            core.position.set(pt.x, pt.y, 4.5);
            core.userData = { phase: Math.random() * Math.PI * 2, speed: 1.2 + Math.random() * 1.5, ring: ring };
            self.patientMeshes.push(core);
            self.scene.add(core);
        });

        // Stats
        var el = function (id) { return document.getElementById(id); };
        if (el('previewDeptCount')) el('previewDeptCount').textContent = (data.departments || []).length;
        if (el('previewPatientCount')) el('previewPatientCount').textContent = (data.patients || []).length;
        if (el('previewSubOnline')) el('previewSubOnline').textContent = '28/28';
    };

    TwinPreview.prototype.onResize = function () {
        var W = this.container.clientWidth || 800;
        var H = this.container.clientHeight || 300;
        this.camera.aspect = W / H;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(W, H);
    };

    TwinPreview.prototype.loop = function () {
        var self = this;
        var t0 = 0;
        function frame() {
            requestAnimationFrame(frame);
            t0 += 0.016;

            // Smooth patient pulsing animation
            self.patientMeshes.forEach(function (p) {
                var ph = p.userData.phase, sp = p.userData.speed, ring = p.userData.ring;
                var pulse = Math.sin(t0 * sp + ph);

                p.scale.setScalar(1 + pulse * 0.08);
                p.material.emissiveIntensity = 0.5 + pulse * 0.15;
                p.position.z = 4.5 + pulse * 0.3;

                if (ring) {
                    ring.scale.setScalar(1 + pulse * 0.06);
                    ring.material.opacity = 0.2 + pulse * 0.1;
                    ring.position.z = 0.1 + pulse * 0.05;
                }
            });

            // Gentle breathing animation for department tops
            self.topAccents.forEach(function (m, i) {
                var glow = 0.8 + Math.sin(t0 * 1.5 + i * 0.5) * 0.08;
                m.material.opacity = glow;
                m.material.emissiveIntensity = 0.18 + Math.sin(t0 * 1.8 + i * 0.5) * 0.05;
            });

            self.renderer.render(self.scene, self.camera);
        }
        frame();
    };

    new TwinPreview();
})();
