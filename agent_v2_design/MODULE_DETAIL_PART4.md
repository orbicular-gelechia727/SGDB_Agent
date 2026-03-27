# 核心模块详细设计 - Part 4: Web架构、API设计、评估框架、技术选型、实施路线图

> 本文件是 ARCHITECTURE.md 第6-11章的详细展开

---

## 6. Web应用架构

### 6.1 技术选型

```
前端: React 18 + TypeScript + TailwindCSS + Recharts
后端: FastAPI (Python 3.11+) + WebSocket
通信: REST API + WebSocket (流式输出)
状态: 后端会话管理 (无需前端状态库)
```

选择理由:
- **FastAPI** vs Flask: 原生async支持、自动OpenAPI文档、类型安全、性能更优
- **React + TypeScript**: 组件化UI、类型安全、生态丰富
- **TailwindCSS**: 快速原型、一致设计、无需自定义CSS
- **Recharts**: 声明式图表、React原生、支持交互

### 6.2 前端页面结构

```
┌─────────────────────────────────────────────────────────────┐
│                    HEADER                                    │
│  SCeQTL-Agent | Database Stats | About | Language (中/EN)   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                 CHAT INTERFACE                          │ │
│  │                                                        │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │ [Agent] 我可以帮你查询756,579个单细胞样本的       │  │ │
│  │  │ 元数据，覆盖CellXGene、GEO、SRA等12个数据库。    │  │ │
│  │  │ 你可以问我：                                      │  │ │
│  │  │ • "找到所有人类大脑的阿尔茨海默病数据集"          │  │ │
│  │  │ • "比较肝癌在GEO和CellXGene中的数据覆盖"        │  │ │
│  │  │ • "统计各组织的样本数量分布"                      │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │                                                        │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │ [User] 查找人类大脑中与阿尔茨海默病相关的         │  │ │
│  │  │        单细胞数据集，最好有10x数据                 │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │                                                        │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │ [Agent] 找到 47 个相关数据集 (跨3个数据库):      │  │ │
│  │  │                                                  │  │ │
│  │  │ 📊 来源分布: [饼图: CellXGene 18, GEO 21, ...]  │  │ │
│  │  │                                                  │  │ │
│  │  │ ┌──────────────────────────────────────────┐     │  │ │
│  │  │ │ RESULTS TABLE (可排序/筛选)               │     │  │ │
│  │  │ │ Score│Title│Tissue│Disease│Assay│Sources │     │  │ │
│  │  │ │ 92.5 │...  │brain │AD    │10x  │3 DBs  │     │  │ │
│  │  │ │ 87.3 │...  │hippo │AD    │10x  │2 DBs  │     │  │ │
│  │  │ │ ...  │     │      │      │     │       │     │  │ │
│  │  │ └──────────────────────────────────────────┘     │  │ │
│  │  │                                                  │  │ │
│  │  │ 💡 建议:                                         │  │ │
│  │  │ [细化: 按脑区分类] [下载: 查看可下载数据]        │  │ │
│  │  │ [比较: 各脑区AD数据覆盖] [血缘: 查看跨库关联]    │  │ │
│  │  │                                                  │  │ │
│  │  │ 📋 查询详情: SQL | 本体扩展 | 数据血缘           │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  │                                                        │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │ 🔍 输入你的查询...                    [发送]     │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌──── SIDEBAR (可折叠) ─────────────────────────────────┐  │
│  │ 📜 查询历史                                            │  │
│  │ ├── 查找大脑AD数据集                                   │  │
│  │ ├── 比较肝癌数据覆盖                                   │  │
│  │ └── 统计组织分布                                       │  │
│  │                                                        │  │
│  │ 📊 数据库概览                                          │  │
│  │ ├── 项目数: 23,123                                     │  │
│  │ ├── 样本数: 756,579                                    │  │
│  │ ├── 数据源: 12个                                       │  │
│  │ └── 跨库链接: 9,966                                    │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 关键交互特性

| 特性 | 实现方式 | 用户价值 |
|------|---------|---------|
| **流式输出** | WebSocket + 逐token推送 | 减少等待感 |
| **建议卡片** | 可点击的Suggestion组件 | 引导探索 |
| **结果表格** | 可排序/筛选/展开详情 | 高效浏览 |
| **可视化嵌入** | Recharts在聊天流中渲染 | 直观理解 |
| **查询透明** | 可展开查看SQL/本体扩展 | 建立信任 |
| **数据血缘** | 可视化跨库关联图 | 追溯来源 |
| **导出功能** | CSV/JSON/BibTeX导出 | 集成工作流 |

---

## 7. API设计

### 7.1 RESTful API

```yaml
# 核心查询
POST /api/v1/query
  body: { "query": "find brain AD datasets", "session_id": "...", "limit": 20 }
  response: AgentResponse (含summary, results, suggestions, charts)

