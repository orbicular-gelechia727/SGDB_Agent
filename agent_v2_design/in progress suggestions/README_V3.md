# SCeQTL-Agent V3 架构文档集

> 精准检索型Agent的完整设计方案

---

## 文档导航

| 文档 | 内容 | 阅读对象 |
|------|------|---------|
| [ARCHITECTURE_V3_AGENT_SYSTEM.md](ARCHITECTURE_V3_AGENT_SYSTEM.md) | 完整架构设计 | 全体团队成员 |
| [IMPLEMENTATION_GUIDE_V3.md](IMPLEMENTATION_GUIDE_V3.md) | 实施操作手册 | 开发人员 |
| [DESIGN_DECISIONS.md](DESIGN_DECISIONS.md) | 设计决策记录 | 技术负责人 |
| [README_V3.md](README_V3.md) | 本文档 | 快速了解 |

---

## V3核心定位 (一句话)

**高精度自然语言检索系统**: 将生物学意图准确转化为可验证的数据库查询。

---

## 与V2的关键区别

| 维度 | V2 | V3 |
|------|-----|-----|
| **核心能力** | 规则+LLM混合 | Schema知识驱动 |
| **配置化** | 部分硬编码 | 完全配置化 |
| **能力边界** | 模糊 | 明确 (L1/L2/L3) |
| **扩展性** | 需改代码 | 改配置即可 |

---

## 架构总览

```
User Query
    ↓
[Intent Understanding] → SchemaKnowledgeBase
    ↓
[Knowledge Enrichment] → 术语扩展/标准化
    ↓  
[Query Construction] → Template/Rule/LLM
    ↓
[Execution & Validation]
    ↓
Answer
```

---

## 关键改进

### 1. SchemaKnowledgeBase (核心基础设施)
- 配置化字段知识 (tissue/disease/assay...)
- 同义词管理 (brain → cerebral/cerebellum/大脑)
- 查询模式库 (可扩展)

### 2. 明确的复杂度分层
- **L1 (精确检索)**: SQL精确匹配 ✅ 重点
- **L2 (语义扩展)**: 本体映射 ✅ 支持
- **L3 (知识推理)**: 外包给LLM 

### 3. 多策略查询生成
- Template (高置信度, 零LLM)
- Rule (结构化构建, 零LLM)
- LLM-Assisted (兜底, 需验证)

---

