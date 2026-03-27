# 架构设计审核报告 #2：模块间耦合与接口设计

**审核日期**: 2026-03-06  
**审核维度**: 模块耦合度、接口设计、依赖关系  
**审核人员**: 独立架构审核员

---

## 1. 模块依赖关系分析

### 1.1 当前依赖图

```
                    ┌─────────────────┐
                    │   Coordinator   │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   Query       │   │  Ontology     │   │  SQL Gen      │
│ Understanding │   │  Resolver     │   │  & Executor   │
└───────┬───────┘   └───────┬───────┘   └───────┬───────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
                   ┌───────────────┐
                   │  Cross-DB     │
                   │  Fusion       │
                   └───────┬───────┘
                           ▼
                   ┌───────────────┐
                   │  Answer       │
                   │  Synthesis    │
                   └───────────────┘
```

### 1.2 依赖复杂度评估

| 模块 | 入度 | 出度 | 耦合度 | 评级 |
|------|------|------|--------|------|
| Coordinator | 0 | 10 | 高 | 核心枢纽 |
| Query Understanding | 1 | 2 | 中 | 独立 |
| Ontology Resolver | 2 | 2 | 中 | 独立 |
| SQL Generator | 2 | 1 | 低 | 独立 |
| SQL Executor | 1 | 1 | 低 | 独立 |
| Cross-DB Fusion | 3 | 1 | 高 | 聚合节点 |
| Answer Synthesis | 2 | 0 | 中 | 终点 |

---

## 2. 接口设计评估

### 2.1 数据流接口

#### ✅ 优点

1. **统一的数据结构**
   - `ParsedQuery` 贯穿查询理解到SQL生成
   - `ResolvedEntity` 在本体解析和SQL生成间传递
   - `FusedRecord` 作为跨模块标准结果格式

2. **清晰的阶段边界**
   - 每个模块有明确的输入输出契约
   - 中间数据类型定义完善

#### ⚠️ 问题

1. **循环依赖风险**
   ```python
   # 潜在问题: SQL Executor的fallback可能回调Query Understanding
   SQLExecutor → fallback → relax_query → (可能) → QueryUnderstanding
   ```
   - 建议明确fallback策略，避免循环依赖

2. **Memory System的隐式依赖**
   - Memory System被多个模块依赖但未明确接口
   - 建议定义 `IMemoryStore` 接口契约

### 2.2 Tool接口设计

#### Coordinator的10个Tool评估

| Tool | 粒度 | 复杂度 | 内聚性 | 建议 |
|------|------|--------|--------|------|
| understand_query | 粗 | 高 | ⭐⭐⭐ | 保持 |
| resolve_ontology | 中 | 高 | ⭐⭐⭐⭐ | 保持 |
| inspect_schema | 细 | 低 | ⭐⭐⭐⭐⭐ | 保持 |
| generate_sql | 粗 | 高 | ⭐⭐⭐ | 拆分为2个? |
| execute_sql | 细 | 中 | ⭐⭐⭐⭐⭐ | 保持 |
| fuse_results | 中 | 高 | ⭐⭐⭐⭐ | 保持 |
| assess_quality | 细 | 中 | ⭐⭐⭐⭐ | 考虑合并到fuse_results |
| find_related | 中 | 中 | ⭐⭐⭐⭐ | 保持 |
| check_availability | 细 | 低 | ⭐⭐⭐⭐⭐ | 保持 |
| recall_memory | 细 | 低 | ⭐⭐⭐⭐⭐ | 保持 |

**建议**: `generate_sql` 可考虑拆分为 `plan_query` + `generate_sql`，增加可观测性

---

## 3. 耦合度问题详解

### 3.1 紧耦合区域

#### TC1: Coordinator与所有模块

```python
# 当前设计 - 高度耦合
class CoordinatorAgent:
    def __init__(self, llm_client, tool_registry, memory_system):
        # Coordinator知晓所有Tool的细节
        self.llm = llm_client
        self.tools = tool_registry  # 10个tools
        self.memory = memory_system
```

**问题**:
- Coordinator成为"上帝类"
- 单点修改风险高
- 测试困难（需要mock所有依赖）

**建议**: 引入中介者模式或事件总线

#### TC2: Cross-DB Fusion与上游模块

