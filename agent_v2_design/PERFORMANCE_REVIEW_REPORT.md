# SCeQTL-Agent V2 性能与可扩展性设计审核报告

> **审核日期**: 2026-03-06  
> **审核角色**: 系统性能架构师  
> **审核范围**: 响应时间目标、成本控制、缓存策略、数据库性能、扩展性  

---

## 执行摘要

| 维度 | 评级 | 关键发现 | 优先级 |
|------|------|---------|--------|
| 响应时间目标 | ⚠️ **需谨慎** | 简单查询目标可行，复杂查询和LLM路径存在风险 | P1 |
| LLM成本控制 | ✅ **良好** | 规则优先策略合理，但需细化成本上限 | P2 |
| 缓存策略 | ⚠️ **需优化** | Working Memory容量偏小，Ontology缓存设计良好 | P2 |
| SQLite并发 | ❌ **有风险** | WAL模式读并发OK，但写入可能成为瓶颈 | P1 |
| 跨库融合 | ✅ **可接受** | Union-Find算法选择正确，性能预估合理 | P3 |
| 水平扩展 | ⚠️ **需规划** | 当前架构无状态化程度不足，需明确扩展路径 | P2 |
| 大数据查询 | ✅ **良好** | 视图优先+索引策略正确，需验证执行计划 | P3 |
| PG迁移对比 | ✅ **路径清晰** | DAL抽象层设计合理，迁移成本可控 | P3 |

**总体评估**: 设计思路正确，但**SQLite生产部署存在并发风险**，建议在MVP验证后尽快评估PostgreSQL迁移时间线。

---

## 1. 响应时间目标审核

### 1.1 目标分解与可行性分析

```
┌─────────────────────────────────────────────────────────────────────┐
│                    响应时间目标分解                                   │
├─────────────────┬─────────────┬─────────────┬───────────────────────┤
│ 查询类型         │ 目标延迟     │ 可行性评估   │ 主要风险点            │
├─────────────────┼─────────────┼─────────────┼───────────────────────┤
│ ID直接查询       │ <50ms       │ ✅ 可达      │ 索引命中率需验证      │
│ 简单搜索         │ <100ms      │ ✅ 可达      │ 依赖视图性能          │
│ 复杂搜索         │ ~500ms      │ ⚠️ 偏乐观    │ 多候选SQL串行执行     │
│ 歧义消解         │ ~800ms      │ ❌ 偏紧张    │ LLM调用+P95延迟       │
│ 答案合成(大结果) │ ~1s         │ ❌ 不可达    │ LLM生成+数据传输      │
│ 平均延迟(规则)   │ 800ms       │ ⚠️ 偏乐观    │ 跨库融合增加开销      │
│ 平均延迟(LLM)    │ 2.5s        │ ✅ 合理      │ 但P99可能>5s          │
└─────────────────┴─────────────┴─────────────┴───────────────────────┘
```

### 1.2 关键风险点

#### 风险1: 3候选SQL串行执行瓶颈

**设计现状**: 按优先级串行执行3个候选SQL，验证失败后执行下一个

**性能影响**:
```python
# 最坏情况时间累积
total_time = exec_candidate_1 + validation_1 
           + exec_candidate_2 + validation_2  # 如果c1失败
           + exec_candidate_3 + validation_3  # 如果c2失败
           + fallback_time                    # 如果都失败

# 预估 (基于756K样本量)
# - 简单查询: 10-30ms × 3 = 30-90ms ✅
# - 复杂JOIN: 100-300ms × 3 = 300-900ms ⚠️ 可能超标
# - 带全文检索: 200-500ms × 3 = 600-1500ms ❌ 超标
```

**建议**:
1. **并行执行候选**: 3个候选SQL并行执行，取最先返回的合理结果
2. **快速失败机制**: 设置单候选超时(如200ms)，避免慢查询阻塞
3. **智能选择**: 基于历史成功率预测最佳候选，优先执行

#### 风险2: 歧义消解800ms目标过于紧张

**当前流程耗时分解**:
| 步骤 | 预估耗时 | 备注 |
|------|---------|------|
| Ontology模糊匹配 | 50-100ms | 本地SQLite查询 |
| LLM选择最佳候选 | 500-1500ms | 网络+生成延迟 |
| 其他处理 | 50-100ms | 数据转换等 |
| **总计** | **600-1700ms** | **P50=800ms可能，P95>2s** |

