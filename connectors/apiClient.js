const axios = require('axios')
const util = require('util')

/**
 * АПИ Клиент
 */
class apiClient {
    constructor() {
        this.url = process.env.API_URL

        this.axiosInstance = new axios.create()

        this.axiosInstance.interceptors.request.use(config => {
            config.maxBodyLength = Infinity
            config.headers = {
                "Content-Type": "application/json"
            }
            console.log('\nSENDING REQUEST. CONFIG: ',  config)
            return config
        }, err => {
            console.log('\nCANNOT USE INTERCEPTOR')
            throw new Error(err)
        })
    }

    async #sendRequest (config) {
        return this.axiosInstance(config).catch(err => {
            console.log('\n')
            if (err.response)
                if (err.response.data) {
                    console.log('ERROR RESPONSE.data:', util.inspect(err.response.data))
                } else {
                    console.log('ERROR RESPONSE: ', err.response)
                }

            else
                console.log('ERROR: ', err)

            throw new Error(err)
        })
    }

    /**
     * [ result | null, error]
     * @param data
     * @return {Promise<[ result : Object | null, error : String]>}
     */
    async sendReport (data) {
        const config = {
            url: this.url,
            method: 'post',
            data: data
        }

        return await this.#sendRequest(config).then(data => {
            if (data.status === 200 && data.data.isSuccess) {
                console.log('RESPONSE: ', data.data)
                return [data.data]
            } else {
                console.log('RESPONSE: ', util.inspect(data.data))
                return [null, JSON.stringify(data.data)]
            }
        }).catch(e => {
            return [null, e]
        })
    }
}

module.exports = apiClient