```python
# Fusion Engine依赖多个上游输出
class CrossDBFusionEngine:
    def fuse_results(self, results: List[dict], entity_type: str):
        # 依赖SQL Executor的输出格式
        # 依赖Query Understanding的entity_type
        # 依赖Ontology Resolution的db_values格式
```

**问题**:
- 格式变化影响大
- 集成测试复杂

**建议**: 定义 `FusionInput` 标准接口

### 3.2 隐式耦合

#### IC1: System Prompt的知识耦合

```python
SYSTEM_PROMPT_TEMPLATE = """
## 数据库结构摘要
{schema_summary}  # 隐式依赖SchemaInspector的内部格式

## 可用工具
{tool_descriptions}  # 隐式依赖ToolRegistry的实现
"""
```

**风险**: Prompt模板与实现细节耦合，schema变化需同步改模板

---

## 4. 接口契约建议

### 4.1 建议的接口分层

```python
# Layer 1: 核心领域接口 (Domain Interfaces)
class IQueryParser(Protocol):
    async def parse(self, query: str) -> ParsedQuery: ...

class IOntologyResolver(Protocol):
    async def resolve(self, entities: List[BioEntity]) -> List[ResolvedEntity]: ...

class ISQLGenerator(Protocol):
    async def generate(self, query: ParsedQuery, entities: List[ResolvedEntity]) -> SQLCandidate: ...

# Layer 2: 应用服务接口 (Application Interfaces)  
class IMetadataService(Protocol):
    async def search(self, request: SearchRequest) -> SearchResponse: ...
    async def get_entity(self, id: str) -> Entity: ...

# Layer 3: 基础设施接口 (Infrastructure Interfaces)
class IDatabase(Protocol):
    async def execute(self, sql: str, params: dict) -> QueryResult: ...

class ILLMClient(Protocol):
    async def chat(self, messages: list, tools: list = None) -> LLMResponse: ...
```

### 4.2 事件驱动解耦方案

对于异步流程，建议引入事件总线：

```python
# 定义领域事件
@dataclass
class QueryParsedEvent:
    session_id: str
    parsed_query: ParsedQuery
    timestamp: datetime

@dataclass
class ResultsFusedEvent:
    session_id: str
    fused_results: List[FusedRecord]
    fusion_stats: dict

# 事件总线
class EventBus:
    def subscribe(self, event_type: Type, handler: Callable): ...
    def publish(self, event: DomainEvent): ...
```

---

## 5. 重构建议

### 5.1 短期优化 (Phase 1前)

1. **提取接口协议**
   - 为每个核心模块定义Protocol
   - 使用依赖注入替代直接实例化

2. **标准化数据传输对象**
   ```python
   # 统一模块间通信格式
   class ModuleContext(BaseModel):
       session_id: str
       request_id: str
       timestamp: datetime
       trace_id: str  # 用于链路追踪
   ```

### 5.2 中期重构 (Phase 2)

1. **引入CQRS模式**
   - 查询路径：Coordinator → QueryHandler → Response
   - 命令路径：Coordinator → CommandHandler → Event

2. **模块化打包**
   ```
   sceqtl_agent/
   ├── core/           # 纯领域逻辑，无外部依赖
   ├── application/    # 应用服务，依赖core
   ├── infrastructure/ # 基础设施实现
   └── interfaces/     # API/CLI/Web接口
   ```

### 5.3 长期演进 (Phase 4后)

考虑微服务拆分（如用户量增长）:
- `query-service`: 查询理解与SQL生成
- `ontology-service`: 本体解析（可独立复用）
- `fusion-service`: 跨库融合

---

## 6. 测试策略影响

### 6.1 当前设计的测试挑战

| 模块 | 测试难度 | 原因 |
|------|---------|------|
| Coordinator | 高 | 依赖太多，需要大量mock |
| Fusion Engine | 中 | 依赖多个上游输出格式 |
| Answer Synthesis | 低 | 相对独立，输入输出清晰 |



**核心建议**:
1. **高优先级**: 定义明确的接口契约（Protocol）
2. **中优先级**: 引入依赖注入框架
3. **低优先级**: 考虑事件驱动架构演进

**综合评级**: **B (良好，但需关注耦合问题)**

---

*审核完成*
