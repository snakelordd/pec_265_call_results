require('dotenv').config()
const cron = require('node-cron')
const config = require('./config')
const reportService = require('./services/reportService')
const collectService = require('./services/collectResults')

const dbClient = require('./connectors/dbClient')
const ClickHouseClient = require("./connectors/clickHouseClient");


class App {
    constructor() {
        this.db = new dbClient()
        this.ch = new ClickHouseClient(process.env.MIA_PROJECT_ID)
        this.reporter = new reportService(this.db)
        this.collector = new collectService(this.db, this.ch)

        this.reporterProccesing = false
        this.collectorProcessing = false
    }
    async start() {
        console.log('Starting app')

        //console.log('Starting Rabbit subscriber')
        //rabbitService(this.reporter)

        console.log('Configuring collector task: ', config.crontab.collector)
        cron.schedule(config.crontab.collector, async () => {
            if (!this.collectorProcessing) {
                this.collectorProcessing = true
                console.log('Collector started')
                const calls = await this.collector.getCalls()
                await this.reporter.createReport(calls)

                this.collectorProcessing = false
            } else
                console.log('COLLECTOR ALREADY STARTED. WAITING FOR PREV LAUNCH WILL BE FINISHED')
        })

        if (process.env.SEND_REPORTS_ON === 'true') {
            console.log('Configuring reporter task: ', config.crontab.reporter)

            cron.schedule(config.crontab.reporter, async () => {
                if (!this.reporterProccesing) {
                    this.reporterProccesing = true
                    await this.reporter.sendReports()
                    this.reporterProccesing = false
                } else {
                    console.log('REPORTER ALREADY STARTED. WAITING FOR PREV LAUNCH WILL BE FINISHED')
                }
            })
        } else {
            console.log('\nATTENTION!')
            console.log('SENDING REPORTS TURNED OFF. SEE .env')
        }

    }
}

const app = new App()
app.start()