declare namespace NodeJS {
    interface ProcessEnv {

        /**
         * Comma-separated list of ICS links
         */
        ICAL_URLS: string;

        /**
         * Should past events be hidden
         */
        HIDE_PAST: string;

    }
}

