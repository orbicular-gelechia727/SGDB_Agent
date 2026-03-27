# 核心模块详细设计 - Part 2: SQL生成与执行、跨库融合引擎

> 本文件是 ARCHITECTURE.md 第4章的详细展开（模块4.4-4.5）

---

## 4.4 SQL Generation & Execution（SQL生成与执行引擎）

### 4.4.1 核心设计理念

SQL生成是Agent的关键能力。我们采用**3候选生成 + 执行验证**策略，
借鉴 CHASE-SQL 的多路径思想，但针对8表归一化schema进行了定制优化。

关键创新：
- **视图优先策略**：简单查询优先使用 `v_sample_with_hierarchy`，避免手写JOIN
- **JOIN路径推理**：复杂查询自动推导最优JOIN路径
- **渐进式降级**：精确→模糊→语义，与V1的4级策略理念一致

### 4.4.2 表关系图（SQL生成器的核心知识）

```
unified_projects (L1)
    │ pk
    ├──── unified_series (L2)        via series.project_pk = projects.pk
    │         │ pk
    │         └──── unified_samples (L3)   via samples.series_pk = series.pk
    │                   │ pk
    │                   └──── unified_celltypes (L4) via celltypes.sample_pk = samples.pk
    │
    └──── unified_samples (L3)       via samples.project_pk = projects.pk
              (直接关联，无需经过series)

entity_links                         跨库关联 (source_pk ↔ target_pk)
id_mappings                          外部ID映射 (entity_pk → id_value)
dedup_candidates                     去重候选 (entity_a_pk ↔ entity_b_pk)
```

### 4.4.3 JOIN路径推理器

```python
class JoinPathResolver:
    """
    根据查询涉及的字段，自动推导最优JOIN路径
    """

    # 字段所属表的映射 (从schema introspection自动构建)
    FIELD_TABLE_MAP = {
        # Project fields
        'project_id': 'unified_projects',
        'pmid': 'unified_projects',
        'doi': 'unified_projects',
        'citation_count': 'unified_projects',
        'journal': 'unified_projects',
        'project_title': 'unified_projects',  # alias

        # Series fields
        'series_id': 'unified_series',
        'assay': 'unified_series',
        'has_h5ad': 'unified_series',
        'has_rds': 'unified_series',
        'cell_count': 'unified_series',
        'gene_count': 'unified_series',

        # Sample fields (大部分查询涉及)
        'sample_id': 'unified_samples',
        'tissue': 'unified_samples',
        'disease': 'unified_samples',
        'cell_type': 'unified_samples',
        'sex': 'unified_samples',
        'age': 'unified_samples',
        'organism': 'unified_samples',
        'ethnicity': 'unified_samples',
        'development_stage': 'unified_samples',
        'n_cells': 'unified_samples',

        # Celltype fields
        'cell_type_name': 'unified_celltypes',
        'cell_type_ontology_term_id': 'unified_celltypes',
    }

    # JOIN规则
    JOIN_RULES = {
        ('unified_samples', 'unified_projects'): {
            'condition': 'samples.project_pk = projects.pk',
            'type': 'LEFT JOIN',  # 样本可能缺少project关联
        },
        ('unified_samples', 'unified_series'): {
            'condition': 'samples.series_pk = series.pk',
            'type': 'LEFT JOIN',
        },
        ('unified_series', 'unified_projects'): {
            'condition': 'series.project_pk = projects.pk',
            'type': 'LEFT JOIN',
        },
        ('unified_celltypes', 'unified_samples'): {
            'condition': 'celltypes.sample_pk = samples.pk',
            'type': 'INNER JOIN',  # celltype必有sample
        },
    }

    def resolve(self, needed_fields: List[str],
                target_table: str) -> JoinPlan:
        """
        输入: 查询涉及的字段列表 + 目标返回表
        输出: JoinPlan (FROM + JOIN子句)
        """
        needed_tables = {self.FIELD_TABLE_MAP.get(f, target_table)
                         for f in needed_fields}
        needed_tables.add(target_table)

        if len(needed_tables) == 1:
            return JoinPlan(base_table=target_table, joins=[])

        # 使用最短路径算法找到连接所有表的最优JOIN序列
        return self._find_optimal_joins(target_table, needed_tables)

    def _find_optimal_joins(self, base: str,
                            tables: Set[str]) -> JoinPlan:
        """
        策略优先级:
        1. 如果只涉及 samples + projects/series → 用 v_sample_with_hierarchy
        2. 否则构建显式JOIN链
        """
        # 检查是否可以用视图
        view_tables = {'unified_samples', 'unified_series', 'unified_projects'}
        if tables.issubset(view_tables) and base == 'unified_samples':
            return JoinPlan(
                base_table='v_sample_with_hierarchy',
                joins=[],
                use_view=True
            )

        # 构建显式JOIN
        joins = []
        connected = {base}
        remaining = tables - connected

        while remaining:
            for table in list(remaining):
                for connected_table in connected:
                    key = tuple(sorted([table, connected_table]))
                    if key in self.JOIN_RULES or (key[1], key[0]) in self.JOIN_RULES:
                        rule = self.JOIN_RULES.get(key) or self.JOIN_RULES.get((key[1], key[0]))
                        joins.append(JoinClause(
                            join_type=rule['type'],
                            table=table,
                            condition=rule['condition'],
                        ))
                        connected.add(table)
                        remaining.discard(table)
                        break

        return JoinPlan(base_table=base, joins=joins)
```

