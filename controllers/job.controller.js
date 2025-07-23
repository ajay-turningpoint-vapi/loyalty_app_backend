import Job from '../models/jobs.model.js';
import { scheduleJob, stopJob } from '../jobs/scheduler.js';

export const createJob = async (req, res) => {
  try {
    // 1. Create the job first
    const job = await Job.create(req.body);

    // 2. Populate the promotionId (and videoPromotion if nested)
    const populatedJob = await Job.findById(job._id).populate({
      path: "promotionId",
      populate: {
        path: "videoPromotion", // Only if promotionId contains videoPromotion
      },
    });

    // 3. Schedule only after full population
    if (populatedJob.isActive) scheduleJob(populatedJob);

    res.status(201).json(populatedJob);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const updateJob = async (req, res) => {
  try {
    const job = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true });
    stopJob(job._id.toString());
    if (job.isActive) scheduleJob(job);
    res.json(job);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const deleteJob = async (req, res) => {
  try {
    await Job.findByIdAndDelete(req.params.id);
    stopJob(req.params.id);
    res.json({ message: 'Job deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const getAllJobs = async (req, res) => {
  const jobs = await Job.find();
  res.json(jobs);
};


export const getJobsByPromotionId = async (req, res) => {
  try {
    const { promotionId } = req.params;

    const jobs = await Job.find({ promotionId }).populate('promotionId');

    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const pauseJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });

    job.isActive = false;
    await job.save();
    stopJob(job._id.toString());

    res.json({ message: 'Job paused', job });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const resumeJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: 'Job not found' });

    job.isActive = true;
    await job.save();
    scheduleJob(job);

    res.json({ message: 'Job resumed', job });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
