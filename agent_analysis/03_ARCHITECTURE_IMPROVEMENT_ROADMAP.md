# SCeQTL-Agent 架构升级路线图

> **文档版本**: 1.0  
> **日期**: 2026-03-18  
> **目的**: 基于核心问题分析，提供针对性的架构升级思路和实施路径

---

## 1. 升级策略总览

### 1.1 当前架构诊断

```
当前架构的优势:
✓ 模块化设计，Protocol-based DI
✓ 规则引擎优先，成本控制良好
✓ 三层记忆系统已建立
✓ 多候选SQL生成策略正确

当前架构的短板:
✗ Ontology扩展策略过于简单（硬编码umbrella terms）
✗ SQL候选选择策略不够智能（首个有效即返回）
✗ 实体抽取不支持嵌套条件
✗ 跨库去重策略未充分实现
✗ 缺乏从用户反馈中学习的闭环
```

### 1.2 升级原则

1. **渐进式改进**: 保持现有架构稳定，逐步引入新能力
2. **数据驱动**: 所有改进基于评测数据和用户反馈
3. **模块化**: 新组件通过Protocol接口接入，可独立测试
4. **可回滚**: 保留原有实现，新功能可开关控制

---

## 2. Phase 1: 本体语义扩展优化 (P0)

### 2.1 目标

将Ontology类别评测通过率从76%提升至90%+

### 2.2 核心问题

当前umbrella term扩展是硬编码的：
```python
UMBRELLA_TERMS = {
    "brain": ["cerebral cortex", "hippocampus", ...],  # 静态列表
    # ...
}
```

问题：
- 覆盖不完整（如"immune cell"未定义）
- 无法根据数据库实际值调整
- 无法处理层级深度

### 2.3 改进方案：动态本体扩展器 (Dynamic Ontology Expander)

#### 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                 DynamicOntologyExpander                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐    │
│  │   Ontology   │   │  Database    │   │   Expansion  │    │
│  │   Graph      │◄──┤  Value Stats │◄──┤   Strategy   │    │
│  │  (UBERON/    │   │  (实际值分布) │   │  (扩展策略)   │    │
│  │   MONDO/CL)  │   │              │   │              │    │
│  └──────────────┘   └──────────────┘   └──────────────┘    │
│           │                                   │              │
│           ▼                                   ▼              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Expansion Decision Engine               │  │
│  │  (基于用户意图、数据分布、层级深度动态决定扩展范围)      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 关键组件

**1. Ontology Graph Navigator**
```python
class OntologyGraphNavigator:
    """
    基于本体层级结构的导航器
    参考: UBERON/MONDO的is_a/part_of关系
    """
    
    def get_descendants(self, term_id: str, max_depth: int = 3) -> list[str]:
        """获取下级术语（带深度控制）"""
        
    def get_related_tissues(self, term_id: str, relation: str = "part_of") -> list[str]:
        """获取相关组织（如 brain → cerebral cortex via part_of）"""
        
    def get_siblings(self, term_id: str) -> list[str]:
        """获取同级术语（如 frontal cortex → temporal cortex）"""
```

**2. Database Value Profiler**
```python
class DatabaseValueProfiler:
    """
    分析数据库中各字段的实际值分布
    用于：只扩展数据库中实际存在的值
    """
    
    def build_tissue_profile(self) -> dict:
        """
        返回组织中各术语的样本数量分布
        {
            "brain": 25000,
            "cerebral cortex": 8900,
            "hippocampus": 4200,
            ...
        }
        """
        
    def filter_existing_terms(self, candidate_terms: list[str]) -> list[str]:
        """过滤掉数据库中没有数据的术语"""
```

**3. Expansion Strategy Engine**
```python
class ExpansionStrategy(Enum):
    CONSERVATIVE = "conservative"  # 仅直接子项
    MODERATE = "moderate"          # 子项 + 孙项
    AGGRESSIVE = "aggressive"      # 所有后代
    SIBLINGS = "siblings"          # 包含同级

class ExpansionStrategyEngine:
    """
    根据查询上下文选择扩展策略
    """
    
    def decide_strategy(
        self,
        term: str,
        intent: QueryIntent,
        context: SessionContext,
    ) -> ExpansionStrategy:
        """
        决策逻辑:
        - EXPLORE意图 → AGGRESSIVE（发现更多）
        - SEARCH + 高置信度 → MODERATE（平衡）
        - COMPARE意图 → CONSERVATIVE（精确对比）
        """
```