### 4.4.4 SQL候选生成器（3路径策略）

```python
class SQLGenerator:
    """
    3候选SQL生成 + 执行验证
    借鉴CHASE-SQL的多路径策略，但简化为3路径以平衡成本
    """

    async def generate_candidates(
        self,
        parsed_query: ParsedQuery,
        resolved_entities: List[ResolvedEntity],
        join_plan: JoinPlan
    ) -> List[SQLCandidate]:
        """生成3个SQL候选"""
        candidates = []

        # 路径1: 模板化生成 (最快，最可靠，覆盖常见查询)
        template_sql = self._generate_from_template(
            parsed_query, resolved_entities, join_plan
        )
        if template_sql:
            candidates.append(SQLCandidate(
                sql=template_sql, method='template', cost=0
            ))

        # 路径2: 规则构建 (灵活，处理组合条件)
        rule_sql = self._generate_from_rules(
            parsed_query, resolved_entities, join_plan
        )
        candidates.append(SQLCandidate(
            sql=rule_sql, method='rule', cost=0
        ))

        # 路径3: LLM生成 (最灵活，处理复杂/歧义查询)
        if parsed_query.complexity in (QueryComplexity.MODERATE, QueryComplexity.COMPLEX):
            llm_sql = await self._generate_from_llm(
                parsed_query, resolved_entities, join_plan
            )
            candidates.append(SQLCandidate(
                sql=llm_sql, method='llm', cost=1
            ))

        return candidates

    def _generate_from_template(
        self, query: ParsedQuery,
        entities: List[ResolvedEntity],
        plan: JoinPlan
    ) -> Optional[str]:
        """
        模板化SQL生成，覆盖最常见的查询模式
        """
        templates = {
            # 按条件搜索样本
            ('SEARCH', 'sample'): """
                SELECT {select_fields}
                FROM {from_clause}
                WHERE {where_conditions}
                ORDER BY {order_clause}
                LIMIT {limit}
            """,

            # 统计某个字段的分布
            ('STATISTICS', 'sample'): """
                SELECT {group_field}, COUNT(*) as count,
                       SUM(n_cells) as total_cells
                FROM {from_clause}
                WHERE {where_conditions}
                GROUP BY {group_field}
                ORDER BY count DESC
                LIMIT {limit}
            """,

            # 按ID查找
            ('SEARCH', 'by_id'): """
                SELECT {select_fields}
                FROM {from_clause}
                WHERE {id_field} = ?
            """,

            # 跨库查找关联
            ('LINEAGE', 'project'): """
                SELECT el.relationship_type,
                       p1.project_id as source_id, p1.source_database as source_db,
                       p1.title as source_title,
                       p2.project_id as target_id, p2.source_database as target_db,
                       p2.title as target_title
                FROM entity_links el
                JOIN unified_projects p1 ON el.source_pk = p1.pk
                JOIN unified_projects p2 ON el.target_pk = p2.pk
                WHERE {where_conditions}
            """,
        }

        key = (query.intent.name, query.target_level)
        template = templates.get(key)
        if not template:
            return None

        return self._fill_template(template, query, entities, plan)

    def _generate_from_rules(
        self, query: ParsedQuery,
        entities: List[ResolvedEntity],
        plan: JoinPlan
    ) -> str:
        """
        规则化SQL构建，处理任意条件组合
        """
        builder = SQLBuilder(plan)

        # SELECT
        builder.add_select_fields(
            self._determine_select_fields(query)
        )

        # WHERE条件
        for entity in entities:
            if not entity.db_values:
                continue

            field = self._entity_type_to_field(entity.original.entity_type)
            values = [v.raw_value for v in entity.db_values]

            if entity.original.negated:
                builder.add_condition_not_in(field, values)
            elif len(values) == 1:
                builder.add_condition_eq(field, values[0])
            else:
                builder.add_condition_in(field, values)

        # 额外过滤条件 (从ParsedQuery.filters)
        self._apply_filters(builder, query.filters)

        # GROUP BY / ORDER BY / LIMIT
        if query.aggregation:
            builder.add_group_by(query.aggregation.group_by)
            builder.add_aggregate(query.aggregation.metric)

        builder.add_order_by(
            query.ordering.field if query.ordering else 'pk',
            query.ordering.direction if query.ordering else 'ASC'
        )
        builder.add_limit(query.limit)

        return builder.build()

    LLM_SQL_PROMPT = """
    你是一个SQL专家，请根据以下信息生成精确的SQLite查询。

    ## 数据库Schema
    {schema_ddl}

    ## 可用视图
    v_sample_with_hierarchy: 预连接 samples + series + projects 的便捷视图
    字段包括: sample_pk, sample_id, sample_source, organism, tissue,
    disease, sex, age, n_cells, series_id, series_title, assay,
    project_id, project_title, pmid, doi, citation_count

    ## 用户意图
    {parsed_intent}

    ## 已解析的实体 (本体标准化后)
    {resolved_entities}

    ## 推荐的JOIN路径
    {join_plan}

    ## 要求
    1. 优先使用 v_sample_with_hierarchy 视图（如果涉及的字段都在其中）
    2. 使用参数化查询 (?) 防止注入
    3. 始终加 LIMIT (默认20)
    4. 对于文本匹配，考虑大小写不敏感 (LOWER() 或 COLLATE NOCASE)
    5. 如果涉及多个数据库来源的比较，用 source_database 进行分组

    请仅返回SQL语句，不要解释。
    """

    async def _generate_from_llm(
        self, query: ParsedQuery,
        entities: List[ResolvedEntity],
        plan: JoinPlan
    ) -> str:
        """LLM生成SQL"""
        prompt = self.LLM_SQL_PROMPT.format(
            schema_ddl=self.schema_inspector.get_ddl_summary(),
            parsed_intent=query.to_dict(),
            resolved_entities=[e.to_dict() for e in entities],
            join_plan=plan.to_sql_hint(),
        )
        result = await self.llm.chat(prompt)
        return self._extract_sql(result)
```

