import express from 'express';
import { getCodeOfConductPublic } from '../controllers/codeOfConductController.js';

const router = express.Router();

// Public route for Code of Conduct
router.get('/code-of-conduct/public', getCodeOfConductPublic);
router.get('/code-of-conduct/public/:role', getCodeOfConductPublic);

export default router;
