# 核心模块详细设计 - Part 1: Coordinator, Query Understanding, Ontology Engine

> 本文件是 ARCHITECTURE.md 第4章的详细展开（模块4.1-4.3）

---

## 4.1 Coordinator Agent（协调器）

### 4.1.1 职责

Coordinator 是系统唯一的决策中枢，负责：
- 接收用户自然语言输入
- 分派任务到具体Tool/Module
- 管理多步推理链（ReAct循环）
- 聚合多个工具的返回结果
- 生成最终回复

### 4.1.2 ReAct循环设计

```python
class CoordinatorAgent:
    """
    核心协调器：单Agent + Multi-Tool 模式
    采用 ReAct (Reason-Act) 循环，最多 MAX_STEPS 步
    """
    MAX_STEPS = 8  # 防止无限循环

    def __init__(self, llm_client, tool_registry, memory_system):
        self.llm = llm_client
        self.tools = tool_registry
        self.memory = memory_system

    async def process_query(self, user_input: str, session_id: str) -> AgentResponse:
        # 1. 加载会话上下文
        context = self.memory.load_session_context(session_id)

        # 2. 构建系统提示词（含schema摘要 + 工具描述 + 会话历史）
        system_prompt = self._build_system_prompt(context)

        # 3. ReAct 循环
        messages = [{"role": "user", "content": user_input}]

        for step in range(self.MAX_STEPS):
            response = await self.llm.chat(
                system=system_prompt,
                messages=messages,
                tools=self.tools.get_tool_definitions()
            )

            # 判断是否需要调用工具
            if response.has_tool_calls():
                tool_results = await self._execute_tools(response.tool_calls)
                messages.append(response.to_message())
                messages.append({"role": "tool", "content": tool_results})
            else:
                # LLM 决定直接回复，循环结束
                break

        # 4. 更新记忆
        self.memory.save_interaction(session_id, user_input, response)

        return self._format_response(response)
```

### 4.1.3 Tool注册表

Coordinator 可调用的10个核心Tool：

| Tool名称 | 输入 | 输出 | 用途 |
|----------|------|------|------|
| `understand_query` | 用户自然语言 | 结构化意图+实体 | 解析用户查询 |
| `resolve_ontology` | 生物术语列表 | 标准本体ID+层级扩展 | 术语标准化 |
| `inspect_schema` | 表名/字段名(可选) | 表结构+统计+样本值 | 了解数据分布 |
| `generate_sql` | 结构化查询条件 | SQL候选列表 | 生成查询 |
| `execute_sql` | SQL语句 | 查询结果集 | 执行查询 |
| `fuse_results` | 多源结果集 | 去重融合结果 | 跨库融合 |
| `assess_quality` | 结果集 | 质量评分+完整性 | 数据质量评估 |
| `find_related` | 实体ID | 跨库关联实体 | 跨库发现 |
| `check_availability` | 数据集列表 | 下载方式+URL | 数据可获取性 |
| `recall_memory` | 查询关键词 | 历史查询+缓存结果 | 记忆检索 |

### 4.1.4 System Prompt 设计

```python
SYSTEM_PROMPT_TEMPLATE = """
你是 SCeQTL-Agent，一个专门用于人源单细胞RNA-seq元数据检索的AI助手。

## 你管理的数据库
- 统一了12个全球主要单细胞数据库的元数据
- 包含 {project_count} 个项目、{sample_count} 个样本、{celltype_count} 条细胞类型注释
- 数据来源：CellXGene, GEO, NCBI/SRA, EBI, HCA, HTAN 等

## 数据库结构摘要
{schema_summary}

## 数据质量概况
{quality_summary}

## 可用工具
{tool_descriptions}

## 行为准则
1. 先用 understand_query 解析用户意图，再决定后续步骤
2. 对生物学术语，必须先用 resolve_ontology 标准化
3. 生成SQL前先用 inspect_schema 确认字段分布
4. 查询结果为空时，自动降级策略（精确→模糊→语义扩展）
5. 跨库结果必须经过 fuse_results 去重后呈现
6. 始终说明数据来源和质量，不做无依据的断言

## 当前会话上下文
{session_context}
"""
```

