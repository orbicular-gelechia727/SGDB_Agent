# SCGB 项目评审报告 — 架构设计评审

> **评审日期**: 2026-03-12  
> **评审对象**: SCGB系统架构  
> **评审范围**: 整体架构、模块划分、依赖关系、扩展性设计  

---

## 1. 执行摘要

### 1.1 总体评价

| 维度 | 评分 | 说明 |
|------|------|------|
| 架构合理性 | 9.0/10 | 4层架构清晰，职责分明 |
| 模块耦合度 | 8.5/10 | 松耦合设计，便于测试和替换 |
| 扩展性 | 8.0/10 | 预留扩展点，但部分实现待完善 |
| 技术选型 | 8.5/10 | 务实合理，符合项目需求 |
| **综合评分** | **8.5/10** | **优秀** |

### 1.2 关键发现

**优势**:
- ✅ 清晰的4层架构 (Application → Agent → Service → Storage)
- ✅ 6阶段处理管线设计合理
- ✅ Protocol-based依赖注入实现松耦合
- ✅ 渐进式检索策略保证召回率

**待改进**:
- ⚠️ Working Memory容量偏小 (50条)
- ⚠️ 多用户场景下会话状态管理待完善
- ⚠️ 水平扩展需外部化状态

---

## 2. 架构总览

### 2.1 四层架构评估

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: APPLICATION (应用层)                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ Web UI   │  │ REST API │  │ CLI      │  │ Python SDK   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
│  评估: 多入口设计合理，覆盖不同使用场景                          │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: AGENT (智能层) - 核心创新                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │Coordinator  │  │Ontology     │  │Cross-DB     │             │
│  │Agent        │  │Resolver     │  │Fusion       │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│  评估: 单Coordinator + Tool模式适合当前规模                      │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3: SERVICE (服务层)                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │DAL       │  │Ontology  │  │Schema    │                      │
│  │          │  │Cache     │  │Inspector │                      │
│  └──────────┘  └──────────┘  └──────────┘                      │
│  评估: 抽象层设计良好，支持SQLite/PG双后端                       │
├─────────────────────────────────────────────────────────────────┤
│  Layer 4: STORAGE (存储层)                                       │
│  ┌─────────────┐  ┌───────────┐  ┌──────────────┐              │
│  │unified_db   │  │Memory     │  │Ontology      │              │
│  │(SQLite/PG)  │  │Store      │  │Graph         │              │
│  └─────────────┘  └───────────┘  └──────────────┘              │
│  评估: SQLite适合MVP，生产需评估PG迁移                           │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 架构设计原则评估

| 原则 | 实现情况 | 评估 |
|------|----------|------|
| Schema-Agnostic Tooling | DAL动态发现表结构 | ✅ 良好 |
| Ontology-First Semantics | 优先本体解析 | ✅ 优秀 |
| Progressive Disclosure | 分层信息展示 | ✅ 良好 |
| Provenance-Aware | 完整数据血缘 | ✅ 优秀 |
| Graceful Degradation | LLM/本体降级 | ✅ 良好 |
| Cost-Conscious | 规则优先策略 | ✅ 优秀 |

---

## 3. 核心模块评审

### 3.1 Coordinator Agent (协调器)

#### 设计评估

```python
# 当前设计: ReAct + 10 Tools
class CoordinatorAgent:
    def execute(self, query: str) -> AgentResponse:
        # 6阶段管线
        parsed = self.parse(query)
        resolved = self.resolve_ontology(parsed)
        candidates = self.generate_sql(resolved)
        executed = self.execute_sql(candidates)
        fused = self.fuse_cross_db(executed)
        answer = self.synthesize(fused)
        return answer
```

**优点**:
- ✅ 职责单一，仅负责任务编排
- ✅ 6阶段管线清晰，便于调试
- ✅ 支持工具扩展

**建议**:
- ⚠️ 考虑增加中间状态持久化，支持长查询断点续传
- ⚠️ 增加查询超时和取消机制

### 3.2 Query Understanding (查询理解)

#### 设计评估

```python
class QueryParser:
    """规则优先 + LLM兜底 (70/30)"""
    
    def parse(self, query: str) -> ParsedQuery:
        # 1. 规则引擎尝试
        if result := self.rule_based_parse(query):
            return result
        
        # 2. LLM兜底
        return self.llm_parse(query)
```

**优点**:
- ✅ 规则优先有效控制成本
- ✅ 支持中英文双语
- ✅ 意图分类明确

**建议**:
- ⚠️ 规则覆盖率需要持续监控
- ⚠️ 建议增加查询复杂度预估

### 3.3 Ontology Resolution (本体解析)

#### 设计评估