# 流式查询 (WebSocket)
WS /api/v1/query/stream
  send: { "query": "...", "session_id": "..." }
  receive: { "type": "thinking|result|suggestion|chart|done", "data": ... }

# ID查询
GET /api/v1/entity/{id}
  params: id=GSE149614 | PRJNA625514 | PMID:33168968
  response: { entity, cross_links, available_in_databases }

# Schema信息
GET /api/v1/schema
  response: { tables, fields, statistics, relationships }

GET /api/v1/schema/{table}/stats/{field}
  params: top_n=20
  response: { distinct_values, null_pct, distribution }

# 字段值自动补全
GET /api/v1/autocomplete
  params: field=tissue&prefix=bra&limit=10
  response: ["brain", "brainstem", "brain organoid"]

# 本体查询
GET /api/v1/ontology/resolve
  params: term=brain&type=tissue&expand=true
  response: { ontology_id, label, children, db_values }

# 跨库关联
GET /api/v1/links/{entity_type}/{pk}
  response: { links: [{target, relationship, evidence}] }

# 数据导出
POST /api/v1/export
  body: { "query_id": "...", "format": "csv|json|bibtex", "fields": [...] }
  response: { download_url }

# 会话管理
GET /api/v1/session/{session_id}/history
POST /api/v1/session/{session_id}/feedback
  body: { "query_id": "...", "rating": 1-5, "comment": "..." }

# 系统统计
GET /api/v1/stats
  response: { total_projects, total_samples, by_source, coverage_report }
```

### 7.2 Python SDK

```python
# 面向编程用户的Python SDK
from sceqtl_agent import SCeQTLAgent

agent = SCeQTLAgent(db_path="unified_metadata.db")

# 自然语言查询
results = agent.query("find brain Alzheimer datasets with 10x")
print(results.summary)
print(results.to_dataframe())

# 结构化查询
results = agent.search_samples(
    tissue="brain",
    disease="Alzheimer's disease",
    assay="10x 3' v3",
    min_cells=1000
)

# ID查询
entity = agent.get_entity("GSE149614")
links = agent.get_cross_links("GSE149614")

# 统计
stats = agent.field_stats("tissue", top_n=20)
```

---

## 8. 评估框架

### 8.1 评估维度

```
┌────────────────────────────────────────────────────────┐
│                EVALUATION FRAMEWORK                     │
│                                                        │
│  Dimension 1: Query Accuracy (查询准确性)               │
│  ├── SQL Execution Accuracy (EX)                       │
│  ├── Result Relevance (人工标注)                        │
│  └── Ontology Expansion Precision/Recall               │
│                                                        │
│  Dimension 2: Cross-DB Fusion Quality (融合质量)        │
│  ├── Dedup Precision (误合并率)                         │
│  ├── Dedup Recall (漏合并率)                            │
│  └── Source Coverage (多源覆盖率)                       │
│                                                        │
│  Dimension 3: User Experience (用户体验)                │
│  ├── Answer Completeness (回答完整性)                   │
│  ├── Response Time (响应时间)                           │
│  ├── Suggestion Usefulness (建议有效性)                  │
│  └── SUS Score (系统可用性量表)                          │
│                                                        │
│  Dimension 4: Cost Efficiency (成本效率)                 │
│  ├── LLM API Calls per Query                           │
│  ├── Token Usage per Query                             │
│  ├── Rule vs LLM Resolution Rate                       │
│  └── Cache Hit Rate                                    │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### 8.2 基准测试集设计

