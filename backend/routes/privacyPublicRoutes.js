import express from 'express';
import { getPrivacyPublic } from '../controllers/privacyPolicyController.js';

const router = express.Router();

// Public route for Privacy Policy (Supports role parameter)
router.get('/privacy/public', getPrivacyPublic);
router.get('/privacy/public/:role', getPrivacyPublic);

export default router;
