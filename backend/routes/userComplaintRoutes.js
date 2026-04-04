import express from 'express';
import {
  submitComplaint,
  getUserComplaints,
  getComplaintDetails
} from '../controllers/user.complaint.controller.js';

const router = express.Router();

router.post('/', submitComplaint);
router.get('/', getUserComplaints);
router.get('/:id', getComplaintDetails);

export default router;
