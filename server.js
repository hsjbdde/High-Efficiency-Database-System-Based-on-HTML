const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 数据库连接
const dbConfig = {
    host: 'localhost',         
    port: 3306,                
    user: 'root',              
    password: 'QZPLasd123', 
    database: 'SchoolManagement',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

const pool = mysql.createPool(dbConfig);

const executeSQL = async (res, query, params = []) => {
    try {
        const [rows] = await pool.execute(query, params);
        res.json({ code: 200, data: rows });
    } catch (err) {
        console.error("SQL执行报错:", err.message);
        res.status(500).json({ code: 500, message: err.message });
    }
};


// 管理员查询接口
app.get('/api/degree', (req, res) => executeSQL(res, "SELECT level_id as id, level_name as name FROM DegreeLevel"));
app.get('/api/department', (req, res) => executeSQL(res, "SELECT dept_code as code, dept_name as name, office_location as location, phone FROM Department"));
app.get('/api/major', (req, res) => executeSQL(res, "SELECT m.major_id as id, m.major_name as name, m.dept_code, d.dept_name FROM Major m LEFT JOIN Department d ON m.dept_code = d.dept_code"));
app.get('/api/teacher', (req, res) => executeSQL(res, "SELECT t.teacher_id as id, t.name, t.dept_code, d.dept_name FROM Teacher t LEFT JOIN Department d ON t.dept_code = d.dept_code"));
app.get('/api/course', (req, res) => executeSQL(res, "SELECT c.course_id as id, c.course_name as name, c.description, c.credit_hours, c.credits, c.degree_level_id, dl.level_name, c.offering_dept_code as dept_code, d.dept_name FROM Course c LEFT JOIN Department d ON c.offering_dept_code = d.dept_code LEFT JOIN DegreeLevel dl ON c.degree_level_id = dl.level_id"));
app.get('/api/student', (req, res) => executeSQL(res, `SELECT s.student_id as id, s.name, s.id_card, s.dormitory, s.home_address, s.phone, DATE_FORMAT(s.birth_date, '%Y-%m-%d') as birth_date, s.gender, s.grade_year, s.major_id, s.minor_dept_code, s.degree_level_id, dl.level_name, s.earned_credits, m.major_name, d.dept_name as main_dept_name, d2.dept_name as minor_dept_name FROM Student s LEFT JOIN Major m ON s.major_id = m.major_id LEFT JOIN Department d ON m.dept_code = d.dept_code LEFT JOIN Department d2 ON s.minor_dept_code = d2.dept_code LEFT JOIN DegreeLevel dl ON s.degree_level_id = dl.level_id`));
app.get('/api/grade', (req, res) => executeSQL(res, "SELECT g.grade_id as id, g.student_id, g.course_id, g.score, g.semester, s.name as s_name, c.course_name as c_name FROM Grade g JOIN Student s ON g.student_id = s.student_id JOIN Course c ON g.course_id = c.course_id"));
app.get('/api/teacher_course', (req, res) => executeSQL(res, "SELECT tc.id, tc.teacher_id, tc.course_id, t.name as teacher_name, c.course_name FROM TeacherCourse tc JOIN Teacher t ON tc.teacher_id = t.teacher_id JOIN Course c ON tc.course_id = c.course_id"));

app.get('/api/stats', async (req, res) => {
    try {
        const stats = {};
        const [sRes] = await pool.query("SELECT COUNT(*) as c FROM Student"); stats.studentCount = sRes[0].c;
        const [cRes] = await pool.query("SELECT COUNT(*) as c FROM Course"); stats.courseCount = cRes[0].c;
        const [aRes] = await pool.query("SELECT AVG(score) as a FROM Grade"); stats.avgScore = aRes[0].a || 0;
        const [pRes] = await pool.query("SELECT (SUM(CASE WHEN score >= 60 THEN 1 ELSE 0 END) / COUNT(*)) * 100 as p FROM Grade"); stats.passRate = pRes[0].p || 0;
        res.json({ code: 200, data: stats });
    } catch (err) { res.status(500).json({ code: 500 }); }
});


// 学生与老师的数据接口 
app.get('/api/my/profile/:studentId', (req, res) => {
    const q = `
        SELECT s.student_id as id, s.name, s.id_card, s.dormitory, s.home_address, s.phone, 
               DATE_FORMAT(s.birth_date, '%Y-%m-%d') as birth_date, s.gender, s.grade_year, 
               dl.level_name, s.earned_credits, m.major_name, d.dept_name as main_dept_name 
        FROM Student s 
        LEFT JOIN Major m ON s.major_id = m.major_id 
        LEFT JOIN Department d ON m.dept_code = d.dept_code 
        LEFT JOIN DegreeLevel dl ON s.degree_level_id = dl.level_id
        WHERE s.student_id = ?`;
    executeSQL(res, q, [req.params.studentId]);
});

app.get('/api/my/grade/:studentId', (req, res) => {
    const q = `
        SELECT g.grade_id as id, g.semester, c.course_name as c_name, c.credits, g.score 
        FROM Grade g 
        JOIN Course c ON g.course_id = c.course_id
        WHERE g.student_id = ?`;
    executeSQL(res, q, [req.params.studentId]);
});

app.get('/api/my/course/:teacherId', (req, res) => {
    const q = `
        SELECT tc.id, c.course_id, c.course_name, c.credits, c.credit_hours 
        FROM TeacherCourse tc 
        JOIN Course c ON tc.course_id = c.course_id
        WHERE tc.teacher_id = ?`;
    executeSQL(res, q, [req.params.teacherId]);
});

app.get('/api/my/students/grade/:teacherId', (req, res) => {
    const q = `
        SELECT g.grade_id as id, g.student_id, s.name as s_name, g.course_id, c.course_name as c_name, g.score, g.semester
        FROM Grade g
        JOIN Student s ON g.student_id = s.student_id
        JOIN Course c ON g.course_id = c.course_id
        JOIN TeacherCourse tc ON c.course_id = tc.course_id
        WHERE tc.teacher_id = ?`;
    executeSQL(res, q, [req.params.teacherId]);
});


// 登录接口

app.post('/api/multi-login', async (req, res) => {
    const { username, password } = req.body;
    try {
        // 1. 验证管理员
        const [adminRows] = await pool.execute("SELECT username FROM Users WHERE username=? AND password=?", [username, password]);
        if (adminRows.length > 0) return res.json({ code: 200, data: { role: 'admin', userId: username } });

        // 2. 验证老师密码表
        const [teacherRows] = await pool.execute("SELECT teacher_id FROM TeacherPasswords WHERE teacher_id=? AND password=?", [username, password]);
        if (teacherRows.length > 0) return res.json({ code: 200, data: { role: 'teacher', userId: username } });

        // 3. 验证学生密码表
        const [studentRows] = await pool.execute("SELECT student_id FROM StudentPasswords WHERE student_id=? AND password=?", [username, password]);
        if (studentRows.length > 0) return res.json({ code: 200, data: { role: 'student', userId: username } });

        res.status(401).json({ code: 401, message: "账号或密码错误" });
    } catch (err) {
        res.status(500).json({ code: 500, message: err.message });
    }
});

// 注册接口 

app.post('/api/register', async (req, res) => {
    const { role, userId, name, password } = req.body;

    if (!role || !userId || !name || !password) {
        return res.status(400).json({ code: 400, message: "所有字段均为必填项" });
    }

    try {
        if (role === 'student') {
            // 1. 校验学生主表里是否存在该学号和姓名
            const [studentCheck] = await pool.execute(
                "SELECT student_id FROM Student WHERE student_id = ? AND name = ?", 
                [userId, name]
            );
            if (studentCheck.length === 0) {
                return res.status(400).json({ code: 400, message: "注册失败：学籍档案中未找到该学号与姓名匹配的记录，请联系管理员！" });
            }

            // 2. 校验是否已经注册过
            const [pwdCheck] = await pool.execute("SELECT student_id FROM StudentPasswords WHERE student_id = ?", [userId]);
            if (pwdCheck.length > 0) {
                return res.status(400).json({ code: 400, message: "该学号已经注册过账号，请直接登录！" });
            }

            // 3. 写入学生密码表
            await pool.execute("INSERT INTO StudentPasswords (student_id, password) VALUES (?, ?)", [userId, password]);
            return res.json({ code: 200, message: "学生账号注册成功！" });

        } else if (role === 'teacher') {
            // 1. 校验教师主表
            const [teacherCheck] = await pool.execute(
                "SELECT teacher_id FROM Teacher WHERE teacher_id = ? AND name = ?", 
                [userId, name]
            );
            if (teacherCheck.length === 0) {
                return res.status(400).json({ code: 400, message: "注册失败：教职工档案中未找到该工号与姓名匹配的记录！" });
            }

            // 2. 校验是否已注册
            const [pwdCheck] = await pool.execute("SELECT teacher_id FROM TeacherPasswords WHERE teacher_id = ?", [userId]);
            if (pwdCheck.length > 0) {
                return res.status(400).json({ code: 400, message: "该工号已经注册过账号，请直接登录！" });
            }

            // 3. 写入教师密码表
            await pool.execute("INSERT INTO TeacherPasswords (teacher_id, password) VALUES (?, ?)", [userId, password]);
            return res.json({ code: 200, message: "教师账号注册成功！" });
        }

        res.status(400).json({ code: 400, message: "无效的注册角色" });
    } catch (err) {
        res.status(500).json({ code: 500, message: "后端数据库报错: " + err.message });
    }
});

app.post('/api/login', (req, res) => {
    res.status(400).json({ message: "前端版本较新，请调取新复合端 /api/multi-login 进行多角色校验" });
});


// 表单提交与操作
// 输入检验
const validateData = (req, res, next) => {
    const { type } = req.params;
    const { action, data } = req.body;

    if (type === 'student') {
        if (!/^\d{17}[\dXx]$/.test(data.id_card)) return res.status(400).json({ code: 400, message: "错误：无效的身份证号码格式" });
        if (data.earned_credits < 0) return res.status(400).json({ code: 400, message: "错误：已修学分不能为负数" });
    }
    if (type === 'grade' && (data.score < 0 || data.score > 100)) {
        return res.status(400).json({ code: 400, message: "错误：分数必须在 0 到 100 之间" });
    }
    next();
};

app.post('/api/action/:type', validateData, async (req, res) => {
    const { type } = req.params;
    const { action, data } = req.body;
    // 空字符转换
    const formatEmpty = (val) => (val === '' || val === undefined) ? null : val;
    
    let q = ""; let params = [];

    if (type === 'department') {
        q = action === 'ADD' ? "INSERT INTO Department (dept_code, dept_name, office_location, phone) VALUES (?, ?, ?, ?)" : "UPDATE Department SET dept_name=?, office_location=?, phone=? WHERE dept_code=?";
        params = action === 'ADD' ? [data.code, data.name, data.location, data.phone] : [data.name, data.location, data.phone, data.code];
    } else if (type === 'major') {
        q = action === 'ADD' ? "INSERT INTO Major (major_name, dept_code) VALUES (?, ?)" : "UPDATE Major SET major_name=?, dept_code=? WHERE major_id=?";
        params = action === 'ADD' ? [data.name, data.dept_code] : [data.name, data.dept_code, data.id];
    } else if (type === 'student') {
        q = action === 'ADD' ? "INSERT INTO Student (student_id, name, id_card, dormitory, home_address, phone, birth_date, gender, grade_year, major_id, minor_dept_code, degree_level_id, earned_credits) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)" : "UPDATE Student SET name=?, id_card=?, dormitory=?, home_address=?, phone=?, birth_date=?, gender=?, grade_year=?, major_id=?, minor_dept_code=?, degree_level_id=?, earned_credits=? WHERE student_id=?";
        const minorDept = formatEmpty(data.minor_dept_code);
        params = action === 'ADD' ? [data.id, data.name, data.id_card, data.dormitory, data.home_address, data.phone, formatEmpty(data.birth_date), data.gender, formatEmpty(data.grade_year), formatEmpty(data.major_id), minorDept, formatEmpty(data.degree_level_id), formatEmpty(data.earned_credits)] : [data.name, data.id_card, data.dormitory, data.home_address, data.phone, formatEmpty(data.birth_date), data.gender, formatEmpty(data.grade_year), formatEmpty(data.major_id), minorDept, formatEmpty(data.degree_level_id), formatEmpty(data.earned_credits), data.id];
    } else if (type === 'course') {
        q = action === 'ADD' ? "INSERT INTO Course (course_id, course_name, description, credit_hours, credits, degree_level_id, offering_dept_code) VALUES (?, ?, ?, ?, ?, ?, ?)" : "UPDATE Course SET course_name=?, description=?, credit_hours=?, credits=?, degree_level_id=?, offering_dept_code=? WHERE course_id=?";
        params = action === 'ADD' ? [data.id, data.name, data.description, formatEmpty(data.credit_hours), formatEmpty(data.credits), formatEmpty(data.degree_level_id), formatEmpty(data.dept_code)] : [data.name, data.description, formatEmpty(data.credit_hours), formatEmpty(data.credits), formatEmpty(data.degree_level_id), formatEmpty(data.dept_code), data.id];
    } else if (type === 'teacher') {
        q = action === 'ADD' ? "INSERT INTO Teacher (teacher_id, name, dept_code) VALUES (?, ?, ?)" : "UPDATE Teacher SET name=?, dept_code=? WHERE teacher_id=?";
        params = action === 'ADD' ? [data.id, data.name, data.dept_code] : [data.name, data.dept_code, data.id];
    } else if (type === 'grade') {
        q = action === 'ADD' ? "INSERT INTO Grade (student_id, course_id, score, semester) VALUES (?, ?, ?, ?)" : "UPDATE Grade SET score=?, semester=? WHERE grade_id=?";
        params = action === 'ADD' ? [data.student_id, data.course_id, formatEmpty(data.score), data.semester] : [formatEmpty(data.score), data.semester, data.id];
    } else if (type === 'teacher_course') {
        q = "INSERT INTO TeacherCourse (teacher_id, course_id) VALUES (?, ?)";
        params = [data.teacher_id, data.course_id];
    }

    try {
        await pool.execute(q, params);
        res.json({ code: 200, message: "操作成功" });
    } catch (err) {
        res.status(500).json({ code: 500, message: err.message });
    }
});

app.delete('/api/:type/:id', async (req, res) => {
    const { type, id } = req.params;
    const map = { department:'dept_code', major:'major_id', student:'student_id', teacher:'teacher_id', course:'course_id', grade:'grade_id', teacher_course:'id' };
    let table = type === 'teacher_course' ? 'TeacherCourse' : type.charAt(0).toUpperCase() + type.slice(1);
    
    try {
        await pool.execute(`DELETE FROM ${table} WHERE ${map[type]} = ?`, [id]);
        res.json({ code: 200, message: "删除成功" });
    } catch (err) {
        res.status(500).json({ code: 500, message: err.message });
    }
});
app.get('/api/stats/detail', async (req, res) => {
    try {
        const [studentData] = await pool.query(`
            SELECT d.dept_name, COUNT(s.student_id) as count 
            FROM Department d 
            LEFT JOIN Major m ON d.dept_code = m.dept_code
            LEFT JOIN Student s ON m.major_id = s.major_id
            GROUP BY d.dept_name`);
            
        const [courseData] = await pool.query(`
            SELECT d.dept_name, COUNT(c.course_id) as count 
            FROM Department d 
            LEFT JOIN Course c ON d.dept_code = c.offering_dept_code
            GROUP BY d.dept_name`);
            
        res.json({ code: 200, data: { studentData, courseData } });
    } catch (err) { res.status(500).json({ code: 500 }); }
});

app.listen(3000, () => { console.log('后端已启动: http://localhost:3000'); });