### 4.4.5 SQL执行与验证

```python
class SQLExecutor:
    """
    SQL执行 + 结果验证 + 自动修复
    """

    async def execute_and_validate(
        self, candidates: List[SQLCandidate],
        expected_intent: QueryIntent
    ) -> ExecutionResult:
        """
        按优先级执行候选SQL，验证结果合理性
        """
        errors = []

        for candidate in candidates:
            try:
                # 1. 语法验证 (EXPLAIN)
                self._validate_syntax(candidate.sql)

                # 2. 执行
                rows, columns, exec_time = self._execute(candidate.sql, candidate.params)

                # 3. 结果合理性验证
                validation = self._validate_results(rows, columns, expected_intent)

                if validation.is_valid:
                    return ExecutionResult(
                        rows=rows,
                        columns=columns,
                        sql=candidate.sql,
                        method=candidate.method,
                        exec_time=exec_time,
                        row_count=len(rows),
                        validation=validation,
                    )
                else:
                    errors.append(f"{candidate.method}: {validation.issue}")

            except Exception as e:
                errors.append(f"{candidate.method}: {str(e)}")

        # 所有候选都失败 → 自动降级
        return await self._fallback_execution(candidates, errors)

    def _validate_results(self, rows, columns, intent) -> ValidationResult:
        """
        结果合理性验证:
        - 行数为0 → 可能需要放宽条件
        - 行数过多(>10000) → 可能缺少过滤条件
        - 关键列全为NULL → JOIN可能有误
        - 聚合结果与总数矛盾 → SQL逻辑有误
        """
        if len(rows) == 0:
            return ValidationResult(is_valid=False, issue='zero_results',
                                    suggestion='try_broader_query')

        if len(rows) > 10000 and intent != QueryIntent.STATISTICS:
            return ValidationResult(is_valid=False, issue='too_many_results',
                                    suggestion='add_filters')

        # 检查关键列是否全为NULL
        null_ratio = self._check_null_columns(rows, columns)
        if null_ratio > 0.9:
            return ValidationResult(is_valid=False, issue='mostly_null_results',
                                    suggestion='check_join_conditions')

        return ValidationResult(is_valid=True)

    async def _fallback_execution(self, candidates, errors) -> ExecutionResult:
        """
        渐进式降级策略 (继承V1的4级策略，升级为多表感知):

        Level 1 (EXACT):     精确匹配，IN 条件
        Level 2 (STANDARD):  LIKE '%term%' 模糊匹配
        Level 3 (FUZZY):     去除部分条件，保留最核心的
        Level 4 (SEMANTIC):  退化为全表扫描 + LLM后处理
        """
        # 从最精确的候选SQL开始逐步放宽
        for level in [QueryStrategy.STANDARD, QueryStrategy.FUZZY, QueryStrategy.SEMANTIC]:
            relaxed_sql = self._relax_query(candidates[0].sql, level)
            try:
                rows, columns, exec_time = self._execute(relaxed_sql)
                if len(rows) > 0:
                    return ExecutionResult(
                        rows=rows, columns=columns,
                        sql=relaxed_sql, method=f'fallback_{level.name}',
                        exec_time=exec_time, row_count=len(rows),
                        validation=ValidationResult(
                            is_valid=True,
                            note=f'降级到{level.name}策略获得结果'
                        ),
                    )
            except Exception:
                continue

        return ExecutionResult.empty(errors=errors)
```

