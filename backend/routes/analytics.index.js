import express from 'express';
import { getTrendingSearches } from '../controllers/analyticsController.js';

const router = express.Router();

router.get('/trending-searches', getTrendingSearches);

export default router;
