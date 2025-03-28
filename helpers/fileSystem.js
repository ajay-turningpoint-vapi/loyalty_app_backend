import fs from "fs";

export const storeFileAndReturnNameBase64 = async (base64) => {
    let tempBase64 = base64.split(",");
    let extension = tempBase64[0].split("/")[1];
    let filename = new Date().getTime() + `.${extension.split(";")[0]}`;
    return new Promise((resolve, reject) => {
        fs.writeFile(`./public/uploads/${filename}`, tempBase64[1], "base64", (err) => {
            if (err) {
                console.error(err);
                reject(err);
            }
        
            resolve(filename);
        });
    });
};



