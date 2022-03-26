import type { CalendarComponent } from "node-ical";

export function eventDataCleaner(evt: CalendarComponent) {
    let { start, end, description, location, summary } = evt

    return { start, end, description, location, summary } as CalendarComponent
}