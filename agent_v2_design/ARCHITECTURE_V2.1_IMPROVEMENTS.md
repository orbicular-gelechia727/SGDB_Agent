# SCeQTL-Agent V2 架构改进方案（基于专业审核反馈）

> **版本**: 2.1 | **日期**: 2026-03-06 | **状态**: 审核后修订

---

## 改进来源

本文档整合了5份专业审核报告的核心建议，按优先级和影响范围进行了系统梳理。

| 审核报告 | 评级 | 核心发现 |
|---------|------|---------|
| #1 整体架构 | B+ | LLM供应商锁定、缺少熔断机制 |
| #2 模块耦合 | B | Coordinator过度集中、接口契约缺失 |
| #3 数据模型 | B+ | 样本表过宽、索引不足、缺乏约束 |
| #4 UX架构 | 4/5 | 移动端缺失、可访问性不足、信息过载 |
| #5 性能扩展 | 3/5 | SQL串行瓶颈、缓存不足、并发风险 |

---

## 一、架构层面改进

### 1.1 LLM供应商解耦 [P0, 来自审核#1]

**问题**: 深度依赖Claude的Tool Use功能，切换LLM需重写交互逻辑

**改进方案**: 引入 `ILLMClient` 协议接口

```python
from typing import Protocol, runtime_checkable

@runtime_checkable
class ILLMClient(Protocol):
    """LLM客户端统一接口 - 支持多供应商无缝切换"""

    async def chat(
        self,
        messages: list[dict],
        system: str = "",
        tools: list[dict] | None = None,
        temperature: float = 0.0,
        max_tokens: int = 4096,
    ) -> LLMResponse: ...

    async def chat_stream(
        self,
        messages: list[dict],
        system: str = "",
        tools: list[dict] | None = None,
    ) -> AsyncIterator[LLMChunk]: ...

    def estimate_tokens(self, text: str) -> int: ...

    @property
    def model_id(self) -> str: ...
    @property
    def supports_tool_use(self) -> bool: ...


class ClaudeLLMClient:
    """Claude API 实现"""
    def __init__(self, api_key: str, model: str = "claude-sonnet-4-6"):
        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        self._model = model

    async def chat(self, messages, system="", tools=None, **kwargs):
        response = await self.client.messages.create(
            model=self._model,
            system=system,
            messages=messages,
            tools=tools or [],
            **kwargs
        )
        return LLMResponse.from_anthropic(response)


class OpenAILLMClient:
    """OpenAI API 实现 (备选)"""
    async def chat(self, messages, system="", tools=None, **kwargs):
        # 转换 tool 格式: Anthropic → OpenAI
        oai_tools = self._convert_tools(tools) if tools else None
        response = await self.client.chat.completions.create(
            model=self._model,
            messages=[{"role": "system", "content": system}] + messages,
            tools=oai_tools,
            **kwargs
        )
        return LLMResponse.from_openai(response)


class LocalLLMClient:
    """本地模型实现 (成本/延迟降级时使用)"""
    async def chat(self, messages, system="", tools=None, **kwargs):
        # Ollama / vLLM 本地调用
        ...
```

**LLM路由与降级策略**:

```python
class LLMRouter:
    """
    智能LLM路由
    - 正常: Claude Sonnet/Haiku
    - 高延迟: 自动切换到本地模型
    - 超预算: 降级到规则引擎
    - API故障: 熔断 + 降级
    """

    def __init__(self, primary: ILLMClient, fallbacks: list[ILLMClient]):
        self.primary = primary
        self.fallbacks = fallbacks
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=3,
            recovery_timeout=60,  # 60秒后重试
        )
        self.cost_controller = CostController(daily_budget_usd=50)

    async def chat(self, messages, system="", tools=None, **kwargs) -> LLMResponse:
        # 1. 检查成本预算
        if not self.cost_controller.has_budget():
            return await self._fallback_chat(messages, system, tools, **kwargs)

        # 2. 检查熔断器状态
        if self.circuit_breaker.is_open:
            return await self._fallback_chat(messages, system, tools, **kwargs)

        # 3. 尝试主LLM
        try:
            response = await asyncio.wait_for(
                self.primary.chat(messages, system, tools, **kwargs),
                timeout=10.0  # 10秒超时
            )
            self.circuit_breaker.record_success()
            self.cost_controller.record_usage(response.usage)
            return response
        except (asyncio.TimeoutError, Exception) as e:
            self.circuit_breaker.record_failure()
            return await self._fallback_chat(messages, system, tools, **kwargs)
```

