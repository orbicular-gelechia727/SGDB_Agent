# SCGB 项目评审报告 — 安全评审

> **评审日期**: 2026-03-12  
> **评审对象**: SCGB系统安全架构  
> **评审范围**: API安全、数据安全、访问控制、安全实践  

---

## 1. 执行摘要

### 1.1 总体评价

| 维度 | 评分 | 说明 |
|------|------|------|
| API安全 | 8.0/10 | 速率限制、输入验证到位 |
| 数据安全 | 7.5/10 | SQLite本地存储，需备份策略 |
| 访问控制 | 6.5/10 | 当前公开访问，需用户认证 |
| 安全实践 | 7.5/10 | 基础安全良好，需定期扫描 |
| **综合评分** | **7.5/10** | **可接受** |

### 1.2 关键发现

**优势**:
- ✅ API速率限制 (60 req/min/IP)
- ✅ RFC 7807错误格式，不泄露内部信息
- ✅ 输入验证 (Pydantic模型)
- ✅ CORS配置环境驱动
- ✅ 请求超时保护

**待改进**:
- ⚠️ 缺少用户认证机制
- ⚠️ 缺少API密钥管理
- ⚠️ 缺少审计日志
- ⚠️ SQLite备份策略待完善

---

## 2. API安全评审

### 2.1 速率限制

```python
# 当前实现
class RateLimitMiddleware:
    """速率限制: 60 req/min/IP"""
    
    def __init__(self):
        self.requests: Dict[str, List[float]] = {}
        self.limit = 60
        self.window = 60
```

**评估**:
- ✅ 基于IP的限制合理
- ✅ 滑动窗口算法
- ⚠️ 分布式部署时需使用Redis

### 2.2 输入验证

```python
# Pydantic模型验证
class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    session_id: Optional[str] = None
    
    @validator('query')
    def validate_query(cls, v):
        if not v.strip():
            raise ValueError('Query cannot be empty')
        return v.strip()
```

**评估**:
- ✅ 长度限制防止DoS
- ✅ 类型验证
- ✅ 空白字符清理

### 2.3 SQL注入防护

```python
# 参数化查询
def execute_query(self, sql: str, params: tuple = ()):
    """使用SQLite参数绑定，防止SQL注入"""
    return self.conn.execute(sql, params)

# 示例
self.db.execute(
    "SELECT * FROM samples WHERE tissue = ?",
    (user_input,)  # 参数绑定，安全
)
```

**评估**: ✅ 全程参数化查询，无SQL注入风险

### 2.4 错误处理

```python
# RFC 7807错误格式
{
    "type": "https://api.scgb.io/errors/rate-limit",
    "title": "Rate Limit Exceeded",
    "status": 429,
    "detail": "Request limit exceeded. Please retry after 60 seconds.",
    "instance": "/api/v1/query"
}
```

**评估**:
- ✅ 不泄露内部实现细节
- ✅ 标准化错误格式
- ✅ 包含帮助链接

---

## 3. 数据安全评审

### 3.1 数据存储安全

| 数据类型 | 存储方式 | 评估 |
|----------|----------|------|
| 元数据库 | SQLite本地文件 | ⚠️ 需备份策略 |
| 本体缓存 | SQLite本地文件 | ✅ 公开数据 |
| 会话记忆 | SQLite本地文件 | ⚠️ 需考虑隐私 |
| 日志文件 | 本地文件 | ⚠️ 需轮转策略 |

### 3.2 数据备份建议

```bash
#!/bin/bash
# 建议的数据库备份脚本

BACKUP_DIR="/backup/scgb"
DATE=$(date +%Y%m%d_%H%M%S)

# SQLite备份
sqlite3 unified_metadata.db ".backup ${BACKUP_DIR}/db_${DATE}.bak"

# 保留最近7天备份
find ${BACKUP_DIR} -name "db_*.bak" -mtime +7 -delete

# 可选: 加密备份
gpg --symmetric --cipher-algo AES256 ${BACKUP_DIR}/db_${DATE}.bak
```

### 3.3 数据传输安全

| 场景 | 当前状态 | 建议 |
|------|----------|------|
| API通信 | HTTP | 生产环境启用HTTPS |
| WebSocket | WS | 生产环境启用WSS |
| 静态资源 | HTTP | 使用CDN + HTTPS |

---

## 4. 访问控制评审

### 4.1 当前状态

```
当前: 完全公开访问
├── 无需认证
├── 无需授权
└── 无用户区分
```

### 4.2 建议方案

#### 方案1: API Key (推荐用于初期)

```python
class APIKeyAuth:
    """简单API Key认证"""
    
    def __init__(self):
        self.api_keys = self._load_keys()  # 从环境变量/配置文件加载
    
    async def __call__(self, request: Request):
        api_key = request.headers.get("X-API-Key")
        if api_key not in self.api_keys:
            raise HTTPException(status_code=403, detail="Invalid API key")
        return api_key

# 使用
@app.post("/api/v1/query", dependencies=[Depends(APIKeyAuth())])
```

