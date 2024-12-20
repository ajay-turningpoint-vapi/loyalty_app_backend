import excel from "exceljs";
import contactMail from "../models/contactMail.model";
import { isValid, ValidateEmail } from "../helpers/Validators";
import QRCode from 'qrcode';
import qr  from "qr-image";

export const addMail = async(req, res, next) => {
    try {
        let found = await contactMail.find({ email: req.body.email }).lean().exec();
        console.log(found, "ppppp");
        if (found.length > 0) throw new Error('you already send mail');

        if (!req.body.name) throw new Error("name is mandatory");
        if (!isValid(req.body.name)) throw new Error('name cant be empty');
        req.body.name.trim();

        if (!req.body.email) throw new Error("email is mandatory");
        if (!ValidateEmail(req.body.email)) throw new Error('email invalid ,give valid email');

        const obj = {
            name: req.body.name,
            email: req.body.email,
            message: req.body.message,
        };
        let newMail = await new contactMail(obj).save();
        res.status(200).json({ message: "mail Successfully send", success: true });
    } catch (err) {
        next(err);
    }
};

export const getMail = async(req, res, next) => {
    try {
        let arr = await contactMail.find().lean().exec();
        res.status(200).json({ message: "getMail", data: arr, success: true });
    } catch (err) {
        next(err);
    }
};

export const deleteById = async(req, res, next) => {
    try {
        const obj = await contactMail.findByIdAndDelete(req.params.id).exec();
        if (!obj) throw { status: 400, message: "mail Not Found" };
        res.status(200).json({ message: "mail Deleted", success: true });
    } catch (err) {
        next(err);
    }
};

export const downloadQrCode = async(req, res, next) => {
    try {
        var code = qr.image(req.params.text, { type: 'png', ec_level: 'H', size: 10, margin: 0 });
        res.setHeader('Content-type', 'image/png')
        code.pipe(res);
    } catch (err) {
        next(err);
    }
};

// export const downloadQrCode = async(req, res, next) => {
//     try {
//         let data = JSON.stringify(req.params.text)
//             // Print the QR code to terminal
//         QRCode.toString(data, function(err, QRcode) {
//                 // Printing the generated code
//                 console.log(QRcode, "pppppp")
//                 res.send(QRCode)
//             })
//             // Converting into base64
//         QRCode.toDataURL(data, function(err, code) {
//             // Printing the code
//             console.log(code)
//         })

//     } catch (err) {
//         next(err);
//     }
// };


export const downloadExcelFile = async(req, res, next) => {
    try {
        let sheetData = [{
            id: "A1",
            title: "mr",
            name: "ramji",
            age: 20,
            published: true
        }];
        let workbook = new excel.Workbook();
        let worksheet = workbook.addWorksheet("excelSheet");
        worksheet.columns = [
            { header: "Id", key: "id", width: 5 },
            { header: "Title", key: "title", width: 25 },
            { header: "Name", key: "name", width: 25 },
            { header: "Age", key: "age", width: 10 },
            { header: "Published", key: "published", width: 10 },
        ];
        // Add Array Rows
        worksheet.addRows(sheetData);
        // res is a Stream object
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=" + "excelSheet.xlsx"
        );
        return workbook.xlsx.write(res).then(function() {
            res.status(200).end();
        });
    } catch (err) {
        next(err);
    }
};