### 4.1.5 意图路由策略

```
用户意图 ────────────────────────> 处理路径

SEARCH (搜索数据集)  ──────────> understand → resolve → generate_sql → execute → fuse → synthesize
COMPARE (比较数据集) ──────────> understand → resolve → generate_sql(×N) → execute(×N) → compare_synthesize
STATISTICS (统计分析) ─────────> understand → generate_sql(聚合) → execute → visualize_synthesize
EXPLORE (探索发现)   ──────────> understand → inspect_schema → suggest_queries → iterative_search
DOWNLOAD (数据下载)  ──────────> understand → resolve → execute → check_availability → download_guide
LINEAGE (数据血缘)   ──────────> understand → find_related → trace_provenance → lineage_synthesize
```

---

## 4.2 Query Understanding Module（查询理解模块）

### 4.2.1 核心设计理念

查询理解是整个pipeline的第一步，其质量直接决定后续步骤的准确性。
采用**规则优先 + LLM兜底**的双轨策略：
- 简单/模式化查询（占~70%）：正则+规则快速解析，延迟<50ms
- 复杂/歧义查询（占~30%）：调用LLM进行深度理解

### 4.2.2 输出数据结构

```python
@dataclass
class ParsedQuery:
    """查询理解的输出"""
    # 意图
    intent: QueryIntent           # SEARCH | COMPARE | STATISTICS | EXPLORE | DOWNLOAD | LINEAGE
    sub_intent: str               # e.g., "search_by_disease", "compare_tissues"
    complexity: QueryComplexity   # SIMPLE | MODERATE | COMPLEX

    # 提取的实体
    entities: List[BioEntity]     # 生物学实体列表

    # 结构化过滤条件 (解析后的，未做本体解析)
    filters: QueryFilters

    # 查询范围
    target_level: str             # "project" | "series" | "sample" | "celltype"

    # 聚合需求
    aggregation: Optional[AggregationSpec]  # GROUP BY, COUNT, etc.

    # 排序需求
    ordering: Optional[OrderingSpec]

    # 分页
    limit: int = 20

    # 元信息
    original_text: str
    language: str                 # "zh" | "en"
    confidence: float             # 0.0 - 1.0
    parse_method: str             # "rule" | "llm"

@dataclass
class BioEntity:
    """生物学实体"""
    text: str                     # 用户原始文本 e.g., "大脑"
    entity_type: str              # "tissue" | "disease" | "cell_type" | "organism" | "assay"
    normalized_value: Optional[str]  # 初步标准化 e.g., "brain"
    ontology_id: Optional[str]    # 本体ID (待resolve_ontology填充)
    negated: bool = False         # 是否是否定条件 e.g., "非癌症"

@dataclass
class QueryFilters:
    """结构化过滤条件"""
    organisms: List[str] = field(default_factory=list)
    tissues: List[str] = field(default_factory=list)
    diseases: List[str] = field(default_factory=list)
    cell_types: List[str] = field(default_factory=list)
    assays: List[str] = field(default_factory=list)
    sex: Optional[str] = None
    age_range: Optional[Tuple[float, float]] = None
    development_stages: List[str] = field(default_factory=list)
    source_databases: List[str] = field(default_factory=list)

    # ID类过滤
    project_ids: List[str] = field(default_factory=list)   # GSE*, PRJNA*
    sample_ids: List[str] = field(default_factory=list)     # GSM*, SAMN*
    pmids: List[str] = field(default_factory=list)
    dois: List[str] = field(default_factory=list)

    # 数值过滤
    min_cells: Optional[int] = None
    min_citation_count: Optional[int] = None
    has_h5ad: Optional[bool] = None

    # 时间过滤
    published_after: Optional[str] = None
    published_before: Optional[str] = None

    # 自由文本 (无法结构化的部分)
    free_text: Optional[str] = None
```

### 4.2.3 规则引擎（快速路径）