**建议调整目标**:
- 歧义消解目标: **P50<1s, P95<3s**
- 考虑引入**本地embedding相似度计算**减少对LLM的依赖

#### 风险3: 大结果集答案合成1s不可达

**问题**: 当结果>50条时需要LLM生成分析性摘要，仅LLM调用就需要500ms-2s

**建议**:
- 大结果集摘要目标: **P50<2s, P95<5s**
- 实施**流式响应**: 先返回结构化结果，LLM摘要以打字机效果流式呈现
- 增加**摘要缓存**: 对高频查询模式预生成摘要模板

### 1.3 修正后的响应时间目标

```yaml
recommended_targets:
  id_direct_query:
    p50: 50ms
    p95: 100ms
    
  simple_search:
    p50: 100ms
    p95: 300ms
    
  complex_search:
    p50: 500ms
    p95: 1500ms
    note: "并行执行3候选，设置200ms单候选超时"
    
  ontology_disambiguation:
    p50: 1000ms
    p95: 3000ms
    note: "引入embedding本地计算减少LLM调用"
    
  synthesis_large_results:
    p50: 2000ms
    p95: 5000ms
    note: "流式输出，首字节<500ms"
    
  end_to_end_rule_path:
    p50: 800ms
    p95: 2000ms
    
  end_to_end_llm_path:
    p50: 2500ms
    p95: 6000ms
```

---

## 2. LLM调用成本控制策略审核

### 2.1 当前策略评估

**规则优先策略**: 70%场景规则处理，30%场景LLM处理

**成本估算验证**:
```
假设: 日查询量10,000次

场景分布:
- 规则处理: 7,000次 × $0 = $0
- LLM处理: 3,000次
  - 复杂搜索(Haiku): 1,500次 × $0.003 = $4.5
  - 歧义消解(Sonnet): 600次 × $0.015 = $9
  - SQL修复(Haiku): 450次 × $0.002 = $0.9
  - 答案合成(Sonnet): 300次 × $0.012 = $3.6
  - 多轮对话(Sonnet): 150次 × $0.01 = $1.5

预估日成本: ~$20
预估月成本: ~$600
预估年成本: ~$7,200
```

**评估**: 成本模型合理，但需要设置**硬性成本上限**。

### 2.2 成本风险与建议

#### 风险: 无成本上限保护

**建议增加的成本控制机制**:

```python
class CostController:
    """LLM调用成本控制"""
    
    DAILY_BUDGET_USD = 50  # 日预算上限
    
    # 模型优先级 (成本从低到高)
    MODEL_PRIORITY = [
        "claude-haiku",      # $0.25/1M input tokens
        "claude-sonnet",     # $3/1M input tokens
        "claude-opus",       # $15/1M input tokens (仅极端情况)
    ]
    
    def should_use_llm(self, query_complexity: str, estimated_tokens: int) -> Tuple[bool, str]:
        """
        决定是否可以使用LLM，返回(是否允许, 建议模型)
        """
        # 检查日预算
        if self.daily_spend >= self.DAILY_BUDGET_USD:
            return False, "budget_exceeded"
        
        # 基于复杂度选择模型
        if query_complexity == "simple":
            return True, "claude-haiku"
        elif query_complexity == "moderate":
            return True, "claude-haiku"  # 优先尝试Haiku
        elif query_complexity == "complex":
            return True, "claude-sonnet"
        else:
            return True, "claude-sonnet"
    
    def estimate_cost(self, model: str, input_tokens: int, output_tokens: int) -> float:
        """估算调用成本"""
        pricing = {
            "claude-haiku": {"input": 0.25, "output": 1.25},    # per 1M tokens
            "claude-sonnet": {"input": 3.0, "output": 15.0},
        }
        p = pricing[model]
        return (input_tokens * p["input"] + output_tokens * p["output"]) / 1_000_000
```

#### 建议: 引入本地模型降级

**当成本或延迟超限时，降级到本地轻量模型**:

```yaml
fallback_strategy:
  when_cost_exceeds_daily_budget:
    action: switch_to_local_model
    local_model: "ollama/llama3.1-8b"  # 本地部署
    performance_impact: "~2s额外延迟，质量轻微下降"
    
  when_latency_exceeds:
    threshold: 5000ms
    action: "返回规则生成的答案，LLM摘要异步生成后推送"
```

### 2.3 Token优化建议

**当前设计中的Token消耗点**:
1. System Prompt注入schema摘要 (每次~500 tokens)
2. SQL生成prompt包含完整DDL (~800 tokens)
3. 答案合成传输大结果集 (~1000+ tokens)

