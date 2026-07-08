# 智环引诊前端项目

## 项目简介

智环引诊前端项目是面向医院智慧导诊场景的完整前端解决方案，包含**云端调度中心**、**患者服务客户端**和**数字孪生地图**三大核心模块。项目采用原生 HTML5 + CSS3 + JavaScript 技术栈，实现了从医院管理调度到患者就诊服务的全流程覆盖。

## 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        智环引诊前端系统                          │
├─────────────────┬─────────────────────┬─────────────────────────┤
│  云端调度中心    │   患者服务客户端     │     数字孪生地图        │
│  (Control Center)│  (Patient Client)  │   (Digital Twin)        │
│                 │                     │                         │
│  - 实时态势监控  │  - 就诊概览         │  - 3D医院可视化         │
│  - 调度管理      │  - 导航指引         │  - 路径规划             │
│  - 紧急情况处理  │  - 智能咨询         │  - 地图编辑             │
│  - 数据分析      │  - 报告查询         │  - 节点可视化           │
│  - 系统设置      │  - 复诊提醒         │                         │
└─────────────────┴─────────────────────┴─────────────────────────┘
```

## 项目结构

```
front/
├── control-center/                 # 云端调度中心 - 医院管理后台
│   ├── control-center/
│   │   ├── html/                   # HTML页面
│   │   │   ├── index.html          # 首页 - 实时态势监控
│   │   │   ├── digital-twin.html   # 数字孪生视图
│   │   │   ├── digital-twin-2.5d.html # 2.5D数字孪生视图
│   │   │   ├── dispatch.html       # 调度管理
│   │   │   ├── emergency.html      # 紧急情况处理
│   │   │   ├── analytics.html      # 数据分析报表
│   │   │   ├── settings.html       # 系统设置
│   │   │   ├── alarm-list.html     # 警报列表
│   │   │   ├── dept-load.html      # 科室负载
│   │   │   └── queue-detail.html   # 队列详情
│   │   ├── css/                    # 样式文件
│   │   │   ├── common/             # 公共样式
│   │   │   ├── components/         # 组件化样式
│   │   │   │   ├── cards/          # 卡片组件
│   │   │   │   ├── charts/         # 图表组件
│   │   │   │   ├── dispatch/       # 调度模块样式
│   │   │   │   ├── emergency/      # 紧急模块样式
│   │   │   │   └── widgets/        # 小部件组件
│   │   │   └── index.css           # 首页样式入口
│   │   ├── js/                     # JavaScript脚本
│   │   │   ├── index.js            # 首页逻辑
│   │   │   ├── dispatch.js         # 调度逻辑
│   │   │   ├── emergency.js        # 紧急逻辑
│   │   │   ├── analytics.js        # 分析逻辑
│   │   │   └── settings.js         # 设置逻辑
│   │   └── api-documentation.md    # API接口文档
│   ├── html/                       # 简化版控制中心页面
│   ├── css/                        # 简化版控制中心样式
│   └── js/                         # 简化版控制中心脚本
│
├── patient-client/                 # 患者服务客户端 - H5移动端
│   ├── pages/                      # 页面文件
│   │   ├── home.html               # 首页
│   │   ├── overview.html           # 就诊概览
│   │   ├── navigation.html         # 导航指引
│   │   ├── chat.html               # 智能咨询
│   │   ├── emergency.html          # 紧急求助
│   │   ├── reports.html            # 报告列表
│   │   ├── report-detail.html      # 报告详情
│   │   ├── reminder.html           # 复诊提醒
│   │   ├── profile.html            # 个人中心
│   │   ├── rating.html             # 满意度评价
│   │   ├── trace.html              # 就诊轨迹
│   │   └── nfc-bind.html           # NFC手环绑定
│   ├── css/                        # 样式文件
│   │   ├── base.css                # 基础样式
│   │   ├── home.css                # 首页样式
│   │   ├── navigation.css          # 导航样式
│   │   ├── emergency-rating.css    # 紧急/评价样式
│   │   └── responsive.css          # 响应式样式
│   ├── js/                         # JavaScript脚本
│   │   ├── app.js                  # 应用入口
│   │   ├── main.js                 # 页面管理
│   │   ├── interactions.js         # 交互逻辑
│   │   └── nfc.js                  # NFC相关功能
│   ├── api-documentation.md        # API接口文档
│   └── index.html                  # 客户端入口
│
├── digital-twin/                   # 数字孪生模块 - 3D医院地图
│   ├── index.html                  # 3D地图主页面
│   ├── server.js                   # Node.js服务器
│   ├── package.json                # NPM配置
│   ├── js/
│   │   ├── twin_scene.js           # Three.js 3D场景核心代码
│   │   └── twin_scene_v3.js        # 数字孪生场景增强版
│   ├── data/
│   │   └── hospital_f1/            # 医院一层数据
│   │       ├── walls.json          # 墙体数据
│   │       ├── departments.json    # 科室数据
│   │       ├── roads.json          # 道路数据
│   │       └── nodes_f1.json       # 导航节点数据
│   └── src/                        # Python数据处理脚本
│       ├── extract_walls.py        # 墙体提取
│       ├── extract_departments.py  # 科室提取
│       ├── extract_roads.py        # 道路提取
│       └── process_cad_for_twin.py # CAD数据处理
│
└── vercel.json                     # Vercel部署配置
```

## 核心功能

### 云端调度中心 (Control Center)

面向医院管理人员的综合性管理平台，提供实时监控、调度优化、紧急响应等核心能力。

**功能模块**:

- **实时态势监控**
  - KPI指标展示（就诊人数、在院人数、科室利用率、警报数量）
  - 院区数字孪生前瞻视图
  - 科室实时负载监控
  - 患者流量趋势分析

- **调度管理**
  - 科室排队管理与实时负载展示
  - 智能分流决策与执行
  - 任务优先级抢占机制
  - 调度日志与历史记录

- **紧急情况处理**
  - 实时警报列表与状态监控
  - 患者紧急求助响应
  - 紧急广播功能
  - 处理记录导出

- **数据分析**
  - 就诊统计与趋势分析
  - 科室负载报表
  - 分流效果评估
  - 患者满意度分析

- **系统设置**
  - 基础系统配置
  - 通知管理
  - 设备管理
  - 数据备份与恢复

### 患者服务客户端 (Patient Client)

面向患者的移动端服务应用，提供便捷的就诊全流程服务。

**功能模块**:

- **就诊概览**
  - 患者信息展示
  - 当前就诊进度追踪
  - 预计等待时间
  - 下一步任务提示

- **导航指引**
  - 院内路径规划
  - 步行指引与时间预估
  - 电梯位置提示

- **智能咨询**
  - AI助手交互界面
  - 就诊相关问题解答
  - 语音识别支持

- **紧急求助**
  - 一键呼叫医护人员
  - 位置信息上报

- **报告查询**
  - 检查报告列表
  - 报告详情查看
  - 报告下载与分享

- **复诊提醒**
  - 复诊预约管理
  - 日历集成
  - 提醒通知

- **无障碍特性**
  - 老年模式（大字体）
  - 高对比度模式
  - 语音提示
  - 大按钮设计（48px最小触控区域）

### 数字孪生地图 (Digital Twin)

基于Three.js构建的医院3D可视化系统，支持地图编辑与路径导航。

**功能模块**:

- 3D医院场景渲染（墙体、科室、道路）
- 交互式视角控制（旋转、缩放、平移）
- 地图元素编辑（创建、删除、拖拽）
- A*路径规划算法
- 导航节点可视化
- glTF/GLB模型导入
- 数据本地存储与云端同步
- 科室详情浮动卡片
- 批量选中编辑（Ctrl+点击、Shift+框选）

## 交互说明

### 数字孪生地图交互

| 操作 | 效果 |
|------|------|
| **左键拖动** | 旋转视角 |
| **右键拖动** | 平移场景 |
| **滚轮** | 缩放视图 |
| **双击对象** | 平滑聚焦到该对象 |
| **双击空白** | 平滑返回默认视角 |
| **编辑模式** | 可拖拽、创建、删除元素 |
| **W/A/S/D** | 键盘控制平移 |
| **Q/E** | 键盘控制缩放 |
| **Ctrl+点击** | 批量选中对象 |
| **Shift+拖动** | 框选多个对象 |

## 技术栈

| 模块 | 技术 | 说明 |
|------|------|------|
| 控制中心 | HTML5 + CSS3 + JavaScript (ES6+) | 原生前端技术，无框架依赖 |
| 患者客户端 | HTML5 + CSS3 + JavaScript | 移动端响应式设计 |
| 数字孪生 | Three.js r128 + WebGL | 3D渲染引擎 |
| 数据处理 | Python | CAD数据提取与处理 |
| 服务器 | Node.js + Express | 数字孪生模块服务 |
| 数据格式 | JSON | 统一的数据交换格式 |

## 快速开始

### 启动控制中心

```bash
# 使用Python内置服务器
cd front/control-center/control-center
python -m http.server 8080
# 访问 http://localhost:8080/html/index.html
```

### 启动患者客户端

```bash
cd front/patient-client
python -m http.server 8081
# 访问 http://localhost:8081/index.html
```

### 启动数字孪生

```bash
cd front/digital-twin
npm install
node server.js
# 访问 http://localhost:3000/
```

## 设计规范

### 配色方案

| 用途 | 颜色 | 说明 |
|------|------|------|
| 主色调 | `#3498db` | 专业蓝 |
| 成功色 | `#27ae60` | 绿色 |
| 警告色 | `#f39c12` | 橙色 |
| 危险色 | `#e74c3c` | 红色 |
| 背景色 | `#f8f9fa` | 浅灰背景 |
| 文字色 | `#2c3e50` | 深色文字 |

