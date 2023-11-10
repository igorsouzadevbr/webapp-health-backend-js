const mysql = require('mysql2');

class DatabaseUtils {
    constructor(pool) {
        this.pool = pool.promise(); // Use .promise() se você estiver usando o pool de promessas do mysql2
    }

    async select(tableName, columns = '*', conditions = '1', values = []) {
        const connection = await this.pool.getConnection();
        try {
            const [rows] = await connection.query(`SELECT ${columns} FROM ${tableName} WHERE ${conditions}`, values);
            return rows;
        } catch (err) {
            throw err;
        } finally {
            connection.release();
        }
    }

    async selectWithLimit(tableName, columns = '*', conditions = '1 = 1', values = [], limit = '', offset = '') {
        const connection = await this.pool.getConnection();
        try {
            let query = `SELECT ${columns} FROM ${tableName} WHERE ${conditions}`;
            if (limit) query += ` LIMIT ${limit}`;
            if (offset) query += ` OFFSET ${offset}`;
            console.log('Executando consulta:', query);

            const [rows] = await connection.query(query, values);
            return rows;
        } catch (err) {
            console.error('Erro na consulta SELECT:', err);
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
            return result.insertId;
        } catch (err) {
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
            return result.affectedRows;
        } catch (err) {
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
            return result.affectedRows;
        } catch (err) {
            throw err;
        } finally {
            connection.release();
        }
    }
    async rawQuery(sql, values = []) {
        const connection = await this.pool.getConnection();
        try {
            const [rows] = await connection.query(sql, values);
            return rows;
        } catch (err) {
            throw err;
        } finally {
            connection.release();
        }
    }
}

module.exports = DatabaseUtils;