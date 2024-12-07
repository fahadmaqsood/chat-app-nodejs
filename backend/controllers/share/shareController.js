
import { User } from '../../models/auth/user.models.js'

import { ShareLinks } from '../../models/social/ShareLinks.js'

import { ApiResponse } from '../../utils/ApiResponse.js';

import mongoose from 'mongoose';


export const generateLink = async (req, res) => {
    try {

        const { type, data } = req.body;

        if (!type || !data) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const shareExists = await ShareLinks.exists({ type: type, data: data });
        if (shareExists) {
            res.status(200).json(new ApiResponse(201, newNotification, "link generated"));
        }



        res.status(201).json(new ApiResponse(201, newNotification, "Notification created successfully"));


    } catch (error) {
        console.error('Error processing message:', error);

        res.status(500).json(new ApiResponse(500, {}, error.message));

    }
}