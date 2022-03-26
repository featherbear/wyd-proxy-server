import dotenv from 'dotenv'
import bunyan from 'bunyan';
import polka from 'polka';
import ical, { CalendarComponent } from 'node-ical'
import moment from 'moment';
import cors from 'cors'
import { eventDataCleaner } from './util';
import type RRule from 'rrule'

const logger = bunyan.createLogger({
    name: "wyd proxy",
})

const env: NodeJS.ProcessEnv = dotenv.config().parsed as any

const ICAL_URLS = env.ICAL_URLS?.split(",").filter(v => v)
if (!ICAL_URLS || ICAL_URLS.length === 0) {
    logger.fatal("No iCal links passed into ICAL_URLS env")
    process.exit(1)
}

const HIDE_PAST = env.HIDE_PAST === 'true'

const cache: {
    [url: string]: {
        _promise?: Promise<ical.CalendarComponent[]>,
        data?: ical.CalendarComponent[],
        lastUpdate?: Date
    }
} = {}

function retrieveCalendar(url: string) {
    function makeRequest() {
        let currentTime = moment().startOf('day')

        let promise = ical.fromURL(url).then((data) => {
            let temp = Object.values(data).filter(({ type }) => type === 'VEVENT')

            temp = temp.flatMap((evt) => {
                let res = [evt]
                if (evt.rrule) {
                    let duration = moment(<Date>evt.end).diff(<Date>evt.start)

                    res.push(...(<RRule>evt.rrule).between(<Date>evt.start, moment(<Date>evt.end).add('1', 'year').toDate()).map(newStart => {
                        return {
                            ...evt,
                            start: newStart, end: moment(newStart).add(duration).toDate()
                        } as CalendarComponent
                    }))
                }

                return res.map(eventDataCleaner)
            })

            if (HIDE_PAST) temp = temp.filter(event => currentTime.isBefore(<Date>event.end))

            let responseData = temp.map(eventDataCleaner)
            Object.assign(cache[url], {
                _promise: null,
                data: responseData,
                lastUpdate: new Date()
            })

            return responseData
        })

        cache[url] = {
            _promise: promise
        }

        return promise;
    }

    if (!cache[url]) return makeRequest()
    if (cache[url].lastUpdate && moment().subtract('5', 'minutes').isAfter(cache[url].lastUpdate)) return makeRequest()

    return cache[url]._promise || cache[url].data;
}

const app = polka()
app.use(cors())

app.get("/", async (req, res) => {
    return res.end(JSON.stringify({
        status: true,
        data: await Promise.all(ICAL_URLS.map(url => retrieveCalendar(url))).then(C => C.flat())
    }, null, 4))
})

app.listen(8080, '0.0.0.0', async function () {
    const { address, port } = this.address()
    logger.info(`Server listening on ${address}:${port}`)

    logger.debug("Loading calendar data")
    ICAL_URLS.forEach(url => retrieveCalendar(url))

})