**优化建议**:
1. **Schema摘要压缩**: 只包含查询相关的表，而非完整schema
2. **Prompt缓存**: 对System Prompt使用Claude的prompt caching (减少90%重复token成本)
3. **结果集截断**: LLM合成时只传前20条+统计摘要，而非完整结果

---

## 3. 缓存策略审核

### 3.1 当前缓存架构

```
┌──────────────────────────────────────────────────────────────┐
│                     三层缓存架构                              │
├──────────────────────────────────────────────────────────────┤
│ L1: Working Memory (进程内)                                  │
│    - 容量: 50条查询结果                                       │
│    - 策略: LRU                                               │
│    - 生命周期: 会话级                                         │
├──────────────────────────────────────────────────────────────┤
│ L2: Ontology缓存 (SQLite)                                    │
│    - 50K术语 + 层级关系                                       │
│    - 本地SQLite，O(1)查找                                     │
├──────────────────────────────────────────────────────────────┤
│ L3: Schema知识库 (内存)                                       │
│    - 表结构 + 字段统计 + 样本值                                │
│    - 启动时加载，运行时只读                                    │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 缓存策略问题与建议

#### 问题1: Working Memory容量偏小

**分析**:
- 50条缓存对于个人用户会话可能足够
- 但对于**多用户部署** (如Web服务)，50条共享缓存命中极低

**建议**:
```python
class WorkingMemory:
    """改进的Working Memory设计"""
    
    # 按用户会话隔离缓存
    PER_SESSION_CACHE_SIZE = 20
    GLOBAL_HOT_CACHE_SIZE = 100  # 高频查询全局缓存
    
    def __init__(self):
        self.session_caches: Dict[str, LRUCache] = {}
        self.global_hot_cache = LRUCache(GLOBAL_HOT_CACHE_SIZE)
        self.query_hash_index = {}  # 查询指纹 -> 结果
    
    def get_cache_key(self, parsed_query: ParsedQuery) -> str:
        """生成查询指纹，支持语义相似匹配"""
        # 规范化: 忽略大小写、排序列表值
        normalized = self._normalize(parsed_query)
        return hashlib.sha256(normalized.encode()).hexdigest()[:16]
```

#### 问题2: 缺少SQL结果缓存层

**建议增加持久化查询结果缓存**:

```python
class QueryResultCache:
    """
    持久化查询结果缓存 (SQLite)
    适用于: 统计类查询、热门查询、计算 expensive 的查询
    """
    
    CACHE_TTL = {
        "schema_stats": 3600 * 24,      # 24小时 (schema统计变化慢)
        "ontology_lookup": 3600 * 24 * 7, # 7天 (本体稳定)
        "search_results": 3600,          # 1小时 (数据可能更新)
        "aggregations": 3600 * 6,        # 6小时 (统计结果缓存)
    }
    
    def get_or_execute(
        self, 
        sql: str, 
        cache_category: str,
        executor: Callable
    ) -> QueryResult:
        cache_key = self._hash_sql(sql)
        ttl = self.CACHE_TTL[cache_category]
        
        # 检查缓存
        cached = self.db.execute(
            "SELECT result, created_at FROM query_cache WHERE key = ?",
            (cache_key,)
        ).fetchone()
        
        if cached and not self._expired(cached["created_at"], ttl):
            return self._deserialize(cached["result"])
        
        # 执行并缓存
        result = executor()
        self._store(cache_key, result, cache_category)
        return result
```

#### 问题3: 缺少LLM响应缓存

**LLM调用结果应该被缓存**:

```python
class LLMResponseCache:
    """
    LLM响应缓存
    适用于: 本体歧义消解、SQL生成、答案合成
    """
    
    def get_cached_response(self, prompt: str, model: str) -> Optional[str]:
        """
        使用prompt的embedding相似度匹配，而非精确匹配
        """
        prompt_embedding = self.embedding_model.encode(prompt)
        
        # 查找相似prompt (余弦相似度>0.95)
        similar = self.vector_store.similarity_search(
            prompt_embedding, 
            threshold=0.95,
            k=1
        )
        
        if similar:
            return similar[0].response
        return None