```python
# 150道测试题，覆盖6种意图×5种复杂度

BENCHMARK_CATEGORIES = {
    "simple_search": {
        # 简单搜索 (30题)
        "examples": [
            {
                "query": "查找人类肝脏的单细胞数据集",
                "gold_sql": "SELECT * FROM v_sample_with_hierarchy WHERE tissue = 'liver' AND organism = 'Homo sapiens' LIMIT 20",
                "expected_count_range": (100, 500),
                "required_fields": ["tissue", "organism"],
            },
            {
                "query": "Find all 10x Chromium datasets in CellXGene",
                "gold_sql": "...",
            },
        ],
    },

    "ontology_expansion": {
        # 需要本体扩展的查询 (25题)
        "examples": [
            {
                "query": "brain相关的所有组织样本",
                "gold_expanded_terms": ["brain", "cerebral cortex", "hippocampus",
                                         "cerebellum", "hypothalamus"],
                "min_expansion_recall": 0.8,
            },
        ],
    },

    "cross_db_fusion": {
        # 需要跨库融合的查询 (25题)
        "examples": [
            {
                "query": "GSE149614的所有相关数据",
                "expected_databases": ["geo", "ncbi", "cellxgene"],
                "gold_dedup_count": 1,  # 应合并为1条
            },
        ],
    },

    "complex_multi_table": {
        # 涉及多表JOIN的复杂查询 (25题)
        "examples": [
            {
                "query": "找到引用超过100次的项目中的T细胞样本",
                "required_joins": ["unified_samples", "unified_projects", "unified_celltypes"],
            },
        ],
    },

    "statistics": {
        # 统计型查询 (25题)
        "examples": [
            {
                "query": "各数据库的样本数量分布",
                "gold_sql": "SELECT source_database, COUNT(*) FROM unified_samples GROUP BY source_database",
            },
        ],
    },

    "multi_turn": {
        # 多轮对话 (20题)
        "examples": [
            {
                "turns": [
                    {"query": "找到肺癌数据集", "expected_count_range": (50, 200)},
                    {"query": "这些中有哪些用了10x", "context": "refinement"},
                    {"query": "按数据库来源统计", "context": "statistics_on_previous"},
                ],
            },
        ],
    },
}
```

### 8.3 Baseline对比

| 系统 | 对比维度 | 实现方式 |
|------|---------|---------|
| **直接SQL** | 专家手写SQL的准确率上限 | 5位生物信息学家标注 |
| **通用LLM** | GPT-4/Claude直接对话 (无数据库) | 提供schema让LLM生成SQL |
| **Text2SQL工具** | 如 Vanna.AI, SQLCoder | 接入同一数据库 |
| **CellXGene搜索** | 现有CellXGene web搜索 | 只能搜CellXGene数据 |
| **GEO搜索** | NCBI GEO搜索 | 只能搜GEO数据 |

### 8.4 用户研究方案

