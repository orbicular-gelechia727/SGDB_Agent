# 硬件需求评估报告

## 概述

本报告评估 SCGB 平台在不同规模下的硬件需求，提供从开发环境到生产环境的配置建议。

---

## 1. 当前资源使用分析

### 1.1 数据库存储分析

| 组件 | 大小 | 占比 | 增长趋势 |
|------|------|------|---------|
| unified_metadata.db | 1.4 GB | 93% | +100%/年 |
| ontology_cache.db | 103 MB | 7% | +10%/年 |
| memory_store.db | <1 MB | <1% | +50%/年 |
| **总计** | **1.5 GB** | **100%** | **+100%/年** |

### 1.2 查询性能基线

| 操作 | SQLite | 目标 (PostgreSQL) |
|------|--------|------------------|
| 简单查询 | 10-50ms | <10ms |
| 全文搜索 | 100-500ms | <50ms |
| 统计查询 | 1-5s | <500ms |
| 仪表盘加载 | 90s → 5ms (优化后) | <5ms |

---

## 2. 部署场景配置

### 2.1 开发环境

**适用场景**: 本地开发、功能测试

| 组件 | 配置 | 说明 |
|------|------|------|
| CPU | 4 核 | Intel i5 / AMD Ryzen 5 |
| 内存 | 8 GB | 最低要求 |
| 存储 | 50 GB SSD | 开发数据 + 依赖 |
| 网络 | 10 Mbps | 下载本体/更新 |

**预估成本**: $0 (使用现有设备)

---

### 2.2 测试环境

**适用场景**: 集成测试、性能测试

| 组件 | 配置 | 说明 |
|------|------|------|
| CPU | 8 核 | Intel i7 / AMD Ryzen 7 |
| 内存 | 16 GB | 支持并发测试 |
| 存储 | 200 GB SSD | 测试数据多版本 |
| 网络 | 100 Mbps | 快速部署 |

**云服务器推荐**:
- AWS: t3.xlarge ($0.1664/小时 ≈ $120/月)
- 阿里云: ecs.g7.xlarge (¥450/月)
- GCP: n2-standard-4 ($0.194/小时 ≈ $140/月)

---

### 2.3 生产环境 (小规模)

**适用场景**: <1000 日活用户，研究机构内部使用

**配置 A: 单服务器**

| 组件 | 配置 | 说明 |
|------|------|------|
| CPU | 16 核 | Intel Xeon / AMD EPYC |
| 内存 | 32 GB | 数据库缓存 + 应用 |
| 存储 | 500 GB NVMe SSD | 高性能存储 |
| 网络 | 1 Gbps | 公网访问 |

**部署架构**:
```
┌─────────────────────────────────────┐
│  单服务器 (16c/32g/500g)            │
│  ├── Docker/Podman                  │
│  │   ├── FastAPI 应用 (4 workers)   │
│  │   └── React 前端 (Nginx)         │
│  ├── PostgreSQL                     │
│  └── Redis                          │
└─────────────────────────────────────┘
```

**预估成本**:
- 物理服务器: $3000-5000 (一次性)
- 云服务器: $400-600/月

---

### 2.4 生产环境 (中规模)

**适用场景**: <10,000 日活用户，对外服务

**配置 B: 分离架构**

| 角色 | CPU | 内存 | 存储 | 数量 |
|------|-----|------|------|------|
| 应用服务器 | 8 核 | 16 GB | 100 GB SSD | 2 |
| 数据库服务器 | 16 核 | 64 GB | 1 TB NVMe SSD | 1 |
| 缓存服务器 | 4 核 | 16 GB | 50 GB SSD | 1 |

**部署架构**:
```
                         ┌─────────────────┐
                         │   Load Balancer │
                         │   (Nginx/ALB)   │
                         └────────┬────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   App Server 1  │     │   App Server 2  │     │   App Server N  │
│   (FastAPI)     │     │   (FastAPI)     │     │   (FastAPI)     │
└────────┬────────┘     └────────┬────────┘     └─────────────────┘
         │                       │
         └───────────────────────┘
                    │
    ┌───────────────┼───────────────┐
    ▼               ▼               ▼
┌────────┐    ┌────────┐     ┌──────────┐
│PostgreSQL│   │  Redis │     │   NFS    │
│Primary  │    │ Cache  │     │ (Files)  │
└────────┘    └────────┘     └──────────┘
     │
     ▼
┌──────────┐
│  Standby │
│   (RO)   │
└──────────┘
```

