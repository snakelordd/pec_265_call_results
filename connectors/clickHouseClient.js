class ClickHouse {
    #client;
    #defaultFormat = "JSONEachRow";

    #defaultUnit = "minute";
    #defaultTimeInterval = 30;

    #projectId = null;

    constructor(projectId) {
        const { createClient } = require("@clickhouse/client");
        this.#client = createClient({
            host: process.env.CLICKHOUSE_HOST,
            username: process.env.CLICKHOUSE_USER,
            database: process.env.CLICKHOUSE_DATABASE,
            password: process.env.CLICKHOUSE_PASSWORD,
        });

        this.#projectId = projectId;
    }

    async selectCallsBy30Minutes() {
        const query = `
            select
                id, phone_number,
                status, init_time,
                whisper_duration, whisper_end_time,
                original_extension
            from
                call
            where
                project_id = ${this.#projectId}
              and
                status not in (10, 22)
              and 
                init_time > timestamp_sub(${this.#defaultUnit}, ${this.#defaultTimeInterval}, now())                
        `;

        return await this.#sendQuery(query);
    }

    async selectVarLogByIds(ids) {
        const callIdsString = `'${ids.join("','")}'`

        const query = `
            select
                var_log.call_id,
                var_log.variable, var_log.value_new,
                var_log.datetime, var_log.order
            from
                var_log
            where
                project_id = ${this.#projectId}
              and
                call_id in (${callIdsString})                
        `;

        return await this.#sendQuery(query);
    }

    async #sendQuery(query) {
        const resultSet = await this.#client.query({
            query,
            format: this.#defaultFormat,
        });

        return await resultSet.json();
    }

    async close() {
        this.#client.close();
    }
}

module.exports = ClickHouse;