```
用户术语 → 5步解析管线 → 标准本体ID + 层级扩展

Step 1: Exact Match
Step 2: Synonym Match  
Step 3: Fuzzy Match
Step 4: LLM Resolution
Step 5: Fallback (原始值)
```

**优点**:
- ✅ 渐进式策略保证覆盖
- ✅ 本地缓存避免API依赖
- ✅ 支持层级扩展

**问题**:
- ❌ 通过率仅76%，需要优化
- ⚠️ umbrella term扩展逻辑待完善

### 3.4 SQL Generation (SQL生成)

#### 设计评估

```python
class SQLGenerator:
    """3候选生成策略"""
    
    def generate(self, query: ParsedQuery) -> List[SQLCandidate]:
        return [
            self.template_generate(query),  # 模板
            self.rule_generate(query),       # 规则
            self.llm_generate(query),        # LLM
        ]
```

**优点**:
- ✅ 多候选提高成功率
- ✅ 执行验证保证正确性
- ✅ 优先级合理

**建议**:
- ⚠️ 当前串行执行，建议改为并行+超时
- ⚠️ 候选结果可缓存避免重复生成

### 3.5 Cross-Database Fusion (跨库融合)

#### 设计评估

```
查询结果 (N条)
    │
    ├── Step 1: Hard Link Deduplication (entity_links)
    ├── Step 2: Identity Hash Deduplication
    ├── Step 3: Multi-source Evidence Aggregation
    └── Step 4: Quality Scoring
    
融合结果 (M条, M ≤ N)
```

**优点**:
- ✅ UnionFind算法选择正确
- ✅ 质量评分系统完善
- ✅ 血缘追踪清晰

**性能**:
- ✅ O(n × α(n)) 时间复杂度
- ✅ 内存占用合理

---

## 4. 依赖关系评审

### 4.1 模块依赖图

```
┌─────────────────────────────────────────────────────────────┐
│                    模块依赖关系                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Coordinator                                               │
│   ├──► QueryParser (接口)                                   │
│   ├──► OntologyResolver (接口)                              │
│   ├──► SQLGenerator (接口)                                  │
│   ├──► FusionEngine (接口)                                  │
│   └──► AnswerSynthesizer (接口)                             │
│                                                             │
│   QueryParser ──► OntologyResolver                          │
│   SQLGenerator ──► DAL, SchemaInspector                     │
│   FusionEngine ──► DAL                                      │
│   AnswerSynthesizer ──► Memory                              │
│                                                             │
│   DAL ──► SQLite/PostgreSQL                                 │
│   OntologyResolver ──► OntologyCache (SQLite)               │
│   Memory ──► EpisodicStore, SemanticStore                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 依赖关系评估

| 评估项 | 状态 | 说明 |
|--------|------|------|
| 循环依赖 | ✅ 无 | 依赖关系清晰，无循环 |
| 接口隔离 | ✅ 良好 | 各模块通过Protocol交互 |
| 实现依赖 | ⚠️ 部分 | DAL具体实现待完全抽象 |
| 第三方依赖 | ✅ 合理 | 核心功能不依赖外部服务 |

---

## 5. 扩展性设计评审

### 5.1 水平扩展能力

```
当前状态 ──────────────────────────────────────► 目标架构

┌─────────┐         ┌─────────┐         ┌─────────┐
│ FastAPI │         │ FastAPI │  ...    │ FastAPI │  (多实例)
│ 单实例  │         │ #1      │         │ #N      │
└────┬────┘         └────┬────┘         └────┬────┘
     │                   │                   │
     │    ┌─────────┐    │                   │
     └───►│ SQLite  │◄───┘                   │  (状态外部化后)
          │ 文件    │                        │
          └─────────┘    ┌─────────┐         │
                         │  Redis  │◄────────┘
                         │ Session │
                         └────┬────┘
                              │
                         ┌────┴────┐
                         │PostgreSQL│
                         └─────────┘
```

**当前限制**:
- ❌ Working Memory存储在进程内存
- ❌ SQLite文件级锁定
- ❌ 无分布式缓存

**扩展路径**:
1. **Phase 1**: Redis外部化会话状态
2. **Phase 2**: SQLite→PostgreSQL迁移
3. **Phase 3**: PG主从+读副本

### 5.2 功能扩展点

| 扩展点 | 当前支持 | 评估 |
|--------|----------|------|
| 新数据源 | ETL模块可扩展 | ✅ 良好 |
| 新查询类型 | Parser意图分类 | ✅ 良好 |
| 新本体 | OBO格式支持 | ✅ 良好 |
| 新Agent工具 | Coordinator可注册 | ✅ 良好 |
| 新SQL候选 | Generator策略模式 | ✅ 良好 |

---

## 6. 设计决策评审

### 6.1 关键决策回顾

| 决策 | 选项 | 选择 | 评估 |
|------|------|------|------|
| Agent框架 | LangGraph vs 自研 | **自研** | ✅ 合理，避免重型依赖 |
| Agent模式 | 单ReAct vs 多角色 | **单Coordinator** | ✅ 适合当前规模 |
| SQL策略 | 单候选 vs 多候选 | **3候选+验证** | ✅ 平衡成本和效果 |
| 本体集成 | 实时API vs 本地缓存 | **本地缓存** | ✅ 避免延迟和不稳定 |
| LLM策略 | 全程LLM vs 规则优先 | **规则优先** | ✅ 控制成本 |

### 6.2 决策建议

#### 建议1: 状态外部化 (高优先级)

```python
# 当前: 进程内存储
class WorkingMemory:
    def __init__(self):
        self.cache = LRUCache(50)  # 仅当前进程