### 1.2 接口协议化 [P1, 来自审核#2]

**问题**: Coordinator是"God Class"，模块间隐式耦合

**改进**: 为每个核心模块定义Protocol接口

```python
# === 核心领域接口 ===

class IQueryParser(Protocol):
    async def parse(self, query: str, context: SessionContext | None = None) -> ParsedQuery: ...

class IOntologyResolver(Protocol):
    async def resolve(self, entities: list[BioEntity], expand: bool = True) -> list[ResolvedEntity]: ...

class ISQLGenerator(Protocol):
    async def generate(self, query: ParsedQuery, entities: list[ResolvedEntity]) -> list[SQLCandidate]: ...

class ISQLExecutor(Protocol):
    async def execute(self, candidates: list[SQLCandidate]) -> ExecutionResult: ...

class IFusionEngine(Protocol):
    def fuse(self, results: list[dict], entity_type: str) -> list[FusedRecord]: ...

class IAnswerSynthesizer(Protocol):
    async def synthesize(self, query: ParsedQuery, results: list[FusedRecord],
                         provenance: ProvenanceInfo) -> AgentResponse: ...

class IMemorySystem(Protocol):
    def load_session(self, session_id: str) -> SessionContext: ...
    def save_interaction(self, session_id: str, query: str, response: AgentResponse): ...


# === Coordinator使用依赖注入 ===

class CoordinatorAgent:
    """依赖注入后的Coordinator - 不再是God Class"""

    def __init__(
        self,
        llm: ILLMClient,
        parser: IQueryParser,
        ontology: IOntologyResolver,
        sql_gen: ISQLGenerator,
        sql_exec: ISQLExecutor,
        fusion: IFusionEngine,
        synthesizer: IAnswerSynthesizer,
        memory: IMemorySystem,
    ):
        self.llm = llm
        self.parser = parser
        self.ontology = ontology
        self.sql_gen = sql_gen
        self.sql_exec = sql_exec
        self.fusion = fusion
        self.synthesizer = synthesizer
        self.memory = memory

    # 各组件通过接口交互, 可独立测试和替换
```

### 1.3 熔断器与健康监控 [P2, 来自审核#1]

```python
class CircuitBreaker:
    """熔断器 - 防止级联失败"""

    CLOSED = "closed"      # 正常
    OPEN = "open"          # 熔断（拒绝请求）
    HALF_OPEN = "half_open" # 试探恢复

    def __init__(self, failure_threshold: int = 3, recovery_timeout: int = 60):
        self.state = self.CLOSED
        self.failure_count = 0
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.last_failure_time = 0

    @property
    def is_open(self) -> bool:
        if self.state == self.OPEN:
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = self.HALF_OPEN
                return False
            return True
        return False

    def record_success(self):
        self.failure_count = 0
        self.state = self.CLOSED

    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.state = self.OPEN


class HealthMonitor:
    """系统健康监控"""

    async def check_all(self) -> HealthReport:
        checks = await asyncio.gather(
            self._check_database(),
            self._check_llm_api(),
            self._check_ontology_cache(),
            return_exceptions=True,
        )
        return HealthReport(
            database=checks[0],
            llm_api=checks[1],
            ontology=checks[2],
            overall=all(c.healthy for c in checks if not isinstance(c, Exception)),
        )
```

---

## 二、性能与缓存改进

