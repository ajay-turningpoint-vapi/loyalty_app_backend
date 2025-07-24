

// const { Router } = require("express");
// const multer = require("multer");
// const multerS3 = require("multer-s3");
// const { v4: uuidv4 } = require("uuid");
// const { S3Client } = require("@aws-sdk/client-s3");
// const path = require("path");

// const router = Router();

// const s3Client = new S3Client({
//     region: process.env.AWS_REGION,
//     credentials: {
//         accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//         secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//     },
// });

// const upload = multer({
//     storage: multerS3({
//         s3: s3Client,
//         bucket: process.env.AWS_S3_INPUT_BUCKET,
//         key: (req, file, cb) => {
//             const fileExtension = path.extname(file.originalname);
//             const fileName = uuidv4() + fileExtension;
//             cb(null, fileName);
//         },
//     }),
//     limits: {
//         fileSize: 20 * 1024 * 1024, // 20 MB limit
//     },
// });

// router.post("/upload", (req, res, next) => {
//     if (req.file && req.file.size > 20 * 1024 * 1024) {
//         return res.status(400).json({ error: "File size exceeds the limit (20 MB)" });
//     }

//     upload.array("images")(req, res, (err) => {
//         if (err instanceof multer.MulterError) {
//             return res.status(400).json({ error: err.message });
//         } else if (err) {
//             return res.status(500).json({ error: "Internal Server Error" });
//         }

//         const fileUrls = req.files.map((file) => file.location); // Use the S3 returned URL
//         res.status(200).json(fileUrls);
//     });
// });

// module.exports = router;




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

dotenv.config();

const router = express.Router();

// Set ffmpeg and ffprobe binary paths
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

// AWS S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Multer in-memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // Max 20MB
  },
});

// Analyze video buffer: return height and bitrate in kbps
function analyzeVideo(buffer) {
  return new Promise((resolve, reject) => {
    const stream = new PassThrough();
    stream.end(buffer);

    ffmpeg(stream).ffprobe((err, metadata) => {
      if (err) return reject(err);

      const videoStream = metadata.streams.find((s) => s.codec_type === "video");
      if (!videoStream) return reject(new Error("No video stream found"));

      const height = videoStream.height || 0;
      const bitrate = parseInt(videoStream.bit_rate || metadata.format.bit_rate || "0", 10);

      resolve({
        height,
        bitrate: Math.floor(bitrate / 1000), // kbps
      });
    });
  });
}

// Upload route
router.post("/upload", upload.array("images"), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" });
    }

    const uploadedFiles = await Promise.all(
      req.files.map(async (file) => {
        let buffer = file.buffer;
        let mimeType = file.mimetype;
        let extension = path.extname(file.originalname).toLowerCase();
        const isImage = mimeType.startsWith("image/");
        const isVideo = mimeType.startsWith("video/");

        if (isVideo) {
          const { height, bitrate } = await analyzeVideo(buffer);

          if (height > 720) {
            throw new Error("Video resolution exceeds 720p");
          }

          if (bitrate > 4000) {
            throw new Error("Video bitrate exceeds 4000 kbps");
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
      })
    );

    res.status(200).json(uploadedFiles);
  } catch (err) {
    console.error("Upload error:", err.message || err);
    res.status(400).json({ error: err.message || "Failed to upload files" });
  }
});

module.exports = router;