---

## 4.5 Cross-Database Fusion Engine（跨库融合引擎）

### 4.5.1 核心问题

同一个生物样本/研究项目可能出现在多个数据库中：
- 一个肝癌研究可能同时在GEO (GSE149614)、SRA (PRJNA625514)、CellXGene中有记录
- 不经融合直接展示会导致用户看到3条"重复"结果

融合引擎利用已建立的 `entity_links` 和 `dedup_candidates` 进行智能去重和多源证据聚合。

### 4.5.2 融合策略

```
查询结果 (可能含跨库重复)
    │
    ▼
┌── FUSION PIPELINE ────────────────────────────────┐
│                                                    │
│  Step 1: 硬链接去重                                 │
│  ┌──────────────────────────────────────────┐      │
│  │ 利用 entity_links (same_as) 识别已确认的   │      │
│  │ 跨库同一实体，合并为一条记录                  │      │
│  │ 覆盖: 4,142 PRJNA↔GSE + 5,756 PMID链接     │      │
│  └──────────────────────────────────────────┘      │
│                                                    │
│  Step 2: Identity Hash去重                          │
│  ┌──────────────────────────────────────────┐      │
│  │ 对Step1后仍可能重复的记录，用                  │      │
│  │ biological_identity_hash 进行匹配            │      │
│  │ (organism:tissue:individual:disease:stage)    │      │
│  │ 覆盖: 100K dedup_candidates                  │      │
│  └──────────────────────────────────────────┘      │
│                                                    │
│  Step 3: 多源证据聚合                               │
│  ┌──────────────────────────────────────────┐      │
│  │ 对去重后的每条记录，聚合来自不同源的信息：     │      │
│  │ - 取最完整的metadata (CellXGene > EBI > GEO) │      │
│  │ - 合并所有可用的ID (GSE, PRJNA, DOI, PMID)   │      │
│  │ - 取最高的citation_count                     │      │
│  │ - 标记所有数据源                              │      │
│  └──────────────────────────────────────────┘      │
│                                                    │
│  Step 4: 质量评分                                   │
│  ┌──────────────────────────────────────────┐      │
│  │ 为每条融合结果计算综合质量分:                  │      │
│  │ - 元数据完整性 (0-1)                         │      │
│  │ - 跨库验证度 (出现在几个库中)                  │      │
│  │ - 数据可获取性 (有无h5ad/rds)                 │      │
│  │ - 引用影响力 (citation_count)                │      │
│  └──────────────────────────────────────────┘      │
│                                                    │
└────────────────────────────────────────────────────┘
    │
    ▼
融合结果: 每条记录 = 最优metadata + 所有来源 + 质量分
```