### 2.1 SQL候选并行执行 [P0, 来自审核#5]

**问题**: 3候选SQL串行执行，最坏情况延迟 = sum(所有候选)

**改进**: 并行执行 + 快速胜出

```python
class ParallelSQLExecutor:
    """并行执行多个SQL候选，取最先返回的合理结果"""

    SINGLE_CANDIDATE_TIMEOUT = 0.5  # 单候选500ms超时

    async def execute_candidates(
        self,
        candidates: list[SQLCandidate],
        expected_intent: QueryIntent,
    ) -> ExecutionResult:

        # 并行启动所有候选
        tasks = [
            asyncio.create_task(
                self._execute_with_timeout(c, expected_intent)
            )
            for c in candidates
        ]

        # 使用 as_completed: 第一个合理结果立即返回
        for completed in asyncio.as_completed(tasks):
            try:
                result = await completed
                if result and result.validation.is_valid:
                    # 取消其余任务
                    for t in tasks:
                        t.cancel()
                    return result
            except (asyncio.TimeoutError, Exception):
                continue

        # 所有候选都失败 → 渐进降级
        return await self._progressive_fallback(candidates)

    async def _execute_with_timeout(
        self, candidate: SQLCandidate, intent: QueryIntent
    ) -> ExecutionResult | None:
        try:
            return await asyncio.wait_for(
                self._execute_single(candidate, intent),
                timeout=self.SINGLE_CANDIDATE_TIMEOUT,
            )
        except asyncio.TimeoutError:
            return None
```

### 2.2 三层缓存增强 [P1, 来自审核#5]

```python
class EnhancedCacheSystem:
    """
    增强的缓存系统 (对比原设计的改进):
    - Working Memory: 50条共享 → 会话隔离(20) + 全局热点(100)
    - 新增: SQL结果缓存层
    - 新增: LLM响应缓存
    """

    def __init__(self):
        # L1: 会话级缓存 (内存)
        self.session_caches: dict[str, LRUCache] = {}
        self.global_hot_cache = LRUCache(100)

        # L2: SQL结果缓存 (SQLite)
        self.sql_cache = SQLResultCache(ttl_config={
            "schema_stats":    86400,   # 24h
            "ontology_lookup": 604800,  # 7天
            "search_results":  3600,    # 1h
            "aggregations":    21600,   # 6h
        })

        # L3: 本体缓存 (SQLite, 不变)
        self.ontology_cache = OntologyCache()

        # L4: LLM响应缓存 (可选, 基于prompt hash)
        self.llm_cache = LLMResponseCache()

    def get_query_cache_key(self, parsed_query: ParsedQuery) -> str:
        """
        语义级缓存key:
        规范化查询条件 → 确定性hash
        "brain AD" 和 "AD brain" 生成相同key
        """
        normalized = {
            "intent": parsed_query.intent.name,
            "filters": {
                k: sorted(v) if isinstance(v, list) else v
                for k, v in parsed_query.filters.__dict__.items()
                if v  # 跳过空值
            },
            "target": parsed_query.target_level,
        }
        return hashlib.sha256(
            json.dumps(normalized, sort_keys=True).encode()
        ).hexdigest()[:16]
```

### 2.3 LLM成本控制器 [P1, 来自审核#5]

