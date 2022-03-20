import dotenv from 'dotenv'
import polka from 'polka';
import bunyan from 'bunyan';

const logger = bunyan.createLogger({
    name: "wyd proxy",

})

const env: NodeJS.ProcessEnv = dotenv.config().parsed as any

const ICAL_URLS = env.ICAL_URLS?.split(",").filter(v => v)
if (!ICAL_URLS || ICAL_URLS.length === 0) {
    logger.fatal("No iCal links passed into ICAL_URLS env")
    process.exit(1)
}

const app = polka()
app.listen(8080, '0.0.0.0', function () {
    const { address, port } = this.address()
    logger.info(`Server listening on ${address}:${port}`)
})