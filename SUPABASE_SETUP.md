# Supabase 设置指南

## 1. 创建Supabase项目

1. 访问 [https://supabase.com](https://supabase.com)
2. 创建新项目
3. 获取项目URL和API密钥

## 2. 创建环境变量

在项目根目录创建 `.env` 文件：

```env
NUXT_SUPABASE_URL=your_supabase_project_url
NUXT_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 3. 创建数据库表

在Supabase SQL编辑器中执行以下SQL：

```sql
-- 创建POI表 (简化版本)
CREATE TABLE pois (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  rating INTEGER DEFAULT 1 CHECK (rating >= 1 AND rating <= 5),
  lng DOUBLE PRECISION NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  category TEXT DEFAULT '其他',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_pois_updated_at
    BEFORE UPDATE ON pois
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 创建索引以优化查询性能
CREATE INDEX idx_pois_category ON pois(category);
CREATE INDEX idx_pois_name ON pois(name);
CREATE INDEX idx_pois_created_at ON pois(created_at);

-- 插入示例数据（可选）
INSERT INTO pois (id, name, description, rating, lng, lat, category) VALUES
('poi-example-1', '莲花山公园', '深圳著名公园，可俯瞰市区景色', 4, 114.059481, 22.553502, '公园');
```

## 4. 设置行级安全策略（RLS）

```sql
-- 启用行级安全
ALTER TABLE pois ENABLE ROW LEVEL SECURITY;

-- 允许所有人读取POI数据
CREATE POLICY "Allow public read access" ON pois
FOR SELECT USING (true);

-- 允许所有人插入POI数据（开发阶段，生产环境可能需要更严格的控制）
CREATE POLICY "Allow public insert access" ON pois
FOR INSERT WITH CHECK (true);
```

## 5. 功能说明

### 已实现的功能：

1. **API端点**：

   - `GET /api/pois` - 获取POI列表，支持筛选和排序
   - `POST /api/pois` - 添加新POI

2. **筛选和排序**：

   - 按分类筛选
   - 按名称和描述搜索
   - 按评分、距离、总分等排序

3. **开发者工具**：

   - 复制功能改为保存到数据库
   - 表单验证和错误处理

4. **实时数据**：
   - 添加POI后自动刷新列表
   - API端计算距离和综合分数

### 查询参数支持：

- `category`: 分类筛选
- `search`: 搜索关键词
- `sortBy`: 排序字段 (name, rating, distance, distanceScore, totalScore)
- `sortOrder`: 排序方向 (asc, desc)

## 6. 使用说明

1. 设置环境变量后重启开发服务器
2. 开发者模式下添加的POI会直接保存到数据库
3. POI列表的筛选和排序通过API实现，提高性能
4. 距离和综合分数在API端计算，确保数据一致性