```python
class RuleBasedParser:
    """
    基于规则的快速解析器，处理70%+的常见查询模式
    """
    # ID模式识别
    ID_PATTERNS = {
        'geo_project':  r'\b(GSE\d{4,8})\b',
        'geo_sample':   r'\b(GSM\d{4,8})\b',
        'sra_project':  r'\b(PRJNA\d{4,8})\b',
        'sra_study':    r'\b(SRP\d{4,8})\b',
        'sra_sample':   r'\b(SRS\d{4,8})\b',
        'biosample':    r'\b(SAM[NE]A?\d{6,12})\b',
        'pmid':         r'\bPMID[:\s]*(\d{6,8})\b',
        'doi':          r'\b(10\.\d{4,}/[^\s]+)\b',
    }

    # 意图关键词
    INTENT_KEYWORDS = {
        'SEARCH': {
            'zh': ['查找', '搜索', '找到', '有哪些', '哪些数据', '什么数据'],
            'en': ['find', 'search', 'look for', 'show me', 'what datasets'],
        },
        'COMPARE': {
            'zh': ['比较', '对比', '差异', '区别', '不同'],
            'en': ['compare', 'difference', 'versus', 'vs'],
        },
        'STATISTICS': {
            'zh': ['统计', '多少', '数量', '分布', '占比', '总共'],
            'en': ['how many', 'count', 'distribution', 'statistics', 'total'],
        },
        'EXPLORE': {
            'zh': ['探索', '浏览', '有什么', '概况', '概览'],
            'en': ['explore', 'browse', 'overview', 'what is available'],
        },
        'DOWNLOAD': {
            'zh': ['下载', '获取数据', '导出'],
            'en': ['download', 'get data', 'export', 'access'],
        },
        'LINEAGE': {
            'zh': ['来源', '出处', '来自', '血缘', '追溯', '关联数据库'],
            'en': ['source', 'origin', 'provenance', 'which database', 'trace'],
        },
    }

    # 生物学实体关键词 (高频，中英文)
    TISSUE_KEYWORDS = {
        'brain': ['大脑', '脑', 'brain', 'cerebral', 'cerebellum', 'hippocampus'],
        'liver': ['肝', '肝脏', 'liver', 'hepatic'],
        'lung':  ['肺', '肺部', 'lung', 'pulmonary'],
        'heart': ['心脏', '心', 'heart', 'cardiac', 'myocardial'],
        'kidney': ['肾', '肾脏', 'kidney', 'renal'],
        'blood': ['血液', '外周血', 'blood', 'PBMC', 'peripheral blood'],
        'bone marrow': ['骨髓', 'bone marrow'],
        'skin': ['皮肤', 'skin', 'dermis', 'epidermis'],
        'intestine': ['肠', '肠道', 'intestine', 'gut', 'colon', 'bowel'],
        'pancreas': ['胰腺', 'pancreas', 'pancreatic'],
        # ... 更多可从数据库高频值中自动提取
    }

    DISEASE_KEYWORDS = {
        "Alzheimer's disease": ['阿尔茨海默', "alzheimer", 'AD', '老年痴呆'],
        'COVID-19': ['新冠', 'covid', 'sars-cov-2', 'coronavirus'],
        'normal': ['正常', '健康', 'normal', 'healthy', 'control'],
        'cancer': ['癌', '肿瘤', 'cancer', 'tumor', 'carcinoma', 'malignant'],
        'diabetes': ['糖尿病', 'diabetes', 'diabetic'],
        'fibrosis': ['纤维化', 'fibrosis', 'fibrotic'],
        # ... 更多
    }

    def parse(self, query: str) -> Optional[ParsedQuery]:
        """尝试用规则解析，返回None表示需要LLM"""
        # 1. ID直接查询 (最简单，最高优先级)
        ids = self._extract_ids(query)
        if ids and len(self._extract_bio_entities(query)) == 0:
            return self._build_id_query(ids, query)

        # 2. 意图分类
        intent = self._classify_intent(query)

        # 3. 实体抽取
        entities = self._extract_bio_entities(query)

        # 4. 如果意图明确且实体清晰，构建结构化查询
        if intent and entities:
            return self._build_structured_query(intent, entities, ids, query)

        # 5. 无法解析，交给LLM
        return None
```

### 4.2.4 LLM解析器（深度理解路径）

