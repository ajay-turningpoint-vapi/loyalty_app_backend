import { customAlphabet } from "nanoid";
import User from "../models/user.model";
import axios from "axios";
const AWS = require("aws-sdk");
import { CONFIG } from "../helpers/Config";
const apiKey = CONFIG.API_KEY;
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
});
const sns = new AWS.SNS();

export const UserActiveSMS = async (req, res, next) => {
    try {
        const { name, phone } = req.body;
        const profileUrl = "http://api.turningpointvapi.com/Users-list";
        const params = {
            Message: `
Hello Admin,
            
A new user has registered on Turning Point App. 
Please verify and approve the profile. 

Name: ${name} Phone:  ${phone} 

You can view the user's profile here: ${profileUrl}

Thank you,
Turning Point Team`,

            TopicArn: process.env.SNS_TOPIC_ARN,
        };

        sns.publish(params, (err, data) => {
            if (err) {
                // res.status(500).send("Error sending SMS");
            } else {
                // res.status(200).send("User registered and SMS sent");
            }
        });
    } catch (err) {
        next(err);
    }
};

export const UserKycSMS = async (req, res, next) => {
    try {
        const { name, phone, _id } = req.body;
        const kycUrl = "http://api.turningpointvapi.com/Users-list";
        const params = {
            Message: `
Hello Admin,
            
A new user has submitted KYC for the Turning Point App. 
Please verify and approve. 

Name: ${name} Phone:  ${phone} 
       
You can view the KYC details here: ${kycUrl}

Thank you,
Turning Point Team`,

            TopicArn: process.env.SNS_TOPIC_ARN,
        };

        sns.publish(params, (err, data) => {
            if (err) {
                res.status(500).send("Error sending SMS");
            } else {
                res.status(200).send("User registered and SMS sent");
            }
        });
    } catch (err) {
        next(err);
    }
};

const nanoid = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 10);

export const generateUid = async () => {
    let check = true;
    while (check) {
        let tempUid = nanoid();
        let userObj = await User.findOne({ uid: tempUid }).exec();
        if (!userObj) {
            check = false;
            return tempUid;
        }
    }
};

export const randomNumberGenerator = () => {
    const values = [300, 400, 500, 600, 700, 800, 900, 1000];
    const randomIndex = Math.floor(Math.random() * values.length);
    return values[randomIndex];
};

export const generateRandomWord = (length) => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let randomWord = "TP" + "";
    for (let i = 0; i < length; i++) {
        randomWord += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return randomWord;
};

export async function sendWhatsAppMessage(templateName, to, body_1, body_2, body_3) {
    const payload = {
        integrated_number: "918200025803",
        content_type: "template",
        payload: {
            messaging_product: "whatsapp",
            type: "template",
            template: {
                name: templateName,
                language: {
                    code: "en",
                    policy: "deterministic",
                },
                namespace: null,
                to_and_components: [
                    {
                        to: [to],
                        components: {
                            body_1: {
                                type: "text",
                                value: body_1,
                            },
                            body_2: {
                                type: "text",
                                value: body_2,
                            },
                            body_3: {
                                type: "text",
                                value: body_3,
                            },
                        },
                    },
                ],
            },
        },
    };

    try {
        const response = await axios.post("https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/", payload, {
            headers: {
                authkey: `418451AzKt9qoMmlL664c674fP1`,
                "Content-Type": "application/json",
            },
        });

        return response.data;
    } catch (error) {
        console.error("Error sending WhatsApp message:", error);
    }
}

