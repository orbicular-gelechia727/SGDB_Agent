# SCeQTL-Agent — 项目全貌与开发状态总结

> **文档日期**: 2026-03-11
> **项目定位**: 全球人源单细胞 RNA-seq 统一元数据平台 + AI 检索 Agent
> **当前状态**: 全部开发阶段完成，进入复核阶段

---

## 1. 项目概述

SCeQTL-Agent 是一个面向单细胞转录组研究的统一元数据检索平台。项目整合了全球 **12 个主要数据源**的元数据，构建了包含 **756,579 个样本**、**23,123 个项目**的统一 SQLite 数据库，并在此基础上开发了一套完整的 AI Agent 检索系统和 Web 门户。

### 核心能力

| 能力 | 描述 |
|------|------|
| 统一元数据库 | 12 个数据源 → 4 级统一 Schema (projects → series → samples → celltypes) |
| 跨库关联 | 9,966 条跨库链接 (PRJNA↔GSE, PMID, DOI)，100K 去重候选 |
| AI 自然语言检索 | 中英文双语查询，85% 零 LLM 消耗的规则引擎 |
| 本体知识图谱 | 113K 本体术语 (UBERON + MONDO + CL + EFO)，5 步渐进解析 |
| 跨库去重融合 | UnionFind 分组 + identity hash 去重 |
| 数据门户网站 | 6 个页面的专业门户：首页/探索/统计/详情/下载/对话 |
| 结构化检索 | Faceted Search 面板 + 分页 + 排序 + URL 状态驱动 |
| 原始数据下载 | FASTQ/H5AD/RDS 下载链接解析，批量脚本生成 |

---

## 2. 数据与数据库

### 2.1 数据源分布

| 数据源 | 项目数 | 系列数 | 样本数 | ID 前缀 | 采集方式 |
|--------|--------|--------|--------|---------|---------|
| **GEO** | 5,406 | 5,406 | 342,368 | GSE*, GSM* | Excel→CSV |
| **NCBI/SRA** | 8,156 | 7,622 | 217,513 | PRJNA*, SRS* | NCBI API→SQLite |
| **EBI** | 1,019 | — | 160,135 | E-MTAB*, SAMEA* | REST API→JSON |
| **CellXGene** | 269 | 1,086 | 33,984 | UUID | Census API→CSV |
| **PsychAD** | — | — | 1,494 | — | 公开下载 |
| **HTAN** | — | — | 942 | — | 公开下载 |
| **HCA** | — | — | 143 | — | HCA Portal |
| **总计** | **23,123** | **15,968** | **756,579** | | |

### 2.2 数据库文件

| 文件 | 大小 | 说明 |
|------|------|------|
| `unified_metadata.db` | 1.4 GB | 主数据库 (SQLite) |
| `ontology_cache.db` | 103 MB | 本体解析缓存 (113K 术语) |
| `episodic.db` | 88 KB | 用户会话记忆 |
| `semantic.db` | 44 KB | 系统知识记忆 |

### 2.3 数据库 Schema

**核心表 (4 级层级)**:
- `unified_projects` — 23,123 行 (项目级，含 PMID/DOI/citation)
- `unified_series` — 15,968 行 (系列级，含 assay/H5AD/RDS URL)
- `unified_samples` — 756,579 行 (样本级，含 tissue/disease/cell_type/sex/age)
- `unified_celltypes` — 378,029 行 (细胞类型注释)

**关系表**:
- `entity_links` — 9,966 条跨库链接
- `id_mappings` — 外部 ID 映射
- `dedup_candidates` — 100,000 条去重候选

**索引与优化**:
- 43 个普通/复合索引
- 3 个 FTS5 全文搜索索引 (fts_samples, fts_series, fts_projects)
- 9 个预计算统计表 (stats_by_source, stats_by_tissue, stats_by_disease, stats_by_assay, stats_by_organism, stats_by_sex, stats_by_cell_type, stats_by_year, stats_overall)
- 2 个质量监控视图 (v_data_quality, v_field_quality)

### 2.4 跨库关联

