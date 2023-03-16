import winston from "winston";

const colors = {
  error: "red",
  warn: "yellow",
  info: "blue",
};

winston.addColors(colors);

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.json(),
    winston.format.simple()
  ),
  transports: [new winston.transports.Console()],
});

export default logger;