# 建议: Redis外部化
class ExternalizedMemory:
    def __init__(self, redis: Redis):
        self.redis = redis  # 多实例共享
        
    def get(self, key: str) -> Optional[Any]:
        return self.redis.get(key)
```

#### 建议2: 查询计划缓存 (中优先级)

```python
class QueryPlanCache:
    """缓存SQL生成结果"""
    
    def get_or_generate(
        self, 
        parsed_query: ParsedQuery,
        generator: Callable
    ) -> List[SQLCandidate]:
        key = self._hash_query(parsed_query)
        if cached := self.cache.get(key):
            return cached
        result = generator()
        self.cache.set(key, result, ttl=3600)
        return result
```

---

## 7. 代码组织评审

### 7.1 目录结构评估

```
agent_v2/
├── src/                    ✅ 核心模块组织清晰
│   ├── core/               ✅ 模型、接口、异常
│   ├── understanding/      ✅ 查询解析
│   ├── ontology/           ✅ 本体引擎
│   ├── sql/                ✅ SQL生成执行
│   ├── fusion/             ✅ 跨库融合
│   ├── synthesis/          ✅ 答案合成
│   ├── memory/             ✅ 记忆系统
│   ├── dal/                ✅ 数据访问层
│   └── infra/              ✅ 基础设施
│
├── api/                    ✅ FastAPI路由
├── web/                    ✅ React前端
├── tests/                  ✅ 测试组织
└── data/                   ✅ 运行时数据
```

### 7.2 模块内聚性

| 模块 | 内聚性 | 评估 |
|------|--------|------|
| core/ | 高 | 纯数据定义 |
| understanding/ | 高 | 单一职责 |
| ontology/ | 高 | 完整本体处理 |
| sql/ | 中 | 生成+执行可考虑拆分 |
| fusion/ | 高 | 单一职责 |
| synthesis/ | 高 | 答案生成 |
| memory/ | 中 | 3种记忆可考虑拆分 |

---

## 8. 架构风险

### 8.1 已识别风险

| 风险 | 等级 | 影响 | 缓解措施 |
|------|------|------|----------|
| SQLite并发瓶颈 | 高 | 限制用户规模 | PG迁移评估 |
| 内存状态限制 | 高 | 无法水平扩展 | Redis外部化 |
| 单点故障 | 中 | 服务不可用 | 负载均衡+多实例 |
| LLM依赖 | 中 | 成本/可用性 | 规则优先+本地降级 |
| 数据一致性 | 低 | 跨库关联错误 | 定期校验 |

### 8.2 架构演进建议

```
MVP (当前) ───────► Staging ───────► Production

SQLite单实例       PostgreSQL        PG主从+缓存
进程内状态    →    + Redis      →    + CDN
单API实例          多API实例         负载均衡
```

---

## 9. 评审结论

### 9.1 总体评价

SCGB项目的架构设计展现了**扎实的系统设计能力**。4层架构清晰，模块职责分明，依赖关系合理。核心创新点（本体解析、跨库融合）设计到位，技术选型务实。

### 9.2 评分详情

| 维度 | 评分 | 说明 |
|------|------|------|
| 架构清晰度 | 9.0 | 4层架构，职责分明 |
| 模块设计 | 8.5 | 内聚性高，耦合度低 |
| 接口设计 | 8.5 | Protocol-based DI |
| 扩展性 | 7.5 | 预留扩展点，部分待实现 |
| 技术选型 | 8.5 | 务实合理 |
| **综合** | **8.5/10** | **优秀** |

### 9.3 关键建议

1. **状态外部化** (P0): 将Working Memory迁移到Redis，支持水平扩展
2. **数据库迁移评估** (P0): 评估SQLite→PostgreSQL迁移方案
3. **查询计划缓存** (P1): 增加SQL候选缓存层
4. **监控体系** (P1): 增加架构级性能监控

---

*本评审完成。*