```

### 3.3 预估缓存命中率

| 缓存层 | 预估命中率 | 说明 |
|--------|-----------|------|
| Working Memory (单用户) | 30-40% | 会话内重复/相似查询 |
| Working Memory (多用户共享) | 5-10% | 需要按会话隔离提升 |
| Ontology缓存 | 95%+ | 本地SQLite，几乎全命中 |
| Schema知识库 | 100% | 内存缓存，启动加载 |
| 建议增加: SQL结果缓存 | 20-30% | 统计类查询受益大 |
| 建议增加: LLM响应缓存 | 15-25% | 相似查询复用 |

**优化后综合缓存命中率预估**: 从当前~35%提升至**~60%**

---

## 4. SQLite高并发表现审核

### 4.1 SQLite并发模型分析

```
┌──────────────────────────────────────────────────────────────┐
│                    SQLite并发模型                             │
├──────────────────────────────────────────────────────────────┤
│ WAL模式 (Write-Ahead Logging)                                │
│                                                              │
│  读取: 多个读取者可以并发执行                                  │
│        ├─ 读不阻塞读 ✅                                       │
│        └─ 读不阻塞写 ✅ (WAL模式)                             │
│                                                              │
│  写入: 单个写入者独占                                         │
│        ├─ 写阻塞其他写 ❌                                     │
│        └─ 写不阻塞读 ✅                                       │
│                                                              │
│  限制: 同一时刻只有一个写入事务                                 │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 并发风险评估

#### 风险1: 写入争用

**场景分析**:
```python
# 高并发场景下的写入争用

# 场景A: 记忆系统更新 (每查询1-2次写入)
# 场景B: Ontology缓存更新 (本体解析时)
# 场景C: 查询结果缓存 (如果启用)

# 争用表现:
# - 并发用户 > 10时，写入队列开始累积
# - 并发用户 > 50时，写入延迟可能>100ms
# - 并发用户 > 100时，"database is locked"错误概率上升
```

#### 风险2: 连接池管理

**当前设计未明确连接池策略**:

**建议**:
```python
class SQLiteConnectionPool:
    """
    SQLite连接池管理
    读连接: 可多个
    写连接: 单例，带队列管理
    """
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.read_pool = queue.Queue(maxsize=10)
        self.write_lock = threading.Lock()
        self.write_queue = queue.Queue()
        
    def get_read_connection(self) -> sqlite3.Connection:
        """获取读连接 (并发安全)"""
        conn = sqlite3.connect(self.db_path)
        conn.execute("PRAGMA query_only = ON")  # 只读模式
        return conn
    
    def execute_write(self, operation: Callable) -> Any:
        """
        排队执行写操作，避免"database is locked"
        """
        with self.write_lock:
            conn = sqlite3.connect(self.db_path)
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=NORMAL")  # 平衡安全与性能
            try:
                result = operation(conn)
                conn.commit()
                return result
            except sqlite3.OperationalError as e:
                if "database is locked" in str(e):
                    # 指数退避重试
                    time.sleep(random.uniform(0.01, 0.1))
                    return self.execute_write(operation)
                raise
            finally:
                conn.close()
```

### 4.3 并发性能预估

基于756K样本数据量:

| 并发用户数 | 读查询QPS | 平均读延迟 | 写操作影响 | 可用性评估 |
|-----------|----------|-----------|-----------|-----------|
| 1-5 | 50-100 | 10-30ms | 无 | ✅ 优秀 |
| 5-20 | 100-200 | 20-50ms | 轻微 | ✅ 良好 |
| 20-50 | 150-300 | 50-100ms | 明显 | ⚠️ 可接受 |
| 50-100 | 200-400 | 100-300ms | 严重 | ❌ 不推荐 |
| >100 | - | >500ms | 阻塞 | ❌ 不可接受 |

**结论**: SQLite适合**原型开发和小规模部署** (<50并发用户)，生产环境需要考虑PostgreSQL迁移。

---

## 5. 跨库融合性能审核

### 5.1 融合流程性能分析

```
查询结果 (N条原始记录)
    │
    ▼
Step 1: 硬链接去重 ──────────────► O(k), k=涉及entity_links数量
    │
    ▼
Step 2: Identity Hash去重 ──────► O(m), m=Step1后记录数
    │
    ▼
Step 3: 多源证据聚合 ────────────► O(m × s), s=平均每记录来源数
    │
    ▼
Step 4: 质量评分 ────────────────► O(m)
    │
    ▼
融合结果 (M条记录, M ≤ N)
```

### 5.2 性能瓶颈识别

#### 瓶颈1: entity_links批量查询