### 布局规范

- **控制中心**: 左侧导航栏 + 右侧主内容区布局
- **患者客户端**: 移动端单页应用，底部导航
- **卡片样式**: 圆角12px，阴影 `0 4px 20px rgba(0,0,0,0.1)`

## 接口规范

### 数字孪生API

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/get-layout` | GET | 获取医院布局数据 |
| `/api/save-layout` | POST | 保存布局数据 |
| `/api/clear-layout` | POST | 清除布局数据 |

### 控制中心API

| 模块 | 接口 | 方法 | 描述 |
|------|------|------|------|
| 首页 | `/api/dashboard/kpi` | GET | 获取实时KPI指标 |
| 首页 | `/api/dashboard/dept-load` | GET | 获取科室负载排行 |
| 首页 | `/api/dashboard/alarms` | GET | 获取紧急求助实时警报 |
| 首页 | `/api/dashboard/traffic-trend` | GET | 获取24小时流量趋势 |
| 调度 | `/api/dispatch/dept-load` | GET | 获取科室实时负载表 |
| 调度 | `/api/dispatch/execute` | POST | 执行分流操作 |
| 紧急 | `/api/emergency/alarms` | GET | 获取实时警报列表 |
| 紧急 | `/api/emergency/broadcast` | POST | 发送紧急广播 |
| 分析 | `/api/analytics/monthly-trend` | GET | 获取月度就诊趋势 |
| 分析 | `/api/analytics/satisfaction` | GET | 获取患者满意度分布 |
| 设置 | `/api/settings` | GET/PUT | 获取/保存系统设置 |

### 患者客户端API

| 模块 | 接口 | 方法 | 描述 |
|------|------|------|------|
| 患者 | `/api/patient/info` | GET/PUT | 获取/更新患者信息 |
| 就诊 | `/api/visit/overview` | GET | 获取就诊概览 |
| 就诊 | `/api/visit/progress` | GET | 获取就诊进度 |
| 报告 | `/api/reports` | GET | 获取报告列表 |
| 导航 | `/api/navigation` | GET | 获取导航路线 |
| 紧急 | `/api/emergency` | POST | 发送求助请求 |
| 评价 | `/api/rating` | POST | 提交评价 |

详细接口文档请参考各模块的 `api-documentation.md` 文件。

### 数据格式

**科室数据**:
```json
{
  "name": "心内科诊室",
  "type": "consultation",
  "center_x": 352.5,
  "center_y": -2.8,
  "width": 8,
  "height": 6,
  "color": "#2ecc71",
  "opacity": 0.6
}
```

**导航节点**:
```json
{
  "id": "node_001",
  "name": "门诊大厅",
  "type": "entrance",
  "real_x_m": 0,
  "real_y_m": 0,
  "crowd_level": 65,
  "current_people": 23
}
```

## 部署

### Vercel部署

项目已配置 `vercel.json`，支持一键部署到Vercel：

```bash
npm i -g vercel
vercel
```

### 静态部署

将 `front/` 目录部署到任意Web服务器即可。

## 更新日志

### v1.2.0

**新增功能：**
- 科室详情浮动卡片 - 点击科室显示跟随位置的详情卡片
- 医生/病人/排队信息 - 显示科室医生、就诊病人、排队情况、今日统计
- 自动保存功能 - 每60秒自动保存到本地存储
- 批量选中编辑 - 支持Ctrl+点击、Shift+框选多选对象
- 节点信息编辑 - 修改节点名称、类型、拥挤程度、当前人数
- 保存功能分离 - 分离"保存到本地"和"保存到云端"按钮
- 3D可视化增强 - 地板瓷砖纹理、墙面纹理、踢脚线、门口标记、道路标线、电梯楼梯

**优化：**
- 拖动方向修复 - 右键拖动方向与鼠标移动一致
- 框选功能优化 - Shift+拖动触发框选，不干扰正常旋转操作
- 普通模式点击科室 - 非编辑模式下也能点击查看科室详情浮动卡片
- 批量编辑 - 移动、缩放、旋转操作对所有选中对象生效

**修复：**
- 保存功能IIFE语法问题导致云端保存失败
- CORS跨域支持
- 批量编辑只对最后一个选中对象生效的问题
- 自动保存装饰性元素导致的保存错误

### v1.1.0

**新增功能：**
- 双击聚焦对象功能 - 双击任意对象平滑聚焦，双击空白返回默认视角
- 3D可视化增强：地板瓷砖纹理效果、墙面纹理与踢脚线装饰、科室门口标记、道路边缘线、电梯井与楼梯间

### v1.0.0

- 新增数字孪生3D地图模块
- 优化控制中心UI组件
- 支持本地存储数据持久化

---

**智环引诊** - 云边协同智慧医疗导诊系统