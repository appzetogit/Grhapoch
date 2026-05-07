import express from 'express';
import { getSupportPublic } from '../controllers/supportPageController.js';

const router = express.Router();

router.get('/', getSupportPublic);

export default router;