**当前实现**:
```python
# 使用IN子句批量查询
links = self.db.execute("""
    SELECT source_pk, target_pk
    FROM entity_links
    WHERE source_entity_type = ?
      AND relationship_type = 'same_as'
      AND (source_pk IN ({pks}) OR target_pk IN ({pks}))
""", [entity_type] + pks + pks)
```

**潜在问题**:
- 当pks数量很大时(如>1000)，IN子句性能下降
- SQLite对大数据量IN查询优化有限

**建议**:
```python
def _group_by_hard_links_optimized(self, results: List[dict], entity_type: str) -> List[List[dict]]:
    """优化的硬链接去重"""
    pks = [r['pk'] for r in results]
    
    # 分批查询避免超大IN子句
    BATCH_SIZE = 500
    all_links = []
    
    for i in range(0, len(pks), BATCH_SIZE):
        batch = pks[i:i + BATCH_SIZE]
        links = self._query_links_batch(entity_type, batch)
        all_links.extend(links)
    
    # Union-Find合并
    uf = UnionFind(pks)
    for link in all_links:
        uf.union(link['source_pk'], link['target_pk'])
    
    return self._group_by_root(results, uf)
```

#### 瓶颈2: Union-Find内存使用

**当结果集很大时(如10K+记录)**:
- Union-Find数组需要10K+元素
- 内存占用约 10K × 8 bytes × 2 (parent + rank) = 160KB，可接受
- 时间复杂度 O(n × α(n)) ≈ O(n)，良好

#### 瓶颈3: 多源证据聚合的排序开销

```python
# 当前: 每记录排序
sorted_group = sorted(
    group,
    key=lambda r: self.SOURCE_QUALITY_RANKING.get(r.get('source_database', ''), 99)
)

# 优化: 预计算排序键
RANKING_MAP = {db: i for i, db in enumerate(SOURCE_QUALITY_RANKING.keys())}
sorted_group = sorted(group, key=lambda r: RANKING_MAP.get(r.get('source_database'), 99))
```

### 5.3 性能预估验证

文档给出的性能数据:

| 场景 | 原始结果数 | 融合后 | 预估耗时 | 评估 |
|------|----------|--------|---------|------|
| 肝癌查询 | ~500 | ~180 | <200ms | ✅ 合理 |
| 全脑查询 | ~3000 | ~1200 | <500ms | ✅ 合理 |
| 全库统计 | 756K | N/A | <2s | ⚠️ 可能偏高 |

**全库统计2s评估**:
- 756K记录的全表扫描在SQLite中可能需要1-3s
- 如果带复杂GROUP BY，可能超过5s
- **建议**: 全库统计使用**预计算汇总表**

```sql
-- 建议增加预计算汇总表
CREATE TABLE stats_summary (
    stat_name TEXT PRIMARY KEY,
    stat_value INTEGER,
    last_updated TIMESTAMP
);

-- 定时更新
INSERT OR REPLACE INTO stats_summary 
SELECT 'total_samples', COUNT(*), datetime('now') FROM unified_samples;
```

---

## 6. 水平扩展可能性审核

### 6.1 当前架构状态评估

```
┌─────────────────────────────────────────────────────────────────┐
│                     当前架构状态                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Web层: FastAPI (可水平扩展) ✅                                  │
│       └── 无状态设计，支持多实例                                  │
│                                                                 │
│  Agent层: 内存状态 (扩展障碍) ❌                                  │
│       └── Working Memory存储在进程内存                            │
│       └── Session状态未外部化                                     │
│                                                                 │
│  数据层: SQLite (单点) ❌                                        │
│       └── 文件级数据库，无法分布式访问                              │
│                                                                 │
│  缓存层: 进程内 (扩展障碍) ❌                                     │
│       └── 无分布式缓存                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 扩展路径建议

#### Phase 1: 状态外部化 (当前→MVP后)

```python
# 将会话状态外部化到Redis

class ExternalizedMemory:
    """
    外部化记忆系统
    支持: 多实例共享会话、故障恢复、水平扩展
    """
    
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        
    def load_session_context(self, session_id: str) -> SessionContext:
        """从Redis加载会话上下文"""
        data = self.redis.get(f"session:{session_id}")
        if data:
            return SessionContext.deserialize(data)
        return SessionContext.new(session_id)
    
    def save_interaction(self, session_id: str, user_input: str, response: AgentResponse):
        """保存到Redis，设置TTL"""
        key = f"session:{session_id}"
        self.redis.setex(key, ttl=3600*24, value=response.serialize())  # 24h TTL
