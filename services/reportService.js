const apiClient = require('../connectors/apiClient')


class reportService {
    constructor(db) {
        this.api = new apiClient()
        this.db = db
    }

    /**
     * Функция создает в БД запись с данными, которая будет отправлена в АПИ
     *
     * На входе:
     *    - Результаты звонков из RabbitMq
     *    Пример: [
     *    {
     *     call: {
     *       id: '5e7f21f3-724d-4a81-809a-a92b2a2c6b63',
     *       phone_number: '79232324693',
     *       init_time: '2023-09-04 10:24:27',
     *       start_time: '2023-09-04 10:24:41',
     *       end_time: '2023-09-04 10:25:21',
     *       whisper_end_time: null,
     *       connect_time: '2023-09-04 10:24:41',
     *       disconnect_time: '2023-09-04 10:25:23',
     *       answer_duration: 15,
     *       robot_duration: 41,
     *       whisper_duration: null,
     *       dial_result: null,
     *       status: 23,
     *       is_completed: 1,
     *       sip_login: 'wc_1101',
     *       sip_code: '200',
     *       sip_code_desc: 'Terminated',
     *       server_id: 61,
     *       project_id: 190,
     *       version: 166,
     *       parent_id: null,
     *       original_extension: null,
     *       forward_number: null,
     *       log_filename: '2023-09-04_10:24:26_OUT_1101.txt',
     *       out_vars: null,
     *       call_task_id: 134,
     *       run_id: 9406,
     *       run_item_id: 21572586,
     *       forward_type: null,
     *       total_blocks: null,
     *       ai_id: '0'
     *     },
     *     var_log: []
     *    }
     *  ]
     * @param calls {[]}
     * @return {Promise<void>}
     */
    async createReport (calls) {
        console.log('Creating reports')
        console.log('Received data size: ', calls.length)

        for (let call of calls) {
            const report = this.parseCall(call)

            if (!report) {
                console.log(`CANNOT PARSE CALL RESULT. FORWARD TO NEXT CALL`)
                continue
            }

            const isCallAlreadyHandled = await this.db.getReportByCallId(report.call_id).catch(e => {
                console.log(e)
                return null
            })

            if (!isCallAlreadyHandled) {
                continue
            }

            if (isCallAlreadyHandled.length) {
                console.log(`Report of call id ${report.call_id} is already handled. Forward to next call`)
                continue
            }

            if (await this.db.newReport(report)) {
                console.log('Report inserted to DB: ', report)
            }
        }

        console.log('Creating reports finished')
    }

    /*
     {
        call_id: ''
        report: {
          "id": "d8410b74-5a84-4cfb-9474-e3b25738890b",
          "url": "https://go.robotmia.ru/project/196?detalizationFilter=ca3fde02-d891-428dafc3-f1563f20636e&dateFrom=20.02.2024+00%3A00&dateTo=20.02.2024+23%3A59",
          "cargoIndex": "999959374029",
          "resultCall": "Окончен по сценарию",
          "dateOfCalling": "2024-02-20T14:15:19+03:00",
          "callingResult": "Оповещен получатель",
          "phone": "79106149888",
          "callType": "Уведомление получатель разгрузка"
          "businessType": "Юр.лицо"
        }
      }
     */
    parseCall (callResult) {
        console.log('Parsing call: ', callResult.call.id)
        const report = {}

        let callId = callResult.call.id
        const calldate = new Date(callResult.call.init_time).toISOString().slice(0, 10).replace(/(\d+)-(\d+)-(\d+)/, "$3.$2.$1")
        const callStatus = callResult.call
        const reportObject = {
            id: callId,
            url: `https://go.robotmia.ru/project/265?detalizationFilter=${callId}&dateFrom=${calldate}%3A00&dateTo=${calldate}%3A59`
        }

        // Порядок записей переменных в var_log order (Чем выше  - тем позже записано в var_log)
        const var_log = callResult.var_log.sort((a, b) => a.order - b.order)
        console.log('\n VAR_LOG: ', var_log.length)

        for (let variable of var_log) {
            // TODO: Parse call data
        }


        if (!reportObject) {
            console.log('No report formed')
            return null
        }


        console.log('REPORT OBJECT: ', reportObject)

        if (callResult.call.original_extension === 'mtt2') {
            console.log('TEST CALL FOUND')
            return null
        }

        report.call_id = callId
        report.report = JSON.stringify(survey)

        return report
    }

    /**
     * Функция отправки отчетов по звонкам из БД в АПИ клиента
     *
     * @return {Promise<void>}
     */
    async sendReports () {
        console.log('Sending reports')

        const reports = await this.db.getNotSentReports()

        if (!reports || !reports.length) {
            console.log('No reports to send')
            return
        }

        console.log(`Received ${reports.length} not sent reports`)

        for (let report of reports) {
            // Последнюю попытку совершать не раньше, чем через час
            if (report.counter >= 2 && report.last_request_at) {
                const lastRequestAt = new Date(report.last_request_at)

                const diffMinutes = (new Date(new Date().toISOString()) - lastRequestAt)/(1000*60)

                if (diffMinutes && diffMinutes < 60) {
                    console.log('REQUEST RETRY WILL BE SEND LATER. DIFF: ', diffMinutes)
                    continue
                }
            }

            const isSent = await this.sendOneReport(report)

            if (!isSent) {
                console.log('Report isnt sent:  ', isSent)
                continue
            }

            await this.db.excludeReport(report.call_id)
        }
    }

    async sendOneReport (report) {
        const isIncremented = await this.db.incrementRequestCounter(report)

        if (!isIncremented) {
            return false
        }

        const isReportSent = await this.api.sendReport(report.report)

        if (isReportSent[0] === null) {
            const error = isReportSent[1]
            await this.db.reportError(report, error)
        }

        return isReportSent[0]
    }
}

module.exports = reportService