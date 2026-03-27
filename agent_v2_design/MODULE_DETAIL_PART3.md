# 核心模块详细设计 - Part 3: 答案合成、记忆系统、数据库抽象层

> 本文件是 ARCHITECTURE.md 第4章4.6-4.7 + 第5章的详细展开

---

## 4.6 Answer Synthesis Module（答案合成模块）

### 4.6.1 核心设计理念

答案合成是用户体验的关键。采用**TAG (Table-Augmented Generation)** 范式：
- 不只返回SQL结果表格，而是生成自然语言摘要 + 结构化数据 + 行动建议
- 借鉴TAG论文 (UC Berkeley/Stanford, CIDR 2025)：LLM在结构化查询结果上进行推理

### 4.6.2 输出结构

```python
@dataclass
class AgentResponse:
    """Agent最终输出"""
    # 自然语言摘要
    summary: str                    # "找到47个肝癌单细胞数据集，覆盖3个数据库..."

    # 结构化结果
    results: List[FusedRecord]      # 融合后的结果列表
    total_count: int
    displayed_count: int

    # 数据血缘
    provenance: ProvenanceInfo      # 查询路径、数据来源、使用的策略

    # 数据质量透明化
    quality_report: QualityReport   # 字段完整性、跨库一致性

    # 建议操作
    suggestions: List[Suggestion]   # 后续探索建议

    # 可视化数据 (供前端渲染)
    charts: List[ChartSpec]         # 分布图、统计图

    # 元信息
    query_info: QueryMetaInfo       # 原始查询、解析过程、执行时间


@dataclass
class ProvenanceInfo:
    """数据血缘信息"""
    original_query: str
    parsed_intent: str
    ontology_expansions: List[dict]   # 本体扩展记录
    sql_executed: str                 # 实际执行的SQL
    sql_method: str                   # 'template' | 'rule' | 'llm'
    strategy_level: str               # 'EXACT' | 'STANDARD' | 'FUZZY' | 'SEMANTIC'
    fusion_stats: dict                # 去重统计
    data_sources: List[str]           # 涉及的数据源
    execution_time_ms: float


@dataclass
class Suggestion:
    """后续操作建议"""
    type: str           # 'refine' | 'expand' | 'compare' | 'download' | 'related'
    text: str           # 用户可读的建议文本
    action_query: str   # 点击后触发的查询
    reason: str         # 为什么建议这个
```

### 4.6.3 摘要生成策略

