import express, { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt, { JwtPayload } from "jsonwebtoken";
import { User } from "../model/user.model";
import { Session } from "../model/token.model";
import FollowerModel from "../model/follower.model";
import { ProductionCompany } from "../model/production.model";
import VideoModel from "../model/video.model";

export const allUsers = (req: Request, res: Response): void => {
  try {
    const users = User.find({});
    res.status(200).json({ users });
  } catch (error: any) {
    res.status(500).json({ error: "Something Wend wrong !" });
  }
};

export const createUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, password, full_name } = req.body;

    // Check if user with provided email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ error: "User already exists" });
      return;
    }

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user with hashed password
    const newUser = await User.create({
      email,
      password: hashedPassword,
      full_name,
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser.id },
      process.env.JWT_SECRET || "demo",
      {
        expiresIn: "7d",
      }
    );

    // Create session
    const newSession = await Session.create({
      userId: newUser.id,
      accessToken: token,
    });

    if (newSession) {
      res.status(201).json({ accessToken: token, message: "User created" });
    } else {
      throw new Error("Failed to create session");
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      const productionCompany: any = await ProductionCompany.findOne({
        email,
      });
      if (!productionCompany) {
        res.status(404).json({ error: "User not found", code: 404 });
        return;
      }

      // Compare passwords
      const passwordMatch = await bcrypt.compare(
        password,
        productionCompany.password
      );

      if (!passwordMatch) {
        res.status(200).json({ error: "Invalid password", code: 401 });
        return;
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: productionCompany.id },
        process.env.JWT || "demo"
      );

      // Create session
      const newSession = await Session.create({
        userId: productionCompany.id,
        accessToken: token,
      });

      if (newSession) {
        res.status(200).json({
          user: productionCompany,
          accessToken: token,
          isProduction: true,
          code: 200,
        });
      } else {
        throw new Error("Failed to create session");
      }

      return;
    }

    // Compare passwords
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      res.status(200).json({ error: "Invalid password", code: 401 });
      return;
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || "demo",
      {
        expiresIn: "7d",
      }
    );

    // Create session
    const newSession = await Session.create({
      userId: user.id,
      accessToken: token,
    });

    if (newSession) {
      res.status(200).json({ user, accessToken: token, isProduction: false });
    } else {
      throw new Error("Failed to create session");
    }
  } catch (error: any) {
    res.status(500).json({ error: "somthings went wrong " });
  }
};

export const logoutUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.body;

    // Find session by userId
    const session = await Session.findOne({ userId });
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    // Delete session
    await Session.deleteOne({ userId });

    res.status(200).json({ message: "User logged out" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const followUser = async (req: any, res: Response): Promise<void> => {
  try {
    const { videoId } = req.body;
    const userId = req.userId;
    if (!userId) {
      res.status(400).json({ error: "User not found" });
      return;
    }

    if (!videoId) {
      res.status(400).json({ error: "Video not found" });
      return;
    }

    const exitingVideo: any = await VideoModel.findById(videoId);
    if (!exitingVideo) {
      res.status(400).json({ error: "Video not found" });
      return;
    }

    const FollowerVideo: any = await FollowerModel.find({
      videoId: videoId,
    });

    if (FollowerVideo.length === 0) {
      const newFollower = await FollowerModel.create({
        videoId: videoId,
        user_id: [userId],
        user: [userId],
      });
      await newFollower.save();

      exitingVideo.followerCount = FollowerVideo[0]?.user_id.length;
      await exitingVideo.save();
      res.status(200).json({ message: "Followed", newFollower });
      return;
    }

    if (FollowerVideo[0].user_id.includes(userId)) {
      // Already then remove id frin userid
      FollowerVideo[0].user_id = FollowerVideo[0].user_id.filter(
        (id: string) => id !== userId
      );
      await FollowerVideo[0].save();

      exitingVideo.followerCount = FollowerVideo[0].user_id.length;
      await exitingVideo.save();
      res.status(200).json({ message: "Unfollowed", FollowerVideo });
      return;
    }

    FollowerVideo[0].user_id.push(userId);
    await FollowerVideo[0].save();

    exitingVideo.followerCount = FollowerVideo[0].user_id.length;
    await exitingVideo.save();

    res.status(200).json({ message: "Followed", FollowerVideo });
  } catch (error: any) {
    console.log(error);

    res.status(500).json({ error: "Something went wrong!" });
  }
};

export const getFollowers = async (req: any, res: Response): Promise<void> => {
  try {
    const { video_id } = req.params;
    const followers = await FollowerModel.find({
      videoId: video_id,
    });

    const distinctFollowers = [
      ...new Set(followers.map((follower) => follower.user_id)),
    ];
    const count = distinctFollowers.length;

    res.status(200).json({ followers, count });
  } catch (error: any) {
    res.status(500).json({ error: "Something went wrong!" });
  }
};

export const getFollowerByUserId = async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const followers = await FollowerModel.find({
      user_id: userId,
    });

    if (followers.length === 0) {
      res.status(200).json({ followers, count: 0 });
      return;
    }

    const distinctFollowers = [
      ...new Set(followers.map((follower) => follower.user_id)),
    ];
    const count = distinctFollowers.length;

    res.status(200).json({ followers, count });
  } catch (error: any) {
    res.status(500).json({ error: "Something went wrong!" });
  }
};