```python
class LLMQueryParser:
    """
    使用LLM进行深度查询理解
    仅在规则引擎无法处理时调用
    """

    PARSE_PROMPT = """
    你是一个单细胞RNA-seq元数据查询解析器。请将用户查询解析为结构化JSON。

    ## 数据库字段参考
    - organism: 主要为 "Homo sapiens"
    - tissue: {top_tissues}  (按频率排序前20)
    - disease: {top_diseases}
    - cell_type: {top_cell_types}
    - assay: {top_assays}
    - sex: male, female, unknown, mixed
    - source_database: cellxgene, geo, ncbi, ebi, hca, htan, ...

    ## 输出格式
    ```json
    {{
      "intent": "SEARCH|COMPARE|STATISTICS|EXPLORE|DOWNLOAD|LINEAGE",
      "target_level": "project|series|sample|celltype",
      "entities": [
        {{"text": "用户原始文本", "type": "tissue|disease|cell_type|...", "value": "标准化值"}}
      ],
      "filters": {{
        "tissues": [...],
        "diseases": [...],
        ...
      }},
      "aggregation": null | {{"group_by": [...], "metric": "count|sum|avg"}},
      "ordering": null | {{"field": "...", "direction": "desc"}},
      "limit": 20,
      "confidence": 0.0-1.0
    }}
    ```

    ## 注意事项
    - 中文术语请翻译为英文标准值
    - "正常"/"健康" → disease: "normal"
    - 如果用户没有指定organism，默认 "Homo sapiens"
    - 否定条件用 negated: true 表示

    用户查询: {query}
    """

    async def parse(self, query: str, schema_context: dict) -> ParsedQuery:
        prompt = self.PARSE_PROMPT.format(
            query=query,
            top_tissues=schema_context['top_tissues'],
            top_diseases=schema_context['top_diseases'],
            top_cell_types=schema_context['top_cell_types'],
            top_assays=schema_context['top_assays'],
        )
        result = await self.llm.chat(prompt)
        return self._json_to_parsed_query(result, query)
```

### 4.2.5 中文支持策略

中文是一等公民，不做翻译后处理：
- 规则引擎内置中英文关键词对照
- LLM prompt 支持中文输入输出
- 本体解析层维护中英文同义词表
- Web UI 默认双语界面

---

## 4.3 Ontology Resolution Engine（本体解析引擎）

### 4.3.1 核心设计理念

本体解析引擎是本系统区别于普通Text2SQL系统的**核心创新**。
它解决一个根本问题：**用户说的"brain"和数据库里存的"cerebral cortex"是什么关系？**

```
用户说 "brain"
    │
    ▼ 本体解析
UBERON:0000955 (brain)
    │
    ▼ 层级扩展
    ├── UBERON:0001870 (cerebral cortex)
    ├── UBERON:0001954 (hippocampus proper)
    ├── UBERON:0002037 (cerebellum)
    ├── UBERON:0001898 (hypothalamus)
    ├── UBERON:0002298 (brainstem)
    └── ... (共37个子结构)
    │
    ▼ 值映射
    数据库中匹配到的实际值:
    ├── "brain" (25,432 samples)
    ├── "cerebral cortex" (3,891 samples)
    ├── "hippocampus" (1,204 samples)
    ├── "cerebellum" (982 samples)
    └── ...
    │
    ▼ 用户选择
    "您想搜索整个brain (31,509 samples) 还是特定区域？"
```

### 4.3.2 支持的本体系统

| 本体 | 用途 | 关键覆盖 |
|------|------|---------|
| **UBERON** | 解剖结构/组织 | tissue, tissue_general 字段 |
| **MONDO** | 疾病 | disease 字段 |
| **CL (Cell Ontology)** | 细胞类型 | cell_type, unified_celltypes |
| **EFO** | 实验方法 | assay 字段 |
| **HsapDv** | 发育阶段 | development_stage 字段 |
| **PATO** | 表型质量 | sex 等属性 |

### 4.3.3 本体缓存数据结构

