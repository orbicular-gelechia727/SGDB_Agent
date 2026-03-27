# 现有架构技术审核报告

## 概述

本报告对 SCGB 平台的现有技术架构进行全面审核，评估其设计质量、技术选型和可维护性。

---

## 1. 总体架构评估

### 1.1 架构分层

```
┌─────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                           │
│    React + TypeScript SPA  ←→  FastAPI REST + WebSocket         │
├─────────────────────────────────────────────────────────────────┤
│                      AGENT LAYER (核心智能)                       │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│    │ Query    │  │ Ontology │  │ Cross-DB │  │ Answer   │       │
│    │ Parser   │  │ Resolver │  │ Fusion   │  │ Synth    │       │
│    └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
├─────────────────────────────────────────────────────────────────┤
│                      SERVICE LAYER (数据服务)                     │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐                     │
│    │ DAL      │  │ Ontology │  │ Schema   │                     │
│    │          │  │ Cache    │  │ Inspector│                     │
│    └──────────┘  └──────────┘  └──────────┘                     │
├─────────────────────────────────────────────────────────────────┤
│                      STORAGE LAYER                               │
│    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│    │ unified_db   │  │ ontology_cache│  │ memory_store │         │
│    │ (SQLite)     │  │ (SQLite)      │  │ (SQLite)     │         │
│    └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

**评分**: ⭐⭐⭐⭐☆ (4/5)

**优势**:
- 分层清晰，职责分离良好
- Agent 层模块化设计，便于单元测试
- Protocol-based DI 支持灵活替换实现

**改进建议**:
- 考虑引入 CQRS 模式分离读写
- 事件驱动架构用于数据更新通知

---

## 2. 数据库架构审核

### 2.1 统一 Schema v3.0

```sql
-- 4 级层级设计
unified_projects      -- 项目级 (23,123 rows)
    ↓
unified_series        -- 系列级 (15,968 rows)
    ↓
unified_samples       -- 样本级 (756,579 rows)
    ↓
unified_celltypes     -- 细胞类型 (378,029 rows)
```

**评分**: ⭐⭐⭐⭐⭐ (5/5)

**设计亮点**:
1. **灵活适配**: 4 级层级适配不同数据源的层次结构
2. **关系表设计**: entity_links + id_mappings 支持复杂关联
3. **去重支持**: biological_identity_hash + dedup_candidates
4. **溯源追踪**: raw_metadata JSON 存储原始数据

**优化建议**:
```sql
-- 建议增加数据版本追踪表
CREATE TABLE data_versions (
    pk INTEGER PRIMARY KEY,
    entity_type TEXT NOT NULL,     -- 'sample', 'series', etc.
    entity_pk INTEGER NOT NULL,
    version_number INTEGER,
    change_type TEXT,              -- 'create', 'update', 'delete'
    changed_fields TEXT,           -- JSON of changed fields
    changed_at TIMESTAMP,
    changed_by TEXT
);
```

### 2.2 索引策略

| 索引类型 | 数量 | 覆盖率 | 评价 |
|----------|------|--------|------|
| 普通索引 | 43 | 高 | ✅ 完善 |
| 复合索引 | 12 | 中 | ✅ 合理 |
| FTS5 全文 | 3 | 低 | ⚠️ 需扩展 |
| 预计算表 | 9 | 高 | ✅ 优秀 |

**优化建议**:
```sql
-- 增加更多 FTS5 索引
CREATE VIRTUAL TABLE fts_celltypes USING fts5(
    cell_type_name, 
    content='unified_celltypes',
    content_rowid='pk'
);

-- 增加 GIN 索引 (PostgreSQL 迁移后)
CREATE INDEX idx_samples_raw_metadata_gin ON unified_samples 
    USING GIN (raw_metadata jsonb_path_ops);
```

---

## 3. ETL 架构审核

### 3.1 设计模式

```python
class BaseETL:
    """所有 ETL 的抽象基类"""
    SOURCE_DATABASE: str = ''
    BATCH_SIZE: int = 5000
    
    def extract_and_load(self): ...
    def batch_insert(self, table, rows): ...
    def compute_identity_hash(self, ...): ...