export const getUserById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { user_id } = req.params;
    const user = await User.findById(user_id).populate("membershipId");
    if (!user) {
      const existingProductionCompany = await ProductionCompany.findById(
        user_id
      );

      if (!existingProductionCompany) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      res.status(200).json({ user: existingProductionCompany });
      return;
    }

    res.status(200).json({ user });
  } catch (error: any) {
    console.log(error, "error");
    res.status(500).json({ error: "Something went wrong!" });
  }
};

// PUT update a value for normal user profilePic and back pic
export const updateUser = async (req: any, res: Response): Promise<void> => {
  try {
    const { user_id } = req.params;
    const { full_name, description } = req.body;
    console.log(user_id);

    const accessToken = req.headers.authorization.split(" ")[1];

    const secret = process.env.JWT_SECRET || "demo";
    const decoded = jwt.verify(accessToken, secret) as JwtPayload;

    if (decoded.userId !== user_id) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const user = await User.findById(user_id);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (req.files["profilePic"]) {
      const profilePic = req.files["profilePic"][0].location;
      user.profilePic = profilePic;
    }

    if (req.files["backgroundPic"]) {
      const backgroundImage = req.files["backgroundPic"][0].location;
      user.backgroundPic = backgroundImage;
    }

    if (full_name) {
      user.full_name = full_name;
    }

    if (description) {
      user.description = description;
    }

    await user.save();
    res.status(200).json({ user });
  } catch (error: any) {
    console.log(error);

    res.status(500).json({ error: "Something went wrong!" });
  }
};

//  PRODUCTION LOGIN
export const CreateProductionCompany = async (req: any, res: Response) => {
  try {
    const logo = req.files["logo"][0].location;
    const exitingUser = await User.findOne({
      email: req.body.email,
    });

    if (exitingUser) {
      res.status(400).json({ error: "User already exists" });
      return;
    }

    const existingProductionCompany = await ProductionCompany.findOne({
      email: req.body.email,
    });

    if (existingProductionCompany) {
      res.status(400).json({ error: "User already exists" });
      return;
    }

    const password = await bcrypt.hash(req.body.password, 10);

    const newProductionCompany = await ProductionCompany.create({
      name: req.body.name,
      founderName: req.body.founderName,
      about: req.body.about,
      email: req.body.email,
      contactNumber: req.body.contactNumber,
      password: password,
      logo: logo,
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: newProductionCompany.id },
      process.env.JWT_SECRET || "demo",
      {
        expiresIn: "7d",
      }
    );

    // Create session
    const newSession = await Session.create({
      userId: newProductionCompany.id,
      accessToken: token,
    });

    if (newSession) {
      res.status(201).json({
        accessToken: token,
        message: "User created",
        userId: newProductionCompany.id,
      });
    } else {
      throw new Error("Failed to create session");
    }
  } catch (error: any) {
    console.log(error);
    res.status(500).json({ error: "Something went wrong!" });
  }
};

export const getProductCompany = async (req: Request, res: Response) => {
  try {
    const productionCompany = await ProductionCompany.find({});
    res.status(200).json({ productionCompany });
  } catch (error: any) {
    console.log(error);
    res.status(500).json({ error: "Something went wrong!" });
  }
};

// get by id
export const getProductionCompanyById = async (req: Request, res: Response) => {
  try {
    const productionCompany = await ProductionCompany.findById(
      req.params.user_id
    );
    res.status(200).json({ productionCompany });
  } catch (error: any) {
    console.log(error);
    res.status(500).json({ error: "Something went wrong!" });
  }
};

// PUT for upload and change production company logo or any other details
export const updateProductionCompany = async (req: any, res: Response) => {
  try {
    const productionCompany = await ProductionCompany.findById(req.userId);

    if (!productionCompany) {
      return res.status(404).json({ error: "Production company not found" });
    }

    // if (req.files["logo"]) {
    //   const logo = req.files["logo"][0].location;
    //   productionCompany.logo = logo;
    // }

    // if (req.files["backgroundImage"]) {
    //   const backgroundImage = req.files["backgroundImage"][0].location;
    //   productionCompany.backgroundImage = backgroundImage;
    // }

    if (req.body.name) {
      productionCompany.name = req.body.name;
    }

    if (req.body.founderName) {
      productionCompany.founderName = req.body.founderName;
    }

    if (req.body.about) {
      productionCompany.about = req.body.about;
    }

    if (req.body.email) {
      productionCompany.email = req.body.email;
    }

    if (req.body.contactNumber) {
      productionCompany.contactNumber = req.body.contactNumber;
    }

    if (req.body.password) {
      productionCompany.password = req.body.password;
    }

    if (req.body.socialMedia) {
      productionCompany.socialMedia = req.body.socialMedia;
    }

    await productionCompany.save();

    res.status(200).json({ productionCompany });
  } catch (error: any) {
    console.log(error);
    res.status(500).json({ error: "Something went wrong!" });
  }
};