```python
class AnswerSynthesizer:
    """答案合成器"""

    async def synthesize(
        self,
        query: ParsedQuery,
        results: List[FusedRecord],
        provenance: ProvenanceInfo
    ) -> AgentResponse:

        # 1. 生成自然语言摘要
        summary = await self._generate_summary(query, results, provenance)

        # 2. 生成质量报告
        quality = self._assess_result_quality(results)

        # 3. 生成建议
        suggestions = self._generate_suggestions(query, results)

        # 4. 生成可视化规格
        charts = self._generate_chart_specs(query, results)

        return AgentResponse(
            summary=summary,
            results=results[:query.limit],
            total_count=len(results),
            displayed_count=min(len(results), query.limit),
            provenance=provenance,
            quality_report=quality,
            suggestions=suggestions,
            charts=charts,
            query_info=QueryMetaInfo(
                original=query.original_text,
                parse_method=query.parse_method,
                confidence=query.confidence,
            ),
        )

    async def _generate_summary(self, query, results, provenance) -> str:
        """
        摘要生成策略:
        - 结果<5条: 模板化摘要 (不调LLM)
        - 结果5-50条: 简短统计摘要
        - 结果>50条: LLM生成分析性摘要
        """
        if len(results) == 0:
            return self._zero_result_summary(query, provenance)

        if len(results) <= 5:
            return self._template_summary(query, results)

        if len(results) <= 50:
            return self._statistical_summary(query, results)

        # 大结果集：LLM生成分析
        return await self._llm_summary(query, results, provenance)

    def _generate_suggestions(self, query, results) -> List[Suggestion]:
        """
        基于查询结果生成智能建议
        """
        suggestions = []

        # 1. 如果结果太多，建议细化
        if len(results) > 100:
            # 分析最常见的未用过的维度
            unused_dims = self._find_unused_dimensions(query)
            if unused_dims:
                dim = unused_dims[0]
                top_values = self._get_top_values(results, dim)
                suggestions.append(Suggestion(
                    type='refine',
                    text=f'结果较多({len(results)}条)，可以按{dim}细化，'
                         f'常见值: {", ".join(top_values[:3])}',
                    action_query=f'{query.original_text} {dim}={top_values[0]}',
                    reason=f'{dim}维度未在当前查询中使用'
                ))

        # 2. 如果结果有CellXGene来源，建议下载
        has_downloadable = any(
            r.data.get('has_h5ad') or r.data.get('access_url')
            for r in results[:20]
        )
        if has_downloadable:
            suggestions.append(Suggestion(
                type='download',
                text='部分结果有可直接下载的h5ad/rds文件',
                action_query=f'download {query.original_text}',
                reason='检测到可下载数据'
            ))

        # 3. 建议相关探索
        if query.filters.tissues and not query.filters.diseases:
            suggestions.append(Suggestion(
                type='expand',
                text=f'查看{query.filters.tissues[0]}相关的疾病分布？',
                action_query=f'统计 {query.filters.tissues[0]} 的疾病分布',
                reason='已指定tissue但未指定disease'
            ))

        # 4. 建议跨库比较
        if len(set(r.sources[0] for r in results[:20] if r.sources)) > 1:
            suggestions.append(Suggestion(
                type='compare',
                text='结果来自多个数据库，是否比较各库覆盖差异？',
                action_query=f'比较各数据库 {query.original_text}',
                reason='结果跨多个数据源'
            ))

        return suggestions[:4]  # 最多4条建议

    def _generate_chart_specs(self, query, results) -> List[ChartSpec]:
        """生成可视化规格 (供前端渲染)"""
        charts = []

        if query.intent == QueryIntent.STATISTICS:
            # 统计查询直接生成柱状图/饼图
            charts.append(ChartSpec(
                type='bar',
                title=f'{query.aggregation.group_by[0]} 分布',
                data=self._aggregate_for_chart(results, query.aggregation),
            ))
        else:
            # 搜索结果：自动生成来源分布
            source_dist = {}
            for r in results:
                for s in r.sources:
                    source_dist[s] = source_dist.get(s, 0) + 1
            if len(source_dist) > 1:
                charts.append(ChartSpec(
                    type='pie',
                    title='数据来源分布',
                    data=source_dist,
                ))

        return charts
```

---

## 4.7 Memory & Learning System（记忆与学习系统）

### 4.7.1 三层记忆架构（升级版）

继承V1的三层设计，但针对多表schema进行了关键升级：