```python
class CostController:
    """
    LLM调用成本控制
    - 日预算上限
    - 模型自动降级
    - Prompt缓存利用
    """

    def __init__(self, daily_budget_usd: float = 50.0):
        self.daily_budget = daily_budget_usd
        self.daily_spend = 0.0
        self.reset_time = self._next_midnight()

        # 成本追踪
        self.call_log: list[dict] = []

    # Token定价 (per 1M tokens, 2026-03 pricing)
    PRICING = {
        "claude-haiku-4-5":  {"input": 0.80,  "output": 4.00},
        "claude-sonnet-4-6": {"input": 3.00,  "output": 15.00},
        "claude-opus-4-6":   {"input": 15.00, "output": 75.00},
    }

    def select_model(self, complexity: str) -> str:
        """根据复杂度和剩余预算选择模型"""
        remaining = self.daily_budget - self.daily_spend

        if remaining < 5.0:
            # 预算紧张: 只用Haiku
            return "claude-haiku-4-5"

        model_map = {
            "simple": "claude-haiku-4-5",
            "moderate": "claude-haiku-4-5",    # Haiku足够
            "complex": "claude-sonnet-4-6",
            "ambiguous": "claude-sonnet-4-6",
        }
        return model_map.get(complexity, "claude-haiku-4-5")

    def has_budget(self) -> bool:
        self._check_reset()
        return self.daily_spend < self.daily_budget

    def record_usage(self, usage: TokenUsage):
        model = usage.model
        pricing = self.PRICING.get(model, self.PRICING["claude-haiku-4-5"])
        cost = (usage.input_tokens * pricing["input"]
                + usage.output_tokens * pricing["output"]) / 1_000_000
        self.daily_spend += cost
        self.call_log.append({
            "model": model, "cost": cost,
            "input_tokens": usage.input_tokens,
            "output_tokens": usage.output_tokens,
            "timestamp": time.time(),
        })
```

### 2.4 修正后的响应时间目标 [来自审核#5]

```yaml
# 原始目标 → 修正目标

response_time_targets:
  id_direct_query:
    p50: 50ms          # 不变
    p95: 100ms

  simple_search:
    p50: 100ms         # 不变
    p95: 300ms         # 新增P95

  complex_search:
    p50: 500ms         # 不变
    p95: 1500ms        # 新增: 原设计未考虑P95

  ontology_disambiguation:
    p50: 1000ms        # 原800ms → 调高
    p95: 3000ms        # 新增

  answer_synthesis_large:
    p50: 2000ms        # 原1s → 调高
    p95: 5000ms        # 新增
    first_byte: 500ms  # 流式输出首字节

  end_to_end_rule_path:
    p50: 800ms         # 不变
    p95: 2000ms        # 新增

  end_to_end_llm_path:
    p50: 2500ms        # 不变
    p95: 6000ms        # 新增
```

---

## 三、数据模型改进

### 3.1 unified_samples 关键字段补充 [P1, 来自审核#3]

```sql
-- 在现有schema基础上新增字段 (不拆表，保持简洁)
-- 理由: 756K记录的30字段表在SQLite中性能完全可接受
-- 垂直拆分收益有限但增加JOIN复杂度，暂不拆分

ALTER TABLE unified_samples ADD COLUMN age_normalized_years REAL;
-- 将 "25 years", "P56", "adult" 统一为数值 (years)
-- NULL = 未知, 0.0 = newborn

ALTER TABLE unified_samples ADD COLUMN has_celltype_annotation INTEGER DEFAULT 0;
-- 快速过滤是否有细胞类型注释

ALTER TABLE unified_samples ADD COLUMN data_quality_score REAL;
-- 预计算字段完整性评分 (0-100)
```

### 3.2 全文搜索索引 [P1, 来自审核#3]

```sql
-- SQLite FTS5 全文搜索 (替代 LIKE '%term%')
-- 性能提升: LIKE扫描 1-5s → FTS5 <50ms

CREATE VIRTUAL TABLE samples_fts USING fts5(
    sample_id,
    tissue,
    disease,
    cell_type,
    content=unified_samples,
    content_rowid=pk,
    tokenize='unicode61'  -- 支持中文分词
);

-- 查询示例:
-- SELECT * FROM samples_fts WHERE samples_fts MATCH 'brain AND cancer';
```

### 3.3 复合索引与预计算统计 [P1, 来自审核#3,#5]