#### 实施步骤

```python
# 新实现（参考CHASE-SQL的多候选思想）
class DynamicOntologyExpander:
    def __init__(
        self,
        ontology_cache: OntologyCache,
        db_profiler: DatabaseValueProfiler,
    ):
        self.navigator = OntologyGraphNavigator(ontology_cache)
        self.profiler = db_profiler
        self.strategy_engine = ExpansionStrategyEngine()
    
    def expand(
        self,
        term: str,
        field_type: str,
        context: QueryContext,
    ) -> ExpansionResult:
        # 1. 确定策略
        strategy = self.strategy_engine.decide_strategy(term, context)
        
        # 2. 获取候选扩展（多候选）
        candidates = self._generate_expansion_candidates(term, strategy)
        
        # 3. 基于数据分布筛选和排序
        filtered = self._filter_by_data_existence(candidates)
        ranked = self._rank_by_sample_count(filtered)
        
        # 4. 返回带置信度的扩展结果
        return ExpansionResult(
            original=term,
            expansions=ranked,
            strategy_used=strategy,
            confidence=self._calculate_confidence(ranked),
        )
```

### 2.4 预期效果

```
改进前:
"immune cell" → ["immune cell"] (无扩展，命中率低)

改进后:
"immune cell" → [
    ("T cell", 15000),           # 数据库中有1.5万样本
    ("B cell", 12000),           # 数据库中有1.2万样本
    ("macrophage", 8000),
    ("natural killer cell", 6000),
    ...
]
（基于CL本体的is_a层级 + 数据库实际分布）
```

---

## 3. Phase 2: 智能SQL候选选择 (P0)

### 3.1 当前问题

当前策略：并行执行3个候选，首个有效即返回

问题：
- 可能返回次优结果
- 无执行结果质量评估
- 无法处理部分成功情况

### 3.2 改进方案：Execution-Based Selection

参考CHASE-SQL的设计：

```python
class SmartSQLSelector:
    """
    基于执行结果的智能SQL选择
    """
    
    def select_best(
        self,
        candidates: list[SQLCandidate],
        execution_results: list[ExecutionResult],
        original_query: ParsedQuery,
    ) -> ExecutionResult:
        """
        多维度评估：
        1. 结果非空性
        2. 结果数量合理性（符合预期范围）
        3. 字段覆盖度
        4. 执行效率
        5. 与查询意图匹配度
        """
        
        scored_results = []
        for candidate, result in zip(candidates, execution_results):
            score = self._calculate_score(
                result=result,
                expected_intent=original_query.intent,
                expected_entities=original_query.entities,
            )
            scored_results.append((candidate, result, score))
        
        # 按综合得分排序
        scored_results.sort(key=lambda x: x[2], reverse=True)
        
        # 返回最佳结果，同时保留备选
        best = scored_results[0][1]
        best.metadata["alternatives"] = [
            {"sql": c.sql, "score": s}
            for c, r, s in scored_results[1:3]
        ]
        return best
    
    def _calculate_score(
        self,
        result: ExecutionResult,
        expected_intent: QueryIntent,
        expected_entities: list[BioEntity],
    ) -> float:
        """
        评分维度（参考CHASE-SQL）:
        - 非空性: 空结果得0分
        - 数量合理性: 与预期范围匹配度
        - 实体覆盖: 结果中包含预期实体的比例
        - 执行效率: 响应时间惩罚
        """
        score = 0.0
        
        # 基础分：非空
        if result.row_count == 0:
            return 0.0
        score += 30.0
        
        # 数量合理性
        expected_range = self._estimate_expected_range(expected_entities)
        if expected_range[0] <= result.row_count <= expected_range[1]:
            score += 30.0
        elif result.row_count > 0:
            score += 10.0
        
        # 实体覆盖（需要分析结果内容）
        coverage = self._check_entity_coverage(result, expected_entities)
        score += coverage * 30.0
        
        # 执行效率
        time_penalty = min(result.exec_time_ms / 1000.0, 10.0)  # 最大扣10分
        score -= time_penalty
        
        return max(0.0, score)
```