```python
@dataclass
class OntologyTerm:
    """本体术语"""
    ontology_id: str              # e.g., "UBERON:0000955"
    ontology_source: str          # e.g., "UBERON"
    label: str                    # e.g., "brain"
    synonyms: List[str]           # e.g., ["encephalon", "cerebrum"]
    definition: str
    parent_ids: List[str]         # 直接父节点
    child_ids: List[str]          # 直接子节点
    ancestor_ids: Set[str]        # 所有祖先 (用于 is-a 推理)
    descendant_ids: Set[str]      # 所有后代 (用于层级扩展)

class OntologyCache:
    """
    本地本体缓存 (SQLite)
    包含约 50,000 个术语 (UBERON ~15K, MONDO ~25K, CL ~6K, EFO ~3K)
    """

    SCHEMA = """
    CREATE TABLE ontology_terms (
        ontology_id TEXT PRIMARY KEY,
        ontology_source TEXT NOT NULL,
        label TEXT NOT NULL,
        definition TEXT,
        is_obsolete INTEGER DEFAULT 0
    );

    CREATE TABLE ontology_synonyms (
        ontology_id TEXT NOT NULL,
        synonym TEXT NOT NULL,
        synonym_type TEXT,  -- 'exact', 'related', 'broad', 'narrow'
        FOREIGN KEY (ontology_id) REFERENCES ontology_terms(ontology_id)
    );

    CREATE TABLE ontology_hierarchy (
        child_id TEXT NOT NULL,
        parent_id TEXT NOT NULL,
        relationship_type TEXT DEFAULT 'is_a',  -- 'is_a', 'part_of'
        FOREIGN KEY (child_id) REFERENCES ontology_terms(ontology_id),
        FOREIGN KEY (parent_id) REFERENCES ontology_terms(ontology_id)
    );

    -- 数据库实际值到本体ID的映射
    CREATE TABLE value_to_ontology (
        raw_value TEXT NOT NULL,           -- 数据库中的实际值
        field_name TEXT NOT NULL,          -- tissue, disease, cell_type
        ontology_id TEXT,                  -- 映射到的本体ID
        mapping_method TEXT,              -- 'exact', 'synonym', 'llm', 'manual'
        confidence REAL DEFAULT 1.0,
        sample_count INTEGER,             -- 该值在数据库中的出现次数
        PRIMARY KEY (raw_value, field_name)
    );

    -- 索引
    CREATE INDEX idx_syn_text ON ontology_synonyms(synonym);
    CREATE INDEX idx_hier_parent ON ontology_hierarchy(parent_id);
    CREATE INDEX idx_hier_child ON ontology_hierarchy(child_id);
    CREATE INDEX idx_v2o_ontology ON value_to_ontology(ontology_id);
    """
```

### 4.3.4 解析流程