### 4.5.3 核心实现

```python
class CrossDBFusionEngine:
    """
    跨库结果融合引擎
    """

    # 数据源质量优先级 (用于选择最优metadata)
    SOURCE_QUALITY_RANKING = {
        'cellxgene': 1,   # 最高质量，100%字段填充
        'ebi': 2,         # 高质量，本体标注丰富
        'ncbi': 3,        # 中高质量，覆盖面广
        'geo': 4,         # 中等质量，tissue好但disease/sex差
        'hca': 5,
        'htan': 6,
    }

    def fuse_results(self, results: List[dict],
                     entity_type: str = 'sample') -> List[FusedRecord]:
        """
        对查询结果进行跨库融合

        Args:
            results: 原始查询结果 (可能含跨库重复)
            entity_type: 'project' | 'sample'

        Returns:
            融合后的记录列表，每条包含所有源信息
        """
        if not results:
            return []

        # Step 1: 硬链接去重
        groups = self._group_by_hard_links(results, entity_type)

        # Step 2: Identity Hash去重
        groups = self._merge_by_identity_hash(groups, entity_type)

        # Step 3: 多源证据聚合
        fused = []
        for group in groups:
            fused.append(self._aggregate_group(group))

        # Step 4: 质量评分
        for record in fused:
            record.quality_score = self._compute_quality_score(record)

        # 按质量分排序
        fused.sort(key=lambda r: r.quality_score, reverse=True)
        return fused

    def _group_by_hard_links(self, results: List[dict],
                              entity_type: str) -> List[List[dict]]:
        """
        利用entity_links将已确认的同一实体分组

        查询逻辑:
        SELECT target_pk FROM entity_links
        WHERE source_pk = ? AND relationship_type = 'same_as'
        """
        pk_to_group = {}
        groups = []

        # 获取所有结果的pk
        pks = [r['pk'] for r in results]

        # 批量查询entity_links
        links = self.db.execute("""
            SELECT source_pk, target_pk
            FROM entity_links
            WHERE source_entity_type = ?
              AND relationship_type = 'same_as'
              AND (source_pk IN ({pks}) OR target_pk IN ({pks}))
        """.format(pks=','.join('?' * len(pks))),
            [entity_type] + pks + pks
        )

        # 使用Union-Find合并连通分量
        uf = UnionFind(pks)
        for link in links:
            if link['source_pk'] in pks and link['target_pk'] in pks:
                uf.union(link['source_pk'], link['target_pk'])

        # 按组分配
        group_map = {}
        for r in results:
            root = uf.find(r['pk'])
            if root not in group_map:
                group_map[root] = []
            group_map[root].append(r)

        return list(group_map.values())

    def _aggregate_group(self, group: List[dict]) -> FusedRecord:
        """
        将一组跨库记录聚合为一条融合记录

        策略: 每个字段取最优源的值
        """
        # 按源质量排序
        sorted_group = sorted(
            group,
            key=lambda r: self.SOURCE_QUALITY_RANKING.get(
                r.get('source_database', ''), 99
            )
        )

        # 最优记录作为基础
        best = sorted_group[0].copy()

        # 聚合来源信息
        sources = []
        all_ids = {}

        for record in sorted_group:
            db = record.get('source_database', 'unknown')
            sources.append(db)

            # 收集所有ID
            for id_field in ['project_id', 'series_id', 'sample_id', 'pmid', 'doi']:
                if record.get(id_field):
                    all_ids.setdefault(id_field, []).append(
                        f"{record[id_field]} ({db})"
                    )

            # 填充best中的空字段
            for field, value in record.items():
                if value and not best.get(field):
                    best[field] = value

        # 取最大citation_count
        best['citation_count'] = max(
            (r.get('citation_count') or 0 for r in sorted_group),
            default=0
        )

        return FusedRecord(
            data=best,
            sources=sources,
            source_count=len(set(sources)),
            all_ids=all_ids,
            records_merged=len(group),
        )

    def _compute_quality_score(self, record: FusedRecord) -> float:
        """
        综合质量评分 (0-100)

        组成:
        - metadata_completeness (0-40): 关键字段填充率
        - cross_validation (0-25): 跨库验证度
        - data_availability (0-20): 数据可获取性
        - citation_impact (0-15): 引用影响力
        """
        score = 0.0

        # 1. 元数据完整性 (40分)
        key_fields = ['tissue', 'disease', 'sex', 'age', 'organism',
                      'assay', 'n_cells', 'pmid']
        filled = sum(1 for f in key_fields if record.data.get(f))
        score += (filled / len(key_fields)) * 40

        # 2. 跨库验证度 (25分)
        score += min(record.source_count / 3, 1.0) * 25

        # 3. 数据可获取性 (20分)
        if record.data.get('has_h5ad'):
            score += 20
        elif record.data.get('has_rds'):
            score += 15
        elif record.data.get('access_url'):
            score += 10

        # 4. 引用影响力 (15分)
        citations = record.data.get('citation_count', 0) or 0
        score += min(citations / 100, 1.0) * 15

        return round(score, 1)


@dataclass
class FusedRecord:
    """融合后的记录"""
    data: dict                    # 最优metadata
    sources: List[str]            # 数据来源列表
    source_count: int             # 来源数量
    all_ids: dict                 # 所有ID汇总
    records_merged: int           # 合并的原始记录数
    quality_score: float = 0.0   # 综合质量分 (0-100)
```