### 3.3 预期效果

```
场景: 查询 "brain Alzheimer's datasets"

候选1 (精确): tissue IN ('brain') AND disease = "Alzheimer's disease"
  → 执行结果: 0条（过于严格）

候选2 (扩展): tissue IN ('brain', 'cerebral cortex', ...) AND disease LIKE '%alzheimer%'
  → 执行结果: 150条 ✓

候选3 (LLM生成): 复杂的JOIN和子查询
  → 执行结果: 15000条（过于宽松）

改进前: 可能返回候选1（首个非空）或候选3（并行执行顺序问题）
改进后: 明确返回候选2（得分最高）
```

---

## 4. Phase 3: 复杂实体关系抽取 (P0)

### 4.1 问题定义

当前parser只抽取扁平实体列表，无法处理：
- "T cells in tumor but not in blood"
- "samples from brain or liver of male patients"
- "datasets with macrophages excluding lung tissue"

### 4.2 改进方案：结构化条件表达式

```python
@dataclass
class Condition:
    """条件表达式节点"""
    type: str  # "entity" | "and" | "or" | "not"
    
    # For entity condition
    entity: BioEntity | None = None
    
    # For compound conditions
    left: Condition | None = None
    right: Condition | None = None

# 示例: "T cells in tumor but not in blood"
condition = Condition(
    type="and",
    left=Condition(
        type="and",
        left=Condition(type="entity", entity=BioEntity("T cell", "cell_type")),
        right=Condition(type="entity", entity=BioEntity("tumor", "tissue"))
    ),
    right=Condition(
        type="not",
        left=Condition(type="entity", entity=BioEntity("blood", "tissue"))
    )
)
```

### 4.3 Parser改进

```python
class EnhancedQueryParser:
    """
    增强版查询解析器，支持复合条件
    参考: Semantic Parsing领域的组合式方法
    """
    
    async def parse(self, query: str, context: SessionContext) -> ParsedQuery:
        # 1. 识别是否为复杂查询
        if self._is_complex_query(query):
            return await self._parse_complex(query, context)
        else:
            return await self._parse_simple(query, context)  # 原有逻辑
    
    async def _parse_complex(self, query: str, context: SessionContext) -> ParsedQuery:
        """
        复杂查询使用LLM进行深度解析
        输出结构化条件表达式而非扁平列表
        """
        prompt = f"""
        Parse the following query into a structured condition tree.
        
        Query: "{query}"
        
        Available entity types: tissue, disease, cell_type, assay, organism
        
        Output format (JSON):
        {{
            "intent": "search",
            "condition_tree": {{
                "type": "and",
                "left": {{...}},
                "right": {{...}}
            }}
        }}
        """
        
        response = await self.llm.chat(prompt)
        parsed_tree = json.loads(response.content)
        
        return ParsedQuery(
            intent=QueryIntent[parsed_tree["intent"].upper()],
            condition_tree=self._build_condition_tree(parsed_tree["condition_tree"]),
            # ...
        )
```

### 4.4 SQL生成适配

```python
class ConditionSQLBuilder:
    """将条件树转换为SQL WHERE子句"""
    
    def build(self, condition: Condition) -> str:
        if condition.type == "entity":
            return self._build_entity_condition(condition.entity)
        elif condition.type == "and":
            left_sql = self.build(condition.left)
            right_sql = self.build(condition.right)
            return f"({left_sql} AND {right_sql})"
        elif condition.type == "or":
            left_sql = self.build(condition.left)
            right_sql = self.build(condition.right)
            return f"({left_sql} OR {right_sql})"
        elif condition.type == "not":
            inner_sql = self.build(condition.left)
            return f"(NOT {inner_sql})"
```

---

## 5. Phase 4: 跨库去重与融合增强 (P1)

### 5.1 当前状态