```

#### Phase 2: 数据库迁移 (生产环境)

```yaml
migration_to_postgresql:
  step_1_dal_abstraction:
    status: "设计中"  # 已有DAL层，迁移成本低
    effort: "1-2天"
    
  step_2_read_replica:
    description: "主库写 + 从库读"
    effort: "2-3天"
    benefit: "读QPS提升3-5x"
    
  step_3_sharding_consideration:
    description: "按source_database分片"
    complexity: "高"
    when: "单库数据量>10M记录"
    note: "当前756K，暂不需要"
```

#### Phase 3: 分布式架构 (长期)

```
┌─────────────────────────────────────────────────────────────────┐
│                    目标分布式架构                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐ │
│  │   FastAPI #1    │    │   FastAPI #2    │    │  FastAPI #N │ │
│  │  (Load Balancer)│◄──►│                 │◄──►│             │ │
│  └────────┬────────┘    └────────┬────────┘    └──────┬──────┘ │
│           │                      │                     │       │
│           └──────────────────────┼─────────────────────┘       │
│                                  │                             │
│                           ┌──────▼──────┐                      │
│                           │    Redis    │                      │
│                           │  (Session)  │                      │
│                           └──────┬──────┘                      │
│                                  │                             │
│                           ┌──────▼──────┐                      │
│                           │ PostgreSQL  │                      │
│                           │  Primary    │                      │
│                           └──────┬──────┘                      │
│                                  │                             │
│                           ┌──────▼──────┐                      │
│                           │  Read Replica │                    │
│                           └─────────────┘                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 扩展性建议总结

| 阶段 | 目标并发 | 关键动作 | 时间线 |
|------|---------|---------|--------|
| 当前 | <50 | SQLite单实例，进程内状态 | MVP阶段 |
| Phase 1 | 50-200 | Redis外部化会话，SQLite→PG | MVP后1-2月 |
| Phase 2 | 200-1000 | PG主从 + 读副本 | 生产部署时 |
| Phase 3 | 1000+ | 分片/分布式 (按需) | 数据增长后 |

---

## 7. 大数据量查询优化审核

### 7.1 当前优化策略评估

| 策略 | 实施状态 | 效果评估 | 建议 |
|------|---------|---------|------|
| 视图优先 | 已设计 | ✅ 减少JOIN复杂度 | 验证视图性能 |
| 3候选并行 | 设计中 | ⚠️ 当前串行，需改并行 | 高优先级 |
| LIMIT默认20 | 已设计 | ✅ 防止全表返回 | 保持 |
| entity_links索引 | 已提及 | ✅ O(1)查找 | 验证索引覆盖 |
| identity_hash索引 | 已提及 | ✅ 快速匹配 | 验证索引覆盖 |

### 7.2 缺少的优化策略

#### 建议1: 查询结果预聚合

```sql
-- 预计算高频统计查询
CREATE TABLE precomputed_stats AS
SELECT 
    source_database,
    tissue,
    disease,
    assay,
    COUNT(*) as sample_count,
    SUM(n_cells) as total_cells
FROM v_sample_with_hierarchy
GROUP BY source_database, tissue, disease, assay;

CREATE INDEX idx_precomp_tissue ON precomputed_stats(tissue);
CREATE INDEX idx_precomp_disease ON precomputed_stats(disease);

-- 查询时直接查预聚合表，而非原始表
```

#### 建议2: 物化视图 (PostgreSQL迁移后)

```sql
-- PostgreSQL支持物化视图
CREATE MATERIALIZED VIEW mv_sample_summary AS
SELECT 
    project_pk,
    COUNT(*) as sample_count,
    STRING_AGG(DISTINCT tissue, ', ') as tissues,
    STRING_AGG(DISTINCT disease, ', ') as diseases
FROM unified_samples
GROUP BY project_pk;

CREATE INDEX idx_mv_project ON mv_sample_summary(project_pk);

-- 定时刷新
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sample_summary;
```

#### 建议3: 查询计划缓存

