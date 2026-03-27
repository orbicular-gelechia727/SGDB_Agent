# SCeQTL-Agent V2: 人源单细胞RNA-seq元数据智能检索Agent架构设计

> **版本**: 2.1 | **日期**: 2026-03-06 | **状态**: 审核后修订
>
> ### 版本历史
> | 版本 | 日期 | 说明 |
> |------|------|------|
> | 2.0 | 2026-03-06 | 初始设计 |
> | 2.1 | 2026-03-06 | 整合5份专业审核反馈,详见 [ARCHITECTURE_V2.1_IMPROVEMENTS.md](ARCHITECTURE_V2.1_IMPROVEMENTS.md) |

---

## 目录

1. [Executive Summary](#1-executive-summary)
2. [设计哲学与原则](#2-设计哲学与原则)
3. [系统架构总览](#3-系统架构总览)
4. [核心模块详细设计](#4-核心模块详细设计)
   - 4.1 Coordinator Agent (协调器)
   - 4.2 Query Understanding Module (查询理解)
   - 4.3 Ontology Resolution Engine (本体解析引擎)
   - 4.4 SQL Generation & Execution (SQL生成与执行)
   - 4.5 Cross-Database Fusion Engine (跨库融合引擎)
   - 4.6 Answer Synthesis Module (答案合成)
   - 4.7 Memory & Learning System (记忆与学习)
5. [数据库抽象层设计](#5-数据库抽象层设计)
6. [Web应用架构](#6-web应用架构)
7. [API设计](#7-api设计)
8. [评估框架](#8-评估框架)
9. [技术选型](#9-技术选型)
10. [实施路线图](#10-实施路线图)
11. [与现有系统对比](#11-与现有系统对比)

---

## 1. Executive Summary

### 1.1 项目定位

SCeQTL-Agent V2 是一个**本体感知、跨库融合的智能元数据检索系统**，
面向全球人源单细胞RNA-seq数据。它整合了来自12个主要数据库（CellXGene、GEO、
SRA、EBI、HCA等）的 **756,579个样本、23,123个项目、378,029条细胞类型注释**，
通过自然语言交互帮助生物学家快速定位、比较和获取目标数据集。

### 1.2 核心创新点（对标正刊发表）

| 创新方向 | 具体内容 | 对标差异化 |
|---------|---------|-----------|
| **跨库统一查询** | 一次查询覆盖12个数据库，自动去重与融合 | SRAgent仅做数据发现，不做统一查询 |
| **本体感知语义扩展** | 基于UBERON/MONDO/CL层级树自动扩展查询范围 | 现有工具均为精确匹配 |
| **TAG混合查询范式** | SQL结构化查询 + LLM语义推理的有机结合 | 超越纯Text2SQL或纯RAG |
| **数据血缘透明化** | 每条结果附完整来源链和数据质量评分 | 用户可评估结果可信度 |
| **自适应渐进检索** | 4级策略自动松弛，保证召回率与精确率平衡 | V1验证有效，V2升级为多表感知 |

### 1.3 与同类系统对比

```
                    数据发现  统一查询  本体感知  跨库融合  数据下载  对话交互
SRAgent (Arc)        ★★★★★   ★☆☆☆☆   ★★★☆☆   ☆☆☆☆☆   ★★☆☆☆   ☆☆☆☆☆
CellAtria (AZ)       ☆☆☆☆☆   ☆☆☆☆☆   ★★☆☆☆   ☆☆☆☆☆   ★★★★☆   ★★★★☆
CellAgent            ☆☆☆☆☆   ☆☆☆☆☆   ★☆☆☆☆   ☆☆☆☆☆   ☆☆☆☆☆   ★★★★★
GeneAgent            ☆☆☆☆☆   ☆☆☆☆☆   ★★★☆☆   ☆☆☆☆☆   ☆☆☆☆☆   ★★★☆☆
SCeQTL-Agent V2      ★★★☆☆   ★★★★★   ★★★★★   ★★★★★   ★★★☆☆   ★★★★★
```

---

## 2. 设计哲学与原则

### 2.1 核心设计哲学

**"Understand Before Query, Fuse Before Present, Explain Before Deliver"**

- **先理解再查询**：不急于生成SQL，先通过本体解析和用户意图理解建立精确的语义表示
- **先融合再呈现**：跨库结果经过去重、关联和质量评分后才呈现给用户
- **先解释再交付**：每条结果附带来源、置信度和数据可用性说明

### 2.2 设计原则

| 原则 | 说明 |
|------|------|
| **Schema-Agnostic Tooling** | Agent工具层通过schema introspection动态适应表结构变化，不硬编码字段名 |
| **Ontology-First Semantics** | 所有生物学概念优先通过本体层级解析，而非字符串匹配 |
| **Progressive Disclosure** | 从项目级概览到样本级详情，按需逐层深入 |
| **Provenance-Aware** | 每个数据点可追溯到原始来源和ETL路径 |
| **Graceful Degradation** | LLM不可用时退化为规则引擎；本体缺失时退化为模糊匹配 |
| **Cost-Conscious** | 优先使用缓存和规则，仅在必要时调用LLM |

---

## 3. 系统架构总览

### 3.1 四层架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ Web UI   │  │ REST API │  │ CLI      │  │ Python SDK   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                    AGENT LAYER (核心智能)                        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │               COORDINATOR AGENT                         │   │
│  │  (意图分类 → 任务分派 → 结果聚合 → 答案生成)              │   │
│  └──────┬──────────┬──────────┬──────────┬─────────────────┘   │
│         │          │          │          │                       │
│  ┌──────▼───┐ ┌────▼────┐ ┌──▼──────┐ ┌▼──────────┐           │
│  │ Query    │ │Ontology │ │Cross-DB │ │ Answer    │           │
│  │ Under-   │ │Resolver │ │Fusion   │ │ Synthe-   │           │
│  │ standing │ │         │ │Engine   │ │ sizer     │           │
│  └──────────┘ └─────────┘ └─────────┘ └───────────┘           │
│                                                                 │
│  ┌──────────────────────┐  ┌────────────────────────────┐      │
│  │  Memory System       │  │  SQL Gen & Execution       │      │
│  │  (Working/Episodic/  │  │  (Multi-candidate +        │      │
│  │   Semantic)          │  │   Validation)              │      │
│  └──────────────────────┘  └────────────────────────────┘      │
├─────────────────────────────────────────────────────────────────┤
│                    SERVICE LAYER (数据服务)                      │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────┐      │
│  │ DB       │  │ Ontology     │  │ Schema               │      │
│  │ Abstract │  │ Cache        │  │ Inspector            │      │
│  │ Layer    │  │ (UBERON/     │  │ (动态表结构发现)       │      │
│  │          │  │  MONDO/CL)   │  │                      │      │
│  └──────────┘  └──────────────┘  └──────────────────────┘      │
├─────────────────────────────────────────────────────────────────┤
│                    STORAGE LAYER                                 │
│  ┌────────────────────┐  ┌───────────┐  ┌──────────────┐       │
│  │ unified_metadata   │  │ Memory    │  │ Ontology     │       │
│  │ .db (SQLite/PG)    │  │ Store     │  │ Graph Store  │       │
│  │ 8 tables + 1 view  │  │ (SQLite)  │  │ (SQLite)     │       │
│  └────────────────────┘  └───────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 查询处理主流程

```
用户输入 (自然语言)
    │
    ▼
┌─── COORDINATOR AGENT ────────────────────────────────────┐
│                                                          │
│  Step 1: UNDERSTAND                                      │
│  ┌──────────────────────────────────────────┐            │
│  │ Query Understanding Module               │            │
│  │ - 意图分类 (搜索/比较/统计/探索/下载)      │            │
│  │ - 实体抽取 (组织/疾病/细胞类型/平台)       │            │
│  │ - 复杂度评估 (简单SQL/需要融合/需要推理)    │            │
│  └──────────────┬───────────────────────────┘            │
│                 ▼                                         │
│  Step 2: RESOLVE                                         │
│  ┌──────────────────────────────────────────┐            │
│  │ Ontology Resolution Engine               │            │
│  │ - 用户术语 → 标准本体ID                    │            │
│  │ - 层级扩展 (brain → cerebral cortex,      │            │
│  │            hippocampus, cerebellum...)    │            │
│  │ - 跨本体映射 (UBERON ↔ tissue字段值)       │            │
│  └──────────────┬───────────────────────────┘            │
│                 ▼                                         │
│  Step 3: PLAN & GENERATE                                 │
│  ┌──────────────────────────────────────────┐            │
│  │ Query Planner + SQL Generator            │            │
│  │ - 确定涉及的表和JOIN路径                    │            │
│  │ - 生成多候选SQL (CoT + 模板 + 直接生成)     │            │
│  │ - 执行验证 (语法检查 + 结果合理性)           │            │
│  └──────────────┬───────────────────────────┘            │
│                 ▼                                         │
│  Step 4: EXECUTE & FUSE                                  │
│  ┌──────────────────────────────────────────┐            │
│  │ Execution + Cross-DB Fusion              │            │
│  │ - 执行最优SQL候选                          │            │
│  │ - 跨库去重 (entity_links + identity_hash) │            │
│  │ - 多源证据聚合                             │            │
│  │ - 数据质量评分                             │            │
│  └──────────────┬───────────────────────────┘            │
│                 ▼                                         │
│  Step 5: SYNTHESIZE                                      │
│  ┌──────────────────────────────────────────┐            │
│  │ Answer Synthesis                         │            │
│  │ - 结构化结果 → 自然语言摘要                  │            │
│  │ - 数据血缘链生成                            │            │
│  │ - 后续探索建议                              │            │
│  │ - 数据下载引导                              │            │
│  └──────────────┬───────────────────────────┘            │
│                 ▼                                         │
│  Memory Update: 记录查询历史、更新用户画像、缓存结果       │
│                                                          │
└──────────────────────────────────────────────────────────┘
    │
    ▼
用户收到: 结构化结果 + 自然语言解释 + 数据来源 + 建议操作
```

### 3.3 设计决策说明

| 决策 | 选项 | 选择 | 理由 |
|------|------|------|------|
| Agent框架 | LangGraph vs 自研 | **自研轻量框架** | 8表schema不需重型框架；自研便于论文贡献说明；避免外部依赖变化 |
| 单Agent vs 多Agent | 单一ReAct vs 多角色Agent | **单Coordinator + Tool模式** | 表规模不大(8表)，工具数可控(~10个)；多Agent增加延迟和复杂度 |
| SQL生成策略 | 单候选 vs 多候选 | **3候选生成 + 执行验证** | CHASE-SQL证明多候选+选择优于单路径；3个平衡成本和效果 |
| 本体集成方式 | 实时API vs 本地缓存 | **本地缓存 + 定期同步** | 避免查询延迟；OLS API不稳定 |
| LLM调用策略 | 全程LLM vs 规则优先 | **规则优先 + LLM兜底** | 减少成本和延迟；可预测行为 |

---

---

## 4-11. 详细设计文档索引

核心模块的完整设计已拆分为4个详细文档：

| 文档 | 内容 | 对应章节 |
|------|------|---------|
| [MODULE_DETAIL_PART1.md](MODULE_DETAIL_PART1.md) | Coordinator Agent、Query Understanding、Ontology Engine | §4.1-4.3 |
| [MODULE_DETAIL_PART2.md](MODULE_DETAIL_PART2.md) | SQL生成与执行、跨库融合引擎 | §4.4-4.5 |
| [MODULE_DETAIL_PART3.md](MODULE_DETAIL_PART3.md) | 答案合成、记忆系统、数据库抽象层 | §4.6-4.7, §5 |
| [MODULE_DETAIL_PART4.md](MODULE_DETAIL_PART4.md) | Web架构、API设计、评估框架、技术选型、实施路线图 | §6-11 |

### 核心模块一览

```
模块                          │ 文件                    │ 核心创新
─────────────────────────────┼────────────────────────┼───────────────────────
4.1 Coordinator Agent        │ agent/coordinator.py   │ ReAct + 10 Tools
4.2 Query Understanding      │ understanding/parser.py│ 规则优先 + LLM兜底 (70/30)
4.3 Ontology Resolution ★    │ ontology/resolver.py   │ 50K术语 + 层级扩展 + DB映射
4.4 SQL Generation           │ sql/generator.py       │ 3候选 + 执行验证
4.5 Cross-DB Fusion ★        │ fusion/engine.py       │ entity_links + hash去重 + 质量分
4.6 Answer Synthesis         │ synthesis/answer.py    │ TAG范式 + 血缘 + 建议
4.7 Memory System            │ memory/system.py       │ 3层记忆 + 多表Schema KB
5.  Database Abstraction     │ dal/database.py        │ SQLite/PG双支持
```

★ = 论文核心创新模块