```
┌─────────────────────────────────────────────────────────────┐
│                   MEMORY SYSTEM                             │
│                                                             │
│  Layer 1: Working Memory (进程内, 会话级)                     │
│  ┌───────────────────────────────────────────────────┐      │
│  │ - 当前会话上下文 (用户查询链)                        │      │
│  │ - 最近查询结果缓存 (LRU, 最多50条)                  │      │
│  │ - 对话状态 (多轮上下文)                             │      │
│  │ - 本次会话的本体解析缓存                            │      │
│  │ 生命周期: 会话结束即销毁                             │      │
│  └───────────────────────────────────────────────────┘      │
│                                                             │
│  Layer 2: Episodic Memory (SQLite, 用户级)                   │
│  ┌───────────────────────────────────────────────────┐      │
│  │ - 用户画像 (研究领域, 偏好的组织/疾病)               │      │
│  │ - 查询历史 (含成功/失败标记)                        │      │
│  │ - 常用查询模式 (自动识别)                           │      │
│  │ - 反馈记录 (用户对结果的评价)                       │      │
│  │ 生命周期: 持久化, 按用户隔离                        │      │
│  └───────────────────────────────────────────────────┘      │
│                                                             │
│  Layer 3: Semantic Memory (SQLite, 系统级)                   │
│  ┌───────────────────────────────────────────────────┐      │
│  │ - Schema知识: 表结构 + 字段统计 + 样本值             │      │
│  │ - 查询模板库: 成功的查询 → 可复用模板                │      │
│  │ - 本体知识: 术语映射缓存 + 层级关系                  │      │
│  │ - 字段值索引: 高频值 + 同义词映射                    │      │
│  │ 生命周期: 持久化, 全局共享                          │      │
│  └───────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 4.7.2 Schema知识库（V2核心升级）

```python
class SchemaKnowledgeBase:
    """
    V2升级: 多表感知的Schema知识库

    V1 → V2 关键变化:
    - field_name → (table_name, field_name) 二元组
    - 新增 JOIN路径知识
    - 新增 跨表字段关联知识
    """

    SCHEMA = """
    -- 表级知识
    CREATE TABLE table_knowledge (
        table_name TEXT PRIMARY KEY,
        record_count INTEGER,
        description TEXT,
        primary_key TEXT,
        is_view INTEGER DEFAULT 0,
        last_analyzed TEXT
    );

    -- 字段级知识 (V2: 含表上下文)
    CREATE TABLE field_knowledge (
        table_name TEXT NOT NULL,
        field_name TEXT NOT NULL,
        field_type TEXT,
        semantic_type TEXT,        -- 'tissue', 'disease', 'id', 'metric', ...
        null_count INTEGER,
        null_pct REAL,
        unique_count INTEGER,
        top_values_json TEXT,      -- JSON: [{"value": "brain", "count": 25432}, ...]
        last_analyzed TEXT,
        PRIMARY KEY (table_name, field_name)
    );

    -- JOIN路径知识
    CREATE TABLE join_knowledge (
        from_table TEXT NOT NULL,
        to_table TEXT NOT NULL,
        join_type TEXT,            -- 'LEFT JOIN', 'INNER JOIN'
        join_condition TEXT,       -- e.g., 'samples.project_pk = projects.pk'
        cardinality TEXT,          -- 'one-to-many', 'many-to-one'
        avg_records_per_parent REAL,
        PRIMARY KEY (from_table, to_table)
    );

    -- 语义字段映射 (概念 → 多个字段)
    CREATE TABLE semantic_field_map (
        concept TEXT NOT NULL,     -- 'tissue', 'disease', 'cell_type', ...
        table_name TEXT NOT NULL,
        field_name TEXT NOT NULL,
        priority INTEGER,          -- 1=首选, 2=备选
        note TEXT,
        PRIMARY KEY (concept, table_name, field_name)
    );

    -- 查询模板
    CREATE TABLE query_templates (
        template_id TEXT PRIMARY KEY,
        intent TEXT,
        pattern TEXT,              -- 正则模式
        sql_template TEXT,
        success_count INTEGER DEFAULT 0,
        avg_exec_time_ms REAL,
        last_used TEXT
    );
    """

    def analyze_schema(self, db_path: str):
        """
        自动分析数据库schema，填充知识库
        """
        conn = sqlite3.connect(db_path)

        # 1. 分析每张表
        tables = self._get_all_tables(conn)
        for table in tables:
            record_count = conn.execute(
                f"SELECT COUNT(*) FROM {table}"
            ).fetchone()[0]

            self.store.execute(
                "INSERT OR REPLACE INTO table_knowledge VALUES (?,?,?,?,?,?)",
                (table, record_count, '', 'pk', 0, datetime.now().isoformat())
            )

        # 2. 分析每个字段
        for table in tables:
            columns = self._get_columns(conn, table)
            for col in columns:
                stats = self._analyze_column(conn, table, col)
                self.store.execute(
                    "INSERT OR REPLACE INTO field_knowledge VALUES (?,?,?,?,?,?,?,?,?)",
                    (table, col, stats['type'], stats['semantic_type'],
                     stats['null_count'], stats['null_pct'],
                     stats['unique_count'], json.dumps(stats['top_values']),
                     datetime.now().isoformat())
                )

        # 3. 填充语义映射
        self._build_semantic_map()

        # 4. 填充JOIN知识
        self._build_join_knowledge(conn)

    def get_field_context(self, concept: str) -> List[FieldContext]:
        """
        根据语义概念获取所有相关字段及其上下文

        示例:
        concept='disease' → [
            FieldContext(table='unified_samples', field='disease',
                         priority=1, null_pct=0.45, top_values=[...]),
            FieldContext(table='unified_projects', field='description',
                         priority=3, null_pct=0.1, note='可能在标题/描述中提及'),
        ]
        """
        rows = self.store.execute("""
            SELECT sm.table_name, sm.field_name, sm.priority, sm.note,
                   fk.null_pct, fk.unique_count, fk.top_values_json
            FROM semantic_field_map sm
            JOIN field_knowledge fk
                ON sm.table_name = fk.table_name AND sm.field_name = fk.field_name
            WHERE sm.concept = ?
            ORDER BY sm.priority
        """, (concept,)).fetchall()

        return [FieldContext(**dict(r)) for r in rows]