```python
class QueryPlanCache:
    """
    缓存SQL查询计划，避免重复优化
    """
    
    def get_execution_plan(self, sql: str) -> QueryPlan:
        """获取或生成查询计划"""
        plan_hash = hash(sql)
        
        # 检查缓存
        cached = self.cache.get(plan_hash)
        if cached and not self._schema_changed(cached["created_at"]):
            return cached["plan"]
        
        # 生成新计划
        plan = self.db.execute(f"EXPLAIN QUERY PLAN {sql}").fetchall()
        self.cache[plan_hash] = {"plan": plan, "created_at": time.time()}
        return plan
    
    def _schema_changed(self, cached_time: float) -> bool:
        """检查schema是否自缓存以来发生变化"""
        last_alter = self.db.execute(
            "SELECT MAX(last_analyzed) FROM table_knowledge"
        ).fetchone()[0]
        return last_alter > cached_time
```

### 7.3 大数据查询性能预估

基于756K样本，预估各类查询性能:

| 查询类型 | 预估延迟 | 优化建议 |
|---------|---------|---------|
| 主键查询 | 1-5ms | 已有索引，良好 |
| 单字段过滤(tissue) | 50-200ms | 确保索引覆盖 |
| 多字段AND | 100-500ms | 考虑复合索引 |
| 多字段OR | 500ms-2s | 改写为UNION |
| GROUP BY统计 | 500ms-3s | 使用预聚合表 |
| 全文搜索(LIKE) | 1-5s | 迁移PG后用tsvector |
| 跨表JOIN(3表) | 200ms-1s | 使用视图 |
| 跨库融合后聚合 | 500ms-2s | 先过滤再融合 |

---

## 8. 与生产环境PostgreSQL对比审核

### 8.1 功能对比

| 特性 | SQLite | PostgreSQL | 影响评估 |
|------|--------|-----------|---------|
| 全文搜索 | FTS5 (有限) | tsvector + tsquery | ⚠️ PG更强 |
| JSON操作 | JSON文本 | JSONB二进制 | ✅ PG更优 |
| 模糊匹配 | LIKE% | pg_trgm | ⚠️ PG更强 |
| 并发写入 | 单写锁 | MVCC | ❌ PG显著优势 |
| 水平扩展 | 不支持 | 主从+分片 | ❌ PG显著优势 |
| 备份恢复 | 文件复制 | pg_dump/WAL | ✅ PG更专业 |
| 监控运维 | 有限 | pg_stat + 生态 | ✅ PG更完善 |
| 部署复杂度 | 零配置 | 需要运维 | ✅ SQLite更简单 |

### 8.2 性能对比 (预估)

基于756K样本数据量:

| 场景 | SQLite | PostgreSQL | 提升倍数 |
|------|--------|-----------|---------|
| 单用户简单查询 | 20ms | 15ms | 1.3x |
| 单用户复杂JOIN | 200ms | 100ms | 2x |
| 10并发读 | 100ms | 50ms | 2x |
| 50并发读 | 500ms | 100ms | 5x |
| 写入+读混合 | 800ms | 150ms | 5x |
| 全文搜索 | 3000ms | 100ms | 30x |

### 8.3 迁移成本评估

**DAL层已设计为数据库无关，迁移成本较低**:

```
迁移工作量预估:
├── DAL层适配: 1-2天 (连接字符串、方言差异)
├── Schema迁移: 1天 (DDL转换)
├── SQL兼容性: 1-2天 (函数差异、语法调整)
├── 性能调优: 2-3天 (索引优化、配置调整)
├── 数据迁移: 1-2天 (导出导入、验证)
└── 测试验证: 2-3天

总计: 10-15人天
```

**关键兼容性问题**:

| SQLite | PostgreSQL | 处理策略 |
|--------|-----------|---------|
| `AUTOINCREMENT` | `SERIAL` / `BIGSERIAL` | DAL层自动转换 |
| `datetime('now')` | `NOW()` | DAL层函数映射 |
| `GROUP_CONCAT` | `STRING_AGG` | DAL层函数映射 |
| `LIMIT n OFFSET m` | `LIMIT n OFFSET m` | 兼容，无需修改 |
| `PRAGMA` | `SET/SHOW` | 移除或条件编译 |
| `?` 占位符 | `$1, $2...` | SQLAlchemy处理 |

### 8.4 迁移建议

```yaml
migration_timeline:
  phase_0_current:
    database: SQLite
    purpose: 原型开发与MVP验证
    max_concurrent_users: 50
    
  phase_1_evaluation:
    trigger: "MVP完成且用户反馈积极"
    action: "PostgreSQL性能基准测试"
    duration: "1周"
    
  phase_2_staging:
    database: PostgreSQL
    setup: "单实例，同步复制"
    purpose: "生产环境预演"
    duration: "2-4周验证期"
    
  phase_3_production:
    database: PostgreSQL
    setup: "主从+读副本+连接池(PgBouncer)"
    max_concurrent_users: 1000+
    backup_strategy: "每日全量+WAL归档"
```