| 关联类型 | 数量 | 方法 |
|----------|------|------|
| PRJNA↔GSE (same_as) | 4,142 | BioProject XML 双向匹配 |
| PMID 关联 (linked_via_pmid) | 5,756 | NCBI↔GEO PubMed ID 匹配 |
| DOI 关联 (linked_via_doi) | 68 | CellXGene↔NCBI DOI 匹配 |
| 去重候选 (identity hash) | 100,000 | 生物学特征 hash 碰撞检测 |

---

## 3. 开发阶段完成情况

### Phase 0: 基础设施 ✅

- 项目骨架: pyproject.toml, 模块结构, `__init__.py`
- 核心模型: 26 个 dataclass (ParsedQuery, SQLCandidate, ExecutionResult 等)
- 协议接口: ILLMClient, IQueryParser, ISQLGenerator 等
- LLM 客户端: Claude + OpenAI, CircuitBreaker + LLMRouter
- 预算控制: 日预算追踪, 自动模型选择
- DAL: 连接池 + SchemaInspector
- 缓存: 3 层 (session + global + SQL)

### Phase 1: 核心 Agent 管线 ✅

- 查询解析器: 规则引擎 (85%) + LLM fallback (15%), 中英双语
- SQL 生成器: 3 候选策略 (template + rule + LLM), 并行执行
- 跨库融合: UnionFind 分组, 质量评分
- 协调器: Pipeline 模式 (parse→sql→execute→fuse→synthesize)
- **测试**: 10/10 E2E 通过

### Phase 2: 本体 + 记忆 + 优化 ✅

- 本体解析引擎: OBO parser (UBERON 9.5K + MONDO 30.7K + CL 16.7K + EFO 56.5K = 113K)
- OntologyCache: SQLite + FTS5, 6K ontology→DB 值映射
- OntologyResolver: 5 步管线 (exact→synonym→fuzzy→LLM→fallback)
- 记忆系统: WorkingMemory + EpisodicMemory + SemanticMemory
- 数据库优化: 复合索引, 统计查询 87s → 22s
- **测试**: 13/13 E2E 通过

### Phase 3: Web 应用 ✅

- FastAPI 后端: 12 个 API 端点
- React + TypeScript + TailwindCSS 前端
- WebSocket 实时流式输出
- Vite 构建, 0 TS 错误
- **测试**: 8/8 API 测试通过

### Phase 4: 评测框架 ✅

- 154 道测试题, 7 个类别
- 总通过率: **142/154 (92.2%)**
  - Simple Search: 30/30 (100%)
  - Ontology: 19/25 (76%)
  - Cross-DB Fusion: 25/25 (100%)
  - Complex: 25/25 (100%)
  - Statistics: 20/25 (80%)
  - Multi-turn: 19/19 (100%)
- 84.9% 查询无需 LLM (规则 68.6% + 模板 16.3%)

### Phase 5: 工程质量 ✅

- 自定义异常层级: SCeQTLError + 15 领域异常
- 独立 AnswerSynthesizer: 模板模式 (零 LLM) + LLM 增强模式
- Protocol-based DI 重构: Coordinator 接受协议接口
- SQLite 连接池: 线程安全, 最大 8 连接
- **单元测试**: 134/134 通过 (6 模块)

### Phase 6: Web 增强 ✅

- WebSocket 流式管线进度
- Error Boundary 崩溃保护
- Markdown 渲染 (react-markdown)
- 导出功能: CSV/JSON/BibTeX
- 响应式布局
- WCAG 对比度修复

### Phase 7: API 安全加固 ✅

- 速率限制中间件 (60 req/min/IP)
- 结构化日志 + 请求 ID
- RFC 7807 错误格式 (problem+json)
- 环境驱动 CORS 配置
- 请求超时保护

### Phase 8: 门户网站升级 ✅

**6 个页面完整实现**:

| 路由 | 页面 | 功能 |
|------|------|------|
| `/` | 首页 | Hero + 统计卡片 + 数据源卡片 + 精选数据集 |
| `/explore` | 探索 | Faceted Search 面板 + 结果表格 + 分页 + URL 状态 |
| `/explore/:id` | 数据集详情 | 元数据 + 样本列表 + 跨库链接 + 下载选项 |
| `/stats` | 统计 | 6+ 图表 (Recharts) + 统计卡片 + 可点击导航 |
| `/chat` | 对话 | 原有对话界面, WebSocket 流式 |
| `/downloads` | 下载中心 | 按 ID 查询 + 批量脚本生成 (TSV/Bash/aria2) |

