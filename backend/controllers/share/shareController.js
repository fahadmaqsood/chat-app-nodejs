
import { User } from '../../models/auth/user.models.js'

import ShareLinks from '../../models/social/ShareLinks.js'

import { ApiResponse } from '../../utils/ApiResponse.js';

import mongoose from 'mongoose';


export const generateLink = async (req, res) => {
    try {

        const { data } = req.body;

        if (!data) {
            return res.status(400).json({ success: false, message: 'Missing required field "data"' });
        }

        const shareExists = await ShareLinks.exists({ data: data });
        if (shareExists) {
            res.status(200).json(new ApiResponse(201, { "linkSuffix": shareExists._id }, "link generated"));
        }



        // If it doesn't exist, create a new entry
        const newShareLink = new ShareLinks({ data });
        await newShareLink.save();

        // Return the _id of the new entry
        res.status(201).json(new ApiResponse(201, { "linkSuffix": newShareLink._id }, "Link generated successfully"));

    } catch (error) {
        console.error('Error processing message:', error);

        res.status(500).json(new ApiResponse(500, {}, error.message));

    }
}


export const resolveLink = async (linkSuffix) => {
    try {
        if (!linkSuffix) {
            return res.status(400).json({ success: false, message: 'Missing required field "linkSuffix"' });
        }

        const shareExists = await ShareLinks.findById(linkSuffix);
        if (shareExists) {
            return shareExists.data;
        }


        return null;

    } catch (error) {
        console.log(error);
        return null;
    }
};