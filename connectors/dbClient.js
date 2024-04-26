const mysql = require('mysql2')

class dbClient {
    constructor() {
        this.user = process.env.DB_USER
        this.password = process.env.DB_PASSWORD
        this.db = process.env.DB_NAME
        this.host = process.env.DB_HOST

        if (!this.pool) {
            this.pool = this.#connect()
        }
    }

    #connect () {
        return mysql.createPool({
            host: this.host,
            user: this.user,
            password: this.password,
            database: this.db,
            multipleStatements: true,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 5000
        }).promise()
    }
    async newReport ({call_id, report}) {
        const query = `INSERT INTO reports
                              (call_id, report) VALUES ('${call_id}', '${(report)}')
        `
        try {
            const result = await this.pool.query(query)

            if (!result) {
                return false
            }

            console.log('INSERT DATA SUCCESSFUL')
            return true
        } catch (e) {
            console.log(e)
            return null
        }
    }

    /**
     * На выходе:
     *      Пример: [
     *          {
     *              call_id: '',
     *              is_sent: '',
     *              report: {}
     *          }
     *      ]
     * @return {Promise<*|*[]>}
     */
    async getReportByCallId (call_id) {
        const query = `
            SELECT * 
            FROM reports
            WHERE call_id = '${call_id}'
        `

        try {
            const result = await this.pool.query(query)

            if (result) {
                return result[0]
            } else {
                return []
            }
        } catch (e) {
            console.log('SELECTING DATA FAILED')
            return new Error(e)
        }
    }

    /**
     * На выходе:
     *      Пример: [
     *          {
     *              call_id: '',
     *              is_sent: '',
     *              report: {}
     *          }
     *      ]
     * @return {Promise<*|*[]>}
     */
    async getNotSentReports () {
        const query = `SELECT * 
                              FROM reports
                              WHERE is_sent = 0
                              AND counter < 3
        `

        try {
            const result = await this.pool.query(query)

            if (result && result[0]) {
                return result[0]
            } else {
                return []
            }
        } catch (e) {
            console.log('SELECTING DATA FAILED')
            console.log(e)
            return []
        }
    }
    async excludeReport (call_id){
        const query = `UPDATE reports
                              SET is_sent = 1
                              WHERE call_id = '${call_id}'
        `

        try {
            const result = await this.pool.query(query)

            if (!result) {
                return null
            }

            console.log('UPDATING DATA SUCCESSFUL')
            return true
        } catch (e) {
            console.log('UPDATING DATA FAILED')
            console.log(e)
            return null
        }
    }

    async reportError (report, error) {
        console.log('UPDATE report CAUSE error. call_id: ', report.call_id)

        const query = `
            UPDATE reports
            SET error = '${error}'
            WHERE call_id = '${report.call_id}'
        `

        try {
            return await this.pool.query(query)
        } catch (e) {
            console.log('ERROR REPORT FAILED')
            console.log(e)
            return null
        }
    }

    async incrementRequestCounter (report) {
        const query = `UPDATE reports
            SET counter = counter + 1
            WHERE call_id = '${report.call_id}'
        `

        try {
            return await this.pool.query(query)
        } catch (e) {
            console.log('INCREMENTING COUNTER FAILED')
            console.log(e)
            return null
        }
    }

    async getCallsByLastHour() {
        const query = `
            select
                call_id
            from
                reports
            where
                created > DATE_SUB(
                    now(),
                    INTERVAL 60 MINUTE
                )
        `;

        try {
            const result = await this.pool.query(query)
            return result[0]
        } catch (e) {
            console.log('GETTING CALLS FAILED')
            console.log(e)
            return null
        }
    }
}

module.exports = dbClient