**新增后端 API**:

| 端点 | 方法 | 功能 |
|------|------|------|
| `POST /api/v1/explore` | Faceted 搜索 + 面板计数 |
| `POST /api/v1/explore/facets` | 仅面板计数 (无结果) |
| `GET /api/v1/dataset/{id}` | 数据集详情 + 下载链接 |
| `GET /api/v1/downloads/{id}` | 下载选项 |
| `POST /api/v1/downloads/manifest` | 批量下载脚本 |
| `GET /api/v1/stats/dashboard` | 仪表盘统计 |

**设计系统**: 世界级门户设计 (参考 Vercel/Linear/Stripe/CellXGene/NCBI)
- 单色调 accent (#2563eb), 完整灰度 (50-950)
- 4px 间距网格, 语义化阴影, 精确排版层级
- 按钮/输入/徽章/卡片/代码块组件系统

### Phase 9: 数据库性能优化 ✅

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 仪表盘首次加载 | 90,000ms | 5ms | **16,657x** |
| 健康检查 | 1,655ms | 0.5ms | **3,310x** |
| Schema 分析 (启动) | 5,000ms | 1,038ms | **5x** |
| Explore 面板 (无筛选) | 29,000ms | 22ms | **1,329x** |

**后端优化**:
- 所有统计端点改用预计算表
- 服务器启动时预热仪表盘缓存
- Explore 无筛选状态使用预计算面板
- COUNT 查询跳过不必要的 JOIN
- SQLite mmap_size + temp_store=MEMORY

**前端优化**:
- 300ms debounce 减少 60-80% API 调用
- Stale-while-revalidate 客户端缓存 (5 分钟 TTL)
- App 启动时后台预取统计数据

---

## 4. 代码结构与文档索引

### 4.1 项目目录总览

```
scgb_agent_bak - claude_v1/
│
├── README.md                              ← 项目总览 (中文)
├── SMALL_SOURCES.md                       ← 小型数据源说明
├── PROJECT_STATUS.md                      ← 本文档 (全貌总结)
│
├── agent_v2/                              ★ Agent + Web 应用 (核心代码)
│   ├── README.md                          │  Agent 技术文档 (英文)
│   ├── pyproject.toml                     │  Python 项目配置
│   ├── run_server.py                      │  服务器启动脚本
│   ├── PHASE1-5_SUMMARY.md               │  各阶段开发总结
│   │
│   ├── src/                               │  核心 Python 模块 (33 文件)
│   │   ├── core/                          │    模型、接口、异常
│   │   ├── understanding/                 │    查询解析器
│   │   ├── sql/                           │    SQL 生成 & 执行
│   │   ├── ontology/                      │    本体解析引擎
│   │   ├── fusion/                        │    跨库融合
│   │   ├── synthesis/                     │    答案生成
│   │   ├── memory/                        │    3 层记忆系统
│   │   ├── dal/                           │    数据库抽象层 + 连接池
│   │   └── infra/                         │    LLM 客户端、预算控制
│   │
│   ├── api/                               │  FastAPI 后端 (17 文件)
│   │   ├── main.py                        │    应用入口、中间件
│   │   ├── schemas.py                     │    Pydantic 模型
│   │   ├── routes/                        │    9 个路由模块
│   │   └── services/                      │    下载链接解析器
│   │
│   ├── web/                               │  React 前端 (32 TypeScript 文件)
│   │   ├── src/
│   │   │   ├── pages/                     │    6 个页面组件
│   │   │   ├── components/                │    UI 组件库
│   │   │   │   ├── layout/                │      TopNav
│   │   │   │   ├── landing/               │      Hero, Stats, Cards, Highlights
│   │   │   │   ├── explore/               │      Facets, Table, Search, Pagination
│   │   │   │   └── chat/                  │      ChatInterface, MessageBubble
│   │   │   ├── hooks/                     │    useFacetedSearch, useDebounce, useWebSocket
│   │   │   ├── services/                  │    API 客户端 (含缓存层)
│   │   │   └── types/                     │    TypeScript 类型定义
│   │   └── dist/                          │    生产构建 (813KB JS, 36KB CSS)
│   │
│   ├── tests/                             │  测试 (19 文件)
│   │   ├── unit/                          │    134 单元测试 (6 模块)
│   │   ├── benchmark/                     │    154 题评测框架
│   │   └── test_phase*.py                 │    集成测试
│   │
│   ├── data/                              │  运行时数据
│   │   ├── ontologies/                    │    4 个 OBO + ontology_cache.db
│   │   └── memory/                        │    episodic.db + semantic.db
│   │
│   └── scripts/                           │  构建脚本
│       ├── build_ontology_cache.py
│       └── download_ontologies.sh
│
├── database_development/                  ★ 统一数据库 (ETL + Schema)
│   ├── README.md                          │  数据库使用说明
│   ├── 00-03_*.md                         │  设计文档 (架构/Schema/路线图)
│   ├── example_data_walkthrough.md        │  数据流转完整示例
│   ├── 04_EXPLORATION_NOTES/              │  技术探索笔记
│   │
│   └── unified_db/                        │  核心数据库目录
│       ├── unified_metadata.db            │    主数据库 (1.4 GB)
│       ├── schema.sql                     │    Schema DDL
│       ├── run_pipeline.py                │    ETL 编排器
│       ├── etl/                           │    5 个 ETL 模块
│       │   ├── base.py, cellxgene_etl.py, ncbi_sra_etl.py
│       │   ├── geo_etl.py, ebi_etl.py, small_sources_etl.py
│       ├── linker/                        │    跨库关联 + 去重
│       │   ├── id_linker.py, dedup.py
│       └── *.sql                          │    索引/FTS/统计/视图 SQL
│
├── agent_v2_design/                       ★ 设计文档 (架构评审)
│   ├── ARCHITECTURE.md                    │  V2 架构设计
│   ├── ARCHITECTURE_V2.1_IMPROVEMENTS.md  │  V2.1 改进方案
│   ├── MODULE_DETAIL_PART1-4.md           │  模块详细设计
│   ├── PERFORMANCE_REVIEW_REPORT.md       │  性能评审报告
│   ├── UX_ARCHITECTURE_REVIEW.md          │  用户体验评审
│   └── professional advice/               │  专业顾问评审意见
│
├── ncbi_bioproject_sra_data/              ← 原始 NCBI 数据 (~26 GB)
├── cellxgene/                             ← CellXGene 采集数据
├── geo/                                   ← GEO 采集数据
├── ebi/                                   ← EBI 采集数据 (160K JSON)
├── zenodo+figshare/                       ← Zenodo & Figshare 数据
├── biscp/, kpmp/                          ← 小型数据源采集
├── HCA.xlsx, HTAN.tsv                     ← 单文件数据源
├── ega_scrna_metadata.xlsx                ← EGA 目录
├── PsychAD_media-1.csv                    ← PsychAD 数据
│
└── agent_development/                     ← V1 早期开发代码 (已废弃)
```

### 4.2 关键文档清单

| 文档 | 路径 | 用途 |
|------|------|------|
| **本文档** | `PROJECT_STATUS.md` | 项目全貌与开发状态 |
| 项目总览 (中文) | `README.md` | 数据源概览、快速开始 |
| Agent 技术文档 | `agent_v2/README.md` | 架构、API、测试、基准 |
| 数据库说明 | `database_development/README.md` | Schema、ETL、查询示例 |
| 架构设计 | `database_development/01_ARCHITECTURE_DESIGN.md` | 系统架构理论 |
| Schema 设计 | `database_development/02_DATABASE_SCHEMA.md` | 数据库 Schema 理论 |
| V2 架构 | `agent_v2_design/ARCHITECTURE.md` | Agent V2 模块设计 |
| 模块详设 | `agent_v2_design/MODULE_DETAIL_PART1-4.md` | 各模块详细设计 |
| 性能评审 | `agent_v2_design/PERFORMANCE_REVIEW_REPORT.md` | 性能分析报告 |
| Phase 1 总结 | `agent_v2/PHASE1_SUMMARY.md` | 核心管线开发 |
| Phase 2 计划 | `agent_v2/PHASE2_PLAN.md` | 本体+记忆规划 |
| Phase 3 总结 | `agent_v2/PHASE3_SUMMARY.md` | Web 应用开发 |
| Phase 4 总结 | `agent_v2/PHASE4_SUMMARY.md` | 评测框架 |
| Phase 5 总结 | `agent_v2/PHASE5_SUMMARY.md` | 工程质量 |

---

## 5. 运行指南

### 5.1 环境要求

- Python 3.10+
- Node.js 18+ (前端构建)
- 1.4 GB 磁盘 (数据库) + 251 MB (本体)

### 5.2 启动服务

```bash
cd agent_v2

# 安装 Python 依赖
pip install -e ".[dev]"

# 安装前端依赖 & 构建 (仅首次)
cd web && npm install && npm run build && cd ..

# 启动服务器
python3 run_server.py --port 8000

# 浏览器访问
open http://localhost:8000
```

### 5.3 API 端点总览

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/v1/health` | GET | 组件状态检查 |
| `/api/v1/stats` | GET | 数据库统计概览 |
| `/api/v1/stats/dashboard` | GET | 仪表盘完整统计 |
| `/api/v1/query` | POST | 自然语言查询 |
| `/api/v1/query/stream` | WS | WebSocket 流式输出 |
| `/api/v1/explore` | POST | Faceted Search 搜索 |
| `/api/v1/explore/facets` | POST | 面板计数 (无结果) |
| `/api/v1/dataset/{id}` | GET | 数据集详情 |
| `/api/v1/downloads/{id}` | GET | 下载选项 |
| `/api/v1/downloads/manifest` | POST | 批量下载脚本 |
| `/api/v1/entity/{id}` | GET | 实体查找 (自动 ID 识别) |
| `/api/v1/autocomplete` | GET | 字段值自动补全 |
| `/api/v1/ontology/resolve` | GET | 本体术语解析 |
| `/api/v1/export` | POST | CSV/JSON/BibTeX 导出 |
| `/api/v1/schema` | GET | 数据库 Schema 概要 |

### 5.4 运行测试

```bash
cd agent_v2

# 单元测试 (134 题, ~2s)
python3 -m pytest tests/unit/ -v

# 集成测试
python3 tests/test_phase1_e2e.py   # 10/10
python3 tests/test_phase2_e2e.py   # 13/13

# 评测基准 (154 题)
python3 tests/benchmark/run_benchmark.py
```

### 5.5 重建数据库

```bash
cd database_development/unified_db

# 完整重建 (~25 分钟)
python run_pipeline.py --phase all

# 应用索引和统计
python apply_fts5.py
python populate_stats.py
```

---

## 6. 已知限制与后续方向

### 已知限制

1. **cell_type 不在 v_sample_with_hierarchy 视图中** — Schema 限制
2. **本体解析通过率 76%** — umbrella term 扩展仍有改进空间
3. **统计查询通过率 80%** — 部分复杂统计需要 LLM 辅助
4. **rds_available = 0** — 当前数据源中无 RDS 文件
5. **前端构建 813KB** — 超过 500KB 警告线, 可代码分割优化
6. **预计算统计表需要 ETL 后手动刷新**

### 可能的后续方向

1. PostgreSQL 迁移 (并发性能)
2. 前端代码分割 (React.lazy)
3. 增加更多数据源 (ENCODE, Allen Brain Atlas)
4. 搜索结果排序优化 (相关性评分)
5. 用户认证与个人收藏功能
6. 数据集版本追踪

---

## 7. 代码统计

| 类型 | 文件数 | 说明 |
|------|--------|------|
| Python 核心源码 | 33 | `agent_v2/src/` |
| Python API | 17 | `agent_v2/api/` |
| Python 测试 | 19 | `agent_v2/tests/` |
| Python ETL | 15 | `database_development/unified_db/` |
| TypeScript/TSX | 32 | `agent_v2/web/src/` |
| SQL | 5 | `database_development/unified_db/` |
| Markdown 文档 | 20+ | 分布各目录 |
| **总计** | **~140+** | |

**前端构建产物**: 813 KB JS (246 KB gzip) + 36 KB CSS (8 KB gzip)
**数据库**: 1.4 GB (含 43 索引, 3 FTS5, 9 预计算统计表)
**评测结果**: 142/154 通过 (92.2%)
**单元测试**: 134/134 通过
