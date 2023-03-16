import { Router } from "express";
import bcrypt from "bcryptjs";
import {
  UserCreateSchema,
  UserForgotPasswordSchema,
  UserLoginSchema,
  UserResetPasswordSchema,
} from "../schemas/user.schema";
import prisma from "../db";
import { User } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { ZodError } from "zod";
import nodemailer from "nodemailer";
import logger from "../logger";
import { v4 as uuidv4 } from "uuid";

declare module "express-session" {
  export interface SessionData {
    data: { [key: string]: any };
  }
}

const router = Router();

// Create
router.post("/create", async (req, res, next) => {
  logger.info("Create user request.");
  try {
    // Validate input
    const validate = UserCreateSchema.safeParse(req.body);
    // Invalid create user input
    if (!validate.success) {
      throw validate.error;
    }

    const { email, password, displayName } = req.body;

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    await prisma.user.create({
      data: {
        email,
        password: hash,
        displayName,
      },
    });

    // User created
    res.status(200).end();
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        logger.warn("Create user failed: Unique email constraint.");
        res.status(500).json("An account with this email already exists.");
      } else {
        logger.warn("Create user failed: Prisma error");
        res.status(500).json("Error while creating account");
      }
    } else if (error instanceof ZodError) {
      logger.warn("Create user input failed zod validation.");
      res.status(500).json(error.issues.map((e) => e.message));
    } else {
      logger.warn("Create user failed: Unknown error.");
      res.status(500).json("Unknown error");
    }
  }
});

// Login
router.post("/login", async (req, res, next) => {
  try {
    // Validate input
    const validate = UserLoginSchema.safeParse(req.body);
    // Invalid login input
    if (!validate.success) {
      throw validate.error;
    }

    const { email, password } = req.body;
    // Find User
    const getUser: User | null = await prisma.user.findUnique({
      where: {
        email: email,
      },
    });

    if (!getUser) {
      throw new Error("Invalid email or password.");
    }

    const validPassword = await bcrypt.compare(password, getUser.password);

    if (validPassword) {
      logger.info("User login.");
      req.session.data = {
        user: getUser.id,
      };
      req.session.save();
      // User logged in
      res.status(200).end();
    } else {
      res.status(500).json("Invalid email or password.");
    }
  } catch (error) {
    if (error instanceof ZodError) {
      logger.warn("Login user input failed zod validation.");
      res.status(500).json(error.issues.map((e) => e.message));
    } else {
      logger.error(error);
      res.status(500).json("An unknown error occured.");
    }
  }
});

// Forgot Password
router.post("/forgot-password", async (req, res, next) => {
  try {
    // Validate input
    const validate = UserForgotPasswordSchema.safeParse(req.body);
    // Invalid forgot password input
    if (!validate.success) {
      throw validate.error;
    }

    // Find user
    const findUserByEmail: User | null = await prisma.user.findUnique({
      where: {
        email: req.body.email,
      },
    });

    if (findUserByEmail) {
      const token = uuidv4();
      const updateUser = await prisma.user.update({
        where: {
          email: findUserByEmail.email,
        },
        data: {
          resetCode: token,
        },
      });
      if (updateUser) {
        logger.info(
          `Updated user forgot-password token: ${findUserByEmail.email}`
        );
        const transport = nodemailer.createTransport({
          service: process.env.SMTP_SERVICE,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
        const message = {
          from: process.env.SMTP_USER,
          to: findUserByEmail.email,
          subject: "notcorp - Forgot Password Request",
          text: `A request was made to reset your notcorp account password. Your token is: ${token}`,
        };
        await transport.sendMail(message);
        logger.info(`Email sent to ${findUserByEmail.email}.`);
      } else {
        logger.error(
          `Unable to send forgot-password token: ${findUserByEmail.email}.`
        );
        res.status(500).json({
          message: "Unable to send forgot-password token.",
        });
      }
    }
    res.status(200).json({
      message: "Sent forgot password email.",
    });
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      logger.error(error);
      res.status(500).json("An unknown error occured.");
    } else if (error instanceof ZodError) {
      logger.warn("Forgot password input failed zod validation.");
      res.status(500).json(error.issues.map((e) => e.message));
    } else {
      logger.error(error);
      res.status(500).json("An unknown error occured.");
    }
  }
});

router.get("/me", async (req, res) => {
  if (req.session.data?.user) {
    try {
      const user = await prisma.user.findUniqueOrThrow({
        select: {
          id: true,
          email: true,
          displayName: true,
          createdAt: true,
          role: true,
        },
        where: {
          id: req.session.data.user,
        },
      });
      logger.info(`Get user`);
      console.log(user);
      res.status(200).json(user);
    } catch (error) {
      /** Database error */
      if (error instanceof PrismaClientKnownRequestError) {
        logger.error(error);
        res.status(500).json("Invalid user.");
      } else {
        logger.error(error);
        res.status(500).json({
          message: "Unknown error.",
        });
      }
    }
  } else {
    res.status(500).json({
      message: "You are not logged in.",
    });
  }
});

// Reset Password
router.post("/reset-password", async (req, res) => {
  try {
    // Validate input
    const validate = UserResetPasswordSchema.safeParse(req.body);
    // Invalid reset password input
    if (!validate.success) {
      throw validate.error;
    }
    // Find user
    const getUser: User | null = await prisma.user.findUnique({
      where: {
        email: req.body.email,
      },
    });

    if (!getUser) {
      logger.warn("Could not find user to reset password.");
      throw new Error("Invalid reset request.");
    }

    if (getUser.resetCode === "") {
      throw new Error("Invalid reset request.");
    } else if (getUser.resetCode === req.body.key) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(req.body.password, salt);

      const updateUser = await prisma.user.update({
        where: {
          email: getUser.email,
        },
        data: {
          password: hash,
          resetCode: "",
        },
      });

      if (updateUser) {
        res.status(200).json({
          message: "Your password has been updated.",
        });
      } else {
        res.status(400).json({
          message: "Invalid reset request.",
        });
        logger.error(`Unable to reset password for user: ${getUser.email}`);
      }
    } else {
      throw new Error("Invalid reset request.");
    }
  } catch (error) {
    res.status(400);
    /** Database error */
    if (error instanceof PrismaClientKnownRequestError) {
      logger.error(error);
      res.json({
        message: "Unknown error.",
      });
      /** Validation error */
    } else if (error instanceof ZodError) {
      logger.warn("Reset password input failed zod validation.");
      res.status(500).json(error.issues.map((e) => e.message));
    } else {
      logger.error(error);
      res.json({
        message: "Unknown error.",
      });
    }
  }
});

// Logout
router.get("/logout", (req, res, next) => {
  if (!req.session.data?.user) {
    res.status(500).json("Session does not exist.");
  }
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json("Error destroying user session.");
    }
    res.status(200).end();
  });
});

export { router };