```sql
-- 高频查询模式的复合索引
CREATE INDEX idx_samples_tissue_disease ON unified_samples(tissue, disease);
CREATE INDEX idx_samples_organism_source ON unified_samples(organism, source_database);
CREATE INDEX idx_samples_source_tissue ON unified_samples(source_database, tissue);

-- 预计算统计表 (解决全库统计查询慢的问题)
CREATE TABLE precomputed_stats (
    dimension TEXT NOT NULL,        -- 'source_database', 'tissue', 'disease', ...
    dimension_value TEXT NOT NULL,
    sample_count INTEGER NOT NULL,
    project_count INTEGER,
    total_cells INTEGER,
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (dimension, dimension_value)
);

-- 交叉维度统计
CREATE TABLE precomputed_cross_stats (
    dim1 TEXT NOT NULL,
    dim1_value TEXT NOT NULL,
    dim2 TEXT NOT NULL,
    dim2_value TEXT NOT NULL,
    sample_count INTEGER NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (dim1, dim1_value, dim2, dim2_value)
);
```

### 3.4 数据质量监控视图 [P2, 来自审核#3]

```sql
CREATE VIEW v_data_quality_report AS
SELECT
    source_database,
    COUNT(*) as total_samples,
    ROUND(100.0 * COUNT(tissue) / COUNT(*), 1) as tissue_pct,
    ROUND(100.0 * COUNT(disease) / COUNT(*), 1) as disease_pct,
    ROUND(100.0 * COUNT(sex) / COUNT(*), 1) as sex_pct,
    ROUND(100.0 * COUNT(age) / COUNT(*), 1) as age_pct,
    ROUND(100.0 * COUNT(cell_type) / COUNT(*), 1) as cell_type_pct,
    ROUND(100.0 * COUNT(n_cells) / COUNT(*), 1) as n_cells_pct,
    COUNT(DISTINCT tissue) as tissue_distinct,
    COUNT(DISTINCT disease) as disease_distinct
FROM unified_samples
GROUP BY source_database;
```

---

## 四、UX与前端改进

### 4.1 渐进式信息披露 [P0, 来自审核#4]

**问题**: 所有信息平铺展示，认知负荷过高

**改进**: 三级渐进披露

```
Level 1 (立即可见 - 不需要任何点击):
├── 自然语言摘要 ("找到47个肝癌数据集，覆盖3个数据库")
├── 关键统计 (47个结果 | 3个来源 | 最高质量分92.5)
├── 前3条核心结果 (卡片视图，含质量分+关键标签)
└── 2条最相关建议 (可点击)

Level 2 (一次点击展开):
├── 完整结果表格 (可排序/筛选)
├── 数据来源分布饼图
├── 更多建议
└── 质量评分详情

Level 3 (深度探索, 按需):
├── SQL查询详情
├── 本体扩展过程
├── 完整数据血缘图
└── 跨库关联可视化
```

### 4.2 WebSocket状态机与容错 [P0, 来自审核#4]

```typescript
// 流式输出状态机
enum StreamPhase {
    UNDERSTANDING = 'understanding',
    RESOLVING = 'resolving',
    GENERATING = 'generating',
    EXECUTING = 'executing',
    FUSING = 'fusing',
    SYNTHESIZING = 'synthesizing',
    COMPLETE = 'complete',
    ERROR = 'error',
}

interface WebSocketManager {
    // 自动重连 (指数退避)
    reconnect: {
        maxRetries: 3;
        backoffMs: [1000, 3000, 10000];
    };

    // SSE降级 (WebSocket被防火墙阻断时)
    fallback: 'sse' | 'polling';

    // 查询取消
    cancelQuery: (queryId: string) => void;

    // 心跳保活
    heartbeat: {
        intervalMs: 30000;
        timeoutMs: 5000;
    };
}
```

### 4.3 混合界面: 对话 + 可视化筛选 [P2, 来自审核#4]