- entity_links表：9,966条已知关联
- dedup_candidates表：100,000条待验证候选
- 实际融合逻辑未充分实现

### 5.2 改进方案：多因子实体匹配

```python
@dataclass
class MatchFactor:
    """匹配因子及其权重"""
    name: str
    weight: float
    similarity_fn: Callable[[Record, Record], float]

class MultiFactorEntityMatcher:
    """
    基于多因子的实体匹配器
    参考: Entity Resolution领域的概率匹配方法
    """
    
    FACTORS = [
        MatchFactor("id_similarity", 0.30, id_similarity),
        MatchFactor("title_similarity", 0.25, title_similarity),
        MatchFactor("author_overlap", 0.20, author_overlap),
        MatchFactor("temporal_proximity", 0.15, temporal_proximity),
        MatchFactor("sample_features", 0.10, sample_feature_similarity),
    ]
    
    def calculate_match_score(self, record_a: Record, record_b: Record) -> float:
        """
        计算两条记录的匹配分数
        """
        weighted_scores = []
        for factor in self.FACTORS:
            score = factor.similarity_fn(record_a, record_b)
            weighted_scores.append(score * factor.weight)
        
        total_score = sum(weighted_scores)
        return total_score
    
    def find_matches(self, records: list[Record], threshold: float = 0.75) -> list[Match]:
        """
        找出所有匹配对（使用blocking优化）
        """
        matches = []
        
        # Step 1: Blocking（减少比较次数）
        blocks = self._create_blocks(records)
        
        # Step 2: 在block内进行详细比较
        for block in blocks:
            for i, rec_a in enumerate(block):
                for rec_b in block[i+1:]:
                    score = self.calculate_match_score(rec_a, rec_b)
                    if score >= threshold:
                        matches.append(Match(rec_a, rec_b, score))
        
        return matches
```

### 5.3 融合质量评估

```python
@dataclass
class FusionQuality:
    """融合结果质量评估"""
    completeness: float  # 字段完整度
    consistency: float   # 跨源一致性
    provenance: float    # 血缘清晰度
    confidence: float    # 整体置信度

class FusionQualityAssessor:
    """评估融合结果的质量"""
    
    def assess(self, fused_record: FusedRecord) -> FusionQuality:
        # 1. 字段完整度
        completeness = self._calculate_completeness(fused_record)
        
        # 2. 跨源一致性（同一字段在不同源中的值是否一致）
        consistency = self._calculate_consistency(fused_record)
        
        # 3. 血缘清晰度
        provenance = self._calculate_provenance_clarity(fused_record)
        
        # 4. 综合置信度
        confidence = (completeness * 0.4 + 
                     consistency * 0.4 + 
                     provenance * 0.2)
        
        return FusionQuality(
            completeness=completeness,
            consistency=consistency,
            provenance=provenance,
            confidence=confidence,
        )
```

---

## 6. Phase 5: 用户反馈与学习闭环 (P2)

### 6.1 目标

建立从用户交互中学习的机制，持续改进系统性能。

### 6.2 反馈收集

```python
@dataclass
class UserFeedback:
    """用户反馈数据"""
    query_id: str
    query_text: str
    result_shown: list[dict]
    user_action: str  # "click", "save", "ignore", "refine", "thumbs_up", "thumbs_down"
    refinement_query: str | None = None
    timestamp: float

class FeedbackCollector:
    """收集和存储用户反馈"""
    
    async def record_feedback(self, feedback: UserFeedback):
        # 存储到episodic memory
        await self.episodic.store_feedback(feedback)
        
        # 触发实时分析
        await self._analyze_feedback(feedback)
```

### 6.3 模式学习

```python
class PatternLearner:
    """
    从成功查询中学习可复用模式
    参考: Semantic Memory的设计
    """
    
    def learn_from_success(self, query: ParsedQuery, results: list[FusedRecord]):
        """
        从成功查询中提取模式
        """
        # 提取查询模式
        pattern = self._extract_pattern(query)
        
        # 存储到semantic memory
        self.semantic.record_successful_pattern(
            pattern=pattern,
            sql=query.to_sql(),
            result_count=len(results),
        )
    
    def suggest_for_query(self, query: str) -> list[PatternSuggestion]:
        """
        为当前查询建议历史成功模式
        """
        # 在semantic memory中搜索相似模式
        similar = self.semantic.find_similar_patterns(query)
        
        # 返回高置信度建议
        return [s for s in similar if s.confidence > 0.8]
```

