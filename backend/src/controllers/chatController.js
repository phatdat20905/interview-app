import { chatClient } from "../lib/stream.js";

/**
 * Generate a Stream chat token for the authenticated user and send it with user metadata.
 *
 * Expects req.user to contain `clerkId`, `name`, and `image`; `clerkId` is used as the Stream user id
 * and must match the id configured in the Stream dashboard.
 *
 * @param {import('express').Request} req - Express request with `user` object: `{ clerkId, name, image }`.
 * @param {import('express').Response} res - Express response used to send the JSON payload or error status.
 */
export async function getStreamToken(req, res) {
  try {
    // use clerkId for Stream (not mongodb _id)=> it should match the id we have in the stream dashboard
    const token = chatClient.createToken(req.user.clerkId);

    res.status(200).json({
      token,
      userId: req.user.clerkId,
      userName: req.user.name,
      userImage: req.user.image,
    });
  } catch (error) {
    console.log("Error in getStreamToken controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}