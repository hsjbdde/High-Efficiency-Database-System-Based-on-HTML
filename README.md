# 高校教务数据库管理系统

本项目是一个基于 **Node.js** 、**MySQL** 和 **HTML5/JavaScript** 开发的高校教务管理系统。系统支持**管理员、教师、学生**三端角色登录，具备完备的数据验证、行级数据隔离、自助注册、实时全字段模糊搜索以及可视化数据大屏功能。

---

## 系统架构与数据说明

* **前端门户 (`index.html`)**: 采用单页面应用 (SPA) 架构，利用 Flexbox/Grid 进行动态响应式布局。通过 `Fetch API` 与后端进行异步 JSON 数据交互。集成 `Chart.js` 动态绘制院系学生与课程分布饼图，并实现了纯前端零延迟的实时全字段模糊搜索。
* **后端服务 (`server.js`)**: 基于 Node.js 运行时，使用 `mysql2/promise` 高性能连接池驱动。核心业务路由具备 `validateData` 数据合规性拦截中间件，并具备空值清洗机制（自动将前端空字符串转为数据库 `NULL`），大幅提升了系统的鲁棒性。
* **数据库架构 (`MySQL`)**: 业务表结构设计严格遵循**第三范式 (3NF)**（如专业表、学生表、课程表仅存储关联表主键 ID，消除传递函数依赖），在降低数据冗余、避免插入/删除异常的同时，后端通过宽容的 `LEFT JOIN` 语句动态拓扑生成多维度的前端视图。

---

##  环境准备

在开始部署前，请确保您的电脑已安装以下软件：
1. **Node.js** (推荐 v16 或更高版本)
2. **MySQL 数据库** (推荐 v8.0 或更高版本)
3. 任意现代前端浏览器 (如 Chrome, Edge, Safari)

---

##  系统安装与部署步骤

### 1. 数据库初始化
打开您的 MySQL 客户端（如 Navicat、Workbench 或命令行），连接成功后执行以下步骤：
1. 创建数据库：
   运行SQL语句，
CREATE DATABASE IF NOT EXISTS SchoolManagement DEFAULT CHARSET utf8mb4;
USE SchoolManagement;

-- 基础字典表
CREATE TABLE Users ( username VARCHAR(50) PRIMARY KEY, password VARCHAR(50), role VARCHAR(20) );
CREATE TABLE DegreeLevel ( level_id INT PRIMARY KEY, level_name VARCHAR(50) );
CREATE TABLE Department ( dept_code VARCHAR(20) PRIMARY KEY, dept_name VARCHAR(100), office_location VARCHAR(100), phone VARCHAR(20) );
CREATE TABLE Major ( major_id INT AUTO_INCREMENT PRIMARY KEY, major_name VARCHAR(100), dept_code VARCHAR(20) );
CREATE TABLE Teacher ( teacher_id VARCHAR(20) PRIMARY KEY, name VARCHAR(50), dept_code VARCHAR(20) );
CREATE TABLE Course ( course_id VARCHAR(20) PRIMARY KEY, course_name VARCHAR(100), description TEXT, credit_hours INT, credits INT, degree_level_id INT, offering_dept_code VARCHAR(20) );

-- 核心业务表
CREATE TABLE Student (
    student_id VARCHAR(20) PRIMARY KEY, name VARCHAR(50), id_card VARCHAR(20), 
    dormitory VARCHAR(50), home_address VARCHAR(200), phone VARCHAR(20), 
    birth_date DATE, gender CHAR(1), grade_year INT, major_id INT, 
    minor_dept_code VARCHAR(20) NULL, degree_level_id INT, earned_credits INT
);
CREATE TABLE Grade ( grade_id INT AUTO_INCREMENT PRIMARY KEY, student_id VARCHAR(20), course_id VARCHAR(20), score DECIMAL(5,2), semester VARCHAR(20) );
CREATE TABLE TeacherCourse ( id INT AUTO_INCREMENT PRIMARY KEY, teacher_id VARCHAR(20), course_id VARCHAR(20) );

-- 插入一条测试管理员账号
INSERT INTO Users (username, password, role) VALUES ('admin', '123456', 'admin');
=

2. 后端依赖安装
打开终端（或 Windows PowerShell），进入本项目的后端代码所在目录。

执行以下命令初始化并安装核心依赖包：

npm init -y;

安装 Express、跨域组件与 MySQL2 驱动；

npm install express cors mysql2

3. 修改后端数据库配置
用文本编辑器打开 server.js，修改第 15 行左右的 dbConfig 数据库连接配置，填入您真实的 MySQL 密码：JavaScriptconst dbConfig = {
    host: 'localhost',         // 数据库地址
    port: 3306,                // MySQL 端口
    user: 'root',              // 您的 MySQL 用户名
    password: '您的真实密码',     // ⚠️ 务必修改为您的 MySQL 密码
    database: 'SchoolManagement',
    // ...
};
在终端运行以下命令启动 Node.js 服务器：

node server.js

当控制台打印出 🚀 多角色融合版后端已启动 (MySQL): http://localhost:3000 时，说明后端服务启动成功。请保持该窗口运行，切勿关闭。

4. 运行前端界面直接双击打开项目中的 index.html 文件（或通过 VS Code 的 Live Server 插件预览），即可进入高校教务系统门户登录页。

## 功能验证与测试用例
系统内置了三套测试账号，覆盖不同的角色权限，供功能审查与验证：

管理员      admin     123456    拥有完整 8 大模块管理权限、大屏统计。在“新增”模式下拥有必填主键 * 红星提示，且输入非标数据（如错误身份证、超出 0-100 的成绩）时可触发表单红字错误拦截提示。

教师端      T1001     123456    仅能查看张教授自己的课表，并在【学生成绩评定】中仅能录入、修改其授课班级学生的成绩。

学生端      S2026001  123456    仅能查看王同学本人的学籍档案信息，以及本人的历史学期选课成绩单，无权窥探他人隐私。

## 核心亮点功能
智能模糊查询验证: 进入任意管理数据表，在顶部的“模糊搜索...”框中输入任意关键字（如输入“计算机”或性别“M”），表格将实现 0 毫秒无感实时过滤。
自助注册网关验证:
1. 在登录页点击“没有账号？立即注册”。
2. 创建账号时，若故意输入主表学籍档案中不存在的工号/学号和姓名（如 S999），系统会触发硬性合规性拦截并报错。输入正确的学籍档案信息（如 S2026002，李小红）则会提示绿色注册成功并安全写入对应的密码表。
