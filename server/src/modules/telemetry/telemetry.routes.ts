import {Router} from "express";
import { postTelemetry } from "./telemetry.controller.js";

const router = Router();

router.post("/", postTelemetry);

export default router;