---

## 9. 综合建议与行动项

### 9.1 高优先级 (P1) - 必须在MVP前解决

| # | 建议 | 影响 | 预估工作量 |
|---|------|------|-----------|
| 1 | **3候选SQL并行执行** | 复杂查询延迟降低50%+ | 2天 |
| 2 | **SQL结果缓存层** | 整体命中率提升至60% | 2天 |
| 3 | **响应时间目标调整** | 避免交付时的性能不符预期 | 文档更新 |
| 4 | **SQLite连接池管理** | 避免并发时的锁定错误 | 1天 |

### 9.2 中优先级 (P2) - MVP后尽快实施

| # | 建议 | 影响 | 预估工作量 |
|---|------|------|-----------|
| 5 | **LLM成本上限保护** | 防止成本失控 | 1天 |
| 6 | **会话状态外部化(Redis)** | 支持水平扩展 | 3天 |
| 7 | **Working Memory会话隔离** | 多用户场景命中率提升 | 1天 |
| 8 | **预计算统计表** | 全库统计查询<100ms | 2天 |

### 9.3 低优先级 (P3) - 生产环境准备

| # | 建议 | 影响 | 时机 |
|---|------|------|------|
| 9 | PostgreSQL迁移 | 支持1000+并发 | 生产部署前 |
| 10 | 读副本配置 | 读QPS提升5x | PG迁移后 |
| 11 | 全文搜索优化 (tsvector) | 文本查询<100ms | PG迁移后 |
| 12 | 分布式缓存 (Redis Cluster) | 水平扩展至多实例 | 需要时 |

### 9.4 监控指标建议

建议实施以下性能监控:

```yaml
metrics_to_track:
  latency_percentiles:
    - p50, p95, p99 for each query type
    
  cache_performance:
    - working_memory_hit_rate
    - ontology_cache_hit_rate
    - query_result_cache_hit_rate
    
  llm_usage:
    - calls_per_query_avg
    - tokens_per_query_avg
    - cost_per_query_avg
    - daily_spend
    
  database:
    - query_execution_time
    - active_connections
    - lock_wait_time
    - cache_hit_ratio (PG)
    
  business:
    - queries_per_minute
    - concurrent_users
    - error_rate
```

---

## 10. 总结

### 10.1 总体评估

| 维度 | 评分 | 说明 |
|------|------|------|
| 架构合理性 | ⭐⭐⭐⭐☆ | 整体设计思路正确，模块化良好 |
| 性能目标可行性 | ⭐⭐⭐☆☆ | 部分目标偏乐观，需要调整 |
| 成本控制 | ⭐⭐⭐⭐☆ | 规则优先策略合理，需增加上限保护 |
| 扩展性准备 | ⭐⭐⭐☆☆ | DAL层设计良好，但状态外部化待实施 |
| 生产就绪度 | ⭐⭐☆☆☆ | SQLite不适合高并发生产环境 |

### 10.2 关键结论

1. **SQLite仅适合MVP阶段**: 当前设计使用SQLite，但并发超过50用户时性能将急剧下降。建议在MVP验证后尽快规划PostgreSQL迁移。

2. **响应时间目标需要调整**: 当前设定的<500ms复杂查询和<1s答案合成目标偏乐观，建议按照本报告建议的目标调整。

3. **缓存策略需要增强**: 当前50条Working Memory容量偏小，建议增加SQL结果缓存层和LLM响应缓存。

4. **3候选SQL应并行执行**: 串行执行策略可能导致复杂查询延迟超标，建议改为并行执行+快速失败机制。

5. **LLM成本控制良好但需上限保护**: 规则优先策略能将70%查询转为规则处理，但需增加日预算上限和降级策略。

### 10.3 推荐实施路径

```
MVP阶段 (当前-4周)
├── 按当前设计开发，使用SQLite
├── 实施P1优先级优化项
└── 完成5个核心场景验证

评估阶段 (MVP后1-2周)
├── 负载测试确定SQLite极限
├── PostgreSQL原型验证
└── 决定是否迁移

生产准备阶段 (评估后2-4周)
├── PostgreSQL迁移
├── Redis会话外部化
└── 性能调优
```

---

*报告完成*

**审核人**: 系统性能架构师  
**审核日期**: 2026-03-06  
**版本**: v1.0
