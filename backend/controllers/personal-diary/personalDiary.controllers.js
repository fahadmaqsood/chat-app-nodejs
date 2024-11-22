import { User } from "../../models/auth/user.models.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

import PersonalDiary from "../../models/personal-diary/PersonalDiary.js";

import moment from "moment"; // For easier date manipulation

import mongoose from "mongoose";



export const getEntries = async (req, res) => {
    try {
        const { limit, skip } = req.query;

        const entries = await PersonalDiary.find({
            user_id: req.user._id,
        })
            .sort({ createdAt: -1 })
            .skip(Number(skip || 0))
            .limit(Number(limit || 15))
            .select('title createdAt')
            .exec();

        return res.status(200).json(new ApiResponse(200, entries, "fetched successfully"));

    } catch (error) {
        console.error(error);
        res.status(500).json(new ApiResponse(500, {}, 'Server encountered an error'));
    }
};


export const getSpecificEntry = async (req, res) => {
    try {
        const { entry_id } = req.query;

        // Check if entry_id is provided
        if (!entry_id) {
            return res.status(400).json(new ApiResponse(400, {}, 'Entry ID is required'));
        }

        const entry = await PersonalDiary.findOne({
            user_id: req.user._id,
            _id: entry_id, // Find by entry_id (the _id of the entry)
        }).exec();


        // If the entry is not found
        if (!entry) {
            return res.status(404).json(new ApiResponse(404, {}, 'Entry not found'));
        }

        return res.status(200).json(new ApiResponse(200, entry, "fetched successfully"));

    } catch (error) {
        console.error(error);
        res.status(500).json(new ApiResponse(500, {}, 'Server encountered an error'));
    }
};



export const addEntry = async (req, res) => {
    try {
        const { title, content } = req.body;

        // Validate required fields
        if (!title || !content) {
            return res.status(400).json(new ApiResponse(400, {}, 'Title and content are required'));
        }

        // Create a new diary entry
        const newEntry = new PersonalDiary({
            user_id: req.user._id,  // Save the user ID of the logged-in user
            title: title,
            content: content,
        });

        // Save the entry to the database
        await newEntry.save();

        return res.status(201).json(new ApiResponse(201, newEntry, 'Entry added successfully'));

    } catch (error) {
        console.error(error);
        res.status(500).json(new ApiResponse(500, {}, 'Server encountered an error'));
    }
};




export const editEntry = async (req, res) => {
    try {
        const { entry_id, title, content } = req.body;

        // Validate required fields
        if (!title || !content) {
            return res.status(400).json(new ApiResponse(400, {}, 'Title and content are required'));
        }

        // Find the entry by entry_id and user_id
        const entry = await PersonalDiary.findOne({
            user_id: req.user._id,
            _id: entry_id,  // Search for the entry by _id and user_id
        });

        // If the entry does not exist
        if (!entry) {
            return res.status(404).json(new ApiResponse(404, {}, 'Entry not found'));
        }

        // Update the title and content of the entry
        entry.title = title;
        entry.content = content;
        entry.updatedAt = new Date();  // Update the 'updatedAt' timestamp

        // Save the updated entry
        await entry.save();

        return res.status(200).json(new ApiResponse(200, entry, 'Entry updated successfully'));

    } catch (error) {
        console.error(error);
        res.status(500).json(new ApiResponse(500, {}, 'Server encountered an error'));
    }
};
