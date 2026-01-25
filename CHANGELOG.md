# lanna-mirror-3

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