```

### 4.7.3 多轮对话上下文管理

```python
class ConversationManager:
    """
    多轮对话管理
    支持: 追问、细化、切换话题、回溯
    """

    def track_turn(self, session_id: str, user_input: str,
                   parsed_query: ParsedQuery, results: List[FusedRecord]):
        """记录一轮对话"""
        session = self.sessions[session_id]
        session.turns.append(ConversationTurn(
            user_input=user_input,
            parsed=parsed_query,
            result_count=len(results),
            timestamp=time.time(),
        ))

    def get_refinement_context(self, session_id: str) -> Optional[RefinementContext]:
        """
        判断当前查询是否是对上一轮的细化

        规则:
        - "这些中哪些是10x的" → 细化上一轮结果
        - "改为搜索kidney" → 修改上一轮条件
        - "另外还有哪些brain的" → 新查询，但相关
        """
        session = self.sessions.get(session_id)
        if not session or not session.turns:
            return None

        last_turn = session.turns[-1]

        # 如果距上一轮超过5分钟，视为新话题
        if time.time() - last_turn.timestamp > 300:
            return None

        return RefinementContext(
            previous_query=last_turn.parsed,
            previous_filters=last_turn.parsed.filters,
            previous_result_count=last_turn.result_count,
        )
```

---

## 5. 数据库抽象层设计

### 5.1 设计目标

数据库抽象层实现 **Agent代码与底层数据库实现的解耦**：
- 当前使用SQLite开发，未来迁移PostgreSQL无需改Agent代码
- 新增数据源只需要新增ETL模块，Agent自动适应
- Schema字段变化通过schema introspection自动感知

### 5.2 架构

```python
class DatabaseAbstractionLayer:
    """
    数据库抽象层 (DAL)
    提供统一的数据访问接口，屏蔽底层细节
    """

    def __init__(self, db_url: str):
        """
        支持:
        - sqlite:///path/to/unified_metadata.db
        - postgresql://user:pass@host/dbname
        """
        self.engine = self._create_engine(db_url)
        self.schema_inspector = SchemaInspector(self.engine)

    # ============= 高级查询接口 =============

    def search_samples(
        self,
        filters: QueryFilters,
        fields: List[str] = None,
        order_by: str = 'pk',
        limit: int = 20,
        offset: int = 0,
        use_view: bool = True
    ) -> QueryResult:
        """
        搜索样本 - 最常用的查询入口

        自动选择:
        - use_view=True → 使用 v_sample_with_hierarchy (含project+series信息)
        - use_view=False → 直接查询 unified_samples (更快，字段更少)
        """
        pass

    def search_projects(
        self,
        filters: QueryFilters,
        fields: List[str] = None,
        limit: int = 20
    ) -> QueryResult:
        """搜索项目"""
        pass

    def get_entity_by_id(
        self,
        id_value: str,
        id_type: str = 'auto'
    ) -> Optional[dict]:
        """
        根据ID获取实体 (自动识别ID类型)

        支持: GSE*, GSM*, PRJNA*, SRP*, SAMN*, DOI, PMID
        自动查询 id_mappings 表进行跨库ID解析
        """
        pass

    def get_cross_db_links(
        self,
        entity_pk: int,
        entity_type: str
    ) -> List[dict]:
        """获取跨库关联"""
        pass

    def get_field_statistics(
        self,
        table: str,
        field: str,
        top_n: int = 20,
        where: str = None
    ) -> FieldStats:
        """获取字段统计信息"""
        pass

    def get_cell_types_for_sample(self, sample_pk: int) -> List[dict]:
        """获取样本的细胞类型注释"""
        pass

    def execute_raw_sql(self, sql: str, params: list = None) -> QueryResult:
        """执行原始SQL (由SQL Generator生成)"""
        pass

    # ============= Schema Introspection =============

    def get_schema_summary(self) -> dict:
        """
        返回schema摘要 (用于System Prompt注入)

        返回格式:
        {
            'tables': {
                'unified_projects': {
                    'record_count': 23123,
                    'fields': ['pk', 'project_id', 'title', ...],
                    'key_stats': {'organism': {'Homo sapiens': 23123}}
                },
                ...
            },
            'views': ['v_sample_with_hierarchy'],
            'total_samples': 756579,
            'total_projects': 23123,
            'source_databases': ['cellxgene', 'geo', 'ncbi', ...]
        }
        """
        pass

    def get_distinct_values(self, table: str, field: str,
                            top_n: int = 50) -> List[Tuple[str, int]]:
        """获取字段的distinct值及其计数"""
        pass


