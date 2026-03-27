# SCeQTL-Agent V2 性能优化指南

## 📊 当前性能瓶颈

| 问题 | 影响 | 优先级 |
|------|------|--------|
| Explore API 10秒+延迟 | 用户首次进入探索页面体验极差 | 🔴 P0 |
| JS Bundle 813KB | 首屏加载慢，移动端尤其明显 | 🟡 P1 |
| 数据库JOIN无索引覆盖 | 大表排序性能差 | 🔴 P0 |

---

## 🚀 快速优化步骤（预计提升 100倍）

### 步骤1：添加数据库索引（立即执行）

```bash
cd database_development/unified_db

# 执行优化SQL
sqlite3 unified_metadata.db < optimize_explore.sql

# 验证索引创建成功
sqlite3 unified_metadata.db "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_samples_n_cells%'"
```

**预期效果**：Explore API 从 10秒 → **< 500ms**

---

### 步骤2：替换优化后的 Explore API

```bash
cd agent_v2

# 备份原文件
cp api/routes/explore.py api/routes/explore_original.py

# 使用优化版本
cp api/routes/explore_optimized.py api/routes/explore.py

# 重启服务器
python3 run_server.py --port 8000
```

---

### 步骤3：前端代码分割优化

```bash
cd agent_v2/web

# 使用优化配置构建
cp vite.config.optimized.ts vite.config.ts

# 重新构建
npm run build

# 检查生成的文件大小
ls -lh dist/assets/js/
```

**预期效果**：JS Bundle 从 813KB → **~300KB（主包）**

---

## 📁 已生成的优化文件

| 文件 | 说明 | 使用方式 |
|------|------|---------|
| `database_development/unified_db/optimize_explore.sql` | 数据库优化索引 | `sqlite3 unified_metadata.db < optimize_explore.sql` |
| `agent_v2/api/routes/explore_optimized.py` | 优化版Explore API | 替换 `explore.py` |
| `agent_v2/web/vite.config.optimized.ts` | 代码分割配置 | 替换 `vite.config.ts` |

---

## 🔧 高级优化（可选）

### 1. 启用 SQLite WAL 模式

```sql
-- WAL模式提升并发性能
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA cache_size=-131072;  -- 128MB cache
```

### 2. 添加 CDN 缓存（生产环境）

在 `api/main.py` 中修改静态文件服务：

```python
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.gzip import GZipMiddleware

# 添加GZip压缩
app.add_middleware(GZipMiddleware, minimum_size=1000)

# 静态文件添加缓存头
app.mount("/assets", StaticFiles(directory=str(web_dist / "assets"), headers={
    "Cache-Control": "public, max-age=31536000, immutable"
}), name="static-assets")
```

### 3. 数据库迁移到 PostgreSQL（大并发场景）

```python
# agent_v2/src/dal/database.py
# 使用 PostgreSQL 替代 SQLite
import asyncpg

class PostgresDAL:
    """PostgreSQL implementation for high-concurrency scenarios."""
    # ... 实现异步连接池
```

---

## 📈 性能监控

启动服务器后，测试优化效果：

```bash
# 测试 Explore API
curl -w "\nTime: %{time_total}s\n" -X POST http://localhost:8000/api/v1/explore \
  -H "Content-Type: application/json" \
  -d '{"tissues":[],"diseases":[],"offset":0,"limit":25}'

# 预期结果: Time: 0.2s ~ 0.5s (原来 10s+)
```

---

## ✅ 验证清单

- [ ] 数据库索引已创建
- [ ] Explore API 响应 < 1秒
- [ ] 前端 JS Bundle < 500KB
- [ ] 首页加载 < 3秒
- [ ] 探索页面首屏 < 2秒

---

## 🆘 如果仍然慢

1. **检查索引是否生效**
   ```sql
   EXPLAIN QUERY PLAN 
   SELECT pk FROM unified_samples ORDER BY n_cells DESC LIMIT 25;
   -- 应该看到 "USING INDEX" 而不是 "SCAN TABLE"
   ```

2. **检查数据库文件位置**
   - 确保数据库在 SSD 上，而非网络磁盘
   - 检查磁盘 I/O：`iostat -x 1`

3. **内存检查**
   - SQLite 缓存设置：当前 64MB，可增加到 256MB
   - 系统可用内存应 > 4GB

4. **联系支持**
   - 查看日志：`tail -f agent_v2/server.log`
   - 报告问题：提供 `EXPLAIN QUERY PLAN` 输出