export async function sendWhatsAppMessageContestWinners(to, contestName, winnersList) {
    const payload = {
        integrated_number: "918200025803",
        content_type: "template",
        payload: {
            messaging_product: "whatsapp",
            type: "template",
            template: {
                name: "lucky_draw_winners",
                language: {
                    code: "en",
                    policy: "deterministic",
                },
                namespace: "19289588_241c_4c3e_ae9c_c7a527b1b4d2", // Replace with your namespace ID
                to_and_components: [
                    {
                        to: [`91${to}`], // Must be an array of phone numbers
                        components: {
                            body_1: {
                                type: "text",
                                value: "test", // Maps to {{1}}
                            },
                            body_2: {
                                type: "text",
                                value: "winnersList", // Maps to {{2}}
                            },
                        },
                    },
                ],
            },
        },
    };

    try {
        const response = await axios.post("https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/", payload, {
            headers: {
                authkey: "418451AzKt9qoMmlL664c674fP1", // Your authkey
                "Content-Type": "application/json",
            },
        });

        return response.data;
    } catch (error) {
        console.error("Error sending WhatsApp message:", error.response ? error.response.data : error.message);
        throw error; // Re-throw to handle errors upstream
    }
}

export async function sendWhatsAppMessageForBankTransfer(body_1, body_2, body_3, body_4, body_5, body_6) {
    const payload = {
        integrated_number: "918200025803",
        content_type: "template",
        payload: {
            messaging_product: "whatsapp",
            type: "template",
            template: {
                name: "banktransfer",
                language: {
                    code: "en",
                    policy: "deterministic",
                },
                namespace: null,
                to_and_components: [
                    {
                        to: ["918975944936"],
                        components: {
                            body_1: {
                                type: "text",
                                value: body_1,
                            },
                            body_2: {
                                type: "text",
                                value: body_2,
                            },
                            body_3: {
                                type: "text",
                                value: body_3,
                            },
                            body_4: {
                                type: "text",
                                value: body_4,
                            },
                            body_5: {
                                type: "text",
                                value: body_5,
                            },
                            body_6: {
                                type: "text",
                                value: body_6,
                            },
                        },
                    },
                ],
            },
        },
    };

    try {
        const response = await axios.post("https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/", payload, {
            headers: {
                authkey: `418451AzKt9qoMmlL664c674fP1`,
                "Content-Type": "application/json",
            },
        });

        return response.data;
    } catch (error) {
        console.error("Error sending WhatsApp message:", error);
    }
}

export async function sendWhatsAppMessageForUPITransfer(body_1, body_2, body_3) {
    const payload = {
        integrated_number: "918200025803",
        content_type: "template",
        payload: {
            messaging_product: "whatsapp",
            type: "template",
            template: {
                name: "upitransfer",
                language: {
                    code: "en",
                    policy: "deterministic",
                },
                namespace: null,
                to_and_components: [
                    {
                        to: ["918975944936"],
                        components: {
                            body_1: {
                                type: "text",
                                value: body_1,
                            },
                            body_2: {
                                type: "text",
                                value: body_2,
                            },
                            body_3: {
                                type: "text",
                                value: body_3,
                            },
                        },
                    },
                ],
            },
        },
    };

    try {
        const response = await axios.post("https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/", payload, {
            headers: {
                authkey: `418451AzKt9qoMmlL664c674fP1`,
                "Content-Type": "application/json",
            },
        });

        return response.data;
    } catch (error) {
        console.error("Error sending WhatsApp message:", error);
    }
}

export async function sendWhatsAppMessageForOTP(phone, otp) {
    const payload = {
        integrated_number: "918200025803",
        content_type: "template",
        payload: {
            messaging_product: "whatsapp",
            type: "template",
            template: {
                name: "optgeneration",
                language: {
                    code: "en",
                    policy: "deterministic",
                },
                namespace: null,
                to_and_components: [
                    {
                        to: [phone],
                        components: {
                            body_1: {
                                type: "text",
                                value: otp,
                            },
                            button_1: {
                                subtype: "url",
                                type: "text",
                                value: otp,
                            },
                        },
                    },
                ],
            },
        },
    };
    try {
        const response = await axios.post("https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/", payload, {
            headers: {
                authkey: `418451AzKt9qoMmlL664c674fP1`,
                "Content-Type": "application/json",
            },
        });
        return response.data;
    } catch (error) {
        console.error("Error sending WhatsApp message:", error);
    }
}