### 4.5.4 融合结果呈现格式

```json
{
  "query": "find liver cancer single-cell datasets",
  "total_fused_results": 47,
  "total_raw_results": 126,
  "dedup_rate": "62.7%",
  "results": [
    {
      "rank": 1,
      "quality_score": 87.5,
      "data": {
        "tissue": "liver",
        "disease": "hepatocellular carcinoma",
        "organism": "Homo sapiens",
        "assay": "10x 3' v3",
        "n_cells": 45892,
        "pmid": "33168968"
      },
      "sources": ["cellxgene", "geo", "ncbi"],
      "source_count": 3,
      "all_ids": {
        "project_id": ["PRJNA625514 (ncbi)", "GSE149614 (geo)"],
        "series_id": ["SRP262818 (ncbi)"],
        "doi": ["10.1016/j.cell.2020.10.001 (cellxgene)"]
      },
      "records_merged": 3,
      "availability": {
        "h5ad": true,
        "download_url": "https://cellxgene.cziscience.com/..."
      }
    }
  ]
}
```

### 4.5.5 性能考量

| 场景 | 原始结果数 | 融合后 | 耗时 |
|------|----------|--------|------|
| 肝癌样本查询 | ~500 | ~180 | <200ms |
| 全脑样本查询 | ~3000 | ~1200 | <500ms |
| 全库统计 | 756K | N/A | <2s |

关键优化:
- entity_links 上的索引确保O(1)查找
- identity_hash 索引支持快速batch匹配
- Union-Find 算法 O(n·α(n)) ≈ O(n) 合并连通分量