class SchemaInspector:
    """
    动态Schema发现

    解决的问题: 当数据库schema变化时(新增字段/表)，Agent自动适应
    """

    def inspect(self) -> SchemaInfo:
        """
        完整schema分析，结果缓存到内存

        包括:
        - 所有表的列定义
        - 外键关系
        - 索引信息
        - 视图定义
        """
        pass

    def detect_schema_changes(self, cached_schema: SchemaInfo) -> List[SchemaChange]:
        """
        检测schema变化 (用于增量更新)

        返回:
        - 新增的表/字段
        - 删除的表/字段
        - 类型变化
        """
        pass

    def get_ddl_summary(self) -> str:
        """
        生成精简的DDL摘要 (用于注入LLM prompt)
        只包含表名、关键字段、外键关系
        不包含索引、默认值等细节
        """
        pass
```

### 5.3 查询结果标准格式

```python
@dataclass
class QueryResult:
    """统一查询结果"""
    rows: List[dict]              # 结果行
    columns: List[str]            # 列名
    total_count: int              # 总匹配数 (不含LIMIT)
    returned_count: int           # 返回行数
    execution_time_ms: float      # 执行耗时
    sql: str                      # 实际执行的SQL
    source: str                   # 'view' | 'table' | 'raw'
```

### 5.4 SQLite → PostgreSQL 迁移策略

```
阶段1 (当前): SQLite开发
  - 单文件部署，零配置
  - WAL模式支持并发读
  - 适合原型开发和小规模部署

阶段2 (生产): PostgreSQL迁移
  - 需要变更:
    * AUTOINCREMENT → SERIAL
    * datetime('now') → NOW()
    * GROUP_CONCAT → STRING_AGG
    * PRAGMA → postgresql.conf
  - 不需要变更:
    * 所有表结构
    * 所有查询逻辑 (通过DAL屏蔽)
    * Agent代码
  - 新增能力:
    * 全文搜索 (tsvector) 替代 LIKE
    * JSONB操作替代 JSON文本
    * pg_trgm 模糊匹配
    * 真正的并发写入
```
