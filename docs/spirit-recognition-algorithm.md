# 兰纳守护灵识别算法与显示机制

## 概述

兰纳照妖镜通过 FACS (Facial Action Coding System) 表情分析，实时检测用户面部表情，并将其映射到五种兰纳守护灵的亲和度。

## 五种守护灵

| ID | 泰文名 | 中文名 | 元素 | 主色调 | Emoji |
|----|--------|--------|------|--------|-------|
| naga | พญานาค | 那伽龙神 | 水 (water) | #1E90FF | 🐉 |
| singha | สิงห์ | 狮神 | 火 (fire) | #FF6B35 | 🦁 |
| hong | หงส์ | 天鹅神鸟 | 空 (air) | #FFD700 | 🦢 |
| chang | ช้าง | 圣象 | 土 (earth) | #8B4513 | 🐘 |
| garuda | ครุฑ | 金翅大鹏 | 灵 (spirit) | #9932CC | 🦅 |

## 表情特征提取 (AU 检测)

基于 MediaPipe Face Mesh 的 468 个面部关键点，提取以下表情分数：

### 关键 Landmark 索引

    const LANDMARKS = {
      // 眉毛
      leftBrowInner: 107,
      leftBrowOuter: 70,
      rightBrowInner: 336,
      rightBrowOuter: 300,

      // 眼睛
      leftEyeTop: 159,
      leftEyeBottom: 145,
      rightEyeTop: 386,
      rightEyeBottom: 374,

      // 嘴巴
      mouthLeft: 61,
      mouthRight: 291,
      mouthTop: 13,
      mouthBottom: 14,

      // 脸部基准
      noseTip: 4,
      chin: 152,
      foreheadCenter: 10,
    }

### 表情分数 (ExpressionScores)

| 分数名 | AU 对应 | 计算方式 |
|--------|---------|----------|
| smile | AU12 | 嘴角相对于嘴巴中心的上扬程度 + 嘴巴宽度 |
| browRaise | AU1+AU2 | 眉毛相对于额头的高度 |
| browFurrow | AU4 | 眉毛内侧距离（越近越皱眉） |
| eyeOpenness | AU5 | 上下眼皮距离 / 脸部高度 |
| mouthOpen | AU25+AU26 | 上下嘴唇距离 / 脸部高度 |
| intensity | - | 所有分数的综合强度 |

所有分数归一化到 0-1 范围。

## 守护灵映射算法

### 性格-表情对应关系

| 守护灵 | 性格特征 | 表情特征 |
|--------|----------|----------|
| Naga (那伽) | 深邃、神秘、智慧 | 平静、微皱眉（思考） |
| Singha (狮神) | 勇气、力量、守护 | 强烈、直视、轻微张嘴（自信） |
| Hongsa (天鹅) | 优雅、纯洁、自由 | 微笑、放松、眉毛舒展 |
| Chang (圣象) | 稳重、忠诚、智慧 | 中性、稳定、轻微微笑 |
| Garuda (金翅) | 超越、神圣、正义 | 专注、眼睛大睁、眉毛上扬 |

### 亲和度计算公式

    function mapExpressionToSpirits(scores: ExpressionScores): SpiritScores {
      const { smile, browRaise, browFurrow, eyeOpenness, mouthOpen, intensity } = scores

      return {
        // Naga: 思考型 - 皱眉高、微笑低、嘴巴闭合
        naga: browFurrow * 0.4
            + (1 - smile) * 0.3
            + (1 - mouthOpen) * 0.2
            + (1 - intensity) * 0.1,

        // Singha: 自信型 - 强度高、眼睛大、嘴巴略张
        singha: intensity * 0.3
              + eyeOpenness * 0.3
              + mouthOpen * 0.2
              + (1 - browFurrow) * 0.2,

        // Hongsa: 愉悦型 - 微笑高、眉毛舒展、放松
        hong: smile * 0.5
            + (1 - browFurrow) * 0.3
            + browRaise * 0.1
            + (1 - intensity) * 0.1,

        // Chang: 稳定型 - 各项中等、不极端
        chang: (1 - Math.abs(smile - 0.3)) * 0.3
             + (1 - Math.abs(browFurrow - 0.2)) * 0.3
             + (1 - intensity) * 0.2
             + (1 - mouthOpen) * 0.2,

        // Garuda: 专注型 - 眼睛大睁、眉毛上扬、强度高
        garuda: eyeOpenness * 0.4
              + browRaise * 0.3
              + intensity * 0.2
              + (1 - smile) * 0.1,
      }
    }

