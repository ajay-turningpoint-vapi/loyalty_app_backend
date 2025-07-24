// const { Router } = require("express");
// const multer = require("multer");
// const { v4: uuidv4 } = require("uuid");
// const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
// const path = require("path");
// const sharp = require("sharp");
// const mime = require("mime-types");

// const router = Router();

// const s3Client = new S3Client({
//   region: process.env.AWS_REGION,
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   },
// });

// const upload = multer({
//   storage: multer.memoryStorage(),
//   limits: {
//     fileSize: 20 * 1024 * 1024, // 20 MB
//   },
// });

// router.post("/upload", upload.array("images"), async (req, res) => {
//   try {
//     if (!req.files || req.files.length === 0) {
//       return res.status(400).json({ error: "No files uploaded" });
//     }

//     const uploadPromises = req.files.map(async (file) => {
//       let buffer = file.buffer;
//       let extension = path.extname(file.originalname).toLowerCase();
//       let mimeType = file.mimetype;
//       let isImage = mimeType.startsWith("image/");

//       let filename;
//       if (isImage) {
//         // Convert to WebP
//         buffer = await sharp(file.buffer).webp().toBuffer();
//         extension = ".webp";
//         mimeType = "image/webp";
//       }

//       filename = uuidv4() + extension;

//       const uploadParams = {
//         Bucket: process.env.AWS_S3_INPUT_BUCKET,
//         Key: filename,
//         Body: buffer,
//         ContentType: mimeType,
//       };

//       await s3Client.send(new PutObjectCommand(uploadParams));

//       const fileUrl = `https://${process.env.AWS_S3_INPUT_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${filename}`;
//       return fileUrl;
//     });

//     const uploadedFiles = await Promise.all(uploadPromises);
//     res.status(200).json(uploadedFiles);
//   } catch (err) {
//     console.error("Upload error:", err);
//     res.status(500).json({ error: "Failed to upload files" });
//   }
// });

// module.exports = router;

//latest code

// const express = require("express");
// const multer = require("multer");
// const sharp = require("sharp");
// const mime = require("mime-types");
// const path = require("path");
// const { v4: uuidv4 } = require("uuid");
// const dotenv = require("dotenv");
// const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
// const ffmpeg = require("fluent-ffmpeg");
// const ffmpegPath = require("ffmpeg-static");
// const ffprobePath = require("ffprobe-static").path;
// const { PassThrough } = require("stream");

// dotenv.config();

// const router = express.Router();

// // Set ffmpeg and ffprobe binary paths
// ffmpeg.setFfmpegPath(ffmpegPath);
// ffmpeg.setFfprobePath(ffprobePath);

// // AWS S3 Client
// const s3Client = new S3Client({
//   region: process.env.AWS_REGION,
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   },
// });

// // Multer in-memory storage
// const upload = multer({
//   storage: multer.memoryStorage(),
//   limits: {
//     fileSize: 20 * 1024 * 1024, // Max 20MB
//   },
// });

// // Analyze video buffer: return height and bitrate in kbps
// function analyzeVideo(buffer) {
//   return new Promise((resolve, reject) => {
//     const stream = new PassThrough();
//     stream.end(buffer);

//     ffmpeg(stream).ffprobe((err, metadata) => {
//       if (err) return reject(err);

//       const videoStream = metadata.streams.find((s) => s.codec_type === "video");
//       if (!videoStream) return reject(new Error("No video stream found"));

//       const height = videoStream.height || 0;
//       const bitrate = parseInt(videoStream.bit_rate || metadata.format.bit_rate || "0", 10);

//       resolve({
//         height,
//         bitrate: Math.floor(bitrate / 1000), // kbps
//       });
//     });
//   });
// }

// // Upload route
// router.post("/upload", upload.array("images"), async (req, res) => {
//   try {
//     if (!req.files || req.files.length === 0) {
//       return res.status(400).json({ error: "No files uploaded" });
//     }

//     const uploadedFiles = await Promise.all(
//       req.files.map(async (file) => {
//         let buffer = file.buffer;
//         let mimeType = file.mimetype;
//         let extension = path.extname(file.originalname).toLowerCase();
//         const isImage = mimeType.startsWith("image/");
//         const isVideo = mimeType.startsWith("video/");

//         if (isVideo) {
//           const { height, bitrate } = await analyzeVideo(buffer);

//           if (height > 720) {
//             throw new Error("Video resolution exceeds 720p");
//           }

//           if (bitrate > 4000) {
//             throw new Error("Video bitrate exceeds 4000 kbps");
//           }
//         }

//         if (isImage) {
//           buffer = await sharp(buffer).webp().toBuffer();
//           mimeType = "image/webp";
//           extension = ".webp";
//         }

