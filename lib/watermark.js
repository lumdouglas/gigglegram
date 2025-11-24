const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const fs = require('fs');

ffmpeg.setFfmpegPath(ffmpegPath);

async function addWatermark(inputVideoPath, outputVideoPath) {
  return new Promise((resolve, reject) => {
    const watermarkText = "GiggleGram.com ✨";
    const fontSize = 32;
    const opacity = 0.2;
    
    const drawtext = `drawtext=text='${watermarkText}':fontsize=${fontSize}:fontcolor=white@${opacity}:x=W-tw-20-abs(sin(n/30)*100):y=H-th-20-abs(cos(n/30)*50)`;

    ffmpeg(inputVideoPath)
      .videoFilters(drawtext)
      .outputOptions([
        '-codec:a copy',
        '-movflags +faststart'
      ])
      .output(outputVideoPath)
      .on('end', () => resolve(outputVideoPath))
      .on('error', (err) => reject(err))
      .run();
  });
}

module.exports = { addWatermark };