### 归一化处理

原始分数归一化，使五种守护灵亲和度总和为 1：

    function getNormalizedSpiritScores(scores: ExpressionScores): SpiritScores {
      const raw = mapExpressionToSpirits(scores)
      const total = Object.values(raw).reduce((sum, v) => sum + v, 0)

      if (total === 0) {
        return { naga: 0.2, singha: 0.2, hong: 0.2, chang: 0.2, garuda: 0.2 }
      }

      return {
        naga: raw.naga / total,
        singha: raw.singha / total,
        hong: raw.hong / total,
        chang: raw.chang / total,
        garuda: raw.garuda / total,
      }
    }

## 多人追踪机制

### TrackedPerson 数据结构

    interface TrackedPerson {
      id: string                          // 唯一标识
      center: { x: number, y: number }    // 脸部中心（归一化 0-1）
      size: number                        // 脸部大小
      accumulator: ExpressionAccumulator  // 表情累积器
      currentExpression: ExpressionScores // 当前帧表情
      expressionDescription: string       // 表情描述
      spiritScores: SpiritScores          // 五灵亲和度
      dominantSpirit: string              // 主导守护灵 ID
      lastSeenFrame: number               // 最后出现帧号
      frameCount: number                  // 累计帧数
    }

### 追踪算法

1. **脸部指标计算**: 从 landmarks 计算脸部中心和大小
2. **贪婪匹配**: 按脸部大小排序，为每个检测到的脸找最近的已追踪人
3. **匹配阈值**: 归一化距离 < 0.15 视为同一人
4. **新人创建**: 未匹配的脸创建新 TrackedPerson
5. **失踪移除**: 超过 30 帧未见则移除

### 表情累积器

使用滑动窗口（最近 60 帧，约 2 秒）平滑表情数据：

    class ExpressionAccumulator {
      private samples: ExpressionScores[] = []
      private readonly maxSamples = 60

      addSample(scores: ExpressionScores) {
        this.samples.push(scores)
        if (this.samples.length > this.maxSamples) {
          this.samples.shift()
        }
      }

      getAverageScores(): ExpressionScores {
        // 返回所有样本的平均值
      }
    }

## 显示机制

### 轮廓发光效果

每个人的身体轮廓使用其主导守护灵的颜色发光：

    // 对于每个边缘像素，找最近的人
    for (const person of persons) {
      const dx = normX - person.center.x
      const dy = normY - person.center.y
      const dist = dx * dx + dy * dy
      if (dist < minDist) {
        minDist = dist
        glowColor = hexToRgb(SPIRIT_INFO[person.dominantSpirit].color)
      }
    }

    // 使用该颜色绘制发光
    output[glowIndex] += glowColor[0] * intensity
    output[glowIndex + 1] += glowColor[1] * intensity
    output[glowIndex + 2] += glowColor[2] * intensity

### 底部 HUD 面板

每个追踪到的人显示一个卡片：
- 左侧：编号圆圈 + 主导守护灵 emoji
- 右侧：5 个守护灵亲和度条形图（实时更新）

### 头顶标记

在视频画面中每个人的头顶显示：
- 编号圆圈（陶土色背景）
- 主导守护灵 emoji

## 文件结构

    src/components/mirror/
    ├── facsAnalyzer.ts      # FACS 分析 + 守护灵映射
    ├── personTracker.ts     # 多人追踪
    ├── spiritData.ts        # 守护灵数据定义
    ├── types.ts             # 类型定义
    └── SigilGenerator.tsx   # 主组件（渲染 + 交互）

## 性能考虑

- MediaPipe 使用 GPU delegate 加速
- 分割和面部检测同步进行，每帧约 30ms
- 边缘检测使用简单的 3x3 邻域判断
- 发光效果半径固定为 3 像素，平衡效果和性能