```
参与者: 10-15位分子生物学/生物信息学研究者
任务: 每人完成5个真实研究场景的数据查询
评估:
  1. 任务完成率 (vs 手动在各数据库网站搜索)
  2. 完成时间 (vs 手动搜索)
  3. 结果满意度 (1-5 Likert)
  4. System Usability Scale (SUS)
  5. 半结构化访谈 (开放反馈)

场景示例:
  S1: "为你的肝纤维化研究找到所有可用的单细胞数据集"
  S2: "比较阿尔茨海默病在不同脑区的数据覆盖情况"
  S3: "找到一篇2023年发表的心脏发育单细胞文章的原始数据"
  S4: "统计当前可用的10x Chromium v3数据集的组织分布"
  S5: "找到与PRJNA625514相关的所有数据库中的记录"
```

---

## 9. 技术选型

### 9.1 技术栈

```
Category          │ Choice                │ Version  │ Rationale
──────────────────┼───────────────────────┼──────────┼────────────────────────
Runtime           │ Python                │ 3.11+    │ 团队熟悉, 生态丰富
Web Framework     │ FastAPI               │ 0.110+   │ Async, 自动文档, 类型安全
Database          │ SQLite → PostgreSQL   │ 3.40+    │ 零配置开发, 生产迁移
ORM/DB Access     │ SQLAlchemy 2.0        │ 2.0+     │ 核心SQL, 模型映射可选
LLM Client        │ anthropic (Claude)    │ latest   │ 原生Tool Use, 长上下文
                  │ openai (备选)          │ latest   │ 备选LLM
Frontend          │ React + TypeScript    │ 18+      │ 组件化, 类型安全
Frontend UI       │ TailwindCSS           │ 3.4+     │ 快速开发, 一致设计
Charts            │ Recharts              │ 2.x      │ React原生, 声明式
WebSocket         │ FastAPI WebSocket     │ built-in │ 流式输出
Testing           │ pytest + pytest-async │ 8.x      │ Python标准
Ontology Parse    │ pronto (OBO/OWL)      │ 2.5+     │ 轻量本体解析
NLP (可选)        │ spaCy + scispaCy      │ 3.7+     │ 生物医学NER
```

### 9.2 LLM使用策略

```
优化目标: 在保持质量的前提下最小化LLM调用成本

策略:
┌─────────────────────────┬───────────────┬──────────┬─────────┐
│ 场景                     │ 是否调用LLM   │ 使用模型  │ 预估延迟 │
├─────────────────────────┼───────────────┼──────────┼─────────┤
│ ID直接查询 (GSE12345)    │ ❌ 规则       │ -        │ <50ms   │
│ 简单搜索 (tissue=brain)  │ ❌ 规则       │ -        │ <100ms  │
│ 复杂搜索 (多条件组合)     │ ✅ 1次调用   │ Haiku    │ ~500ms  │
│ 歧义消解                 │ ✅ 1次调用   │ Sonnet   │ ~800ms  │
│ SQL修复/验证             │ ✅ 1次调用   │ Haiku    │ ~500ms  │
│ 答案合成 (大结果集)       │ ✅ 1次调用   │ Sonnet   │ ~1s     │
│ 本体未知术语映射         │ ✅ 1次调用   │ Haiku    │ ~500ms  │
│ 多轮对话上下文理解       │ ✅ 1次调用   │ Sonnet   │ ~800ms  │
└─────────────────────────┴───────────────┴──────────┴─────────┘

平均每次用户查询: 1.5次LLM调用 (规则处理70%+场景)
预估平均延迟: 800ms (规则路径) ~ 2.5s (LLM路径)
预估成本: ~$0.005/查询 (Haiku) ~ $0.02/查询 (Sonnet)
```

---

## 10. 实施路线图

### 10.1 分阶段计划

