import logger from './logger'
import dotenv from 'dotenv'

import polka from 'polka'
import cors from 'cors'
import { retrieveCalendar } from './calUtils'

const env: NodeJS.ProcessEnv = dotenv.config().parsed as any

const ICAL_URLS = env.ICAL_URLS?.split(",").filter(v => v)
if (!ICAL_URLS || ICAL_URLS.length === 0) {
    logger.fatal("No iCal links passed into ICAL_URLS env")
    process.exit(1)
}

const app = polka()
app.use(cors())

async function getData() {
    return Promise.all(ICAL_URLS.map(url => retrieveCalendar(url))).then(C => C.flat())
}

app.get("/public", async (req, res) => {
    return res.end(JSON.stringify({
        status: true,
        data: await getData()
            .then(r => r.map(evt => {
                if (/!wyd/i.test((<string>evt.description))) {
                    evt.location = ''
                    evt.summary = 'Hidden'
                    evt.description = ''
                    evt['private'] = true
                }

                return evt
            }))
    }))
})

app.get('/private', async (req, res) => {
    // TODO: do auth checks
    return res.end(JSON.stringify({
        status: true,
        data: await getData()
    }))
})

app.listen(8080, '0.0.0.0', async function () {
    const { address, port } = this.address()
    logger.info(`Server listening on ${address}:${port}`)

    logger.debug("Loading calendar data")
    getData()
})