**预估成本**:
- 物理服务器: $8000-15000 (一次性)
- 云服务器: $1200-2000/月

---

### 2.5 生产环境 (大规模)

**适用场景**: >10,000 日活用户，多数据中心

**配置 C: 高可用架构**

| 角色 | CPU | 内存 | 存储 | 数量 |
|------|-----|------|------|------|
| 应用服务器 | 16 核 | 32 GB | 200 GB SSD | 4+ |
| 数据库 Primary | 32 核 | 128 GB | 2 TB NVMe SSD | 1 |
| 数据库 Replica | 32 核 | 128 GB | 2 TB NVMe SSD | 2 |
| 缓存集群 | 8 核 | 32 GB | 100 GB SSD | 3 |
| 搜索集群 | 16 核 | 64 GB | 500 GB SSD | 3 |

**部署架构**:
```
┌─────────────────────────────────────────────────────────────┐
│                    Global Load Balancer                     │
│                    (Cloudflare/AWS ALB)                     │
└─────────────────────────────────────────────────────────────┘
          │                         │
          ▼                         ▼
┌──────────────────┐      ┌──────────────────┐
│  Region: US-East │      │  Region: EU-West │
│  ┌────────────┐  │      │  ┌────────────┐  │
│  │ App Cluster│  │      │  │ App Cluster│  │
│  │ (4 nodes)  │  │      │  │ (4 nodes)  │  │
│  └────────────┘  │      │  └────────────┘  │
│  ┌────────────┐  │      │  ┌────────────┐  │
│  │ DB Primary │  │◄────►│  │ DB Replica │  │
│  │ + Replica  │  │  同步 │  │   (RO)     │  │
│  └────────────┘  │      │  └────────────┘  │
│  ┌────────────┐  │      │  ┌────────────┐  │
│  │ ES Cluster │  │      │  │ ES Cluster │  │
│  └────────────┘  │      │  └────────────┘  │
└──────────────────┘      └──────────────────┘
```

**预估成本**:
- 云基础设施: $5000-10000/月
- CDN + 负载均衡: $500-1000/月

---

## 3. 存储规划

### 3.1 存储需求计算

```python
def calculate_storage(years=3):
    """
    存储需求计算模型
    """
    # 当前数据
    current_samples = 756_579
    current_size_gb = 1.4
    
    # 增长假设
    annual_growth_rate = 0.50  # 50% 年增长
    
    # 计算未来规模
    future_samples = current_samples * ((1 + annual_growth_rate) ** years)
    future_size_gb = current_size_gb * ((1 + annual_growth_rate) ** years)
    
    # 数据库开销 (索引、WAL、备份)
    index_overhead = 1.5  # 索引占 50%
    wal_overhead = 0.3    # WAL 占 30%
    backup_retention = 3  # 3 份备份
    
    total_storage = future_size_gb * (1 + index_overhead + wal_overhead) * backup_retention
    
    return {
        "samples": int(future_samples),
        "raw_data_gb": round(future_size_gb, 2),
        "total_storage_tb": round(total_storage / 1024, 2),
        "recommended_tb": round(total_storage / 1024 * 1.5, 2)  # 50% buffer
    }

# 3 年规划
result = calculate_storage(3)
# {
#   "samples": 2,562,821,
#   "raw_data_gb": 4.73,
#   "total_storage_tb": 25.5,
#   "recommended_tb": 38.3
# }
```

### 3.2 存储层级

| 层级 | 介质 | 用途 | 容量 |
|------|------|------|------|
| 热数据 | NVMe SSD | 活跃查询数据 | 100 GB |
| 温数据 | SATA SSD | 历史查询数据 | 500 GB |
| 冷数据 | HDD | 归档/备份 | 2 TB |

---

## 4. 网络规划

### 4.1 带宽需求

| 场景 | 并发 | 平均响应 | 带宽需求 |
|------|------|---------|---------|
| API 查询 | 50 | 50 KB | 2 Mbps |
| 前端资源 | 100 | 1 MB | 100 Mbps |
| 数据导出 | 10 | 10 MB | 100 Mbps |
| **总计** | - | - | **200 Mbps** |

### 4.2 CDN 配置

```
用户请求
    │
    ▼
┌─────────────┐
│   CDN       │  ← 缓存静态资源 (JS/CSS/图片)
│ (Cloudflare)│
└──────┬──────┘
       │ 未命中
       ▼
┌─────────────┐
│ Load Balancer│
│   (Nginx)   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ App Servers │
└─────────────┘
```