```
Phase 0: 基础准备 (3-5天)
├── 0.1 项目结构搭建 (FastAPI项目骨架)
├── 0.2 数据库抽象层实现 (DAL + SchemaInspector)
├── 0.3 本体缓存构建 (下载UBERON/MONDO/CL, 构建value_to_ontology映射)
└── 0.4 配置管理 (LLM API key, 数据库路径, 日志)

Phase 1: 核心Agent (7-10天)
├── 1.1 Coordinator Agent骨架 (ReAct循环 + Tool注册)
├── 1.2 Query Understanding (规则引擎 + LLM解析器)
├── 1.3 Ontology Resolution Engine
├── 1.4 SQL Generator (模板 + 规则 + LLM 三路径)
├── 1.5 SQL Executor + 渐进降级
├── 1.6 Cross-DB Fusion Engine
└── 1.7 Answer Synthesizer (摘要 + 建议 + 血缘)

Phase 2: 记忆与优化 (5-7天)
├── 2.1 三层记忆系统实现
├── 2.2 Schema知识库自动构建
├── 2.3 多轮对话管理
├── 2.4 查询缓存与复用
└── 2.5 性能优化 (批量查询, 索引优化)

Phase 3: Web前端 (7-10天)
├── 3.1 FastAPI后端API实现
├── 3.2 WebSocket流式输出
├── 3.3 React前端: 聊天界面
├── 3.4 React前端: 结果表格 + 可视化
├── 3.5 React前端: 侧边栏 (历史, 统计)
└── 3.6 导出功能 (CSV, JSON, BibTeX)

Phase 4: 评估与论文 (7-10天)
├── 4.1 基准测试集构建 (150题)
├── 4.2 自动化评估pipeline
├── 4.3 Baseline系统对比实验
├── 4.4 用户研究 (10-15人)
├── 4.5 系统架构图绘制
├── 4.6 案例研究撰写
└── 4.7 论文初稿
```

### 10.2 MVP定义 (Phase 1完成后)

MVP应能支持以下5个核心场景:

```
场景1: "查找人类大脑中阿尔茨海默病的数据集"
  → 本体扩展brain子区域 → 跨12个库查询 → 去重融合 → 返回排序结果

场景2: "GSE149614"
  → ID识别 → 查询项目 → 查找跨库关联 → 展示多源信息

场景3: "统计各组织的样本数量分布"
  → 统计意图 → 生成GROUP BY SQL → 返回分布 + 柱状图

场景4: "这些中有哪些用了10x" (多轮)
  → 识别为细化 → 在上一轮结果基础上加条件 → 返回子集

场景5: "比较肝癌在CellXGene和GEO中的数据"
  → 比较意图 → 分组查询 → 对比展示
```

---

## 11. 与现有系统对比

### 11.1 架构层面对比

```
┌──────────────────┬─────────────┬──────────────┬────────────────┐
│ 维度              │ V1 (旧Agent) │ SRAgent      │ V2 (本设计)     │
├──────────────────┼─────────────┼──────────────┼────────────────┤
│ 数据模型          │ 单表(52字段) │ PostgreSQL   │ 8表归一化       │
│ 查询方式          │ 字段匹配     │ NCBI API     │ NL→SQL+本体    │
│ 跨库融合          │ ❌           │ ❌           │ ✅ entity_links │
│ 本体支持          │ 硬编码同义词  │ UBERON/MONDO │ 50K术语缓存    │
│ 多轮对话          │ ✅ 基础      │ ❌           │ ✅ 上下文感知   │
│ SQL生成           │ 规则         │ N/A          │ 3候选+验证     │
│ 答案解释          │ 模板         │ ❌           │ TAG范式+LLM    │
│ 数据质量评估      │ ❌           │ ❌           │ ✅ 综合评分     │
│ Web前端           │ Flask+Alpine │ ❌           │ FastAPI+React  │
│ LLM调用优化      │ 全程LLM      │ 全程LLM      │ 规则优先+LLM   │
└──────────────────┴─────────────┴──────────────┴────────────────┘
```

### 11.2 核心差异化总结

**对比SRAgent (Arc Institute, 最直接竞争者):**
- SRAgent专注于**数据发现与采集**（从SRA中发现新数据集）
- 我们专注于**已有数据的智能查询与融合**（12个库的统一检索）
- SRAgent没有跨库去重和融合
- 我们提供本体感知的语义扩展查询
- 我们提供数据质量透明化和血缘追踪

