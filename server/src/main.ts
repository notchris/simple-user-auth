import * as dotenv from "dotenv";
import express, { Application } from "express";
import cors from "cors";
import session from "express-session";
import { PrismaSessionStore } from "@quixo3/prisma-session-store";
import { v4 as uuidv4 } from "uuid";
import prisma from "./db";
import router from "./router";

dotenv.config();

/**
 * Setup application
 */
const app: Application = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: "http://localhost:5001",
    credentials: true,
  })
);

const sessionMiddleware = session({
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
  secret: process.env.SESSION_SECRET || uuidv4(),
  resave: false,
  saveUninitialized: false,
  store: new PrismaSessionStore(prisma, {
    checkPeriod: 2 * 60 * 1000,
    dbRecordIdIsSessionId: true,
    dbRecordIdFunction: undefined,
  }),
});

app.use(sessionMiddleware);
app.use("/", router);

const API_PORT = process.env.API_PORT;
app.listen(API_PORT, () => {
  console.log("Server listening on :" + API_PORT || 5001);
});
