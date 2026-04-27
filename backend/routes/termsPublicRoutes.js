import express from 'express';
import { getTermsPublic } from '../controllers/termsAndConditionController.js';

const router = express.Router();

// Public route for Terms and Conditions (Supports role parameter)
router.get('/terms/public', getTermsPublic);
router.get('/terms/public/:role', getTermsPublic);

export default router;