```
┌──────────────────────────────────────────────────────────┐
│  Chat (主交互) + Filter Panel (辅助, 可折叠)              │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌───────── Chat ──────────┐  ┌── Filter Panel ──┐      │
│  │ [Agent] 找到47个结果...  │  │ Tissue:          │      │
│  │                         │  │ [brain      ▼]   │      │
│  │ [User] 查找脑部AD数据    │  │                  │      │
│  │                         │  │ Disease:         │      │
│  │ [Agent] 结果:           │  │ [Alzheimer ▼]   │      │
│  │ ┌─────────────────┐    │  │                  │      │
│  │ │ Results Table   │    │  │ Source:          │      │
│  │ └─────────────────┘    │  │ [☑CXG ☑GEO ☑SRA]│      │
│  │                         │  │                  │      │
│  │ 🔍 输入...       [发送] │  │ [Apply Filters]  │      │
│  └─────────────────────────┘  └──────────────────┘      │
│                                                          │
│  两种使用模式:                                            │
│  · 新手: 在Chat中用自然语言                                │
│  · 专家: 直接调整Filter Panel                             │
│  · 两者同步: 修改Filter自动生成等价自然语言查询              │
└──────────────────────────────────────────────────────────┘
```

### 4.4 前端状态管理 [P2, 来自审核#4]

```
原设计: "后端会话管理，无需前端状态库" (过于简化)

修正为:
├── Server State    → TanStack Query (缓存/重试/乐观更新)
├── Global UI State → Zustand (主题/侧边栏/语言偏好)
├── URL State       → nuqs (筛选条件同步到URL, 支持分享)
├── Form State      → React controlled components
└── Client Cache    → IndexedDB (本体术语/字段值缓存)
```

### 4.5 可访问性基础 [P2, 来自审核#4]

```
WCAG 2.1 AA 目标 (最低要求):
├── 键盘导航: Tab遍历所有交互元素
├── ARIA标签: 表格/图表/按钮的aria-label
├── 对比度: 文本 ≥ 4.5:1 (Tailwind需验证)
├── 图表替代: 每个图表提供数据表格视图
├── 屏幕阅读器: 结果变化时announce
└── 减弱动效: prefers-reduced-motion支持
```

### 4.6 移动端响应式 [P3, 来自审核#4]

```
移动端核心适配:
├── 断点: sm(640) / md(768) / lg(1024) / xl(1280)
├── 移动布局: Chat全屏 + 结果卡片式 + Filter底部抽屉
├── 输入优化: 支持预设快捷查询 + 语音输入(可选)
└── 离线: PWA基础支持 (缓存结果离线查看)

优先级说明: 移动端为P3，因为目标用户(生物信息学家)
主要在桌面工作，但需预留架构支持
```

---

## 五、模块耦合改进

### 5.1 Tool拆分: generate_sql → plan_query + generate_sql [来自审核#2]

```python
# 原始10个Tools → 优化为11个 (拆分1个, 合并1个)

TOOLS_V2 = {
    # 不变
    "understand_query": ...,
    "resolve_ontology": ...,
    "inspect_schema": ...,
    "execute_sql": ...,
    "find_related": ...,
    "check_availability": ...,
    "recall_memory": ...,

    # 拆分: generate_sql → plan_query + generate_sql
    "plan_query": {
        "description": "确定查询涉及的表、JOIN路径和策略",
        "input": "ParsedQuery + ResolvedEntities",
        "output": "QueryPlan (tables, joins, strategy)",
    },
    "generate_sql": {
        "description": "基于QueryPlan生成SQL候选",
        "input": "QueryPlan",
        "output": "List[SQLCandidate]",
    },

    # 合并: fuse_results + assess_quality → fuse_and_score
    "fuse_and_score": {
        "description": "跨库融合 + 质量评分 (原两步合为一步)",
        "input": "ExecutionResult",
        "output": "List[FusedRecord] (含quality_score)",
    },
}
```

### 5.2 消除循环依赖 [来自审核#2]

