# lovsigil

## 0.10.0

### Minor Changes

- Add game mode with audience wall
  - GameGenerator component for real-time sigil generation game
  - AudienceWall for audience participation and voting
  - GameModeLayout for game interface structure
  - Game API endpoints for sigil management
  - Database migration for game sessions

## 0.9.12

### Patch Changes

- feat(desktop): 添加右侧边栏二维码供手机扫描访问

## 0.9.11

### Patch Changes

- fix(mobile): 修复移动端 Sigil 生成卡在 Waiting to start 的问题

  调整 fetch 和 window.location.href 顺序，避免页面跳转取消生成请求

## 0.9.10

### Patch Changes

- 修复移动端主题颜色和布局问题，统一 Mystic Rune 深色风格

## 0.9.9

### Patch Changes

- 历史记录跑马灯只显示生命图腾风格的 sigil

## 0.9.8

### Patch Changes

- feat(mirror): mobile inline form - direct input without dialog

## 0.9.7

### Patch Changes

- fix(mirror): simplify mobile UI - direct to generation without camera

## 0.9.6

### Patch Changes

- fix(mirror): mobile default camera off for better performance

## 0.9.5

### Patch Changes

- fix(mirror): remove overlay X button from captured thumbnail

## 0.9.4

### Patch Changes

- 修复关闭再打开摄像头后 AI Effect 静止的问题

  根本原因：initCamera 依赖 cameraEnabled state，导致状态变化时 useEffect cleanup 取消 renderLoop 的 animationFrame。
  修复方案：使用 cameraEnabledRef 替代 state，避免函数重建和 cleanup 执行。

## 0.9.3

### Patch Changes

- Unify Mystic Rune design system with consistent color palette

## 1.0.3

### Patch Changes

- SVG 下载时自动转换为 2x DPI 的 PNG 格式

## 1.0.2

### Patch Changes

- 修复 Sigil 重试功能和添加生成参数显示
  - 修复 retry 时 404 错误（移除不存在的 style 字段）
  - 修复 retry 后 polling 不重启的问题
  - 在详情页显示生成参数（name, bio, aspect_ratio）

## 1.0.1

### Patch Changes

- Add sigil detail page with order status tracking
  - View sigil generation status at `/sigil/{orderId}`
  - Auto-polling for pending/generating orders
  - Display generated sigil with vibe analysis
  - Download button for completed sigils

## 1.0.0

### Major Changes

- Initial release of LovSigil - AI-powered personal Sigil totem generator
  - Camera-based face detection with MediaPipe
  - AI vibe/personality analysis from facial features
  - Rune-style personalized Sigil generation
  - Name + bio input for enhanced personalization
  - Multi-language support (EN/ZH/TH/KO)

## 0.9.2

### Patch Changes

- feat: enhance gallery page and UI improvements

## 0.9.1

### Patch Changes

- 优化画廊页面显示与移动端体验

## 0.9.0

### Minor Changes

- 大幅优化移动端显示与性能
  - 添加 viewport 配置和 iOS PWA 支持
  - 移动端专属布局：全屏镜像 + 底部工具栏
  - 降低移动端视频分辨率减少 GPU 负载
  - Gallery 页面添加 content-visibility 优化
  - 添加 safe-area 安全区域支持
  - 优化移动端顶部状态栏视觉效果

## 0.8.0

### Minor Changes

- 新增历史生成瀑布流画廊页面
  - 创建独立画廊页面，CSS columns 实现瀑布流布局
  - IntersectionObserver 实现无限滚动加载
  - 添加 en/zh/th/ko 四语言翻译
  - LannaMirror 顶栏添加 Gallery 入口按钮
  - 点击 Gallery 时释放 GPU 资源避免性能问题

## 0.7.1

### Patch Changes

- 修复 TypeScript 数组索引类型检查错误

## 0.7.0

### Minor Changes

- 新增积分系统集成到图片生成流程
  - 图片生成弹窗显示所需积分和用户余额
  - 支持积分不足提示和登录引导
  - 单人生成消耗 2 积分，合照按人数计算

## 0.6.4

### Patch Changes

- 增大守护灵头像尺寸

## 0.6.3

### Patch Changes

- 增大分享二维码尺寸（80px → 120px）

## 0.6.2

### Patch Changes

- fix(mirror): 调整视口高度和历史记录栏尺寸
  - h-screen → h-dvh 解决跨浏览器视口高度不一致
  - 历史记录栏和缩略图尺寸增大

## 0.6.1

### Patch Changes

- fix(mirror): 在打开生成选项对话框时捕获静态截图，而非显示实时画面

## 0.6.0

### Minor Changes

- feba6bf: 优化合照场景人脸检测：支持最多 8 人同时检测，降低阈值支持远处小脸

## 0.5.0

### Minor Changes

- 添加灵符生成风格选择与打印订单功能
  - 生成选项对话框：支持壁画/可爱/神秘/现代四种风格
  - 打印订单管理后台和 API
  - 祈福 API 端点
  - 二维码组件和通知服务

## 0.4.0

### Minor Changes

- UI 改进和重构
  - 将 UI emoji 替换为 lucide-react 图标
  - 精简守护灵面板为单行显示
  - 重构 QR 弹窗为左右布局
  - 优化标题区域布局
  - 重构历史记录为顶部走马灯横条
  - 移除 spotlight 依赖

## 0.3.0

### Minor Changes

- 添加订单系统和 QR 码分享功能
  - 新增订单跟踪系统（order_id, status）
  - 新增独立详情页支持实时进度查看
  - 新增 QR 码分享和海报生成功能
  - 新增实体打印选项（纹身贴、相框、手办、明信片）
  - 重构面部分析从表情改为静态面部特征匹配
  - 历史记录点击在新标签页打开详情页

## 0.2.0

### Minor Changes

- feat(mirror): 支持多人合像生成

## 0.1.6

### Patch Changes

- 修复 TooltipProvider 组件类型错误

## 0.1.5

### Patch Changes

- 清理认证模块冗余代码，优化 AuthClient 实现

## 0.1.4

### Patch Changes

- feat(i18n): 添加韩语和泰语支持

## 0.1.3

### Patch Changes

- 安全与体验优化
  - fix: 升级 Next.js 到 16.1.4 修复 CVE-2025-66478 漏洞
  - fix: 优化镜子界面交互体验
  - fix: 移除 Next.js 16 不支持的 eslint 配置
  - fix: 移除外部 Google Fonts 导入
  - chore: 添加 vercel.json 配置

## 0.1.2

### Patch Changes

- 58eda7b: fix: 修复 CI 构建问题

## 0.1.1

### Patch Changes

- ab57471: feat(mirror): 优化预览界面和配置
