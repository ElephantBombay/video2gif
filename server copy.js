const express = require("express");
const app = express();
const dotenv = require("dotenv");

const AWS = require("aws-sdk");

var ffmpeg = require("fluent-ffmpeg");
var ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
var ffprobePath = require("@ffprobe-installer/ffprobe").path;

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

dotenv.config();
// Use environment variables for security
const bucketName = process.env.BUCKET_NAME;
const bucketRegion = process.env.BUCKET_REGION;
const accessKey = process.env.ACCESS_KEY;
const secretAccessKey = process.env.SECRET_ACCESS_KEY;

// Configure AWS SDK
AWS.config.update({
  accessKeyId: accessKey,
  secretAccessKey: secretAccessKey,
  region: bucketRegion,
});

const s3 = new AWS.S3();

app.use(express.json());

app.post("/video2gif", (req, res) => {
  res.json({
    message: "GIF created",
  });

  try {
    const { url, start, duration, fps } = req.body;
    let inputDuration;

    if (url && start && duration && fps) {
      const passThroughStream = new (require("stream").PassThrough)();
      const params = {
        // Bucket: "vidfunnlz",
        Bucket: bucketName,
        Key: `${Date.now()}.gif`,
        Body: passThroughStream,
        ContentType: "image/gif",
      };

      /// Fetch input video duration
      ffmpeg.ffprobe(url, function (err, metadata) {
        if (err) {
          console.error("Error fetching video metadata:", err);
        } else {
          inputDuration = metadata.format.duration;
        }
      });

      s3.upload(params, function (err, data) {
        if (err) {
          console.log("Error uploading file to S3:", err);
          return res
            .status(500)
            .json({ message: "Failed to upload GIF", error: err });
        }
        console.log(`File uploaded successfully at ${data.Location}`);
        res.json({
          message: "GIF created",
          url: data.Location,
          input_duration: inputDuration,
        });
      });

      ffmpeg(url)
        .inputOptions([`-ss ${start}`]) // Add this line to set the start time directly in the input options
        .input("https://vidfunnlz.s3.amazonaws.com/statics/play-button.png")
        .input("https://vidfunnlz.s3.amazonaws.com/statics/play-button.png")
        .complexFilter([
          {
            inputs: "0:v",
            filter: "scale",
            options: "-1:300",
            outputs: "video",
          },
          {
            inputs: "1:v",
            filter: "scale",
            options: "75:75",
            outputs: "play",
          },
          {
            inputs: ["video", "play"],
            filter: "overlay",
            options: {
              x: "(main_w-overlay_w)/2", // Center horizontally
              y: "(main_h-overlay_h)/2", // Center vertically
            },
            // outputs: "video-play",
          },
          // {
          //   inputs: "video-play",
          //   filter: "drawtext",
          //   options: {
          //     text: `35 secs`,
          //     fontsize: 14,
          //     fontcolor: "white",
          //     fontfile:
          //       "https://vidfunnlz.s3.amazonaws.com/statics/OpenSans-Bold.ttf",
          //     x: 10, // 10 pixels from the left
          //     y: "(main_h-text_h-10)", // 10 pixels from the bottom
          //   },
          //   outputs: "video-play-text",
          // },
        ])

        .setDuration(duration)
        .fps(fps)
        .format("gif")
        .pipe(passThroughStream, { end: true });
    } else {
      res.status(400).json({ message: "invalid" });
    }
  } catch (error) {
    res.status(400).json({ message: error });
  }
});

app.listen(5000, () => {
  console.log("Server running on port 5000. Go to http://localhost:5000");
});

/// 1) Im trying to add a time duration to the left bottom corner of video. 3) Looking to increase quality video