```python
# 问题: SQLExecutor.fallback → relax_query → 可能回调QueryUnderstanding

# 解决: fallback策略内聚在SQLExecutor内部，不回调上游

class SQLExecutor:
    async def _progressive_fallback(self, candidates: list[SQLCandidate]) -> ExecutionResult:
        """
        内聚的降级策略 - 不依赖任何上游模块

        Level 1: IN(...) → LIKE '%...%' (放宽匹配)
        Level 2: 去除低优先级条件 (保留tissue/disease, 去除sex/age)
        Level 3: 去除除最核心条件外的所有条件
        Level 4: 全表COUNT + 提示用户手动调整
        """
        CONDITION_PRIORITY = ['tissue', 'disease', 'organism', 'assay', 'sex', 'age']

        for level in range(1, 5):
            relaxed = self._relax_at_level(candidates[0], level, CONDITION_PRIORITY)
            result = await self._try_execute(relaxed)
            if result and result.row_count > 0:
                result.metadata['fallback_level'] = level
                return result

        return ExecutionResult.empty()
```

---

## 六、更新后的实施路线图

```
Phase 0: 基础准备 (5天)
├── 0.1 项目骨架 (FastAPI + 配置)
├── 0.2 ILLMClient接口 + Claude/OpenAI实现
├── 0.3 数据库抽象层 + SchemaInspector
├── 0.4 本体缓存构建 (UBERON/MONDO/CL)
├── 0.5 ★ 增强: CircuitBreaker + CostController      [新增]
└── 0.6 ★ 增强: 缓存系统骨架 (3层)                     [新增]

Phase 1: 核心Agent (12天, 原7-10天)
├── 1.1 Coordinator (依赖注入 + Protocol接口)            [改进]
├── 1.2 Query Understanding (规则 + LLM)
├── 1.3 Ontology Resolution Engine
├── 1.4 ★ plan_query + generate_sql (原为1个)            [拆分]
├── 1.5 ★ 并行SQL执行 + 渐进降级                        [改进]
├── 1.6 Cross-DB Fusion (含质量评分)
├── 1.7 Answer Synthesizer (渐进披露)
├── 1.8 ★ FTS5索引 + 复合索引 + 预计算统计               [新增]
└── 1.9 ★ 数据质量监控视图                               [新增]

Phase 2: 记忆与优化 (7天)
├── 2.1 三层记忆系统 (会话隔离 + 全局热点)               [改进]
├── 2.2 Schema知识库自动构建
├── 2.3 多轮对话管理
├── 2.4 ★ SQL结果缓存 + LLM响应缓存                     [新增]
└── 2.5 ★ 性能基准测试 (P50/P95)                        [新增]

Phase 3: Web前端 (10天)
├── 3.1 FastAPI后端 + WebSocket容错                      [改进]
├── 3.2 React前端 + TanStack Query + Zustand             [改进]
├── 3.3 ★ 渐进式信息披露 (3级)                           [新增]
├── 3.4 ★ 混合界面 (Chat + Filter Panel)                 [新增]
├── 3.5 结果表格 + Recharts可视化
├── 3.6 导出功能
├── 3.7 ★ 可访问性基础 (键盘导航 + ARIA)                 [新增]
└── 3.8 ★ 响应式布局 (桌面优先 + 移动端可用)             [新增]

Phase 4: 评估与论文 (10天)
├── 4.1 基准测试集 (150题)
├── 4.2 自动化评估pipeline
├── 4.3 Baseline对比
├── 4.4 ★ 性能报告 (P50/P95延迟, 缓存命中率, LLM成本)   [新增]
├── 4.5 用户研究 (10-15人)
└── 4.6 论文准备
```

---

## 七、更新后的目录结构

