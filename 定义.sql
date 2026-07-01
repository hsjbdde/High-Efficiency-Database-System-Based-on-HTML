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