**对比CellAtria (AstraZeneca):**
- CellAtria专注于**单个研究的端到端分析**（从论文到分析）
- 我们专注于**跨库元数据检索和比较**
- CellAtria不处理多数据库融合
- 我们的用户场景是"找数据"而非"分析数据"

**本系统的独特贡献:**
1. 首个覆盖12个主要单细胞数据库的统一元数据智能检索系统
2. 本体感知的语义查询扩展（UBERON/MONDO/CL）
3. 基于entity_links的跨库证据融合与质量评分
4. TAG范式的混合查询（SQL + LLM推理）
5. 完整的数据血缘追踪和质量透明化

---

## 附录A: 目录结构

```
agent_v2/
├── README.md
├── pyproject.toml
├── config/
│   ├── default.yaml          # 默认配置
│   └── ontology_sources.yaml # 本体数据源
├── src/
│   ├── __init__.py
│   ├── agent/
│   │   ├── coordinator.py    # 4.1 Coordinator Agent
│   │   ├── tools.py          # Tool定义与注册
│   │   └── prompts.py        # System prompt模板
│   ├── understanding/
│   │   ├── parser.py         # 4.2 查询理解 (规则+LLM)
│   │   └── entities.py       # 实体数据结构
│   ├── ontology/
│   │   ├── resolver.py       # 4.3 本体解析引擎
│   │   ├── cache.py          # 本体缓存管理
│   │   └── builder.py        # 缓存构建工具
│   ├── sql/
│   │   ├── generator.py      # 4.4 SQL生成器
│   │   ├── executor.py       # SQL执行与验证
│   │   ├── join_resolver.py  # JOIN路径推理
│   │   └── templates.py      # SQL模板库
│   ├── fusion/
│   │   ├── engine.py         # 4.5 跨库融合引擎
│   │   ├── quality.py        # 质量评分
│   │   └── union_find.py     # Union-Find算法
│   ├── synthesis/
│   │   ├── answer.py         # 4.6 答案合成
│   │   ├── suggestions.py    # 建议生成
│   │   └── charts.py         # 可视化规格
│   ├── memory/
│   │   ├── system.py         # 4.7 记忆系统
│   │   ├── schema_kb.py      # Schema知识库
│   │   └── conversation.py   # 多轮对话管理
│   ├── dal/
│   │   ├── database.py       # 5. 数据库抽象层
│   │   └── inspector.py      # Schema Introspection
│   └── sdk/
│       └── client.py         # Python SDK
├── api/
│   ├── __init__.py
│   ├── main.py               # FastAPI应用入口
│   ├── routes/
│   │   ├── query.py          # /api/v1/query
│   │   ├── schema.py         # /api/v1/schema
│   │   ├── entity.py         # /api/v1/entity
│   │   ├── ontology.py       # /api/v1/ontology
│   │   └── export.py         # /api/v1/export
│   └── websocket.py          # WebSocket处理
├── web/
│   ├── package.json
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ChatInterface.tsx
│   │   │   ├── ResultTable.tsx
│   │   │   ├── ChartPanel.tsx
│   │   │   ├── SuggestionCards.tsx
│   │   │   ├── ProvenanceView.tsx
│   │   │   └── Sidebar.tsx
│   │   └── hooks/
│   │       ├── useWebSocket.ts
│   │       └── useQuery.ts
│   └── public/
├── tests/
│   ├── test_understanding.py
│   ├── test_ontology.py
│   ├── test_sql_generation.py
│   ├── test_fusion.py
│   └── benchmark/
│       ├── benchmark_suite.json  # 150题测试集
│       └── run_benchmark.py
└── scripts/
    ├── build_ontology_cache.py
    ├── analyze_schema.py
    └── run_benchmark.py
```