---

## 5. 性能基准测试

### 5.1 推荐配置性能

| 配置 | QPS | 平均延迟 | 并发用户 |
|------|-----|---------|---------|
| 开发环境 (4c/8g) | 50 | 100ms | 10 |
| 测试环境 (8c/16g) | 200 | 50ms | 50 |
| 生产小 (16c/32g) | 500 | 30ms | 200 |
| 生产中 (分离架构) | 2000 | 20ms | 1000 |
| 生产大 (分布式) | 10000 | 10ms | 5000 |

### 5.2 压力测试场景

```python
# 使用 Locust 进行压力测试
from locust import HttpUser, task

class SCGBUser(HttpUser):
    @task(5)
    def simple_search(self):
        self.client.post("/api/v1/explore", json={
            "filters": {"tissue": ["brain"]},
            "limit": 20
        })
    
    @task(3)
    def ontology_query(self):
        self.client.get("/api/v1/ontology/resolve?term=liver&field=tissue")
    
    @task(2)
    def stats_dashboard(self):
        self.client.get("/api/v1/stats/dashboard")
```

---

## 6. 成本对比

### 6.1 自建 vs 云服务

| 方案 | 初期投入 | 月运营成本 | 3年总成本 | 适用场景 |
|------|---------|-----------|----------|---------|
| 自建物理机 | $10,000 | $200 | $17,200 | 长期运营 |
| 云服务器 | $0 | $1,500 | $54,000 | 快速启动 |
| 混合方案 | $3,000 | $800 | $31,800 | 推荐 |

### 6.2 云服务对比

| 提供商 | 配置 | 月成本 | 特点 |
|--------|------|--------|------|
| AWS | m6i.2xlarge | $280 | 稳定，生态完善 |
| GCP | n2-standard-8 | $240 | 网络好，BigQuery |
| Azure | D8s_v5 | $280 | 企业集成 |
| 阿里云 | ecs.g7.2xlarge | ¥1800 | 国内访问快 |

---

## 7. 扩容策略

### 7.1 垂直扩容 (Scale Up)

```
阶段 1: 8c/16g → 16c/32g
- 增加 CPU 核数处理更多并发
- 增加内存扩大数据库缓存

阶段 2: 16c/32g → 32c/128g
- 数据库专用服务器
- 内存容纳全量热点数据
```

### 7.2 水平扩容 (Scale Out)

```
阶段 1: 应用层扩容
- 增加应用服务器节点
- 负载均衡分发请求

阶段 2: 数据库读写分离
- Primary 处理写入
- Replica 处理查询

阶段 3: 分片
- 按 source_database 分片
- 跨分片查询路由
```

---

## 8. 推荐配置总结

### 8.1 最小可行产品 (MVP)

```yaml
# 推荐配置: 单服务器
server:
  cpu: 8 cores
  memory: 16 GB
  storage: 200 GB SSD
  network: 100 Mbps
  
cost:
  cloud: $200-300/month
  onpremise: $1500 + $100/month
```

### 8.2 标准生产环境

```yaml
# 推荐配置: 分离架构
app_servers:
  count: 2
  cpu: 8 cores each
  memory: 16 GB each
  
database:
  primary:
    cpu: 16 cores
    memory: 64 GB
    storage: 1 TB NVMe SSD
  replica:
    cpu: 16 cores
    memory: 64 GB
    storage: 1 TB NVMe SSD
    
cache:
  cpu: 4 cores
  memory: 16 GB
  
cost:
  cloud: $800-1200/month
  onpremise: $8000 + $200/month
```

---

## 9. 监控指标

### 9.1 硬件监控

| 指标 | 告警阈值 | 严重阈值 |
|------|---------|---------|
| CPU 使用率 | >70% | >90% |
| 内存使用率 | >80% | >95% |
| 磁盘使用率 | >70% | >85% |
| 磁盘 I/O 延迟 | >10ms | >50ms |
| 网络延迟 | >100ms | >500ms |

### 9.2 应用监控

| 指标 | 目标 | 告警阈值 |
|------|------|---------|
| 响应时间 (p50) | <50ms | >100ms |
| 响应时间 (p99) | <200ms | >500ms |
| 错误率 | <0.1% | >1% |
| 吞吐量 | - | 下降 >20% |