```
agent_v2/
├── src/
│   ├── core/                    # 纯领域逻辑 [审核#2建议]
│   │   ├── interfaces.py        # ★ Protocol接口定义
│   │   ├── models.py            # 数据结构定义
│   │   └── exceptions.py
│   ├── agent/
│   │   ├── coordinator.py       # Coordinator (依赖注入)
│   │   ├── tools.py             # Tool定义 (11个)
│   │   └── prompts.py
│   ├── understanding/
│   │   ├── parser.py
│   │   └── entities.py
│   ├── ontology/
│   │   ├── resolver.py
│   │   ├── cache.py
│   │   └── builder.py
│   ├── sql/
│   │   ├── planner.py           # ★ plan_query (新拆分)
│   │   ├── generator.py         # generate_sql
│   │   ├── executor.py          # ★ 并行执行
│   │   ├── join_resolver.py
│   │   └── templates.py
│   ├── fusion/
│   │   ├── engine.py
│   │   ├── quality.py
│   │   └── union_find.py
│   ├── synthesis/
│   │   ├── answer.py
│   │   ├── suggestions.py
│   │   └── charts.py
│   ├── memory/
│   │   ├── system.py
│   │   ├── schema_kb.py
│   │   ├── conversation.py
│   │   └── cache.py             # ★ 增强缓存系统
│   ├── dal/
│   │   ├── database.py
│   │   └── inspector.py
│   ├── infra/                   # ★ 基础设施 [审核#1,#2建议]
│   │   ├── llm_client.py        # ILLMClient + Claude/OpenAI实现
│   │   ├── llm_router.py        # ★ 路由 + 降级
│   │   ├── circuit_breaker.py   # ★ 熔断器
│   │   ├── cost_controller.py   # ★ 成本控制
│   │   └── health.py            # ★ 健康监控
│   └── sdk/
│       └── client.py
├── api/
│   ├── main.py
│   ├── routes/
│   │   ├── query.py
│   │   ├── schema.py
│   │   ├── entity.py
│   │   ├── ontology.py
│   │   ├── export.py
│   │   └── health.py            # ★ /api/v1/health
│   └── websocket.py             # ★ 含容错状态机
├── web/                         # React前端
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatInterface.tsx
│   │   │   ├── ResultTable.tsx
│   │   │   ├── FilterPanel.tsx  # ★ 可视化筛选面板
│   │   │   ├── ProgressiveDisclosure.tsx  # ★ 渐进披露
│   │   │   └── ...
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts  # ★ 含重连/降级
│   │   │   ├── useQuery.ts      # TanStack Query
│   │   │   └── useStore.ts      # Zustand
│   │   └── stores/
│   │       └── uiStore.ts       # ★ Zustand store
│   └── ...
└── tests/
    ├── unit/                    # ★ 按模块独立测试 (Protocol mock)
    ├── integration/
    └── benchmark/
```

---

## 八、改进决策追踪

| 审核建议 | 决策 | 理由 |
|---------|------|------|
| 样本表垂直拆分 | **暂不采纳** | 756K×30字段在SQLite完全可接受；拆分增加JOIN复杂度 |
| 引入litellm | **自研ILLMClient替代** | litellm依赖重、更新快；自研接口更精简可控 |
| Redis分布式缓存 | **延后到Phase 2** | MVP阶段SQLite缓存足够；Redis增加运维复杂度 |
| CQRS模式 | **暂不采纳** | 当前读写比例99:1，CQRS过度设计 |
| 事件总线 | **暂不采纳** | 模块数量少(11个工具)，事件总线增加复杂度 |
| ECharts替代Recharts | **保留Recharts** | 数据量<1000点足够；ECharts包体大 |
| RTL语言预留 | **暂不采纳** | 目标用户为中英文，RTL需求极低 |
| 微服务拆分 | **暂不采纳** | 单体足够，微服务增加100x运维复杂度 |
| Alembic迁移工具 | **采纳** | Schema演进管理是刚需 |
| SQL并行执行 | **采纳** | 审核#5验证了串行瓶颈的真实性 |
| 渐进式信息披露 | **采纳** | 审核#4的认知负荷分析有说服力 |
| 混合界面 | **采纳** | 兼顾新手和专家用户 |
| WCAG 2.1 AA | **部分采纳** | 键盘导航+ARIA为P2，完整合规为P3 |
| 移动端PWA | **架构预留，P3实施** | 用户以桌面为主 |
