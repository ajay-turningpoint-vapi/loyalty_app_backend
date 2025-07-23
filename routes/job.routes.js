import express from 'express';
import { createJob, deleteJob, getAllJobs, getJobsByPromotionId, pauseJob, resumeJob, updateJob } from '../controllers/job.controller';


const router = express.Router();

router.post('/', createJob);
router.get('/', getAllJobs);
router.put('/:id', updateJob);
router.delete('/:id', deleteJob);
router.patch('/:id/pause', pauseJob);
router.patch('/:id/resume', resumeJob);
router.get('/promotion/:promotionId', getJobsByPromotionId);

export default router;