### 6.4 个性化适配

```python
class PersonalizationEngine:
    """
    基于用户历史的个性化适配
    """
    
    def adapt_expansion_strategy(
        self,
        user_id: str,
        base_strategy: ExpansionStrategy,
    ) -> ExpansionStrategy:
        """
        根据用户历史行为调整扩展策略
        
        示例:
        - 用户A经常点击扩展后的结果 → 使用更激进的策略
        - 用户B经常refine查询以缩小范围 → 使用更保守的策略
        """
        user_profile = self._get_user_profile(user_id)
        
        if user_profile.expansion_acceptance_rate > 0.7:
            return ExpansionStrategy.AGGRESSIVE
        elif user_profile.expansion_acceptance_rate < 0.3:
            return ExpansionStrategy.CONSERVATIVE
        else:
            return base_strategy
```

---

## 7. 实施路线图

### 7.1 时间规划

```
Month 1: Phase 1 - 本体扩展优化
├── Week 1-2: 设计动态扩展器架构
├── Week 3: 实现Ontology Graph Navigator
├── Week 4: 实现Database Value Profiler
└── Deliverable: 新的OntologyResolver V2

Month 2: Phase 2 + 3 - SQL选择 + 复杂条件
├── Week 1-2: 实现SmartSQLSelector
├── Week 3-4: 实现条件树Parser
└── Deliverable: 增强的SQL生成管线

Month 3: Phase 4 - 跨库融合
├── Week 1-2: 实现MultiFactorEntityMatcher
├── Week 3: 实现FusionQualityAssessor
└── Deliverable: 完整的融合引擎V2

Month 4: Phase 5 + 评估 - 学习闭环
├── Week 1-2: 实现FeedbackCollector和PatternLearner
├── Week 3-4: 全面评估和调优
└── Deliverable: 完整的V2系统和评估报告
```

### 7.2 风险评估

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|-------|------|---------|
| 动态扩展引入不相关结果 | 中 | 高 | 渐进式部署 + A/B测试 |
| 复杂条件Parser性能问题 | 中 | 中 | 缓存策略 + 异步处理 |
| 多因子匹配计算成本高 | 高 | 中 | Blocking优化 + 预计算 |
| 用户反馈数据稀疏 | 中 | 中 | 冷启动策略 + 模拟数据 |

---

## 8. 关键成功指标

### 8.1 技术指标

| 指标 | 当前 | 目标 | 测量方法 |
|------|------|------|---------|
| Ontology评测通过率 | 76% | 90%+ | 25题专项测试 |
| SQL选择准确率 | ~70% | 85%+ | 人工评估100个查询 |
| 复杂条件解析成功率 | 0% | 80%+ | 设计20个复杂查询测试 |
| 跨库去重准确率 | ~80% | 95%+ | 抽样人工验证 |
| 平均响应时间 (P50) | 800ms | <500ms | 性能监控 |

### 8.2 业务指标

| 指标 | 测量方法 |
|------|---------|
| 用户满意度 | 调研问卷 |
| 查询成功率 | 日志统计 |
| 结果点击率 | 埋点数据 |
| 重复查询率 | 日志分析 |

---

## 附录：与论文发表的关联

### 可发表的贡献点

1. **Dynamic Ontology Expansion for Biomedical Data Retrieval**
   - 动态本体扩展策略
   - 基于数据分布的智能筛选

2. **Multi-Candidate SQL Selection with Execution-Based Ranking**
   - 受CHASE-SQL启发的选择策略
   - 结合领域知识的评分函数

3. **Cross-Database Entity Resolution for Single-cell Data**
   - 多因子实体匹配
   - 融合质量评估框架

4. **TAG: A Hybrid Approach for Biomedical Data Retrieval**
   - Text2SQL + Ontology + Fusion的完整体系
   - 端到端评估方法论
