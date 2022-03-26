import logger from './logger';

import type { CalendarComponent } from "node-ical";
import type RRule from 'rrule'
import ical from 'node-ical'

import moment from "moment";

export function eventDataCleaner(evt: CalendarComponent) {
    let { start, end, description, location, summary } = evt

    return { start, end, description, location, summary } as CalendarComponent
}


const cache: {
    [url: string]: {
        _promise?: Promise<CalendarComponent[]>,
        data?: CalendarComponent[],
        lastUpdate?: Date
    }
} = {}

export function retrieveCalendar(url: string) {
    function makeRequest() {

        let promise = ical.fromURL(url).then((data) => {
            let temp = Object.values(data).filter(({ type }) => type === 'VEVENT')
            let currentDay = moment().startOf('day')
            let monthFuture = currentDay.clone().add('1', 'month')

            temp = temp.flatMap((evt) => {
                let res = [evt]
                if (evt.rrule) {
                    let delta = moment(<Date>evt.end).diff(<Date>evt.start)

                    res.push(
                        ...(<RRule><unknown>evt.rrule).between(currentDay.toDate(), monthFuture.toDate())
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

            temp = temp.filter(event => currentDay.isBefore(<Date>event.end))
            temp = temp.filter(event => monthFuture.isAfter(<Date>event.start))

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