#### 方案2: JWT Token (推荐用于生产)

```python
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """JWT Token验证"""
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

### 4.3 权限模型建议

```python
class Permission(Enum):
    QUERY = "query"           # 基础查询
    EXPORT = "export"         # 数据导出
    ADMIN = "admin"          # 管理功能

# 基于角色的权限
ROLES = {
    "guest": [Permission.QUERY],
    "user": [Permission.QUERY, Permission.EXPORT],
    "admin": [Permission.QUERY, Permission.EXPORT, Permission.ADMIN],
}
```

---

## 5. 安全监控与审计

### 5.1 当前日志

```python
# 结构化日志
{
    "timestamp": "2026-03-12T10:30:00Z",
    "request_id": "uuid",
    "client_ip": "192.168.1.1",
    "method": "POST",
    "path": "/api/v1/query",
    "status_code": 200,
    "duration_ms": 150,
    "user_agent": "..."
}
```

**评估**:
- ✅ 请求ID追踪
- ✅ 性能指标记录
- ⚠️ 缺少用户标识
- ⚠️ 缺少异常详情

### 5.2 建议增强

```python
class SecurityAudit:
    """安全审计日志"""
    
    def log_auth(self, user_id: str, action: str, success: bool):
        self.logger.info("auth_event", extra={
            "user_id": user_id,
            "action": action,
            "success": success,
            "ip": request.client.host,
            "timestamp": datetime.utcnow()
        })
    
    def log_access(self, user_id: str, resource: str, action: str):
        self.logger.info("access_event", extra={
            "user_id": user_id,
            "resource": resource,
            "action": action,
        })
    
    def log_anomaly(self, event_type: str, details: dict):
        self.logger.warning("anomaly_detected", extra={
            "event_type": event_type,
            "details": details,
        })
```

---

## 6. 安全实践检查清单

### 6.1 已实现

- [x] SQL注入防护 (参数化查询)
- [x] XSS防护 (输入清理 + 输出转义)
- [x] 速率限制 (60 req/min/IP)
- [x] 请求超时保护
- [x] CORS配置
- [x] 错误信息隐藏
- [x] 输入长度限制

### 6.2 待实现

- [ ] HTTPS/WSS (生产环境)
- [ ] 用户认证机制
- [ ] API密钥管理
- [ ] 审计日志
- [ ] 依赖安全扫描
- [ ] 数据库备份加密
- [ ] 安全响应头

### 6.3 建议配置

```python
# 安全响应头
@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    return response
```

---

## 7. 依赖安全

### 7.1 建议扫描工具

```bash
# Python依赖扫描
pip install safety
safety check

# 代码安全扫描
pip install bandit
bandit -r agent_v2/src

# 定期更新
pip list --outdated
```

### 7.2 GitHub Dependabot配置

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/agent_v2"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    
  - package-ecosystem: "npm"
    directory: "/agent_v2/web"
    schedule:
      interval: "weekly"
```

---

## 8. 风险评估

### 8.1 风险矩阵

| 风险 | 可能性 | 影响 | 等级 | 缓解措施 |
|------|--------|------|------|----------|
| 未授权访问 | 中 | 高 | 🔴 | 增加认证机制 |
| 数据泄露 | 低 | 高 | 🟡 | 备份加密 |
| DoS攻击 | 中 | 中 | 🟡 | 速率限制+CDN |
| 依赖漏洞 | 中 | 中 | 🟡 | 定期扫描 |
| 内部威胁 | 低 | 中 | 🟢 | 审计日志 |

### 8.2 缓解优先级

| 优先级 | 措施 | 预估工作量 |
|--------|------|-----------|
| P0 | HTTPS/WSS部署 | 1天 |
| P0 | API认证机制 | 2天 |
| P1 | 审计日志 | 2天 |
| P1 | 安全扫描集成 | 1天 |
| P2 | 备份加密 | 1天 |
| P2 | 安全响应头 | 0.5天 |

---

## 9. 评审结论

### 9.1 总体评价

SCGB项目的安全实践达到了**基础安全水平**，API安全、输入验证、错误处理等方面实现良好。但对于生产环境，需要补充认证机制、审计日志和安全监控。

### 9.2 评分详情

| 维度 | 评分 | 说明 |
|------|------|------|
| API安全 | 8.0/10 | 速率限制、输入验证到位 |
| 数据安全 | 7.5/10 | 本地存储，需备份策略 |
| 访问控制 | 6.5/10 | 当前公开，需认证 |
| 安全实践 | 7.5/10 | 基础良好，需扫描 |
| **综合** | **7.5/10** | **可接受** |

### 9.3 关键建议

1. **启用HTTPS/WSS** (P0): 生产环境必须使用TLS
2. **增加认证机制** (P0): API Key或JWT Token
3. **完善审计日志** (P1): 记录用户操作和异常
4. **集成安全扫描** (P1): safety + bandit自动化

---

*本评审完成。*
