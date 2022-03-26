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
    level: 'debug'
})

const env: NodeJS.ProcessEnv = dotenv.config().parsed as any

const ICAL_URLS = env.ICAL_URLS?.split(",").filter(v => v)
if (!ICAL_URLS || ICAL_URLS.length === 0) {
    logger.fatal("No iCal links passed into ICAL_URLS env")
    process.exit(1)
}

const cache: {
    [url: string]: {
        _promise?: Promise<ical.CalendarComponent[]>,
        data?: ical.CalendarComponent[],
        lastUpdate?: Date
    }
} = {}

function retrieveCalendar(url: string) {
    function makeRequest() {

        let promise = ical.fromURL(url).then((data) => {
            let temp = Object.values(data).filter(({ type }) => type === 'VEVENT')
            let currentTime = moment().startOf('day')
            let monthFuture = currentTime.clone().add('1', 'month')

            temp = temp.flatMap((evt) => {
                let res = [evt]
                if (evt.rrule) {
                    let delta = moment(<Date>evt.end).diff(<Date>evt.start)

                    res.push(
                        ...(<RRule>evt.rrule).between(currentTime.toDate(), monthFuture.toDate())
                            .map(newStart =>
                            (<CalendarComponent>{
                                ...evt,
                                start: newStart,
                                end: moment(newStart).add(delta).toDate()
                            }))
                    )
                }

                return res.map(eventDataCleaner)
            })

            temp = temp.filter(event => currentTime.isBefore(<Date>event.end))

            let responseData = temp.map(eventDataCleaner)
            responseData = responseData.sort((a, b) => (<any>a.start - <any>b.start))

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

    if (!cache[url]) {
        logger.debug("Requesting initial data")
        return makeRequest()
    }

    if (cache[url].lastUpdate && moment().subtract('5', 'minutes').isAfter(cache[url].lastUpdate)) {
        logger.debug("Requesting updated data")
        return makeRequest()
    }

    if (cache[url].data) {
        logger.debug("Returning cached result")
        return cache[url].data
    }

    logger.debug("Returning promise")
    return cache[url]._promise
}

const app = polka()
app.use(cors())

app.get("/", async (req, res) => {
    return res.end(JSON.stringify({
        status: true,
        data: await Promise.all(ICAL_URLS.map(url => retrieveCalendar(url))).then(C => C.flat())
    }))
})

app.listen(8080, '0.0.0.0', async function () {
    const { address, port } = this.address()
    logger.info(`Server listening on ${address}:${port}`)

    logger.debug("Loading calendar data")
    ICAL_URLS.forEach(url => retrieveCalendar(url))

})

