import axios from "axios";
import NewContractor from "../models/newContractor.modal";

export const addNewContractor = async (req, res, next) => {
    try {
        const { phone, name } = req.body;
        if (!phone) {
            return res.status(400).json({ message: "Phone number is required" });
        }
        const existingContractor = await NewContractor.findOne({ phone });
        if (existingContractor) {
            return res.status(400).json({ message: "Phone number is already in use" });
        }
        const newContractor = await NewContractor.create({ phone, name });
        const message = encodeURIComponent(
            `Hello ${name},\n\nThank you for providing your name. We noticed that you're not registered with Turing Point App yet. Don't miss out on exclusive discounts, special offers, and exciting lucky draws available only for our registered customers!\n\nRegister now on the Turing Point App to enjoy these benefits and more:\n- Exclusive discounts on carpentry services\n- Special offers tailored just for you\n- Participate in our lucky draws for a chance to win exciting prizes\n- Stay updated on the latest promotions and events\n\nDownload Turing Point App today and register with your name to start saving and winning! Hurry, don't miss out on the opportunity!\n\nIf you have any questions or need assistance with registration, feel free to contact our customer support team at 8140470004.\n\nBest regards,\nTuring Point Team`
        );
        await axios.post(`http://wa.me/${phone}?text=${message}`);
        res.status(201).json({ message: "Contractor created successfully", data: newContractor });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const getNewContractor = async (req, res, next) => {
    try {
        const contractors = await NewContractor.find();
        res.status(200).json({ data: contractors });
    } catch (error) {
        console.error(error);
        next(error);
    }
};

export const updateNewContractorById = async (req, res, next) => {
    try {
        const contractorId = req.params.id;
        const { phone, name } = req.body;

        // Check if phone number is provided
        if (!phone) {
            return res.status(400).json({ message: "Phone number is required" });
        }

        // Check if the phone number is unique, excluding the current contractor
        const existingContractor = await NewContractor.findOne({ phone, _id: { $ne: contractorId } });
        if (existingContractor) {
            return res.status(400).json({ message: "Phone number is already in use" });
        }

        const updatedContractor = await NewContractor.findByIdAndUpdate(contractorId, { phone, name, isActive, role }, { new: true });
        res.status(200).json({ message: "Contractor updated successfully", data: updatedContractor });
    } catch (error) {
        console.error(error);
        next(error);
    }
};
export const deleteNewContractorById = async (req, res, next) => {
    try {
        const contractorId = req.params.id;

        // Check if the contractor exists
        const existingContractor = await NewContractor.findById(contractorId);
        if (!existingContractor) {
            return res.status(404).json({ message: "Contractor not found" });
        }

        const deletedContractor = await NewContractor.findByIdAndDelete(contractorId);
        res.status(200).json({ message: "Contractor deleted successfully", data: deletedContractor });
    } catch (error) {
        console.error(error);
        next(error);
    }
};
