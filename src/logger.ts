import bunyan from 'bunyan';

const logger =  bunyan.createLogger({
    name: "wyd proxy",
    level: 'debug'
})

export default logger
