const mysql = require('mysql2');

class DatabaseUtils {
    constructor(pool) {
        this.pool = pool.promise(); // Use .promise() se você estiver usando o pool de promessas do mysql2
    }

    async select(tableName, columns = '*', conditions = '1', values = []) {
        const connection = await this.pool.getConnection();
        try {
            const [rows] = await connection.query(`SELECT ${columns} FROM ${tableName} WHERE ${conditions}`, values);
            connection.release();
            return rows;
        } catch (err) {
            connection.release();
            throw err;
        } finally {
            connection.release();
        }
    }

    async insert(tableName, data) {
        const connection = await this.pool.getConnection();
        try {
            const columns = Object.keys(data).join(', ');
            const values = Object.values(data).map(value => mysql.escape(value)).join(', ');
            const sql = `INSERT INTO ${tableName} (${columns}) VALUES (${values})`;
            const [result] = await connection.query(sql);
            connection.release();
            return result.insertId;
        } catch (err) {
            connection.release();
            throw err;
        } finally {
            connection.release();
        }
    }

    async update(tableName, data, conditions) {
        const connection = await this.pool.getConnection();
        try {
            const setClause = Object.entries(data).map(([key, value]) => `${key}=${mysql.escape(value)}`).join(', ');
            const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${conditions}`;
            const [result] = await connection.query(sql);
            connection.release();
            return result.affectedRows;
        } catch (err) {
            connection.release();
            throw err;
        } finally {
            connection.release();
        }
    }
    async delete(tableName, conditions) {
        const connection = await this.pool.getConnection();
        try {
            const sql = `DELETE FROM ${tableName} WHERE ${conditions}`
            const [result] = await connection.query(sql);
            connection.release();
            return result.affectedRows;
        } catch (err) {
            connection.release();
            throw err;
        } finally {
            connection.release();
        }
    }
}

module.exports = DatabaseUtils;