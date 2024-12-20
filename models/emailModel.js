class EmailModel {
    static sendEmail(transporter, mailOptions) {
      return new Promise((resolve, reject) => {
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            reject(error);
          } else {
            resolve(info);
          }
        });
      });
    }
  }
  
  export default EmailModel;
  