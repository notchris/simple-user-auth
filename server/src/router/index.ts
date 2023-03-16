import { Router } from "express";
import { router as userRouter } from "./user.router";

const router = Router();

router.use("/user", userRouter);

export default router;