```python
class OntologyResolver:
    """
    本体解析引擎
    三步解析: 术语识别 → 本体映射 → 层级扩展
    """

    async def resolve(self, entities: List[BioEntity],
                      expand_hierarchy: bool = True,
                      max_depth: int = 2) -> List[ResolvedEntity]:
        """
        将用户提及的生物学实体解析为本体标准表示

        Args:
            entities: 从QueryUnderstanding提取的实体列表
            expand_hierarchy: 是否进行层级扩展
            max_depth: 层级扩展深度 (1=直接子节点, 2=孙节点, ...)

        Returns:
            解析后的实体列表，含本体ID和数据库匹配值
        """
        resolved = []
        for entity in entities:
            # Step 1: 找到最匹配的本体术语
            ontology_term = await self._match_to_ontology(entity)

            # Step 2: 层级扩展 (如需要)
            expanded_terms = []
            if expand_hierarchy and ontology_term:
                expanded_terms = self._expand_hierarchy(
                    ontology_term, max_depth
                )

            # Step 3: 映射到数据库实际值
            db_values = self._map_to_db_values(
                ontology_term, expanded_terms, entity.entity_type
            )

            resolved.append(ResolvedEntity(
                original=entity,
                ontology_term=ontology_term,
                expanded_terms=expanded_terms,
                db_values=db_values,
                total_sample_count=sum(v.count for v in db_values),
            ))

        return resolved

    async def _match_to_ontology(self, entity: BioEntity) -> Optional[OntologyTerm]:
        """
        三级匹配策略:
        1. 精确匹配 label 或 synonym
        2. 模糊匹配 (Levenshtein distance < 2)
        3. LLM语义匹配 (最后手段)
        """
        text = entity.normalized_value or entity.text

        # Level 1: 精确匹配
        term = self.cache.lookup_exact(text, entity.entity_type)
        if term:
            return term

        # Level 2: 模糊匹配
        candidates = self.cache.lookup_fuzzy(text, entity.entity_type, max_distance=2)
        if len(candidates) == 1:
            return candidates[0]
        elif len(candidates) > 1:
            # 多个候选，用LLM选择最佳
            return await self._llm_select_best(text, candidates)

        # Level 3: LLM语义匹配
        return await self._llm_resolve(text, entity.entity_type)

    def _expand_hierarchy(self, term: OntologyTerm,
                          max_depth: int) -> List[OntologyTerm]:
        """
        沿本体层级树向下扩展
        使用BFS，按深度限制
        """
        expanded = []
        queue = [(term.ontology_id, 0)]
        visited = {term.ontology_id}

        while queue:
            current_id, depth = queue.pop(0)
            if depth >= max_depth:
                continue

            children = self.cache.get_children(current_id)
            for child in children:
                if child.ontology_id not in visited:
                    visited.add(child.ontology_id)
                    expanded.append(child)
                    queue.append((child.ontology_id, depth + 1))

        return expanded

    def _map_to_db_values(self, term: Optional[OntologyTerm],
                          expanded: List[OntologyTerm],
                          field_type: str) -> List[DBValueMatch]:
        """
        将本体术语映射到数据库中实际存在的值
        返回按sample_count降序排列的匹配值列表
        """
        all_ontology_ids = set()
        if term:
            all_ontology_ids.add(term.ontology_id)
        all_ontology_ids.update(t.ontology_id for t in expanded)

        # 查询value_to_ontology表
        field_name = {
            'tissue': 'tissue',
            'disease': 'disease',
            'cell_type': 'cell_type',
        }.get(field_type, field_type)

        matches = self.cache.get_db_values_by_ontology_ids(
            all_ontology_ids, field_name
        )

        return sorted(matches, key=lambda m: m.count, reverse=True)

@dataclass
class ResolvedEntity:
    """本体解析后的实体"""
    original: BioEntity
    ontology_term: Optional[OntologyTerm]     # 匹配到的本体术语
    expanded_terms: List[OntologyTerm]         # 层级扩展的术语
    db_values: List[DBValueMatch]              # 数据库中实际匹配的值
    total_sample_count: int                    # 总匹配样本数

@dataclass
class DBValueMatch:
    """数据库值匹配"""
    raw_value: str           # 数据库中的实际值
    ontology_id: str         # 对应的本体ID
    field_name: str          # 匹配的字段名
    count: int               # 在数据库中的出现次数
    match_type: str          # 'exact', 'synonym', 'hierarchy'
```

### 4.3.5 本体缓存构建流程

```
初始构建 (一次性，约30分钟):
  1. 从OBO Foundry下载最新版 UBERON, MONDO, CL, EFO (OWL/OBO格式)
  2. 解析为 ontology_terms + ontology_synonyms + ontology_hierarchy
  3. 扫描 unified_metadata.db 中所有 tissue, disease, cell_type 的 distinct 值
  4. 精确/synonym匹配 → 写入 value_to_ontology
  5. 未匹配值 → 批量LLM映射 → 写入 value_to_ontology
  6. 输出覆盖率报告

增量更新 (数据库更新时):
  1. diff 新增的 distinct 值
  2. 对新值进行本体映射
  3. 更新 value_to_ontology 表
```

### 4.3.6 与V1对比的核心提升

| 维度 | V1 (旧agent) | V2 (新设计) |
|------|-------------|------------|
| 术语匹配 | 硬编码同义词表 (~50个) | 本体层级图 (~50,000术语) |
| 扩展方式 | 手工定义 brain→cerebral | 自动BFS遍历本体子树 |
| 覆盖范围 | 仅disease和tissue | 6个本体系统全覆盖 |
| 与数据库关联 | 无 | value_to_ontology 精确映射 |
| 更新方式 | 修改源代码 | 数据驱动，自动更新 |
