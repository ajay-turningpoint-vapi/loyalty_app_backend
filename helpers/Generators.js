let QRCode = require("qrcode");
const fs = require("fs");
const archiver = require("archiver");
var path = require("path");
const location = path.join(__dirname, "..", "public", "qr");
import { customAlphabet } from "nanoid";
const nanoid = customAlphabet("1234567890", 10);

import CouponsModel from "../models/Coupons.model";

const generateCouponCode = async () => {
    let Couponintial = "TNP";
    let check = true;
    let couponCode = "";
    while (check) {
        let tempId = await nanoid();
        console.log(tempId);
        let tempCode = `${Couponintial}${tempId}`;
        let existCheck = await CouponsModel.findOne({ name: tempCode }).exec();
        if (!existCheck) {
            check = false;
            couponCode = tempCode;
        }
    }
    return couponCode;
};

const QrGenerator = async (couponId) => {
    const couponIdString = couponId.toString();
    let fileName = `/${new Date().getTime()}.png`;
    let locationVal = location + fileName;

    let qr = await QRCode.toFile(locationVal, couponIdString);
    return { locationVal, fileName };
};

const ZipGenerator = (locationArr) => {
    return new Promise((resolve, reject) => {
        try {
            // require modules

            // create a file to stream archive data to.

            let zipFileName = `/${new Date().getTime()}.zip`;
            let zipLocation = location + zipFileName;

            const output = fs.createWriteStream(zipLocation);
            const archive = archiver("zip", {
                zlib: { level: 9 }, // Sets the compression level.
            });

            // listen for all archive data to be written
            // 'close' event is fired only when a file descriptor is involved
            output.on("close", function () {
                console.log(archive.pointer() + " total bytes");
                console.log("archiver has been finalized and the output file descriptor has closed.");
                resolve({ zipFileName, zipLocation });
            });

            // This event is fired when the data source is drained no matter what was the data source.
            // It is not part of this library but rather from the NodeJS Stream API.
            // @see: https://nodejs.org/api/stream.html#stream_event_end
            output.on("end", function () {
                console.log("Data has been drained");
            });

            // good practice to catch warnings (ie stat failures and other non-blocking errors)
            archive.on("warning", function (err) {
                reject(err);

                if (err.code === "ENOENT") {
                    // log warning
                } else {
                    // throw error
                    // throw err;
                }
            });

            // good practice to catch this error explicitly
            archive.on("error", function (err) {
                reject(err);
            });

            // pipe archive data to the file
            archive.pipe(output);

            // append a file from stream
            for (const el of locationArr) {
                archive.append(fs.createReadStream(el), { name: `${el}`.split("/")[`${el}`.split("/").length - 1] });
            }

            archive.finalize();
        } catch (error) {
            reject(error);
        }
    });
};

const deleteFile = (url) => {
    fs.unlink(url, (err) => {
        if (err) {
            throw err;
        }
        console.log("File is deleted.");
    });
};

module.exports = { QrGenerator, ZipGenerator, deleteFile, generateCouponCode };
