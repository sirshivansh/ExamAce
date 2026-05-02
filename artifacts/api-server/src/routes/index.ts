import { Router, type IRouter } from "express";
import healthRouter from "./health";
import analyzeRouter from "./analyze";
import generateAnswerRouter from "./generate-answer";

const router: IRouter = Router();

router.use(healthRouter);
router.use(analyzeRouter);
router.use(generateAnswerRouter);

export default router;