```

**评分**: ⭐⭐⭐⭐⭐ (5/5)

**设计亮点**:
1. **模板方法模式**: BaseETL 定义流程，子类实现细节
2. **批处理优化**: 5000 条批量插入，减少事务开销
3. **ID 映射管理**: 统一的 id_mappings 创建逻辑
4. **身份哈希**: 去重逻辑复用

### 3.2 ETL 实现对比

| ETL 模块 | 代码质量 | 复杂度 | 可维护性 |
|----------|---------|--------|---------|
| CellXGeneETL | ⭐⭐⭐⭐⭐ | 中 | 优秀 |
| NcbiSraETL | ⭐⭐⭐⭐☆ | 高 | 良好 |
| GeoETL | ⭐⭐⭐⭐☆ | 高 | 良好 |
| EbiETL | ⭐⭐⭐⭐☆ | 中 | 良好 |
| SmallSourcesETL | ⭐⭐⭐⭐⭐ | 低 | 优秀 |

**改进建议**:
```python
# 建议增加 ETL 编排框架
class ETLOrchestrator:
    """ETL 编排器，管理依赖和并行执行"""
    
    def define_pipeline(self):
        return {
            'phase1': [CellXGeneETL, HcaETL],      # 独立数据源，可并行
            'phase2': [NcbiSraETL, GeoETL, EbiETL], # 依赖 phase1 ID 映射
            'phase3': [IdLinker, DedupEngine],      # 跨库关联
            'phase4': [StatsComputer, IndexBuilder] # 后处理
        }
    
    async def run_parallel(self, etl_classes):
        """并行执行同阶段 ETL"""
        tasks = [self.run_etl(cls) for cls in etl_classes]
        return await asyncio.gather(*tasks)
```

---

## 4. Agent 架构审核

### 4.1 Coordinator Agent

```python
class CoordinatorAgent:
    """协议驱动的依赖注入设计"""
    
    def __init__(self, *, 
                 parser: IQueryParser,
                 sql_gen: ISQLGenerator,
                 sql_exec: ISQLExecutor,
                 fusion: IFusionEngine,
                 synthesizer: IAnswerSynthesizer,
                 ...)
```

**评分**: ⭐⭐⭐⭐⭐ (5/5)

**设计亮点**:
1. **Protocol-based DI**: 接口驱动，支持 Mock 测试
2. **工厂方法**: `create()` 自动构建依赖图
3. **流水线模式**: 6 步处理流程清晰
4. **记忆系统**: Working + Episodic + Semantic 三层

### 4.2 查询处理流水线

| 步骤 | 模块 | 延迟 | 评价 |
|------|------|------|------|
| 1. Parse | QueryParser | <10ms | ✅ 规则+LLM 混合 |
| 2. Resolve | OntologyResolver | <50ms | ✅ 本地缓存 |
| 3. Generate | SQLGenerator | <100ms | ✅ 3候选策略 |
| 4. Execute | ParallelSQLExecutor | 可变 | ✅ 连接池 |
| 5. Fuse | CrossDBFusionEngine | <50ms | ✅ UnionFind |
| 6. Synthesize | AnswerSynthesizer | <100ms | ✅ 模板优先 |

**总延迟**: 简单查询 <200ms，复杂查询 <1s

---

## 5. 本体系统审核

### 5.1 OntologyResolver 设计

```python
class OntologyResolver:
    """5 步解析管线"""
    
    def _resolve_pipeline(self, entity, field_type, expand):
        # Step 0: Umbrella terms
        # Step 1: Exact label match
        # Step 2: Synonym match
        # Step 3: FTS5 fuzzy match
        # Step 4: LLM disambiguation (预留)
        # Step 5: Fallback to free text
```

**评分**: ⭐⭐⭐⭐☆ (4/5)

**设计亮点**:
1. **渐进解析**: 5 步策略平衡准确性和覆盖率
2. **本地缓存**: 避免外部 API 依赖
3. **层级扩展**: 支持本体上下位扩展
4. **Umbrella 术语**: 处理系统级查询

**改进建议**:
1. **LLM 辅助消歧**: 实现 Step 4
2. **增量更新**: 本体缓存支持增量更新
3. **多语言支持**: 增加中文本体映射

### 5.2 本体缓存架构

```sql
-- ontology_cache.db 结构
terms                  -- 113K 本体术语
├── ontology_id (PK)
├── ontology_source (UBERON/MONDO/CL/EFO)
├── label
├── synonyms_json
├── parent_ids_json
└── child_ids_json

ontology_value_map     -- 本体→DB值映射
├── ontology_id
├── field_name
├── db_value
└── sample_count
```

**性能**: 解析延迟 <50ms，缓存命中率 >90%

---

## 6. API 架构审核

### 6.1 FastAPI 实现

**评分**: ⭐⭐⭐⭐⭐ (5/5)

**设计亮点**:
1. **依赖注入**: `deps.py` 集中管理依赖
2. **中间件设计**: 请求 ID、日志、限流分离
3. **错误处理**: RFC 7807 problem+json 标准
4. **生命周期管理**: `lifespan` 处理启动/关闭

### 6.2 端点设计

| 端点 | 功能 | 缓存策略 |
|------|------|---------|
| `/health` | 健康检查 | 预计算统计 |
| `/stats/dashboard` | 仪表盘 | 启动预热 + 5min TTL |
| `/explore` | Faceted 搜索 | 结果缓存 |
| `/query` | 自然语言查询 | 无缓存 |
| `/ontology/resolve` | 本体解析 | 永久缓存 |

### 6.3 WebSocket 实现

```python
# WebSocket 流式输出设计
@app.websocket("/api/v1/query/stream")
async def query_stream(websocket: WebSocket):
    # 实时返回处理进度
    await websocket.send_json({"stage": "parse", "progress": 20})
    await websocket.send_json({"stage": "ontology", "progress": 40})
    await websocket.send_json({"stage": "execute", "progress": 60})
    await websocket.send_json({"stage": "fuse", "progress": 80})
    await websocket.send_json({"stage": "complete", "results": {...}})