export async function sendWhatsAppMessageForSessionError() {
    const payload = {
        integrated_number: "918200025803",
        content_type: "template",
        payload: {
            messaging_product: "whatsapp",
            type: "template",
            template: {
                name: "whatsapp_failed_log",
                language: {
                    code: "en",
                    policy: "deterministic",
                },
                namespace: "19289588_241c_4c3e_ae9c_c7a527b1b4d2",
                to_and_components: [
                    {
                        to: [918975944936],
                        components: {},
                    },
                ],
            },
        },
    };
    try {
        const response = await axios.post("https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/", payload, {
            headers: {
                authkey: `418451AzKt9qoMmlL664c674fP1`,
                "Content-Type": "application/json",
            },
        });
        return response.data;
    } catch (error) {
        console.error("Error sending WhatsApp message:", error);
    }
}

export async function sendWhatsAppMessageProductRedeem(to, body_1, body_2, body_3, body_4, body_5, body_6) {
    console.log("to", to, body_1, body_2, body_3, body_4, body_5, body_6);

    const payload = {
        integrated_number: "918200025803",
        content_type: "template",
        payload: {
            messaging_product: "whatsapp",
            type: "template",
            template: {
                name: "diamondproduct",
                language: {
                    code: "en",
                    policy: "deterministic",
                },
                namespace: null,
                to_and_components: [
                    {
                        to: [to],
                        components: {
                            body_1: {
                                type: "text",
                                value: body_1,
                            },
                            body_2: {
                                type: "text",
                                value: body_2,
                            },
                            body_3: {
                                type: "text",
                                value: body_3,
                            },
                            body_4: {
                                type: "text",
                                value: body_4,
                            },
                            body_5: {
                                type: "text",
                                value: body_5,
                            },
                            body_6: {
                                type: "text",
                                value: body_6,
                            },
                        },
                    },
                ],
            },
        },
    };

    try {
        const response = await axios.post("https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/", payload, {
            headers: {
                authkey: `418451AzKt9qoMmlL664c674fP1`,
                "Content-Type": "application/json",
            },
        });

        return response.data;
    } catch (error) {
        console.error("Error sending WhatsApp message:", error);
    }
}

// export async function sendWhatsAppMessageForOTP(phone, otp) {
//     const payload = {
//         integrated_number: "918200025803", // Replace with your integrated number
//         content_type: "template",
//         payload: {
//             messaging_product: "whatsapp",
//             type: "template",
//             template: {
//                 name: "newotpgenerationloyapp", // Replace with your template name
//                 language: {
//                     code: "en_US", // Language and policy should match your template setup
//                     policy: "deterministic",
//                 },
//                 namespace: "19289588_241c_4c3e_ae9c_c7a527b1b4d2", // Replace with your template namespace
//                 to_and_components: [
//                     {
//                         to: [phone], // Recipient phone number(s) in international format
//                         components: {
//                             body_1: {
//                                 type: "text",
//                                 value: otp, // Dynamic value for the body_1 variable
//                             },
//                             button_1: {
//                                 subtype: "url",
//                                 type: "text",
//                                 value:otp, // Replace with your button URL or text
//                             },
//                         },
//                     },
//                 ],
//             },
//         },
//     };

//     try {
//         const response = await axios.post(
//             "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
//             payload,
//             {
//                 headers: {
//                     authkey: `418451AzKt9qoMmlL664c674fP1`, // Replace with your MSG91 API key
//                     "Content-Type": "application/json",
//                 },
//             }
//         );
//         return response.data;
//     } catch (error) {
//         console.error("Error sending WhatsApp message:", error.response?.data || error.message);
//         throw error; // Optionally, rethrow the error for further handling
//     }
// }
