class collector {
    constructor(db, ch) {
        this.db = db
        this.ch = ch
    }

    async getCalls(){
        try {
            const startTime = Date.now()

            let chRuntime =  null
            let chVarlogRuntime = null
            let mysqlRuntime = null

            const chStartTime = Date.now()
            const callsFromCH = await this.ch.selectCallsBy30Minutes();

            chRuntime = Date.now() - chStartTime
            console.log("callsFromCH: ", callsFromCH.length);
            console.log(callsFromCH.slice(0, 5), '...');

            const mysqlStartTime = Date.now()
            console.log('getting calls from DB')
            const idSendingCalls = (await this.db.getCallsByLastHour());
            mysqlRuntime = Date.now() - mysqlStartTime
            console.log("idSendingCalls: ", idSendingCalls.length)
            console.log(idSendingCalls.slice(0,5), '...')

            const callsNotSending = callsFromCH.filter(call => !idSendingCalls.includes(call.id));
            console.log("callsNotSending");
            console.log(callsNotSending);

            const idNotSendingCalls = callsNotSending.map(call => call.id);
            console.log("idNotSendingCalls");
            console.log(idNotSendingCalls);

            const varLogStartTime = Date.now()
            console.log('Selecting var logs')
            const varLog = await this.ch.selectVarLogByIds(idNotSendingCalls);
            chVarlogRuntime = Date.now() - varLogStartTime
            console.log("varLog: ", varLog.length);
            console.log(varLog.slice(0, 5), '...');

            const parsedCalls = this.parse(callsNotSending, varLog);
            console.log("parsedCalls: ", parsedCalls.length);
            console.log(parsedCalls.slice(0,5));

            console.log('CH Runtime: ', chRuntime)
            console.log('CH VarLog Runtime: ', chVarlogRuntime)
            console.log('MySql Runtime: ', mysqlRuntime)
            console.log('Runtime: ', Date.now() - startTime)

            return parsedCalls
        } catch (e) {
            console.log('ERROR GETTING CALLS')
            console.log(e)
            return []
        }

    }

    parse(calls, varLog) {
        const parsedCalls = [];

        for (const call of calls) {
            const varLogCall = varLog.filter(variable => call.id === variable.call_id);

            const object = {
                call,
                var_log: varLogCall
            };

            parsedCalls.push(object);
        }

        return parsedCalls;
    }
}

module.exports = collector