```

---

## 7. 前端架构审核

### 7.1 React 应用结构

```
web/src/
├── pages/           # 6 个页面
│   ├── Home.tsx
│   ├── Explore.tsx
│   ├── DatasetDetail.tsx
│   ├── Stats.tsx
│   ├── Chat.tsx
│   └── Downloads.tsx
├── components/      # UI 组件库
│   ├── layout/
│   ├── landing/
│   ├── explore/
│   └── chat/
├── hooks/           # 自定义 Hooks
├── services/        # API 客户端
└── types/           # TypeScript 类型
```

**评分**: ⭐⭐⭐⭐☆ (4/5)

**设计亮点**:
1. **类型安全**: TypeScript 全覆盖
2. **组件化**: 职责分离清晰
3. **自定义 Hooks**: useDebounce, useFacetedSearch
4. **状态管理**: URL 驱动状态，可分享链接

**改进建议**:
```typescript
// 建议增加代码分割
const Explore = lazy(() => import('./pages/Explore'));
const Stats = lazy(() => import('./pages/Stats'));

// React.lazy + Suspense 减少首屏加载
```

---

## 8. 测试架构审核

### 8.1 测试金字塔

```
        /\
       /  \      154 E2E 评测 (92.2% 通过)
      /____\     
     /      \    134 单元测试 (100% 通过)
    /________\   
   /          \  集成测试 (Phase 1-2)
  /____________\
```

**评分**: ⭐⭐⭐⭐⭐ (5/5)

**测试覆盖**:
| 模块 | 单元测试 | 集成测试 | 评价 |
|------|---------|---------|------|
| QueryParser | ✅ | ✅ | 完善 |
| OntologyResolver | ✅ | ✅ | 完善 |
| SQLGenerator | ✅ | ✅ | 完善 |
| FusionEngine | ✅ | ⚠️ | 需加强 |
| AnswerSynthesizer | ✅ | ⚠️ | 需加强 |

---

## 9. 安全与运维审核

### 9.1 安全特性

| 特性 | 实现 | 评价 |
|------|------|------|
| 速率限制 | 60 req/min/IP | ✅ 基础防护 |
| CORS | 环境驱动配置 | ✅ 灵活 |
| 错误隐藏 | 生产环境隐藏详情 | ✅ 安全 |
| 请求超时 | 60s 默认 | ⚠️ 需调优 |

**改进建议**:
- 增加 API Key 认证机制
- 实现请求签名验证
- 增加 SQL 注入检测 (虽然 ORM 已有防护)

### 9.2 可观测性

```python
# 当前日志格式
"%(asctime)s [%(levelname)s] %(name)s | %(message)s"

# 建议增强
{
    "timestamp": "2026-03-12T10:00:00Z",
    "level": "INFO",
    "request_id": "abc123",
    "user_id": "user_001",
    "method": "POST",
    "path": "/api/v1/query",
    "duration_ms": 150,
    "sql_method": "fts5",
    "result_count": 42
}
```

---

## 10. 技术债务评估

| 债务项 | 严重程度 | 技术影响 | 业务影响 | 解决成本 |
|--------|---------|---------|---------|---------|
| SQLite 并发限制 | 高 | 无法水平扩展 | 用户体验 | 中 |
| 前端包体积 | 中 | 首屏加载慢 | 跳出率 | 低 |
| 硬编码配置 | 低 | 部署不灵活 | 运维效率 | 低 |
| 缺少监控埋点 | 中 | 问题定位难 | 稳定性 | 中 |

---

## 11. 架构演进建议

### 11.1 近期 (1-3 个月)

1. **PostgreSQL 迁移**: 解决并发瓶颈
2. **连接池优化**: 实现真正的连接池管理
3. **前端代码分割**: 减少首屏加载

### 11.2 中期 (3-6 个月)

1. **微服务拆分**: 将 ETL 独立为服务
2. **缓存层引入**: Redis 作为外部缓存
3. **事件驱动**: 消息队列处理数据更新

### 11.3 远期 (6-12 个月)

1. **数据湖架构**: 支持原始数据存储
2. **联邦查询**: 跨数据中心查询
3. **机器学习平台**: 集成分析 pipeline