//         const filename = uuidv4() + extension;

//         await s3Client.send(
//           new PutObjectCommand({
//             Bucket: process.env.AWS_S3_INPUT_BUCKET,
//             Key: filename,
//             Body: buffer,
//             ContentType: mimeType,
//           })
//         );

//         return `https://${process.env.AWS_S3_INPUT_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${filename}`;
//       })
//     );

//     res.status(200).json(uploadedFiles);
//   } catch (err) {
//     console.error("Upload error:", err.message || err);
//     res.status(400).json({ error: err.message || "Failed to upload files" });
//   }
// });

// module.exports = router;

//new version with video transcoding and analysis



const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const mime = require("mime-types");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const ffprobePath = require("ffprobe-static").path;
const { PassThrough } = require("stream");
const tmp = require("tmp-promise");
const fs = require("fs-extra");
const pMap = require("p-map").default;; 

dotenv.config();

const router = express.Router();
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
const allowedVideoTypes = ["video/mp4", "video/quicktime", "video/x-matroska"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

async function analyzeVideo(buffer) {
  return new Promise((resolve, reject) => {
    const stream = new PassThrough();
    stream.end(buffer);

    ffmpeg(stream)
      .ffprobe((err, metadata) => {
        if (err) return reject(err);
        const videoStream = metadata.streams.find((s) => s.codec_type === "video");
        if (!videoStream) return reject(new Error("No video stream found"));

        const height = videoStream.height || 0;
        const bitrate = parseInt(videoStream.bit_rate || metadata.format.bit_rate || "0", 10);
        resolve({ height, bitrate: Math.floor(bitrate / 1000) }); // kbps
      });
  });
}

async function transcodeVideo(buffer) {
  const { path: tmpInput, cleanup: cleanupInput } = await tmp.file({ postfix: ".mp4" });
  const { path: tmpOutput, cleanup: cleanupOutput } = await tmp.file({ postfix: ".mp4" });

  await fs.writeFile(tmpInput, buffer);

  return new Promise((resolve, reject) => {
    ffmpeg(tmpInput)
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions([
        "-preset veryfast", // fast encoding
        "-movflags +faststart", // streaming support
        "-profile:v baseline", // max compatibility
        "-level 3.1", // H.264 level for mobile
        "-pix_fmt yuv420p", // avoid weird playback issues
        "-r 30", // frame rate
        "-b:v 4000k", // video bitrate (target ~4 Mbps)
        "-maxrate 2500k", // cap bitrate spikes
        "-bufsize 4000k", // buffer size for bitrate control
      ])
      .size("?x720") // maintain aspect ratio, max height 720
      .format("mp4")
      .output(tmpOutput)
      .on("error", async (err) => {
        await cleanupInput();
        await cleanupOutput();
        reject(new Error("FFmpeg Error: " + err.message));
      })
      .on("end", async () => {
        const transcodedBuffer = await fs.readFile(tmpOutput);
        await cleanupInput();
        await cleanupOutput();
        resolve(transcodedBuffer);
      })
      .run();
  });
}


router.post("/upload", upload.array("images"), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const results = await pMap(
      req.files,
      async (file) => {
        const originalMimeType = file.mimetype;
        const isImage = allowedImageTypes.includes(originalMimeType);
        const isVideo = allowedVideoTypes.includes(originalMimeType);

        if (!isImage && !isVideo) {
          throw new Error(`Unsupported file type: ${originalMimeType}`);
        }

        let buffer = file.buffer;
        let mimeType = originalMimeType;
        let extension = path.extname(file.originalname).toLowerCase();

        if (isVideo) {
          const { height, bitrate } = await analyzeVideo(buffer);
          if (height > 720 || bitrate > 4000) {
            buffer = await transcodeVideo(buffer);
            mimeType = "video/mp4";
            extension = ".mp4";
          }
        }

        if (isImage) {
          buffer = await sharp(buffer).webp().toBuffer();
          mimeType = "image/webp";
          extension = ".webp";
        }

        const filename = uuidv4() + extension;

        await s3Client.send(
          new PutObjectCommand({
            Bucket: process.env.AWS_S3_INPUT_BUCKET,
            Key: filename,
            Body: buffer,
            ContentType: mimeType,
          })
        );

        return `https://${process.env.AWS_S3_INPUT_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${filename}`;
      },
      { concurrency: 3 } // Max 3 files processed in parallel
    );

    res.status(200).json(results);
  } catch (err) {
    console.log("Upload error:", err.message || err);
    
    res.status(400).json({ error: err.message || "Upload failed" });
  }
});

module.exports = router;
